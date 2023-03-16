"""A list of classes for utils api"""
import json
import os
import logging
import config
import time
from datetime import datetime
from subprocess import call
from fetchd.utils import Utils
import pmp.api.esadapter as esadapter
from cachelib.simple import SimpleCache
from elasticsearch import NotFoundError


class SuggestionsAPI(esadapter.InitConnection):
    """
    Used to search in elastic index for similar PrepIDs as given
    """
    __cache = SimpleCache(threshold=config.CACHE_SIZE, default_timeout=config.CACHE_TIMEOUT)

    def __init__(self, typeof):
        esadapter.InitConnection.__init__(self)
        self.max_results_in_index = 200
        self.max_suggestions = 200
        self.present = (typeof == 'present')
        self.historical = (typeof == 'historical')
        self.performance = (typeof == 'performance')

    def get(self, query):
        """
        Get suggestions for the query
        Order:
          campaign
          request
          chained campaign
          chained request
          ppd tag
          tag
          flow
          mcm dataset name
          rereco request
          rereco processing string
          rereco campaign
          relval request
          relval cmssw version
          relval campaign
        """
        query = query.replace(' ', '*')
        cache_key = 'suggestions_%s' % (query)
        if self.__cache.has(cache_key):
            results = self.__cache.get(cache_key)
            if len(results) > 0:
                logging.info('Found %s suggestions in cache for %s' % (len(results), cache_key))
                return json.dumps({'results': results})

        search = 'prepid:*%s*' % (query)

        results = []
        suggestion_queries = [{'type': 'RERECO CAMPAIGN', 'index': 'rereco_campaigns'},
                              {'type': 'CAMPAIGN', 'index': 'campaigns'},
                              # {'type': 'REQUEST', 'index': 'requests'},
                              # {'type': 'CHAINED CAMPAIGN', 'index': 'chained_campaigns'},
                              # {'type': 'CHAINED REQUEST', 'index': 'chained_requests'},
                              {'type': 'PPD TAG', 'index': 'ppd_tags'},
                              {'type': 'TAG', 'index': 'tags'},
                              # {'type': 'FLOW', 'index': 'flows'},
                              # {'type': 'MCM DATASET', 'index': 'mcm_dataset_names'},
                              {'type': 'DATATIER', 'index': 'mcm_datatiers'},
                              # {'type': 'RERECO', 'index': 'rereco_requests'},
                              {'type': 'PROCESSING STRING', 'index': 'processing_strings'},
                              # {'type': 'RELVAL', 'index': 'relval_requests'},
                              # {'type': 'RELVAL CMSSW', 'index': 'relval_cmssw_versions'},
                              # {'type': 'RELVAL CAMPAIGN', 'index': 'relval_campaigns'}]
                             ]

        for suggestion_query in suggestion_queries:
            suggestion_results = [x['_id'] for x in self.search(search,
                                                                suggestion_query['index'],
                                                                self.max_suggestions,
                                                                self.max_suggestions)]
            suggestion_query['all_suggestions'] = [{'type': suggestion_query['type'], 'label': x} for x in suggestion_results]
            suggestion_query['selected_suggestions'] = []

        used_suggestions = set()
        for i in range(self.max_suggestions):
            for suggestion_query in suggestion_queries:
                if i < len(suggestion_query.get('all_suggestions', [])):
                    suggestion = suggestion_query['all_suggestions'][i]
                    if suggestion['label'] not in used_suggestions:
                        suggestion_query['selected_suggestions'].append(suggestion)
                        used_suggestions.add(suggestion['label'])

                if len(used_suggestions) >= self.max_suggestions:
                    break

            if len(used_suggestions) >= self.max_suggestions:
                break

        selected_results = []
        for suggestion_query in suggestion_queries:
            selected_results.extend(sorted(suggestion_query.get('selected_suggestions'), key=lambda x: x['label']))

        results = selected_results
        logging.info('Found %s suggestions for %s' % (len(results), search))

        self.__cache.set(cache_key, results)
        return json.dumps({'results': results})


