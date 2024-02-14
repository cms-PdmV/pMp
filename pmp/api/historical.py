"""A list of classes supporting historical statistics API"""
from pmp.api.common import APIBase
import json
import time
import logging
from werkzeug.contrib.cache import SimpleCache
import config
import re

# Disable expected events plot for the following processing strings
expected_events_ps_to_disable = [
    'PromptNanoAOD'
]

# Disable pattern
ps_blacklist_expected_events = "|".join(expected_events_ps_to_disable)
ps_blacklist_regex = re.compile(ps_blacklist_expected_events)


class HistoricalAPI(APIBase):
    """Used to return list of points for historical plots"""

    __cache = SimpleCache(threshold=config.CACHE_SIZE, default_timeout=config.CACHE_TIMEOUT)

    def __init__(self):
        APIBase.__init__(self)

    def aggregate_requests(self, data):
        """
        Aggregate list of requests and data points into dictionary by request name
        """
        aggregated = {}
        for request_details in data:
            prepid = request_details['request']
            aggregated[prepid] = {}
            aggregated[prepid]['data'] = []
            aggregated[prepid]['force_completed'] = request_details['force_completed']
            aggregated[prepid]['data'] = request_details['data']

        return aggregated

    def aggregate_data_points(self, data, timestamps):
        """
        Add points to response
        List of granularity timestamps. Put timestamps and iterate through all data.
        Add it or not according to which side of timestamp the time of a point is
        """
        points = []
        for timestamp in timestamps:
            point = {
                'done': 0,
                'produced': 0,
                'expected': 0,
                'invalid': 0,
                'time': timestamp * 1000,
                'expected_events': True
            }
            for key in data:
                if data[key]['data'][0]['time'] <= timestamp:
                    for details in reversed(data[key]['data']):
                        if details['time'] <= timestamp:
                            point['done'] += details['done']
                            point['produced'] += details['produced']
                            point['expected'] += details['expected']
                            point['invalid'] += details['invalid']
                            point['expected_events'] = details.get('expected_events', True)
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
                newest_details = data[key]['data'][-1]
                new_value = max(newest_details['done'], newest_details['invalid'], newest_details['produced'])
                for details in data[key]['data']:
                    details['expected'] = new_value

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

    def group_requests(self, data):
        """
        Group requests by PWG and then by priority block
        """
        grouped = {}
        for request_details in data:
            pwg = request_details['pwg'].upper()
            if pwg not in grouped:
                grouped[pwg] = {}

            priority_block = self.get_priority_block(request_details['priority'])
            priority_block = 'block%s' % (priority_block)
            if priority_block not in grouped[pwg]:
                grouped[pwg][priority_block] = []

            grouped[pwg][priority_block].append(request_details)

        return grouped

    def request_filter(self, request):
        return request.get('status') in ['submitted', 'done']

    def prepare_response(self, query, estimate_completed_events):
        """
        Loop through all the workflow data, generate response
        """
        response_list = []
        valid_tags = []
        invalid_tags = []
        messages = []
        query = query.split(',')
        seen_prepids = set()
        types_for_done_events = set(['VALID'])
        types_for_invalid_events = set(['INVALID', 'DELETED'])
        valid_status = set(['submitted', 'done'])
        for one in query:
            # Keep track of the prepids we've seen, so that we only add submission data points once
            logging.info('Processing %s' % (one))
            if not one:
                # Skip empty values
                continue

            found_something = False
            # Process the db documents
            for stats_document, mcm_document in self.db_query(one, estimate_completed_events=estimate_completed_events, skip_prepids=seen_prepids, request_filter=self.request_filter):
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

                if mcm_document.get('status') not in valid_status:
                    logging.info('Skipping %s because it is %s' % (mcm_document['prepid'], mcm_document['status']))
                    continue

                if 'submitted_time' not in mcm_document:
                    logging.info('Skipping %s because it was not submitted yet' % (mcm_document['prepid']))
                    continue

                found_something = True
                # create an array of requests to be processed
                response = {'data': [{'produced': 0,
                                      'produced_lumis': 0,
                                      'done': 0,
                                      'done_lumis': 0,
                                      'invalid': 0,
                                      'expected': int(mcm_document['expected']),
                                      'expected_lumis': int(mcm_document.get('total_input_lumis', 0)),
                                      'time': int(mcm_document['submitted_time'])}]}

                response['request'] = mcm_document['prepid']
                response['pwg'] = mcm_document['pwg']
                response['interested_pwg'] = mcm_document['interested_pwg']
                response['priority'] = mcm_document['priority']
                response['status'] = mcm_document['status']
                response['force_completed'] = mcm_document['force_completed']
                response['output_dataset'] = mcm_document['output_dataset']
                response['dataset'] = mcm_document.get('dataset_name', '')
                response['reqmgr_name'] = mcm_document.get('reqmgr_name', [])
                response['output_dataset_status'] = 'NONE'
                if 'estimate_from' in mcm_document:
                    response['estimate_from'] = mcm_document['estimate_from']

                status_timestamp = 0
                for history_entry in reversed(mcm_document.get('history', [])):
                    if history_entry.get('action') == mcm_document['status']:
                        status_timestamp = history_entry['time']
                        break

                response['status_timestamp'] = status_timestamp
                response['workflow_status'] = '<unknown>'
                response['workflow_status_timestamp'] = 0

                # Check if there is a document from stats (i.e. the workflow was found)
                if stats_document is not None:
                    # logging.info('Workflow name %s' % (stats_document['request_name']))
                    if stats_document.get('request_name'):
                        response['reqmgr_name'] = [stats_document['request_name']]

                    if stats_document.get('request_transition'):
                        last_request_transition = stats_document['request_transition'][-1]
                        response['workflow_status'] = last_request_transition['status']
                        response['workflow_status_timestamp'] = last_request_transition['update_time']

                    if mcm_document['output_dataset'] and 'event_number_history' in stats_document:
                        for history_record in stats_document['event_number_history']:
                            if history_record['dataset'] != mcm_document['output_dataset']:
                                continue

                            history = history_record.get('history', [])
                            history = sorted(history, key=lambda i: i['time'])
                            for entry in history:
                                data_point = {
                                    'produced': 0,
                                    'produced_lumis': 0,
                                    'done': 0,
                                    'done_lumis': 0,
                                    'invalid': 0,
                                    'expected': mcm_document.get('expected', 0),
                                    'expected_lumis': mcm_document.get('total_input_lumis', 0),
                                    'time': entry['time'],
                                    'expected_events': True
                                }

                                # For some processing strings, disable the plotting of expected_events
                                if ps_blacklist_regex.search(one):
                                    logging.info('Query: %s is part of the processing strings which expected events must be disabled', one)
                                    data_point['expected_events'] = False

                                events = entry.get('events', 0)
                                lumis = entry.get('lumis', 0)
                                if entry['type'] in types_for_done_events:
                                    data_point['done'] = events
                                    data_point['done_lumis'] = lumis
                                elif entry['type'] in types_for_invalid_events:
                                    data_point['invalid'] = events
                                else:
                                    data_point['produced'] = events
                                    data_point['produced_lumis'] = lumis

                                response['data'].append(data_point)

                            response['data'] = self.remove_useless_points(response['data'])
                            if len(history) > 0:
                                response['output_dataset_status'] = history[-1].get('type', 'NONE')

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
                seen_prepids.add(mcm_document['prepid'])
                response_list.append(response)

            if found_something:
                valid_tags.append(one)
                if self.is_instance(one, 'mcm_datatiers', 'mcm_datatier'):
                    messages.append('Note: results for %s include only submitted requests' % (one))

                if one == 'submitted':
                    messages.append('Note: this picks only the last submitted request in each chained request. This does NOT show ALL submitted requests in the system')
                elif one == 'submitted-no-nano':
                    messages.append('Note: this picks only the last submitted request in each chained request while ignoring NanoAOD requests')
            else:
                invalid_tags.append(one)

        #logging.info('Prepare response length is %d' % (len(response_list)))
        #logging.info('Response list is %s' % (json.dumps(response_list, indent=4)))
        return response_list, valid_tags, invalid_tags, messages

    def remove_useless_points(self, arr):
        """Compressing data: remove first data point of resubmissions and points
        that are equal to previous measurement
        """
        compressed = []
        prev = {'produced': -1, 'expected': -1}
        for data_point in arr:
            if (data_point['produced'] != prev['produced'] or
                data_point.get('produced_lumis') != prev.get('produced_lumis') or
                data_point['expected'] != prev['expected'] or
                data_point.get('expected_lumis') != prev.get('expected_lumis') or
                data_point['done'] != prev['done'] or
                data_point.get('done_lumis') != prev.get('done_lumis') or
                data_point['invalid'] != prev['invalid']):
                compressed.append(data_point)
                prev = data_point

        return compressed

    def sort_timestamps(self, data, limit):
        """Reduce the number of timestamps to limit"""
        times = []
        for details in data:
            times += [i['time'] for i in data[details]['data']]

        times = set(times)

        if limit > len(times):
            # No point making more data points than we have the data for
            return sorted(times)

        # Get a list of times evenly distributed between the first data point and the last
        latest = int(max(times))
        earliest = int(min(times))

        data_points = list(range(earliest, latest, int((latest - earliest) / (limit))))
        if data_points[-1] < latest:
            data_points[-1] = latest

        return sorted(data_points)

    def get_with_status(self, data, status):
        new_data = []
        for request in data:
            if request.get('status') != status:
                continue

            data_points = sorted(request.get('data', []), key=lambda k: k['time'])
            if not data_points:
                data_points = [{'done': 0, 'done_lumis': 0, 'produced': 0, 'produced_lumis': 0}]

            workflow_name = ''
            if len(request.get('reqmgr_name', [])) > 0:
                workflow_name = request['reqmgr_name'][-1]

            new_data.append({'prepid': request['request'],
                             'priority': request['priority'],
                             'output_dataset': request['output_dataset'],
                             'output_dataset_status': request['output_dataset_status'],
                             'dataset': request['dataset'],
                             'expected': data_points[-1]['expected'],
                             'expected_lumis': data_points[-1]['expected_lumis'],
                             'done': max(data_points[-1]['done'], data_points[-1]['produced'], data_points[-1]['invalid']),
                             'done_lumis': max(data_points[-1]['done_lumis'], data_points[-1]['produced_lumis']),
                             'force_completed': request['force_completed'],
                             'estimate_from': request.get('estimate_from', None),
                             'workflow': workflow_name,
                             'status_timestamp': request['status_timestamp'],
                             'workflow_status': request['workflow_status'],
                             'workflow_status_timestamp': request['workflow_status_timestamp']})

        new_data = sorted(new_data, key=lambda k: k['prepid'])
        return new_data

    def get(self, query, data_point_count=250, estimate_completed_events=False, priority_filter=None, pwg_filter=None, interested_pwg_filter=None, status_filter=None, aggregate=True):
        """
        Get the historical data based on query, data point count, priority and filter
        """
        start_time = time.time()
        logging.info('Historical: q=%s, point=%s estimate=%s, prio=%s, pwg=%s, i_pwg=%s, status=%s, agg=%s' % (query,
                                                                                                               data_point_count,
                                                                                                               estimate_completed_events,
                                                                                                               priority_filter,
                                                                                                               pwg_filter,
                                                                                                               interested_pwg_filter,
                                                                                                               status_filter,
                                                                                                               aggregate))
        
        cache_key = 'present_%s_____%s' % (query, estimate_completed_events)
        if self.__cache.has(cache_key):
            logging.info('Found result in cache for key: %s' % cache_key)
            response_tuple = self.__cache.get(cache_key)
        else:
            # Construct data by given query
            response_tuple = self.prepare_response(query, estimate_completed_events)
            self.__cache.set(cache_key, response_tuple)

        response_tuple = self.prepare_response(query, estimate_completed_events)
        response, valid_tags, invalid_tags, messages = response_tuple
        # Apply priority, PWG and status filters
        response, pwgs, interested_pwgs, statuses = self.apply_filters(response, priority_filter, pwg_filter, interested_pwg_filter, status_filter)
        # Get submitted and done requests separately
        submitted_requests = self.get_with_status(response, 'submitted')
        done_requests = self.get_with_status(response, 'done')

        if not aggregate:
            grouped_requests = self.group_requests(response)
            data = {}
            for pwg, pwg_data in grouped_requests.items():
                data[pwg] = {}
                for block, block_data in pwg_data.items():
                    logging.info('Will aggregate requests of of %s of %s', block, pwg)
                    block_data = self.aggregate_requests(block_data)
                    logging.info('Will adjust for force complete of %s of %s', block, pwg)
                    block_data = self.adjust_for_force_complete(block_data)
                    logging.info('Will sort timestamps of %s of %s', block, pwg)
                    timestamps = self.sort_timestamps(block_data, data_point_count)
                    logging.info('Will adjust data points of %s of %s', block, pwg)
                    data[pwg][block] = self.aggregate_data_points(block_data, timestamps)
                    logging.info('Remove useless points for the last time of %s of %s', block, pwg)
                    data[pwg][block] = self.remove_useless_points(data[pwg][block])
                    logging.info('Will append last data point of %s of %s', block, pwg)
                    data[pwg][block] = self.append_last_data_point(data[pwg][block])

        else:
            # Continue aggregating data points for response
            logging.info('Will aggregate requests')
            response = self.aggregate_requests(response)
            logging.info('Will adjust for force complete')
            response = self.adjust_for_force_complete(response)
            logging.info('Will sort timestamps')
            timestamps = self.sort_timestamps(response, data_point_count)
            logging.info('Will adjust data points')
            data = self.aggregate_data_points(response, timestamps)
            logging.info('Remove useless points for the last time')
            data = self.remove_useless_points(data)
            logging.info('Will append last data point')
            data = self.append_last_data_point(data)

        res = {'data': data,
               'valid_tags': valid_tags,
               'invalid_tags': invalid_tags,
               'pwg': pwgs,
               'interested_pwg': interested_pwgs,
               'status': statuses,
               'submitted_requests': submitted_requests,
               'done_requests': done_requests,
               'messages': messages}
        end_time = time.time()
        logging.info('Will return. Took %.4fs' % (end_time - start_time))
        return json.dumps({'results': res})
