"""A list of classes supporting present statistics API"""
from pmp.api.common import APIBase
import json
import logging
from werkzeug.contrib.cache import SimpleCache
import config
import time


class PresentAPI(APIBase):

    __cache = SimpleCache(threshold=config.CACHE_SIZE, default_timeout=config.CACHE_TIMEOUT)

    def __init__(self):
        APIBase.__init__(self)

    def sum(self, thing):
        if thing is None:
            return 0

        if isinstance(thing, int):
            return thing

        if isinstance(thing, float):
            return int(thing + 0.5)

        return sum(thing)

    def prepare_response(self, query, estimate_completed_events):
        response_list = []
        valid_tags = []
        invalid_tags = []
        messages = []
        query = query.split(',')
        seen_prepids = set()
        for one in query:
            # Keep track of the prepids we've seen, so that we only add submission data points once
            logging.info('Processing %s' % (one))
            if not one:
                # Skip empty values
                continue

            found_something = False
            # Process the db documents
            for stats_document, mcm_document in self.db_query(one, include_stats_document=True, estimate_completed_events=estimate_completed_events, skip_prepids=seen_prepids):
                # skip legacy request with no prep_id
                if len(mcm_document.get('prepid', '')) == 0:
                    continue

                found_something = True
                completed_events = self.number_of_completed_events(stats_document, mcm_document['output_dataset'])
                seen_prepids.add(mcm_document['prepid'])
                workflow_name = ''
                workflow_status = 'n/a'
                if stats_document:
                    workflow_name = stats_document['request_name']
                elif len(mcm_document.get('reqmgr_name', [])) > 0:
                    workflow_name = mcm_document['reqmgr_name'][-1]

                if workflow_name:
                    reqmgr_status_history = mcm_document.get('reqmgr_status_history', [])
                    for history_entry in reqmgr_status_history:
                        if history_entry['name'] == workflow_name:
                            statuses = history_entry['history']
                            if statuses:
                                workflow_status = statuses[-1]

                            break

                response_list.append({'member_of_campaign': mcm_document['member_of_campaign'],
                                      'prepid': mcm_document['prepid'],
                                      'pwg': mcm_document['pwg'],
                                      'interested_pwg': mcm_document['interested_pwg'],
                                      'status': mcm_document['status'],
                                      'priority': mcm_document['priority'],
                                      'member_of_chain': mcm_document.get('member_of_chain', []),
                                      'is_member_of_chain': 'YES' if len(mcm_document.get('member_of_chain', [])) > 0 else 'NO',
                                      'time_event_sum': self.sum(mcm_document.get('time_event', [])),
                                      'total_events': mcm_document['total_events'],
                                      'dataset_name': mcm_document.get('dataset_name', ''),
                                      'completed_events': completed_events,
                                      'estimate_from': mcm_document.get('estimate_from'),
                                      'workflow': workflow_name,
                                      'workflow_status': workflow_status})

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
                logging.warning('No data for %s' % (one))

        return response_list, valid_tags, invalid_tags, messages

    def get(self, query, estimate_completed_events=False, priority_filter=None, pwg_filter=None, interested_pwg_filter=None, status_filter=None):

        """
        Get the historical data based on query, data point count, priority and filter
        """
        start_time = time.time()
        logging.info('%s (%s) | %s (%s) | %s (%s) | %s (%s) | %s (%s)' % (query,
                                                                          type(query),
                                                                          priority_filter,
                                                                          type(priority_filter),
                                                                          pwg_filter,
                                                                          type(pwg_filter),
                                                                          interested_pwg_filter,
                                                                          type(interested_pwg_filter),
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
        response, pwgs, interested_pwgs, statuses = self.apply_filters(response, priority_filter, pwg_filter, interested_pwg_filter, status_filter)
        res = {'data': response,
               'valid_tags': valid_tags,
               'invalid_tags': invalid_tags,
               'pwg': pwgs,
               'interested_pwg': interested_pwgs,
               'status': statuses,
               'messages': messages}
        end_time = time.time()
        logging.info('Will return. Took %.4fs' % (end_time - start_time))
        return json.dumps({'results': res})