class ShortenAPI(object):
    """Shorten URL with tinyurl api"""

    def __init__(self):
        # api url
        self.base_url = "http://tinyurl.com/api-create.php?url="

    def get(self, url):
        """
        Curl tinyurl and return url
        """
        response, _ = Utils.curl('GET', self.base_url + url, parse_json=False)
        logging.info('Shortened %s to %s' % (url, response))
        return response


class ScreenshotAPI(object):
    """Generate screenshot/report api"""

    def __init__(self):
        self.static_dir = 'pmp/static/'

    @staticmethod
    def get_time():
        """Get current time"""
        return str(datetime.now()).replace(' ', '_').replace(':', '-').replace('.', '-')

    @staticmethod
    def is_file(check_file):
        """Check if file exists"""
        return os.path.isfile(check_file) and os.access(check_file, os.R_OK)

    def generate_name(self):
        """Generate file name"""
        return 'tmp/pmp_' + self.get_time()

    def get(self, svg_content, output_format='png'):
        """Generate file and return its url"""
        while True:
            gen_name = self.generate_name()
            svg_file = self.static_dir + gen_name + '.svg'
            if not self.is_file(svg_file):
                break
        tmp_file = open(svg_file, 'w')
        tmp_file.write(svg_content.replace('U+0023', '#'))
        tmp_file.close()
        if output_format != 'svg':
            output_file = self.static_dir + gen_name + '.' + output_format
            call(['rsvg-convert', '-o', output_file, '-f', output_format,
                  '--background-color', 'white', svg_file])
        return 'static/' + gen_name + '.' + output_format


class OverallAPI(object):
    """
    Get number statistics from DB
    """
    def get(self, collections):
        """
        Query DB and return response
        """
        results = {}
        for collection_name in collections:
            response, _ = Utils.curl('GET', config.DATABASE_URL + collection_name + '/_count')
            count = response.get('count', 0)
            results[collection_name.replace('_', ' ')] = count

        logging.info('OverallAPI results: %s' % (results))
        return json.dumps({"results": results}, sort_keys=True)


class LastUpdateAPI(esadapter.InitConnection):
    def __init__(self):
        esadapter.InitConnection.__init__(self)
        Utils.setup_console_logging()

    def get(self):
        last_sequences = self.search(query='*',
                                     index='last_sequences',
                                     max_results=1000)
        last_update = min([x['time'] for x in last_sequences]) / 1000.0
        last_update_date = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(last_update))
        current_time = time.time()
        seconds_ago = current_time - last_update
        if seconds_ago < 60:
            ago = 'less than a minute ago'
        else:
            minutes_ago = int(seconds_ago / 60)
            if minutes_ago < 60:
                m = minutes_ago
                ago = '%d minute%s ago' % (m, '' if m == 1 else 's')
            else:
                h = int(minutes_ago / 60)
                m = int(minutes_ago - (60 * int(minutes_ago / 60)))
                ago = '%d hour%s and %d minute%s ago' % (h, '' if h == 1 else 's', m, '' if m == 1 else 's')

        return {"results": {'timestamp': last_update, 'date': last_update_date, 'ago': ago}}


class AdminAPI(esadapter.InitConnection):
    def __init__(self):
        esadapter.InitConnection.__init__(self)
        Utils.setup_console_logging()

    def get(self):
        collections, _ = Utils.curl('GET', config.DATABASE_URL + '_aliases?pretty=false')
        collections = collections.keys()
        results = {}
        for collection_name in collections:
            response, _ = Utils.curl('GET', config.DATABASE_URL + collection_name + '/_count')
            collection_name = collection_name.replace('_', ' ')
            count = response.get('count', 0)
            results[collection_name] = {}
            results[collection_name]['total'] = count

        last_sequences = self.search(query='*',
                                     index='last_sequences',
                                     max_results=1)
        for last_sequence in last_sequences:
            name = last_sequence['_id']
            if name in results:
                last_update = last_sequence.get('time', 0) / 1000.0
                results[name]['last_update'] = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(last_update))

        return results


