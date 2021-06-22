"""A list of classes supporting performance statistics API"""
from pmp.api.common import APIBase
import json
import logging
from werkzeug.contrib.cache import SimpleCache
import config


class PerformanceAPI(APIBase):
    """Return list of requests with history points"""

    status_order = ['n/a', 'new', 'validation', 'defined', 'approved', 'submitted', 'done',
                    'assignment-approved', 'assigned', 'staging', 'staged', 'acquired', 'running-open',
                    'running-closed', 'force-complete', 'completed', 'closed-out', 'announced', 'normal-archived',
                    'rejected', 'rejected-archived', 'failed', 'aborted', 'aborted-completed', 'aborted-archived']

    __cache = SimpleCache(threshold=config.CACHE_SIZE, default_timeout=config.CACHE_TIMEOUT)

    def __init__(self):
        APIBase.__init__(self)

    def prepare_response(self, query):
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
            for stats_document, mcm_document in self.db_query(one, skip_prepids=seen_prepids):
                # skip legacy request with no prep_id
                if len(mcm_document.get('prepid', '')) == 0:
                    continue

                # Remove new and unchained to clean up output plots
                if mcm_document['status'] == 'new' and len(mcm_document.get('member_of_chain', [])) == 0:
                    logging.info('Skipping %s because status is %s OR it is member of %s chains' % (mcm_document['prepid'],
                                                                                                    mcm_document['status'],
                                                                                                    len(mcm_document.get('member_of_chain', []))))
                    continue

                found_something = True
                # duplicates fix ie. when request was reset
                history = {'mcm': {}, 'reqmgr2': {}}
                if stats_document:
                    for history_entry in stats_document['request_transition']:
                        history['reqmgr2'][history_entry['status']] = history_entry['update_time']

                for history_entry in mcm_document['history']:
                    history['mcm'][history_entry['action']] = history_entry['time']

                workflow_name = ''
                if len(mcm_document.get('reqmgr_name', [])) > 0:
                    workflow_name = mcm_document['reqmgr_name'][0]

                mcm_document['history'] = history
                seen_prepids.add(mcm_document['prepid'])
                response_list.append({'history': mcm_document['history'],
                                      'prepid': mcm_document['prepid'],
                                      'pwg': mcm_document['pwg'],
                                      'interested_pwg': mcm_document['interested_pwg'],
                                      'status': mcm_document['status'],
                                      'priority': mcm_document['priority'],
                                      'workflow': workflow_name})

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

        return response_list, valid_tags, invalid_tags, messages

    def get_all_statuses_in_history(self, data):
        """
        Get list of all possible statuses in data
        """
        statuses = {}
        for item in data:
            for tool_name, entries in item['history'].items():
                tool_statuses = statuses.setdefault(tool_name, set())
                for status in entries.keys():
                    tool_statuses.add(status.lower())

        order = {name: i for i, name in enumerate(self.status_order)}
        statuses = {name: sorted(entries, key=lambda i: order.get(i, -1)) for name, entries in statuses.items()}
        return statuses

    def get(self, query, priority_filter=None, pwg_filter=None, interested_pwg_filter=None, status_filter=None):
        """
        Get the historical data based on query, data point count, priority and filter
        """
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

        cache_key = 'performance_%s' % (query)
        if self.__cache.has(cache_key):
            logging.info('Found result in cache for key: %s' % cache_key)
            response_tuple = self.__cache.get(cache_key)
        else:
            # Construct data by given query
            response_tuple = self.prepare_response(query)
            self.__cache.set(cache_key, response_tuple)

        response, valid_tags, invalid_tags, messages = response_tuple
        logging.info('Requests before filtering %s' % (len(response)))
        # Apply priority, PWG and status filters
        response, pwgs, interested_pwgs, statuses = self.apply_filters(response, priority_filter, pwg_filter, interested_pwg_filter, status_filter)
        all_statuses_in_history = self.get_all_statuses_in_history(response)
        logging.info('Requests after filtering %s' % (len(response)))
        res = {'data': response,
               'valid_tags': valid_tags,
               'invalid_tags': invalid_tags,
               'pwg': pwgs,
               'interested_pwg': interested_pwgs,
               'status': statuses,
               'all_statuses_in_history': all_statuses_in_history,
               'messages': messages}
        logging.info('Will return')
        return json.dumps({'results': res})
