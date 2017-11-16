"""A list of classes supporting historical statistics API"""
from pmp.api.utils import utils as apiutils
from pmp.api.models import esadapter
import simplejson as json
import time
import re

class HistoricalAPI(esadapter.InitConnection):
    """Used to return list of points for historical plots"""

    def __init__(self):
        esadapter.InitConnection.__init__(self)
        self.campaign = True

    def accumulate_requests(self, data):
        """Make sure same request workflows add only probes"""
        accumulate = {}
        for request_details in data:
            request = request_details['request']
            if request not in accumulate:
                accumulate[request] = dict()
                accumulate[request]['data'] = []
            accumulate[request]['data'] += request_details['data']
            accumulate[request]['data'] = sorted(accumulate[request]['data'],
                                                 key=lambda i: i['t'])
            accumulate[request]['data'] = self.rm_useless(
                accumulate[request]['data'])
        return accumulate

    @staticmethod
    def add_data_points(data, times):
        """Add points to response"""
        points = []
        for ftime in times:
            point = {'d': 0, 'e': 0, 't': ftime, 'x': 0}
            for key in data:
                prevx = {'d': 0, 'e': 0, 'x': 0}
                for (i, details) in enumerate(data[key]['data']):
                    if details['t'] > ftime:
                        point['d'] += prevx['d']
                        point['e'] += prevx['e']
                        point['x'] += prevx['x']
                        break
                    elif details['t'] == ftime or \
                            i == len(data[key]['data'])-1:
                        point['d'] += details['d']
                        point['e'] += details['e']
                        point['x'] += details['x']
                        break
                    else:
                        prevx = details
            points.append(point)
        return points

    @staticmethod
    def append_data_point(data):
        """Duplicate last probe with current timestamp"""
        if len(data):
            duplicated = {'d': data[-1]['d'], 'e': data[-1]['e'],
                          'x': data[-1]['x'],
                          't': int(round(time.time() * 1000))}
            data.append(duplicated)
        return data

    @staticmethod
    def check_dataset(output_dataset, doc):
        """Check for secondary datasets - True if they exist, False otherwise"""
        if doc is None:
            return False
        if doc['pdmv_dataset_name'] != output_dataset and \
                'pdmv_monitor_datasets' in doc:
            if output_dataset in [i['dataset'] for i \
                                      in doc['pdmv_monitor_datasets']]:
                return True
        return False

    def is_instance(self, prepid, typeof, index):
        """Checks if prepid matches any typeof in the index"""
        try:
            self.es.get(index, typeof, prepid)['_source']
        except esadapter.pyelasticsearch.exceptions.ElasticHttpNotFoundError:
            return False
        return True

    def parse_query(self, query):
        """Returns parsed query and correct field"""
        if self.is_instance(query, 'flow', 'flows'):
            return 'flown_with', query, False
        elif self.is_instance(query, 'campaign', 'campaigns'):
            return 'member_of_campaign', query, False
        elif self.is_instance(query, 'processing_string', 'processing_strings'):
            return 'member_of_campaign', query, True
        elif self.is_instance(query, 'request', 'requests'):
            return None, query, False
        elif self.is_instance(query, 'rereco_request', 'rereco_requests'):
            return None, query, True
        return None, query, False

    def db_query(self, query):
        """Query DB and return array of raw documents"""
        iterable = []
        req_arr = []
        field, query, is_rereco = self.parse_query(query)
        doctype, index = ('rereco_request', 'rereco_requests') if is_rereco \
            else ('request', 'requests')

        if field is not None:
            # try to query for campaign and get list of requests
            req_arr = [s['_source'] for s in
                self.es.search(('%s:%s' % (field, query)), index=index,
                    size=self.overflow)['hits']['hits']]
        else:
            # could be a request or a workflow
            self.campaign = False
            try:
                req_arr = [self.es.get(index, doctype, query)['_source']]
            except esadapter.pyelasticsearch.exceptions.ElasticHttpNotFoundError:
                # if exception thrown this may be a workflow
                iterable = [query]

        # iterate over array and collect details
        for req in req_arr:
            try:
                dataset_list = req['output_dataset']
                if len(dataset_list):
                    dataset = dataset_list[0]
                else:
                    dataset = None

                # Include a blank one in case there are no workflows. We still want expected events
                if not len(req['reqmgr_name']):
                    req['reqmgr_name'] = [None]

                for reqmgr in req['reqmgr_name']:
                    i = {}
                    i['expected'] = req['total_events']
                    i['name'] = reqmgr
                    i['prepid'] = req['prepid']
                    i['output_dataset'] = dataset
                    i['priority'] = req['priority']
                    i['pwg'] = req.get('pwg', 'None') # for ReReco support
                    i['request'] = True
                    i['status'] = req['status']
                    i['done_time'] = 0 # default, see next step

                    # Get time of first transition to "submitted"
                    for item in req['history']:
                        if item['action'] == 'submitted':
                            i['submitted_time'] = self.parse_request_history_time(item['time'])
                            break

                    # Get the time of the *last* transition to status "done"
                    for item in reversed(req['history']):
                        if item['action'] == 'done':
                            i['done_time'] = self.parse_request_history_time(item['time'])
                            break

                    iterable.append(i)
            except KeyError:
                pass

        # iterate over workflows and yield documents
        for i in iterable:
            if 'request' in i:
                if i['name'] is None:
                    yield [True, None, i]
                else:
                    try:
                        yield [i['request'],
                               self.es.get('stats', 'stats', i['name'])
                               ['_source'], i]
                    except esadapter.pyelasticsearch.exceptions\
                            .ElasticHttpNotFoundError:
                        yield [True, None, i]
            else:
                try:
                    yield [False,
                           self.es.get('stats', 'stats', i)
                           ['_source'], None]
                except esadapter.pyelasticsearch.exceptions\
                        .ElasticHttpNotFoundError:
                    yield [False, None, None]

    def parse_probe(self, request, monitor, details, expected):
        """Parse input and return fixed data points"""
        data = dict()

        # If there is an output dataset...
        if ((details is None or 
            (details['output_dataset'] is not None
             and len(details['output_dataset']))) and
            'pdmv_evts_in_DAS' in monitor):
            data['e'] = (monitor['pdmv_evts_in_DAS'] +
                         monitor['pdmv_open_evts_in_DAS'])
        else: # no dataset
            data['e'] = 0

        data['d'] = 0 # default - fixed later if conditions apply

        # get timestamp, if field is empty set 1/1/2013
        if len(monitor['pdmv_monitor_time']):
            if monitor['pdmv_monitor_time'] == "FLAG":
                data['t'] = int(round(time.time() * 1000))
            else:
                data['t'] = self.parse_time(monitor['pdmv_monitor_time'])
        else:
            data['t'] = self.parse_time("Tue Jan 1 00:00:00 2013")
        if request:
            data['x'] = details['expected']
        else:
            data['x'] = expected
        return data

    def get_data_points(self, monitor_history, is_request, details, expected):
        """Parse a monitor history and return data points, accounting for done requests with no
        probes after their final transition
        """
        data = []

        probe_after_done = False
        for record in monitor_history:
            probe = self.parse_probe(is_request, record, details, expected)

            if details is None or (details['status'] == 'done' and
                probe['t'] > details['done_time']):
                probe_after_done = True
                probe['d'] = probe['e']

            data.append(probe)

        # Check that the most recent probe is after transition (if request is done) and fix if not
        # Gets 'done' value from the most recent evts_in_DAS value, as it did before this change
        if not probe_after_done and details['status'] == 'done':
            data.insert(0, {'e': data[0]['e'], 'd': data[0]['e'], 't': details['done_time'],
                'x': data[0]['x']})

        return data

    @staticmethod
    def get_filter_dict(doc, arr, inp):
        """Generate filter dictionary"""
        if doc not in arr:
            arr[doc] = False
            if inp is None:
                arr[doc] = True
            else:
                for i in inp:
                    if i == doc:
                        arr[doc] = True
                        break
        return arr

    @staticmethod
    def filtering(details, pwg_i, status_i, priority):
        """Returns boolean if request should be filtered"""
        # pwg filtering
        if not (pwg_i is None or details['pwg'] in pwg_i):
            return True
        # status filtering
        if not (status_i is None or details['status'] in status_i):
            return True
        # filter out invalidated 'new'
        if details['status'] not in ['done', 'submitted']:
            return True
        # priority filtering
        if details['priority'] < priority[0] or \
                (details['priority'] > priority[1] and priority[1] != -1):
            return True
        return False

    @staticmethod
    def parse_time(string_time):
        """Parse time in a "Tue Jan 1 00:00:00 2013" format to integer"""
        return time.mktime(time.strptime(string_time))*1000

    @staticmethod
    def parse_request_history_time(string_time):
        """Parse time in a "2013-12-01-00-00" format to an integer as above"""
        return time.mktime(time.strptime(string_time, '%Y-%m-%d-%H-%M'))*1000

    def prepare_response(self, query, priority, status_i, pwg_i):
        """Loop through all the workflow data, generate response"""
        response_list = []
        filters = dict()
        filters['status'] = dict()
        filters['pwg'] = dict()
        incorrect = True
        for one in query:

            # Keep track of the prepids we've seen, so that we only add submission probes once
            seen_prepids = []

            # Process the db documents
            for (is_request, document, details) in self.db_query(one):

                if details is None and document is None:
                    # Well, there's nothing to do, is there?
                    continue

                if incorrect and document is not None:
                    incorrect = False

                # skip legacy request with no prep_id - check both details and document
                if ((document is None and details.get('prepid', '') == '')
                    or (details is None and document.get('pdmv_prep_id', '') == '')):
                    continue

                # filter out requests
                if is_request:

                    filters['status'].update(self.get_filter_dict(details['status'],
                        filters['status'], status_i))
                    filters['pwg'].update(self.get_filter_dict(details['pwg'], filters['pwg'],
                        pwg_i))

                    secondary_datasets = self.check_dataset(details['output_dataset'], document)

                    # Only check self.skip_request if we have a document from stats
                    if (self.filtering(details, pwg_i, status_i, priority) or
                        (document is not None and self.skip_request(details['output_dataset'],
                        document['pdmv_dataset_name'], document['pdmv_type'],
                        secondary_datasets))):
                        continue

                # create an array of requests to be processed
                response = {}
                response['data'] = []

                if details is not None:
                    response['request'] = details['prepid']
                else:
                    response['request'] = document['pdmv_prep_id']

                # Check there is a document from stats (i.e. the workflow was found)
                # If not, we may still want to create a submission probe
                if document is not None:
                    # A ReReco request with ALCARECO output datasets - stats does not differentiate
                    # between these, so we choose the one with the most events
                    # If there's a "real" output dataset like RECO/AOD/MINIAOD, this will not apply
                    if ('rereco_preferred_dataset' in document
                        and 'pdmv_monitor_datasets' in document):
                        for dataset in document['pdmv_monitor_datasets']:
                            if dataset['dataset'] == document['rereco_preferred_dataset']:
                                response['data'] += self.get_data_points(dataset['monitor'],
                                    is_request, details, document['pdmv_expected_events'])

                    # A TaskChain and not a request (only when the query is a workflow afaik)
                    elif not is_request and (document['pdmv_type'] == 'TaskChain'):
                        response_list = self.process_taskchain(document)
                        return response_list, dict(), dict(), True, ''

                    # There are no details (so not in the requests index or no workflows assigned)
                    # OR
                    # dataset_name == output_dataset, it's not a TaskChain and it has a monitor history
                    elif (details is None or
                          document['pdmv_dataset_name'] == \
                              details['output_dataset']) \
                              and document['pdmv_type'] != 'TaskChain' \
                              and 'pdmv_monitor_history' in document:
                        # usually pdmv_monitor_history has more information than pdmv_datasets
                        response['data'] += self.get_data_points(document['pdmv_monitor_history'],
                            is_request, details, document['pdmv_expected_events'])

                    # No dataset assigned yet OR it's submitted, has details and
                    elif (document['pdmv_dataset_name'] == "None Yet" or
                          (details is not None and
                           details['status'] == 'submitted' and
                           (details['output_dataset'] is None or
                            len(details['output_dataset']) == 0))):
                        """
                        Fix for submitted requests that have no output dataset
                        specified. Ensures present == historical(expected).
                        if query is workflow pdmv_dataset_name is None Yet
                        if query is request/above details not none and array len 0
                        """
                        record = dict()
                        if 'pdmv_monitor_history' in document:
                            record = document['pdmv_monitor_history'][0]
                        else:
                            record['pdmv_monitor_time'] = "FLAG"

                        response['data'] += self.get_data_points([record], is_request, details,
                            document['pdmv_expected_events'])

                    # document contains 'pdmv_monitor_datasets' and is either a TaskChain or has
                    # secondary datasets
                    elif ('pdmv_monitor_datasets' in document
                        and (document['pdmv_type'] == 'TaskChain' or secondary_datasets)):
                        # handling taskchain requests where output dataset
                        # is not the main one
                        for record in document['pdmv_monitor_datasets']:
                            if record['dataset'] == details['output_dataset']:
                                response['data'] += self.get_data_points(record['monitor'], is_request,
                                    details, document['pdmv_expected_events'])

                if (details is not None and 'submitted_time' in details
                    and details['prepid'] not in seen_prepids):
                    response['data'].append({'e': 0, 'd': 0, 'x': details['expected'],
                        't': details['submitted_time']})

                    seen_prepids.append(details['prepid'])

                response_list.append(response)
            error = ''
            if incorrect:
                error = 'Please load valid campaign, request or workflow name'
        return response_list, filters['pwg'], filters['status'], False, error

    def process_taskchain(self, document):
        """Use when input is workflow and a taskchain"""
        probes = []
        for taskchain in document['pdmv_monitor_datasets']:
            res = {}
            res['request'] = taskchain['dataset']
            res['data'] = []
            for record in taskchain['monitor']:
                if len(record['pdmv_monitor_time']):
                    data = dict()
                    data['e'] = (record['pdmv_evts_in_DAS'] +
                                 record['pdmv_open_evts_in_DAS'])
                    data['d'] = data['e']
                    data['t'] = self.parse_time(record['pdmv_monitor_time'])
                    data['x'] = document['pdmv_expected_events']
                res['data'].append(data)
            probes.append(res)
        return probes

    @staticmethod
    def rm_useless(arr):
        """Compressing data: remove first probe of resubmissions and points
        that are equal to previous measurement
        """
        compressed = []
        prev = {'e': -1, 'x': -1}
        for (expected, probe) in enumerate(arr):
            if (probe['e'] != prev['e'] or probe['x'] != prev['x']
                    or probe['d'] != prev['d']) and (probe['e'] != 0 or expected == 0):

                compressed.append(probe)
                prev = probe

        return compressed

    @staticmethod
    def skip_request(output_dataset, dataset, ttype, sd):
        """Check if skip request"""
        return dataset != output_dataset and output_dataset is not None \
            and dataset != 'None Yet' and ttype != 'TaskChain' and not sd

    @staticmethod
    def sort_timestamps(data, limit):
        """Reduce the number of timestamps to limit"""
        times = []
        for details in data:
            times += [i['t'] for i in data[details]['data']]

        times = set(times)

        if limit >= len(times):
            # No point making more probes than we have the data for
            return sorted(times)

        # Get a list of times evenly distributed between the first probe and the last
        latest = int(max(times))
        earliest = int(min(times))

        probes = range(earliest, latest, int(round((latest - earliest) / limit)))

        # Ensure that the most recent probe is always included
        if probes[-1] != latest:
            probes.append(latest)

        return probes

    def get(self, query, probe=100, priority=",", filters=None):
        """Get the historical data based on input, probe and filter"""
        if filters is None:
            filters = dict()
            filters['status'] = None
            filters['pwg'] = None
        priority = apiutils.APIUtils().parse_priority_csv(priority.split(','))
        response, pwg, status, taskchain, error = \
            self.prepare_response(query.split(','), priority,
                                  apiutils.APIUtils().parse_csv( \
                    filters['status']), apiutils.APIUtils().parse_csv( \
                                          filters['pwg']))
        if taskchain:
            res = {'data': response, 'pwg': dict(), 'status': dict(),
                   'taskchain': True, 'error': ''}
        else:
            # get accumulated requests
            accumulated = self.accumulate_requests(response)
            # add data points
            data = self.add_data_points(accumulated,
                                        self.sort_timestamps(accumulated,
                                                             probe))
            # add last point which is now()
            data = self.append_data_point(data)
            res = {'data': data, 'pwg': pwg, 'status': status,
                   'taskchain': False, 'error': error}
        return json.dumps({"results": res})