class ObjectListAPI(esadapter.InitConnection):
    def __init__(self):
        esadapter.InitConnection.__init__(self)
        Utils.setup_console_logging()

    def get(self, collection_name):
        return [x['_id'] for x in self.search(query='*',
                                              index=collection_name,
                                              max_results=10000)]


class APIBase(esadapter.InitConnection):

    __cache = SimpleCache(threshold=config.CACHE_SIZE, default_timeout=config.CACHE_TIMEOUT)

    def __init__(self):
        esadapter.InitConnection.__init__(self)
        Utils.setup_console_logging()

    def is_instance(self, prepid, index, doc_type):
        """
        Checks if prepid matches any typeof in the index
        """
        try:
            self.es.get_source(index=index, doc_type=doc_type, id=prepid)
        except NotFoundError:
            return False

        return True

    def parse_query(self, query):
        """
        Returns query and index name
        First it checks if there are wildcards in query
        If there are wildcards, it checks for matching requests and rereco requests
        If there are no wildcards, check for exact matches in following order
        Order:
          campaign
          request
          chained campaign
          chained request
          ppd tag
          tag
          flow
          mcm dataset name
          mcm datatier
          rereco request
          rereco processing string
          rereco campaign
          relval request
          relval cmssw version
          relval campaign
        """
        cache_key = 'parse_query_%s' % (query)
        if self.__cache.has(cache_key):
            result = self.__cache.get(cache_key)
            logging.info('Found result in cache for key: %s' % cache_key)
            return result

        allowed_characters = ('abcdefghijklmnopqrstuvwxyz'
                              'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                              '01234567890-_*')
        query_allowed_characters = ''.join([x for x in query if x in allowed_characters])
        if '*' in query and len(query_allowed_characters.replace('*', '')) < 8:
            # If there are less than 8 non *  characters, do not search
            # This is done to avoid things like *-*-*
            return None, None

        if '*' in query:
            # Wildcard search
            # Lord have mercy on poor pMp
            if self.search(query, 'requests', page_size=1, max_results=1):
                result = ('prepid:%s' % (query), 'requests')

            elif self.search(query, 'rereco_requests', page_size=1, max_results=1):
                result = ('prepid:%s' % (query), 'rereco_requests')

            else:
                result = (None, None)
        else:
            # Exact match
            if self.is_instance(query, 'campaigns', 'campaign'):
                result = ('member_of_campaign:%s' % (query), 'requests')

            elif self.is_instance(query, 'requests', 'request'):
                result = ('prepid:%s' % (query), 'requests')

            elif self.is_instance(query, 'chained_campaigns', 'chained_campaign'):
                result = ('member_of_campaign:%s' % (query), 'chained_requests')

            elif self.is_instance(query, 'chained_requests', 'chained_request'):
                result = ('member_of_chain:%s' % (query), 'requests')

            elif self.is_instance(query, 'ppd_tags', 'ppd_tag'):
                result = ('ppd_tags:%s' % (query), 'requests')

            elif self.is_instance(query, 'tags', 'tag'):
                result = ('tags:%s' % (query), 'requests')

            elif self.is_instance(query, 'flows', 'flow'):
                result = ('flown_with:%s' % (query), 'requests')

            elif self.is_instance(query, 'mcm_dataset_names', 'mcm_dataset_name'):
                result = ('dataset_name:%s' % (query), 'requests')

            elif self.is_instance(query, 'mcm_datatiers', 'mcm_datatier'):
                result = ('datatiers:%s AND status:submitted' % (query), 'requests')

            elif self.is_instance(query, 'rereco_requests', 'rereco_request'):
                result = ('prepid:%s' % (query), 'rereco_requests')

            elif self.is_instance(query, 'processing_strings', 'processing_string'):
                result = ('processing_string:%s' % (query), 'rereco_requests')

            elif self.is_instance(query, 'rereco_campaigns', 'rereco_campaign'):
                result = ('member_of_campaign:%s' % (query), 'rereco_requests')

            elif self.is_instance(query, 'relval_requests', 'relval_request'):
                result = ('prepid:%s' % (query), 'relval_requests')

            elif self.is_instance(query, 'relval_cmssw_versions', 'relval_cmssw_version'):
                result = ('cmssw_version:%s' % (query), 'relval_requests')

            elif self.is_instance(query, 'relval_campaigns', 'relval_campaign'):
                result = ('member_of_campaign:%s' % (query), 'relval_requests')

            else:
                result = (None, None)

        self.__cache.set(cache_key, result)
        return result

    def number_of_completed_events(self, stats_document, output_dataset):
        completed_events = 0
        if stats_document and output_dataset and 'event_number_history' in stats_document:
            for history_record in stats_document['event_number_history']:
                if history_record['dataset'] != output_dataset:
                    continue

                if len(history_record.get('history', [])) == 0:
                    break

                newest_entry = sorted(history_record.get('history', []), key=lambda k: k['time'])[-1]
                if newest_entry['type'] == 'VALID' or newest_entry['type'] == 'PRODUCTION':
                    completed_events = newest_entry.get('events', 0)

        return completed_events

    def get_info_for_estimate(self, req):
        """
        Return (tuple) a request name, output dataset and request manager name
        Returns name of request, it's dataset and request manager name that should
        be used to estimate number of completed events of given request
        """
        member_of_chains = req['member_of_chain']
        potential_results_with_events = []
        for member_of_chain in member_of_chains:
            chained_requests = self.search(query='prepid:%s' % (member_of_chain),
                                           index='chained_requests')

            logging.info('Will look in %s chained requests for %s estimate' % (len(chained_requests), req['prepid']))
            for chained_request in chained_requests:
                chain = chained_request.get('chain', [])
                if req['prepid'] in chain:
                    following_requests = chain[chain.index(req['prepid']) + 1:]
                    for following_request_prepid in following_requests:
                        following_requests = list(self.db_query(following_request_prepid,
                                                                include_stats_document=True,
                                                                estimate_completed_events=False))

                        if len(following_requests) == 0:
                            continue

                        stats_document, mcm_document = following_requests[0]
                        output_dataset = mcm_document.get('output_dataset')
                        request_manager_name = mcm_document.get('name')
                        request = mcm_document.get('prepid')
                        if output_dataset and request_manager_name:
                            potential_results_with_events.append((self.number_of_completed_events(stats_document, output_dataset),
                                                                  request,
                                                                  output_dataset,
                                                                  request_manager_name))
                            # Find next one that has dataset, no need to iterate over all of the chain
                            break

        potential_results_with_events = sorted(potential_results_with_events, key=lambda k: k[0])
        if len(potential_results_with_events) > 0:
            best_match = potential_results_with_events[0]
            logging.info('Best match for %s is %s %s %s' % (req['prepid'], best_match[1], best_match[2], best_match[3]))
            return best_match[1], best_match[2], best_match[3]

        return None, None, None

    def db_query(self, query, include_stats_document=True, estimate_completed_events=False, skip_prepids=None, request_filter=None):
        """
        Query DB and return array of raw documents
        Tuple of three things is returned: stats document, mcm document
        """

        req_arr = []
        if query in ('submitted', 'submitted-no-nano', 'submitted-all'):
            index = 'requests'
            es_query = 'status:submitted'
            requests = {x['prepid']: x for x in self.search(es_query, index)}
            if query == 'submitted-no-nano':
                requests = {prepid: request for prepid, request in requests.items() if 'nanoaod' not in prepid.lower()}
                logging.info('Removed NanoAOD requests')

            if query in ('submitted', 'submitted-no-nano'):
                chained_reqs = set()
                logging.info('Found %s submitted requests', len(requests))
                for _, req in requests.items():
                    chained_reqs.update(req.get('member_of_chain', []))

                logging.info('Collected %s chained requests from these campaigns', len(chained_reqs))
                chained_reqs = self.es.mget(index='chained_requests',
                                            doc_type='chained_request',
                                            body={'ids': list(chained_reqs)})['docs']
                logging.info('Feched %s chained requests', len(chained_reqs))
                added_reqs = set()
                for chained_req in chained_reqs:
                    chain = chained_req['_source']['chain']
                    for prepid in reversed(chain):
                        req = requests.get(prepid)
                        if not req:
                            continue

                        if prepid not in added_reqs:
                            req_arr.append(req)
                            added_reqs.add(prepid)

                        break

                logging.info('Picked %s requests in these chaied requests', len(req_arr))
            else:
                req_arr = [req for _, req in requests.items()]
                logging.info('Taking all %s submitted requests', len(req_arr))
        else:
            es_query, index = self.parse_query(query)
            logging.info('Query: %s, index: %s' % (es_query, index))
            if index is None:
                logging.info('Returning nothing because index for %s could not be found' % (query))
                return []

            if index == 'chained_requests':
                chained_requests = self.search(es_query, index)
                for chained_request in chained_requests:
                    es_query, index = ('member_of_chain:%s' % (chained_request.get('prepid')), 'requests')
                    req_arr.extend(self.search(es_query, index))
            else:
                req_arr = self.search(es_query, index)

        if index == 'requests':
            logging.info('Found %d requests for %s' % (len(req_arr), es_query))
        elif index == 'relval_requests':
            logging.info('Found %s RelVal requests from %s' % (len(req_arr), es_query))
        elif index == 'rereco_requests':
            logging.info('Found %d ReReco requests for %s' % (len(req_arr), es_query))

        # Iterate over array and collect details (McM documents)
        if index == 'rereco_requests' or index == 'relval_requests':
            output_dataset_index = -1
        else:
            output_dataset_index = 0

        if skip_prepids is None:
            skip_prepids = set()

        if request_filter:
            logging.info('Requests before request filter %s' % (len(req_arr)))
            req_arr = [req for req in req_arr if request_filter(req)]
            logging.info('Requests after request filter %s' % (len(req_arr)))

        req_mgr_names_set = set()
        req_mgr_names_map = {}
        for req in req_arr:
            if req.get('prepid', '') in skip_prepids:
                logging.info('Skipping %s as it is in skippable prepids list',
                             req.get('prepid', ''))
                continue

            dataset_list = req.get('output_dataset', [])
            if dataset_list == None:
                # For some reason output dataset becomes null
                refetched = self.es.get_source(index='requests',
                                               doc_type='request',
                                               id=req['prepid'])
                logging.info('Refetched %s because output datasets were null', req['prepid'])
                dataset_list = refetched.get('output_dataset', [])

            if len(dataset_list) > 0:
                dataset = dataset_list[output_dataset_index]
            else:
                dataset = None

            if not dataset and estimate_completed_events and index == 'requests' and include_stats_document:
                logging.info('Will try to find closest estimate for %s' % (req['prepid']))
                closest_request, closest_output_dataset, closest_request_manager = self.get_info_for_estimate(req)
                if closest_request and closest_output_dataset and closest_request_manager:
                    logging.info('Will use %s dataset and %s request manager of %s as an estimate for %s' % (closest_output_dataset,
                                                                                                             closest_request_manager,
                                                                                                             closest_request,
                                                                                                             req['prepid']))
                    dataset = closest_output_dataset
                    req['reqmgr_name'] = [closest_request_manager]
                    req['estimate_from'] = closest_request

            req['force_completed'] = False
            req['expected'] = req['total_events']
            req['output_dataset'] = dataset
            for reqmgr_dict in req.get('reqmgr_status_history', []):
                if 'force-complete' in reqmgr_dict['history']:
                    req['force_completed'] = True
                    break

            # Get time of last transition to "submitted"
            for item in reversed(req['history']):
                if item['action'] == 'submitted':
                    req['submitted_time'] = item['time']
                    break

            # Get the time of the *last* transition to status "done"
            for item in reversed(req['history']):
                if item['action'] == 'done':
                    req['done_time'] = item['time']
                    break

            if not include_stats_document:
                req['reqmgr_name'] = []
            else:
                # Collect all reqmgr_names
                for reqmgr in req['reqmgr_name']:
                    req_mgr_names_set.add(reqmgr)

            if len(req_mgr_names_set) > 10000:
                self.fetch_workflows_into_dictionary(list(req_mgr_names_set), req_mgr_names_map)
                req_mgr_names_set = set()

        self.fetch_workflows_into_dictionary(list(req_mgr_names_set), req_mgr_names_map)
        results_to_return = []
        for res in req_arr:
            for reqmgr in reversed(res['reqmgr_name']):
                if reqmgr in req_mgr_names_map:
                    res['name'] = reqmgr
                    results_to_return.append((req_mgr_names_map[reqmgr], res))
                    break
            else:
                results_to_return.append((None, res))

        return results_to_return

    def fetch_workflows_into_dictionary(self, workflow_ids, result_dictionary):
        """
        Fetch workflows using workflow_ids list of ids and fill result dictionary
        with results where workflow id is a key and it's _source is value
        Skip workflows that are resubmissions
        """
        if len(workflow_ids) == 0:
            return

        logging.info('Will try to get %s workflows' % len(workflow_ids))
        workflows = self.es.mget(index='workflows',
                                 doc_type='workflow',
                                 body={'ids': workflow_ids})['docs']

        found = 0
        for workflow in workflows:
            if workflow['found']:
                workflow_source = workflow['_source']
                if workflow_source.get('request_type').lower() != 'resubmission':
                    found += 1
                    result_dictionary[workflow['_id']] = workflow['_source']

        logging.info('Got %s workflows' % (found))

    def apply_filters(self, data, priority_filter, pwg_filter, interested_pwg_filter, status_filter):
        """
        Priority filter is an array of min and max priorities
        PWG filter is list of strings (pwg) of requests to include
        Status filter is list of strings (status) of requests to include
        Return new data and dictionaries of pwgs and status filters that show whether
        these values were left (True) or filtered out (False)
        """
        logging.info('Requests before filtering %s' % (len(data)))
        new_data = []
        if pwg_filter is not None:
            pwg_filter = [x.upper() for x in pwg_filter if x]

        if interested_pwg_filter is not None:
            interested_pwg_filter = [x.upper() for x in interested_pwg_filter if x]

        if status_filter is not None:
            status_filter = [x.lower() for x in status_filter if x]

        all_pwgs = {}
        all_interested_pwgs = {}
        all_statuses = {}
        for item in data:
            pwg = item.get('pwg', '').upper()
            if pwg not in all_pwgs:
                if pwg_filter is not None:
                    all_pwgs[pwg] = pwg in pwg_filter
                else:
                    all_pwgs[pwg] = True

            interested_pwgs = set(item.get('interested_pwg', []))
            for interested_pwg in interested_pwgs:
                if interested_pwg not in all_interested_pwgs:
                    if interested_pwg_filter is not None:
                        all_interested_pwgs[interested_pwg] = interested_pwg in interested_pwg_filter
                    else:
                        all_interested_pwgs[interested_pwg] = True

            status = item.get('status', '').lower()
            if status not in all_statuses:
                if status_filter is not None:
                    all_statuses[status] = status in status_filter
                else:
                    all_statuses[status] = True

            try:
                priority = int(item.get('priority'))
            except:
                priority = None

            if priority is not None:
                if priority_filter is not None:
                    lower_priority = priority_filter[0]
                    upper_priority = priority_filter[1]
                    if lower_priority is not None and priority < lower_priority:
                        continue

                    if upper_priority is not None and priority >= upper_priority:
                        continue

            if all_pwgs[pwg] and all_statuses[status]:
                if interested_pwg_filter is None:
                    new_data.append(item)
                else:
                    for interested_pwg in interested_pwgs:
                        if all_interested_pwgs[interested_pwg]:
                            new_data.append(item)
                            break

        logging.info('Requests after filtering %s' % (len(new_data)))
        return new_data, all_pwgs, all_interested_pwgs, all_statuses

    def get_priority_block(self, priority):
        """
        Return priority block for given priority
        """
        priority = int(priority)
        if priority >= 130000:
            return 0

        if priority >= 110000:
            return 1

        if priority >= 90000:
            return 2

        if priority >= 85000:
            return 3

        if priority >= 80000:
            return 4

        if priority >= 70000:
            return 5

        if priority >= 63000:
            return 6

        return 7
