"""A list of classes supporting historical statistics API"""
from pmp.api.utils import utils as apiutils
from pmp.api.models import esadapter
import json
import time


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
        """Check for secondary datasets"""
        if doc['pdmv_dataset_name'] != output_dataset and \
                'pdmv_monitor_datasets' in doc:
            if output_dataset in [i['dataset'] for i \
                                      in doc['pdmv_monitor_datasets']]:
                return False
        return True

    def db_query(self, query):
        """Query DB and return array of raw documents"""
        iterable = []

        # try to query for campaign and get list of requests
        req_arr = [s['_source'] for s in
                   self.es.search(('member_of_campaign:%s' % query),
                                  index='requests',
                                  size=self.overflow)['hits']['hits']]

        # if empty, assume query is a request
        if not len(req_arr):
            self.campaign = False
            try:
                req_arr = [self.es.get('requests',
                                       'request', query)['_source']]
            except esadapter.pyelasticsearch.exceptions\
                    .ElasticHttpNotFoundError:
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

                for reqmgr in req['reqmgr_name']:
                    i = {}
                    i['expected'] = req['total_events']
                    i['name'] = reqmgr
                    i['output_dataset'] = dataset
                    i['priority'] = req['priority']
                    i['pwg'] = req['pwg']
                    i['request'] = True
                    i['status'] = req['status']
                    iterable.append(i)
            except KeyError:
                pass

        # iterate over workflows and yield documents
        for i in iterable:
            if 'request' in i:
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

    def get_data_points(self, request, monitor, details, expected):
        """Parse input and return fixed data points"""
        data = dict()

        if details is None or details['output_dataset'] is not None:
            data['e'] = (monitor['pdmv_evts_in_DAS'] +
                         monitor['pdmv_open_evts_in_DAS'])
        else:
            data['e'] = 0
        if details is None or details['status'] == 'done':
            data['d'] = data['e']
        else:
            data['d'] = 0
        # get timestamp, if field is empty set 1/1/2013
        if len(monitor['pdmv_monitor_time']):
            data['t'] = self.parse_time(monitor['pdmv_monitor_time'])
        else:
            data['t'] = self.parse_time("Tue Jan 1 00:00:00 2013")
        if request:
            data['x'] = details['expected']
        else:
            data['x'] = expected
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

    def prepare_response(self, query, priority, status_i, pwg_i):
        """Loop through all the workflow data, generate response"""
        response_list = []
        filters = dict()
        filters['status'] = dict()
        filters['pwg'] = dict()

        for one in query:

            # Process the db documents
            for (is_request, document, details) in self.db_query(one):

                # skip empty documents and legacy request with no prep_id
                if document is None or document['pdmv_prep_id'] == '':
                    continue

                # filter out requests
                if is_request:

                    filters['status'].update(self.get_filter_dict( \
                            details['status'], filters['status'], status_i))
                    filters['pwg'].update(self.get_filter_dict( \
                            details['pwg'], filters['pwg'], pwg_i))

                    no_secondary_datasets = self.check_dataset(
                        details['output_dataset'], document)

                    if self.filtering(details, pwg_i, status_i, priority) or \
                            self.skip_request( \
                        details['output_dataset'],
                        document['pdmv_dataset_name'],
                        document['pdmv_type'], no_secondary_datasets):
                        continue

                # create an array of requests to be processed
                response = {}
                response['data'] = []
                response['request'] = document['pdmv_prep_id']

                if not is_request and (document['pdmv_type'] == 'TaskChain'):
                    response_list = self.process_taskchain(document)
                    return response_list, dict(), dict(), True

                elif (details is None or
                      document['pdmv_dataset_name'] == \
                          details['output_dataset']) \
                          and document['pdmv_type'] != 'TaskChain' \
                          and 'pdmv_monitor_history' in document:
                    # usually pdmv_monitor_history has more information than
                    # pdmv_datasets
                    for record in document['pdmv_monitor_history']:
                        response['data'].append(self.get_data_points( \
                                is_request, record, details,
                                document['pdmv_expected_events']))

                elif ('pdmv_monitor_datasets' in document
                      and (document['pdmv_type'] == 'TaskChain'
                           or not no_secondary_datasets)):
                    # handling taskchain requests where output dataset
                    # is not the main one
                    for record in document['pdmv_monitor_datasets']:
                        if record['dataset'] == details['output_dataset']:
                            for monitor in record['monitor']:
                                response['data'].append(self.get_data_points( \
                                        is_request, monitor, details,
                                        document['pdmv_expected_events']))
                response_list.append(response)
        return response_list, filters['pwg'], filters['status'], False

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
            if (probe['e'] != prev['e'] or probe['x'] != prev['x']) \
                    and (probe['e'] != 0 or expected == 0):
                compressed.append(probe)
                prev = probe
        return compressed

    @staticmethod
    def skip_request(output_dataset, dataset, ttype, nsd):
        """Check if skip request"""
        return dataset != output_dataset and output_dataset is not None \
            and dataset != 'None Yet' and ttype != 'TaskChain' and nsd

    @staticmethod
    def sort_timestamps(data, probe):
        """Get valid timestamps. Remove duplicates and apply probing limit"""
        times = []
        for details in data:
            times += (i['t'] for i in data[details]['data'])
        times = sorted(set(times))

        if len(times) > (probe-1):
            skiper = len(times) / (probe-1)
        else:
            skiper = -1

        probes = []
        counter = 0
        for (index, probe) in enumerate(times):
            if counter < skiper and index < len(times) - 1 and index != 0:
                counter += 1
            else:
                probes.append(probe)
                counter = 0
        return probes

    def get(self, query, probe=100, priority=",", filters=None):
        """Get the historical data based on input, probe and filter"""
        if filters is None:
            filters = dict()
            filters['status'] = None
            filters['pwg'] = None
        priority = apiutils.APIUtils().parse_priority_csv(priority.split(','))
        response, pwg, status, taskchain = \
            self.prepare_response(query.split(','), priority,
                                  apiutils.APIUtils().parse_csv( \
                    filters['status']), apiutils.APIUtils().parse_csv( \
                                          filters['pwg']))
        if taskchain:
            res = {'data': response, 'pwg': dict(), 'status': dict(),
                   'taskchain': True}
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
                   'taskchain': False}
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
            response += [s['_source'] for s in
                         self.es.search(('member_of_campaign:%s' % campaign),
                                        index='requests', size=self.overflow)
                         ['hits']['hits']]
        for request in response:
            if (request['status'] == 'submitted') \
                    and (pwg is None or request['pwg'] in pwg) \
                    and (request['priority'] > priority[0] \
                             and (request['priority'] < priority[1] or \
                                      priority[1] == -1)):
                completed = self.completed_deep(request)
                if completed >= 0:
                    submitted[request['prepid']] = (100 * completed /
                                                    request['total_events'])
        return json.dumps({"results": submitted})

    @staticmethod
    def stats_maximum(data, previous):
        """Return maximum number of completed events"""
        return max(previous,
                   data['pdmv_evts_in_DAS'] + data['pdmv_open_evts_in_DAS'])
