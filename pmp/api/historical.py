"""A list of classes supporting historical statistics API"""
from pmp.api.utils import APIUtils
from pmp.api.common import APIBase
import elasticsearch
import json
import time
import re
import logging


class HistoricalAPI(APIBase):
    """Used to return list of points for historical plots"""

    def __init__(self):
        APIBase.__init__(self)

    def aggregate_requests(self, data):
        """
        Aggregate list of requests and data points into dictionary by request name
        and sort data points by timestamp. Also remove useless data points
        """
        aggregated = {}
        for request_details in data:
            request = request_details['request']
            if request not in aggregated:
                aggregated[request] = {}
                aggregated[request]['data'] = []
                aggregated[request]['force_completed'] = request_details['force_completed']

            aggregated[request]['data'] += request_details['data']
            aggregated[request]['data'] = sorted(aggregated[request]['data'], key=lambda i: i['t'])
            aggregated[request]['data'] = self.remove_useless_points(aggregated[request]['data'])

        return aggregated

    def aggregate_data_points(self, data, timestamps):
        """
        Add points to response
        List of granularity timestamps. Put timestamps and iterate through all data.
        Add it or not according to which side of timestamp the time of a point is
        """
        points = []
        for t in timestamps:
            point = {'d': 0, 'e': 0, 'x': 0, 't': t, 'o': 0}
            for key in data:
                previous = {'d': 0, 'e': 0, 'x': 0, 'o': 0}
                for (i, details) in enumerate(data[key]['data']):
                    if details['t'] > t:
                        point['d'] += previous['d']
                        point['e'] += previous['e']
                        point['x'] += previous['x']
                        point['o'] += previous['o']
                        break
                    elif details['t'] == t or i == len(data[key]['data']) - 1:
                        point['d'] += details['d']
                        point['e'] += details['e']
                        point['x'] += details['x']
                        point['o'] += details['o']
                        break
                    else:
                        previous = details

            points.append(point)

        return points

    def adjust_for_force_complete(self, data):
        """
        Iterate through requests and lower x (Expected) to d (Done in DAS) if request
        was force completed
        """
        for key in data:
            if data[key].get('force_completed', False) and len(data[key]['data']) > 0:
                newest_details = data[key]['data'][0]
                for details in data[key]['data']:
                    if details['t'] > newest_details['t']:
                        newest_details = details

                for details in data[key]['data']:
                    details['x'] = newest_details['d']
                # Comment-out the above for loop and uncomment the line below
                # to adjust only last detail (graph will show a decline)
                # newest_details['x'] = newest_details['d']

        return data

    def append_last_data_point(self, data):
        """
        Duplicate last data point with current timestamp
        """
        if len(data) > 0:
            duplicated = {'d': data[-1]['d'],
                          'e': data[-1]['e'],
                          'x': data[-1]['x'],
                          't': int(round(time.time() * 1000)),
                          'o': data[-1]['o']}
            data.append(duplicated)

        return data

    def db_query(self, query):
        """
        Query DB and return array of raw documents
        Tuple of three things is returned: is request, stats document, mcm document
        """
        iterable = []
        req_arr = []
        field, index, doctype, query = self.parse_query(query)
        logging.info('Field: %s, index: %s, query: %s' % (field, index, query))
        if field is not None:
            # If field is present first find all results that have given value in
            # that field. For example, if query is campaign, find  all requests
            # that have that campaign in their member_of_campaign field
            search_results = self.es.search(q='%s:%s' % (field, query),
                                            index=index,
                                            size=self.results_window_size)['hits']['hits']
            req_arr = [s['_source'] for s in search_results]
        else:
            # Could be a request or a workflow
            try:
                req_arr = [self.es.get(index=index, doc_type=doctype, id=query)['_source']]
            except elasticsearch.NotFoundError:
                # If exception thrown this may be a workflow
                iterable = [query]

        logging.info('Found %d requests for %s' % (len(req_arr), query))
        # Iterate over array and collect details (McM documents)
        for req in req_arr:
            try:
                dataset_list = req['output_dataset']
                if len(dataset_list) > 0:
                    dataset = dataset_list[0]
                else:
                    dataset = None

                # Include a blank one in case there are no workflows. We still want expected events
                if len(req['reqmgr_name']) == 0:
                    req['reqmgr_name'] = [None]

                force_completed_request = False
                if 'reqmgr_status_history' in req:
                    for reqmgr_dict in req['reqmgr_status_history']:
                        if 'force-complete' in reqmgr_dict['history']:
                            force_completed_request = True
                            break

                for reqmgr in req['reqmgr_name']:
                    i = {}
                    i['expected'] = req['total_events']
                    i['name'] = reqmgr
                    i['prepid'] = req['prepid']
                    i['output_dataset'] = dataset
                    i['priority'] = req['priority']
                    i['pwg'] = req.get('pwg', 'None')  # for ReReco support
                    i['request'] = True
                    i['status'] = req['status']
                    i['done_time'] = 0  # default, see next step
                    i['force_completed'] = force_completed_request

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

        # Iterate over workflows and yield documents
        # yield: is_request, stats_document(s), mcm_document
        for mcm_document in iterable:
            if 'request' in mcm_document:
                if mcm_document['name'] is None:
                    yield True, None, mcm_document
                else:
                    try:
                        stats_document = self.es.get(index='workflows', doc_type='workflow', id=mcm_document['name'])['_source']
                        yield True, stats_document, mcm_document
                    except elasticsearch.NotFoundError:
                        yield True, None, mcm_document
            else:
                try:
                    stats_document = self.es.get(index='workflows', doc_type='workflow', id=mcm_document)['_source']
                    yield False, stats_document, None
                except elasticsearch.NotFoundError:
                    yield False, None, None

    def get_filter_dict(self, doc, arr, inp):
        """
        Generate filter dictionary. Return dictionary where key is given term
        and value is either true or false. If inp is present, true will only
        be set if doc is in inp list
        """
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

    def filtering(self, details, pwg_i, status_i, priority):
        """
        Returns boolean if request should be filtered (skipped)
        """
        # pwg filtering
        if pwg_i is not None and details['pwg'] not in pwg_i:
            return True

        # status filtering
        if status_i is not None and details['status'] not in status_i:
            return True

        # filter out invalidated 'new'
        if details['status'] not in ['done', 'submitted']:
            return True

        # priority filtering
        if details['priority'] < priority[0] or (details['priority'] > priority[1] and priority[1] != -1):
            return True

        return False

    def parse_time(self, string_time):
        """
        Parse time in a "Tue Jan 1 00:00:00 2013" format to integer
        """
        return time.mktime(time.strptime(string_time)) * 1000

    def parse_request_history_time(self, string_time):
        """
        Parse time in a "2013-12-01-00-00" format to an integer as above
        """
        return time.mktime(time.strptime(string_time, '%Y-%m-%d-%H-%M')) * 1000

    def prepare_response(self, query, priority, status_i, pwg_i):
        """
        Loop through all the workflow data, generate response
        """
        response_list = []
        filters = dict()
        filters['status'] = dict()
        filters['pwg'] = dict()
        query = query.split(',')
        for one in query:
            # Keep track of the prepids we've seen, so that we only add submission data points once
            seen_prepids = []
            logging.info('Processing %s' % (one))

            # Process the db documents
            for is_request, stats_document, mcm_document in self.db_query(one):
                if stats_document is None and mcm_document is None:
                    # Well, there's nothing to do, is there?
                    continue

                # skip legacy request with no prep_id - check both stats and mcm documents
                if ((stats_document is None and mcm_document.get('prepid', '') == '') or
                        (mcm_document is None and stats_document.get('PrepID', '') == '')):
                    continue

                if stats_document is not None and len(stats_document.get('OutputDatasets', [])) > 0:
                    last_stats_dataset = stats_document['OutputDatasets'][-1]
                else:
                    last_stats_dataset = None

                # Filter out requests
                if is_request:
                    filters['status'].update(self.get_filter_dict(mcm_document['status'],
                                                                  filters['status'],
                                                                  status_i))
                    filters['pwg'].update(self.get_filter_dict(mcm_document['pwg'],
                                                               filters['pwg'],
                                                               pwg_i))

                    should_filter_out = self.filtering(mcm_document, pwg_i, status_i, priority)
                    # Only check self.skip_request if we have a document from stats
                    should_skip = stats_document is not None and self.skip_request(mcm_document['output_dataset'],
                                                                                   last_stats_dataset,
                                                                                   stats_document['RequestType'])
                    if should_filter_out or should_skip:
                        logging.info('%s should filter out %s, should skip %s' % (mcm_document['prepid'],
                                                                                  should_filter_out,
                                                                                  should_skip))
                        continue

                # create an array of requests to be processed
                response = {'data': []}

                if mcm_document is not None:
                    response['request'] = mcm_document['prepid']
                    if 'force_completed' in mcm_document:
                        response['force_completed'] = mcm_document['force_completed']
                    else:
                        response['force_completed'] = False

                else:
                    response['request'] = stats_document['PrepID']
                    response['force_completed'] = False

                # Check if there is a document from stats (i.e. the workflow was found)
                if stats_document is not None:
                    logging.info('Workflow name %s' % (stats_document['RequestName']))

                    # A TaskChain and not a request (only when it's a workflow)
                    if not is_request and stats_document['RequestType'] == 'TaskChain':
                        logging.info('Workflow!')
                        response_list = self.process_workflow(stats_document, mcm_document)
                        # Return response, no pwg, no status, taskchain=True and no error
                        return response_list, {}, {}, True, ''

                    elif 'EventNumberHistory' in stats_document:
                        found_dataset_in_stats = False
                        for history_record in stats_document['EventNumberHistory']:
                            if history_record['dataset'] != mcm_document['output_dataset']:
                                continue

                            found_dataset_in_stats = True
                            for entry in history_record.get('history', []):
                                data_point = {
                                    'e': entry.get('Events', 0),
                                    'd': 0,
                                    'x': mcm_document.get('expected', 0),
                                    't': entry['Time'] * 1000,
                                    'o': stats_document.get('TotalEvents', 0)
                                }
                                if entry['Type'] == 'VALID':
                                    data_point['d'] = entry.get('Events', 0)

                                response['data'].append(data_point)

                            break

                        if not found_dataset_in_stats:
                            logging.warning('Didn\'t find any datasets for %s. Workflow: %s' % (mcm_document['prepid'],
                                                                                                stats_document['RequestName']))

                    else:
                        logging.info('Doing nothing for %s' % (mcm_document.get('prepid', '-')))
                        if 'EventNumberHistory' not in stats_document:
                            logging.info('EventNumberHistory not in stats_document')

                else:
                    logging.info('Stats document for %s is none' % (mcm_document.get('prepid', '--')))

                # In any case, we still want to create a submission data point (first point with expected events)
                if mcm_document is not None:
                    if mcm_document['prepid'] in seen_prepids:
                        logging.warning('%s is already in seen_prepids. Why is it here agait?' % (mcm_document['prepid']))
                    else:
                        response['data'].append({
                            'e': 0,
                            'd': 0,
                            'x': mcm_document['expected'],
                            't': mcm_document['submitted_time'],
                            'o': mcm_document['expected']
                        })
                        seen_prepids.append(mcm_document['prepid'])
                        response_list.append(response)

            error = ''

        logging.info('Prepare response length is %d' % (len(response_list)))
        return response_list, filters['pwg'], filters['status'], False, error

    def process_workflow(self, stats_document, mcm_document):
        """
        Use when input is workflow and a taskchain
        """
        data_points = []
        for taskchain in stats_document['EventNumberHistory']:
            res = {
                'request': taskchain['dataset'],
                'data': []
            }
            for record in taskchain['history']:
                data = {
                    'd': record['Events'],
                    'e': record['Events'],
                    'x': mcm_document['expected'],
                    't': record['Time'] * 1000,
                    'o': stats_document['TotalEvents']
                }
                res['data'].append(data)

            data_points.append(res)

        return data_points

    def remove_useless_points(self, arr):
        """Compressing data: remove first data point of resubmissions and points
        that are equal to previous measurement
        """
        compressed = []
        prev = {'e': -1, 'x': -1}
        for (expected, data_point) in enumerate(arr):
            if (data_point['e'] != prev['e'] or
                    data_point['x'] != prev['x'] or
                    data_point['d'] != prev['d']) and (data_point['e'] != 0 or expected == 0):

                compressed.append(data_point)
                prev = data_point

        return compressed

    def skip_request(self, output_dataset, dataset, ttype):
        """Check if skip request"""
        return dataset != output_dataset and output_dataset is not None and\
            dataset != 'None Yet' and ttype != 'TaskChain'

    def sort_timestamps(self, data, limit):
        """Reduce the number of timestamps to limit"""
        times = []
        # logging.info(json.dumps(data, indent=2))
        for details in data:
            times += [i['t'] for i in data[details]['data']]

        times = set(times)

        if limit >= len(times):
            # No point making more data points than we have the data for
            return sorted(times)

        # Get a list of times evenly distributed between the first data point and the last
        latest = int(max(times))
        earliest = int(min(times))

        data_points = list(range(earliest, latest, int(round((latest - earliest) / limit))))

        # Ensure that the most recent data point is always included
        if data_points[-1] != latest:
            data_points.append(latest)

        return data_points

    def get(self, query, data_point_count=100, priority=',', filters=None):
        """
        Get the historical data based on query, data point count, priority and filter
        """
        if filters is None:
            filters = {'status': None,
                       'pwg': None}

        filters_status_csv = APIUtils.parse_csv(filters['status'])
        filters_pwg_csv = APIUtils.parse_csv(filters['pwg'])
        priority = APIUtils.parse_priority_csv(priority)
        response, pwg, status, taskchain, error = self.prepare_response(query,
                                                                        priority,
                                                                        filters_status_csv,
                                                                        filters_pwg_csv)

        if taskchain:
            res = {'data': response,
                   'pwg': {},
                   'status': {},
                   'taskchain': True,
                   'error': error}
        else:
            aggregated = self.aggregate_requests(response)
            aggregated = self.adjust_for_force_complete(aggregated)
            data = self.aggregate_data_points(aggregated,
                                              self.sort_timestamps(aggregated,
                                                                   data_point_count))
            data = self.append_last_data_point(data)
            res = {'data': data,
                   'pwg': pwg,
                   'status': status,
                   'taskchain': False,
                   'error': error}

        return json.dumps({"results": res})


