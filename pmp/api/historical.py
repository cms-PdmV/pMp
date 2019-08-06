"""A list of classes supporting historical statistics API"""
from pmp.api.common import APIBase
import json
import time
import logging
from werkzeug.contrib.cache import SimpleCache
import config


class HistoricalAPI(APIBase):
    """Used to return list of points for historical plots"""

    __cache = SimpleCache(threshold=config.CACHE_SIZE, default_timeout=config.CACHE_TIMEOUT)

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
            aggregated[request]['data'] = sorted(aggregated[request]['data'], key=lambda i: i['time'])
            aggregated[request]['data'] = self.remove_useless_points(aggregated[request]['data'])

        return aggregated

    def aggregate_data_points(self, data, timestamps):
        """
        Add points to response
        List of granularity timestamps. Put timestamps and iterate through all data.
        Add it or not according to which side of timestamp the time of a point is
        """
        points = []
        for timestamp in timestamps:
            point = {'done': 0, 'produced': 0, 'expected': 0, 'invalid': 0, 'time': timestamp * 1000}
            for key in data:
                for details in reversed(data[key]['data']):
                    if details['time'] <= timestamp:
                        point['done'] += details['done']
                        point['produced'] += details['produced']
                        point['expected'] += details['expected']
                        point['invalid'] += details['invalid']
                        break

            points.append(point)

        return points

    def adjust_for_force_complete(self, data):
        """
        Iterate through requests and lower x (Expected) to d (Done in DAS) if request
        was force completed
        """
        for key in data:
            if data[key].get('force_completed', False) and len(data[key]['data']) > 0:
                newest_details =  data[key]['data'][-1]
                # If number of done (VALID) events are more or equal to number of
                # produced, adjust expected to done value
                # This prevents from setting expected to 0 when there are no done events
                if newest_details['done'] >= newest_details['produced']:
                    for details in data[key]['data']:
                        details['expected'] = newest_details['done']

        return data

    def append_last_data_point(self, data):
        """
        Duplicate last data point with current timestamp
        """
        if len(data) > 0:
            duplicated = {'done': data[-1]['done'],
                          'produced': data[-1]['produced'],
                          'expected': data[-1]['expected'],
                          'invalid': data[-1]['invalid'],
                          'time': int(round(time.time() * 1000))}
            data.append(duplicated)

        return data

    def prepare_response(self, query, estimate_completed_events):
        """
        Loop through all the workflow data, generate response
        """
        response_list = []
        valid_tags = []
        invalid_tags = []
        messages = []
        query = query.split(',')
        seen_prepids = []
        types_for_done_events = set(['VALID'])
        types_for_invalid_events = set(['INVALID', 'DELETED'])
        for one in query:
            # Keep track of the prepids we've seen, so that we only add submission data points once
            logging.info('Processing %s' % (one))
            if not one:
                # Skip empty values
                continue

            found_something = False
            # Process the db documents
            for stats_document, mcm_document in self.db_query(one, include_stats_document=True, estimate_completed_events=estimate_completed_events):
                if stats_document is None and mcm_document is None:
                    # Well, there's nothing to do, is there?
                    continue

                # skip legacy request with no prep_id - check both stats and mcm documents
                if ((stats_document is None and mcm_document.get('prepid', '') == '') or
                        (mcm_document is None and stats_document.get('prepid', '') == '')):
                    continue

                if not mcm_document:
                    logging.info('No McM document for %s, skipping' % (one))
                    continue

                if mcm_document.get('status') not in ['submitted', 'done']:
                    logging.info('Skipping %s because it is %s' % (mcm_document['prepid'], mcm_document['status']))
                    continue

                if 'submitted_time' not in mcm_document:
                    logging.info('Skipping %s because it was not submitted yet' % (mcm_document['prepid']))
                    continue

                if mcm_document['prepid'] in seen_prepids:
                    logging.warning('%s is already in seen_prepids. Why is it here again?' % (mcm_document['prepid']))
                    continue

                found_something = True
                # create an array of requests to be processed
                response = {'data': [{'produced': 0,
                                      'done': 0,
                                      'invalid': 0,
                                      'expected': int(mcm_document['expected']),
                                      'time': int(mcm_document['submitted_time'])}]}

                response['request'] = mcm_document['prepid']
                response['pwg'] = mcm_document['pwg']
                response['priority'] = mcm_document['priority']
                response['status'] = mcm_document['status']
                response['force_completed'] = mcm_document['force_completed']
                response['output_dataset'] = mcm_document['output_dataset']
                response['dataset'] = mcm_document.get('dataset_name', '')
                response['reqmgr_name'] = mcm_document.get('reqmgr_name', [])
                response['output_dataset_status'] = 'NONE'
                if 'estimate_from' in mcm_document:
                    response['estimate_from'] = mcm_document['estimate_from']

                # Check if there is a document from stats (i.e. the workflow was found)
                if stats_document is not None and mcm_document['output_dataset']:
                    logging.info('Workflow name %s' % (stats_document['request_name']))

                    if 'event_number_history' in stats_document:
                        for history_record in stats_document['event_number_history']:
                            if history_record['dataset'] != mcm_document['output_dataset']:
                                continue

                            for entry in history_record.get('history', []):
                                data_point = {
                                    'produced': 0,
                                    'done': 0,
                                    'invalid': 0,
                                    'expected': mcm_document.get('expected', 0),
                                    'time': entry['time']
                                }
                                events = entry.get('events', 0)
                                if entry['type'] in types_for_done_events:
                                    data_point['done'] = events
                                elif entry['type'] in types_for_invalid_events:
                                    data_point['invalid'] = events
                                else:
                                    data_point['produced'] = events

                                response['data'].append(data_point)
                                response['output_dataset_status'] = entry['type']

                            break
                        else:
                            logging.warning('Didn\'t find any datasets for %s. Workflow: %s' % (mcm_document['prepid'],
                                                                                                stats_document['request_name']))

                    else:
                        logging.info('Doing nothing for %s' % (mcm_document.get('prepid', '-')))
                        if 'event_number_history' not in stats_document:
                            logging.info('event_number_history not in stats_document')

                else:
                    logging.info('Stats document for %s is none' % (mcm_document.get('prepid', '--')))

                # In any case, we still want to create a submission data point (first point with expected events)
                seen_prepids.append(mcm_document['prepid'])
                response_list.append(response)

            if found_something:
                valid_tags.append(one)
                if self.is_instance(one, 'mcm_datatiers', 'mcm_datatier'):
                    messages.append('Note: results for %s include only submitted requests' % (one))
            else:
                invalid_tags.append(one)

        # logging.info('Prepare response length is %d' % (len(response_list)))
        # logging.info('Response list is %s' % (json.dumps(response_list, indent=4)))
        return response_list, valid_tags, invalid_tags, messages

    def remove_useless_points(self, arr):
        """Compressing data: remove first data point of resubmissions and points
        that are equal to previous measurement
        """
        compressed = []
        prev = {'produced': -1, 'expected': -1}
        for data_point in arr:
            if (data_point['produced'] != prev['produced'] or
                data_point['expected'] != prev['expected'] or
                data_point['done'] != prev['done'] or
                data_point['invalid'] != prev['invalid']):
                compressed.append(data_point)
                prev = data_point

        return compressed

    def sort_timestamps(self, data, limit):
        """Reduce the number of timestamps to limit"""
        times = []
        # logging.info(json.dumps(data, indent=2))
        for details in data:
            times += [i['time'] for i in data[details]['data']]

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

        return sorted(data_points)

    def get_with_status(self, data, status):
        new_data = []
        key = 'done' if status == 'done' else 'produced'
        for request in data:
            if request.get('status') != status:
                continue

            data_points = sorted(request.get('data', []), key=lambda k: k['time'])
            if not data_points:
                data_points = [{'done': 0, 'produced': 0}]

            workflow_name = ''
            if len(request.get('reqmgr_name', [])) > 0:
                workflow_name = request['reqmgr_name'][0]

            new_data.append({'prepid': request['request'],
                             'priority': request['priority'],
                             'output_dataset': request['output_dataset'],
                             'output_dataset_status': request['output_dataset_status'],
                             'dataset': request['dataset'],
                             'expected': data_points[-1]['expected'],
                             'done': max(data_points[-1][key], data_points[-1]['invalid']),
                             'force_completed': request['force_completed'],
                             'estimate_from': request.get('estimate_from', None),
                             'workflow': workflow_name})

        new_data = sorted(new_data, key=lambda k: k['prepid'])
        return new_data

    def get(self, query, data_point_count=100, estimate_completed_events=False, priority_filter=None, pwg_filter=None, status_filter=None):
        """
        Get the historical data based on query, data point count, priority and filter
        """
        start_time = time.time()
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

        cache_key = 'present_%s_____%s' % (query, estimate_completed_events)
        if self.__cache.has(cache_key):
            logging.info('Found result in cache for key: %s' % cache_key)
            response_tuple = self.__cache.get(cache_key)
        else:
            # Construct data by given query
            response_tuple = self.prepare_response(query, estimate_completed_events)
            self.__cache.set(cache_key, response_tuple)

        response, valid_tags, invalid_tags, messages = response_tuple
        # Apply priority, PWG and status filters
        response, pwgs, statuses = self.apply_filters(response, priority_filter, pwg_filter, status_filter)
        # Get submitted and done requests separately
        submitted_requests = self.get_with_status(response, 'submitted')
        done_requests = self.get_with_status(response, 'done')
        # print(done_requests)
        # Continue aggregating data points for response
        logging.info('Will aggregate requests')
        response = self.aggregate_requests(response)
        logging.info('Will adjust for force complete')
        response = self.adjust_for_force_complete(response)
        logging.info('Will sort timestamps')
        timestamps = self.sort_timestamps(response, data_point_count)
        logging.info('Will adjust data points')
        data = self.aggregate_data_points(response, timestamps)
        logging.info('Will append last data point')
        data = self.append_last_data_point(data)
        res = {'data': data,
               'valid_tags': valid_tags,
               'invalid_tags': invalid_tags,
               'pwg': pwgs,
               'status': statuses,
               'submitted_requests': submitted_requests,
               'done_requests': done_requests,
               'messages': messages}
        end_time = time.time()
        logging.info('Will return. Took %.4fs' % (end_time - start_time))
        return json.dumps({'results': res})
