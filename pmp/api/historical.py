"""A list of classes supporting historical statistics API"""
from pmp.api.common import APIBase
import elasticsearch
import json
import time
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
            point = {'d': 0, 'e': 0, 'x': 0, 't': t}
            for key in data:
                previous = {'d': 0, 'e': 0, 'x': 0}
                for (i, details) in enumerate(data[key]['data']):
                    if details['t'] > t:
                        point['d'] += previous['d']
                        point['e'] += previous['e']
                        point['x'] += previous['x']
                        break
                    elif details['t'] == t or i == len(data[key]['data']) - 1:
                        point['d'] += details['d']
                        point['e'] += details['e']
                        point['x'] += details['x']
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
                          't': int(round(time.time() * 1000))}
            data.append(duplicated)

        return data

    def db_query(self, query):
        """
        Query DB and return array of raw documents
        Tuple of three things is returned: is request, stats document, mcm document
        """
        req_arr = []
        field, index, doctype, query = self.parse_query(query)
        logging.info('Field: %s, index: %s, doctype: %s, query: %s' % (field, index, doctype, query))
        if index is None:
            logging.info('Returning nothing')
            return None, None

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
                req_arr = []

        if index == 'requests':
            logging.info('Found %d requests for %s' % (len(req_arr), query))
        else:
            logging.info('Found %d ReReco requests for %s' % (len(req_arr), query))

        # Iterate over array and collect details (McM documents)
        for req in req_arr:
            dataset_list = req['output_dataset']
            if len(dataset_list) > 0:
                if index == 'rereco_requests':
                    dataset = dataset_list[-1]
                else:
                    dataset = dataset_list[0]
            else:
                dataset = None

            req['force_completed'] = False
            for reqmgr_dict in req.get('reqmgr_status_history', []):
                if 'force-complete' in reqmgr_dict['history']:
                    req['force_completed'] = True
                    break

            # Get time of last transition to "submitted"
            for item in reversed(req['history']):
                if item['action'] == 'submitted':
                    req['submitted_time'] = item['time'] * 1000
                    break

            # Get the time of the *last* transition to status "done"
            for item in reversed(req['history']):
                if item['action'] == 'done':
                    req['done_time'] = item['time'] * 1000
                    break

            # Iterate through all workflow names, starting from the newest one
            # and stopping once any valid workflow is found
            req['reqmgr_name'] = sorted(req.get('reqmgr_name', []), key=lambda k: '_'.join(k.split('_')[-3:]), reverse=True)
            for reqmgr in req['reqmgr_name']:
                try:
                    stats_document = self.es.get(index='workflows', doc_type='workflow', id=reqmgr)['_source']
                except elasticsearch.NotFoundError:
                    logging.warning('%s is not found' % (reqmgr))
                    continue

                if stats_document.get('request_type').lower() == 'resubmission':
                    continue

                # Add reqmgr as name and output dataset to request
                mcm_document = dict(req)
                mcm_document.update({'expected': req['total_events'],
                                     'name': reqmgr,
                                     'output_dataset': dataset})
                yield stats_document, mcm_document
                break
            else:
                # Add reqmgr as name and output dataset to request
                mcm_document = dict(req)
                mcm_document.update({'expected': req['total_events'],
                                     'output_dataset': dataset})
                yield None, mcm_document

    def prepare_response(self, query):
        """
        Loop through all the workflow data, generate response
        """
        response_list = []
        query = query.split(',')
        for one in query:
            # Keep track of the prepids we've seen, so that we only add submission data points once
            seen_prepids = []
            logging.info('Processing %s' % (one))
            if not one:
                # Skip empty values
                continue

            # Process the db documents
            for stats_document, mcm_document in self.db_query(one):
                if stats_document is None and mcm_document is None:
                    # Well, there's nothing to do, is there?
                    continue

                # skip legacy request with no prep_id - check both stats and mcm documents
                if ((stats_document is None and mcm_document.get('prepid', '') == '') or
                        (mcm_document is None and stats_document.get('prepid', '') == '')):
                    continue

                if stats_document and stats_document['request_type'] == 'Resubmission':
                    logging.info('Skipping %s because it\'s Resubmission' % (stats_document['request_name']))
                    continue

                if mcm_document and mcm_document.get('status') not in ['submitted', 'done']:
                    logging.info('Skipping %s because it is %s' % (mcm_document['prepid'], mcm_document['status']))
                    continue

                if mcm_document and 'submitted_time' not in mcm_document:
                    logging.info('Skipping %s because it was not submitted yet' % (mcm_document['prepid']))
                    continue

                # create an array of requests to be processed
                response = {'data': []}

                if mcm_document is not None:
                    response['request'] = mcm_document['prepid']
                    response['pwg'] = mcm_document['pwg']
                    response['priority'] = mcm_document['priority']
                    response['status'] = mcm_document['status']
                    response['force_completed'] = mcm_document['force_completed']
                    response['dataset'] = mcm_document['output_dataset']
                else:
                    response['request'] = stats_document['prepid']
                    response['pwg'] = None
                    response['priority'] = stats_document['priority']
                    response['status'] = None
                    response['force_completed'] = False
                    response['dataset'] = ''

                # Check if there is a document from stats (i.e. the workflow was found)
                if stats_document is not None:
                    logging.info('Workflow name %s' % (stats_document['request_name']))

                    if 'event_number_history' in stats_document:
                        found_dataset_in_stats = False
                        for history_record in stats_document['event_number_history']:
                            if history_record['dataset'] != mcm_document['output_dataset']:
                                continue

                            found_dataset_in_stats = True
                            for entry in history_record.get('history', []):
                                data_point = {
                                    'e': entry.get('events', 0),
                                    'd': 0,
                                    'x': mcm_document.get('expected', 0),
                                    't': entry['time'] * 1000
                                }
                                if entry['type'] == 'VALID' or entry['type'] == 'INVALID':
                                    data_point['d'] = entry.get('events', 0)

                                response['data'].append(data_point)

                            break

                        if not found_dataset_in_stats:
                            logging.warning('Didn\'t find any datasets for %s. Workflow: %s' % (mcm_document['prepid'],
                                                                                                stats_document['request_name']))

                    else:
                        logging.info('Doing nothing for %s' % (mcm_document.get('prepid', '-')))
                        if 'event_number_history' not in stats_document:
                            logging.info('event_number_history not in stats_document')

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
                            'x': int(mcm_document['expected']),
                            't': int(mcm_document['submitted_time'] - 1)
                        })
                        seen_prepids.append(mcm_document['prepid'])
                        response_list.append(response)

        # logging.info('Prepare response length is %d' % (len(response_list)))
        # logging.info('Response list is %s' % (json.dumps(response_list, indent=4)))
        return response_list

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

    def apply_filters(self, data, priority_filter, pwg_filter, status_filter):
        """
        Priority filter is an array of min and max priorities
        PWG filter is list of strings (pwg) of requests to include
        Status filter is list of strings (status) of requests to include
        Return new data and dictionaries of pwgs and status filters that show whether
        these values were left (True) or filtered out (False)
        """
        new_data = []
        if pwg_filter:
            pwg_filter = [x.upper() for x in pwg_filter]

        if status_filter:
            status_filter = [x.lower() for x in status_filter]

        all_pwgs = {}
        all_statuses = {}
        for item in data:
            pwg = item.get('pwg', '').upper()
            if pwg not in all_pwgs:
                if pwg_filter:
                    all_pwgs[pwg] = pwg in pwg_filter
                else:
                    all_pwgs[pwg] = True

            status = item.get('status', '').lower()
            if status not in all_statuses:
                if status_filter:
                    all_statuses[status] = status in all_statuses
                else:
                    all_statuses[status] = True

            priority = item.get('priority')
            if priority is not None:
                if priority_filter is not None:
                    if priority < priority_filter[0] or priority > priority_filter[1]:
                        continue

            if all_pwgs[pwg] and all_statuses[status]:
                new_data.append(item)

        return new_data, all_pwgs, all_statuses

    def get_with_status(self, data, status):
        new_data = []
        for request in data:
            if request.get('status') != status:
                continue

            data_points = sorted(request.get('data', []), key=lambda k: k['t'])
            if not data_points:
                data_points = [{'d': 0, 'e': 0}]

            new_data.append({'request': request['request'],
                             'priority': request['priority'],
                             'dataset': request['dataset'],
                             'expected': data_points[-1]['x'],
                             'done': data_points[-1]['e']})

        return new_data

    def get(self, query, data_point_count=100, priority_filter=None, pwg_filter=None, status_filter=None):
        """
        Get the historical data based on query, data point count, priority and filter
        """
        logging.info('%s (%s) | %s (%s) | %s (%s) | %s (%s) | %s (%s)' % (query,
                                                                         type(query),
                                                                         data_point_count,
                                                                         type(data_point_count),
                                                                         priority_filter,
                                                                         type(priority_filter),
                                                                         pwg_filter,
                                                                         type(pwg_filter),
                                                                         status_filter,
                                                                         type(status_filter)))
        # Construct data by given query
        response = self.prepare_response(query)
        logging.info('Requests before filtering %s' % (len(response)))
        # Apply priority, PWG and status filters
        response, pwgs, statuses = self.apply_filters(response, priority_filter, pwg_filter, status_filter)
        logging.info('Requests after filtering %s' % (len(response)))
        # Get submitted and done requests separately
        submitted_requests = self.get_with_status(response, 'submitted')
        done_requests = self.get_with_status(response, 'done')
        # Continue aggregating data points for response
        logging.info('Will aggregate requests')
        response = self.aggregate_requests(response)
        logging.info('Will adjust for force complete')
        response = self.adjust_for_force_complete(response)
        logging.info('Will adjust data points')
        data = self.aggregate_data_points(response,
                                          self.sort_timestamps(response,
                                                               data_point_count))
        data = self.append_last_data_point(data)
        res = {'data': data,
               'pwg': pwgs,
               'status': statuses,
               'submitted_requests': submitted_requests,
               'done_requests': done_requests}
        logging.info('Will return')
        return json.dumps({'results': res})