class SubmittedStatusAPI(esadapter.InitConnection):
    """Used to return list of submitted requests with current progress"""

    def completed_deep(self, request):
        """Return number of completed events from based on stats not McM"""
        completed_events = 0
        if not len(request['output_dataset']):
            # output dataset not set, do not add request to the list
            return -1
        output_dataset = request['output_dataset'][0]
        for workflow in request['reqmgr_name']:
            try:
                stats = self.es.get('stats', 'stats', workflow)['_source']
            except esadapter.pyelasticsearch.exceptions\
                    .ElasticHttpNotFoundError:
                continue

            if stats['pdmv_dataset_name'] == output_dataset:
                try:
                    completed_events = self.stats_maximum(
                        stats['pdmv_monitor_history'][0], completed_events)
                except KeyError:
                    continue
            elif 'pdmv_monitor_datasets' in stats:
                for monitor in stats['pdmv_monitor_datasets']:
                    if monitor['dataset'] == output_dataset:
                        completed_events = self.stats_maximum(
                            monitor['monitor'][0], completed_events)
        return completed_events

    def get(self, query, priority=",", pwg=None):
        """Get submitted requests with current progress"""
        priority = apiutils.APIUtils().parse_priority_csv(priority.split(','))
        pwg = apiutils.APIUtils().parse_csv(pwg)
        submitted = {}
        response = []

        for campaign in query.split(','):

            single_request = self.is_single_simple_request(campaign) or self.is_single_rereco_request(campaign)

            if single_request:
                doctype, index = ('rereco_request', 'rereco_requests') \
                    if self.is_single_rereco_request(campaign) else ('request', 'requests')

                response.append(self.es.get(index, doctype, campaign)['_source'])
            else:
                if self.is_instance(campaign, 'processing_string', 'processing_strings'):
                    index = 'rereco_requests'
                    fields = ['member_of_campaign']
                else: # assume it's Monte Carlo (original functionality)
                    index = 'requests'
                    fields = ['flown_with'] if campaign.startswith("flow") else ['member_of_campaign']

                for field in fields:
                    response += [s['_source'] for s in
                                 self.es.search(('%s:%s' % (field, campaign)),
                                                index=index,
                                                size=self.overflow)
                                 ['hits']['hits']]

        for request in response:
            if (request['status'] == 'submitted') \
                    and (pwg is None or request.get('pwg', 'None') in pwg) \
                    and (request['priority'] > priority[0] \
                             and (request['priority'] < priority[1] or \
                                      priority[1] == -1)):
                completed = self.completed_deep(request)
                if completed >= 0:
                    submitted[request['prepid']] = {}
                    submitted[request['prepid']]['datasets'] = request['output_dataset']
                    if request['total_events'] == 0:
                        submitted[request['prepid']]['completion'] = 'NO_EXP_EVTS'
                    else:
                        submitted[request['prepid']]['completion'] = (100 * completed /
                            request['total_events'])
        return json.dumps({"results": submitted})

    def is_instance(self, prepid, typeof, index):
        """Checks if prepid matches any typeof in the index"""
        try:
            self.es.get(index, typeof, prepid)['_source']
        except esadapter.pyelasticsearch.exceptions.ElasticHttpNotFoundError:
            return False
        return True

    def is_single_simple_request(self, prepid):
        """Checks if given prepid matches XXX-...-00000"""
        regex = r"((.{3})-.*-\d{5})"
        return re.search(regex, prepid) != None

    def is_single_rereco_request(self, prepid):
        """Checks if given prepid matches ReReco-...-0000"""
        regex = r"(ReReco-.*-\d{4})"
        return re.search(regex, prepid) != None

    @staticmethod
    def stats_maximum(data, previous):
        """Return maximum number of completed events"""
        return max(previous,
                   data['pdmv_evts_in_DAS'] + data['pdmv_open_evts_in_DAS'])