class SubmittedStatusAPI(APIBase):
    """
    Is used to return list of submitted requests with current progress
    """

    def __init__(self):
        APIBase.__init__(self)

    def get(self, query, priority=',', pwg=None):
        """Get submitted requests with current progress"""
        priority = APIUtils.parse_priority_csv(priority)
        pwg = APIUtils.parse_csv(pwg)
        submitted = {}
        response = []

        for one in query.split(','):
            simple_request = self.is_single_simple_request(one)
            rereco_request = self.is_single_rereco_request(one)
            _, index, doctype, _ = self.parse_query(one)

            if simple_request or rereco_request:
                try:
                    response.append(self.es.get(index=index, doc_type=doctype, id=one)['_source'])
                except elasticsearch.NotFoundError:
                    logging.info('Not found %s' % (one))
                    pass

            else:
                field = 'flown_with' if one.startswith("flow") else 'member_of_campaign'
                response += [s['_source'] for s in
                             self.es.search(q=('%s:%s' % (field, one)),
                                            index='requests',
                                            doc_type='request',
                                            size=self.results_window_size)
                             ['hits']['hits']]

        for request in response:
            if (request['status'] == 'submitted') and\
                    (pwg is None or request.get('pwg', 'None') in pwg) and\
                    (request['priority'] > priority[0] and
                     (request['priority'] < priority[1] or
                     priority[1] == -1)):
                completed = self.completed_deep(request)
                if completed >= 0:
                    submitted[request['prepid']] = {}
                    submitted[request['prepid']]['datasets'] = request['output_dataset']
                    if request['total_events'] == 0:
                        submitted[request['prepid']]['completion'] = 'NO_EXP_EVTS'
                    else:
                        submitted[request['prepid']]['completion'] = int(100 * completed / request['total_events'])

        return json.dumps({"results": submitted})

    def is_single_simple_request(self, prepid):
        """
        Checks if given prepid matches XXX-...-00000
        """
        regex = r"((.{3})-.*-\d{5})"
        return re.search(regex, prepid) is not None

    def is_single_rereco_request(self, prepid):
        """
        Checks if given prepid matches ReReco-...-0000
        """
        regex = r"(ReReco-.*-\d{4})"
        return re.search(regex, prepid) is not None
