"""A list of classes for utils api"""
from datetime import datetime
from subprocess import call
from fetchd.utils import Utils
import pmp.api.esadapter as esadapter
import elasticsearch
import json
import os
import logging
import config
from werkzeug.contrib.cache import SimpleCache
import time


class SuggestionsAPI(esadapter.InitConnection):
    """
    Used to search in elastic index for similar PrepIDs as given
    """

    __cache = SimpleCache(threshold=config.CACHE_SIZE, default_timeout=config.CACHE_TIMEOUT)

    def __init__(self, typeof):
        esadapter.InitConnection.__init__(self)
        self.max_results_in_index = 20
        self.max_suggestions = 20
        self.present = (typeof == 'present')
        self.historical = (typeof == 'historical')
        self.performance = (typeof == 'performance')

    def search(self, query, index):
        logging.info('Query ' + query + ' index ' + index)
        try:
            return [s['_id'] for s in
                    self.es.search(q=query,
                                   index=index,
                                   size=self.max_results_in_index)['hits']['hits']]
        except elasticsearch.NotFoundError as ex:
            logging.error(str(ex))
            return []

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
        cache_key = 'suggestions_%s' % (query)
        if self.__cache.has(cache_key):
            results = self.__cache.get(cache_key)
            if len(results) > 0:
                logging.info('Found %s suggestions in cache for %s' % (len(results), cache_key))
                return json.dumps({'results': results})

        search = 'prepid:*%s*' % (query)

        results = []

        suggestion_queries = [{'type': 'CAMPAIGN', 'index': 'campaigns'},
                              {'type': 'REQUEST', 'index': 'requests'},
                              {'type': 'CHAINED CAMPAIGN', 'index': 'chained_campaigns'},
                              {'type': 'CHAINED REQUEST', 'index': 'chained_requests'},
                              {'type': 'TAG', 'index': 'tags'},
                              {'type': 'PPD TAG', 'index': 'ppd_tags'},
                              {'type': 'FLOW', 'index': 'flows'},
                              {'type': 'MCM DATASET', 'index': 'mcm_dataset_names'},
                              {'type': 'DATATIER', 'index': 'mcm_datatiers'},
                              {'type': 'RERECO', 'index': 'rereco_requests'},
                              {'type': 'PROCESSING STRING', 'index': 'processing_strings'},
                              {'type': 'RERECO CAMPAIGN', 'index': 'rereco_campaigns'},
                              {'type': 'RELVAL', 'index': 'relval_requests'},
                              {'type': 'RELVAL CMSSW', 'index': 'relval_cmssw_versions'},
                              {'type': 'RELVAL CAMPAIGN', 'index': 'relval_campaigns'}]

        for suggestion_query in suggestion_queries:
            suggestion_query['all_suggestions'] = [{'type': suggestion_query['type'], 'label': x} for x in self.search(search, suggestion_query['index'])]
            suggestion_query['selected_suggestions'] = []

        found_suggestions = 0
        for i in range(self.max_suggestions):
            for suggestion_query in suggestion_queries:
                if i < len(suggestion_query.get('all_suggestions', [])):
                    suggestion_query['selected_suggestions'].append(suggestion_query['all_suggestions'][i])
                    found_suggestions += 1

                if found_suggestions >= self.max_suggestions:
                    break

            if found_suggestions >= self.max_suggestions:
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
        search_results = self.es.search(q='*',
                                        index='last_sequences')['hits']['hits']
        last_sequences = [s['_source'] for s in search_results]
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

        return json.dumps({"results": {'timestamp': last_update, 'date': last_update_date, 'ago': ago}}, sort_keys=True)


class AdminAPI(esadapter.InitConnection):
    def __init__(self):
        esadapter.InitConnection.__init__(self)
        Utils.setup_console_logging()

    def get(self):
        collections, _ = Utils.curl('GET', config.DATABASE_URL + '_aliases?pretty=false')
        print(collections)
        collections = collections.keys()
        results = {}
        for collection_name in collections:
            response, _ = Utils.curl('GET', config.DATABASE_URL + collection_name + '/_count')
            collection_name = collection_name.replace('_', ' ')
            count = response.get('count', 0)
            results[collection_name] = {}
            results[collection_name]['total'] = count

        last_sequences = self.es.search(q='*', index='last_sequences')['hits']['hits']
        for last_sequence in last_sequences:
            name = last_sequence['_id']
            if name in results:
                last_update = last_sequence.get('_source', {}).get('time', 0) / 1000.0
                results[name]['last_update'] = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(last_update))

        return results


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
            self.es.get(index=index, doc_type=doc_type, id=prepid)['_source']
        except elasticsearch.NotFoundError:
            return False

        return True

    def parse_query(self, query):
        """
        Returns query, index name and doctype
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

        if self.is_instance(query, 'campaigns', 'campaign'):
            result = ('member_of_campaign:%s' % (query), 'requests', 'request')

        elif self.is_instance(query, 'requests', 'request'):
            result = ('prepid:%s' % (query), 'requests', 'request')

        elif self.is_instance(query, 'chained_campaigns', 'chained_campaign'):
            result = ('member_of_campaign:%s' % (query), 'chained_requests', 'chained_request')

        elif self.is_instance(query, 'chained_requests', 'chained_request'):
            result = ('member_of_chain:%s' % (query), 'requests', 'request')

        elif self.is_instance(query, 'tags', 'tag'):
            result = ('tags:%s' % (query), 'requests', 'request')

        elif self.is_instance(query, 'ppd_tags', 'ppd_tag'):
            result = ('ppd_tags:%s' % (query), 'requests', 'request')

        elif self.is_instance(query, 'flows', 'flow'):
            result = ('flown_with:%s' % (query), 'requests', 'request')

        elif self.is_instance(query, 'mcm_dataset_names', 'mcm_dataset_name'):
            result = ('dataset_name:%s' % (query), 'requests', 'request')

        elif self.is_instance(query, 'mcm_datatiers', 'mcm_datatier'):
            result = ('datatiers:%s AND status:submitted' % (query), 'requests', 'request')

        elif self.is_instance(query, 'rereco_requests', 'rereco_request'):
            result = ('prepid:%s' % (query), 'rereco_requests', 'rereco_request')

        elif self.is_instance(query, 'processing_strings', 'processing_string'):
            result = ('processing_string:%s' % (query), 'rereco_requests', 'rereco_request')

        elif self.is_instance(query, 'rereco_campaigns', 'rereco_campaign'):
            result = ('member_of_campaign:%s' % (query), 'rereco_requests', 'rereco_request')

        elif self.is_instance(query, 'relval_requests', 'relval_request'):
            result = ('prepid:%s' % (query), 'relval_requests', 'relval_request')

        elif self.is_instance(query, 'relval_cmssw_versions', 'relval_cmssw_version'):
            result = ('cmssw_version:%s' % (query), 'relval_requests', 'relval_request')

        elif self.is_instance(query, 'relval_campaigns', 'relval_campaign'):
            result = ('member_of_campaign:s' % (query), 'relval_requests', 'relval_request')

        else:
            result = (None, None, None)

        self.__cache.set(cache_key, result)
        return result

    def fetch_objects(self, query, index, doctype):
        """
        Fetch one object by given id, index name and doctype
        """
        search_results = self.es.search(q=query,
                                        index=index,
                                        size=self.results_window_size)['hits']['hits']
        req_arr = [s['_source'] for s in search_results]

        return req_arr

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
            chained_requests = self.fetch_objects(query='prepid:%s' % (member_of_chain),
                                                  index='chained_requests',
                                                  doctype='chained_request')

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

    def db_query(self, query, include_stats_document=True, estimate_completed_events=False):
        """
        Query DB and return array of raw documents
        Tuple of three things is returned: stats document, mcm document
        """

        req_arr = []
        es_query, index, doctype = self.parse_query(query)
        logging.info('Query: %s, index: %s, doctype: %s' % (es_query, index, doctype))
        if index is None:
            logging.info('Returning nothing because index for %s could not be found' % (query))
            return []

        cache_key = 'db_query_%s_____%s______%s' % (str(es_query), include_stats_document, estimate_completed_events)
        if self.__cache.has(cache_key):
            results = self.__cache.get(cache_key)
            logging.info('Found result in cache for key: %s' % cache_key)
            return results

        if index == 'chained_requests':
            chained_requests = self.fetch_objects(es_query, index, doctype)
            for chained_request in chained_requests:
                es_query, index, doctype = 'member_of_chain:%s' % (chained_request.get('prepid')), 'requests', 'request'
                req_arr.extend(self.fetch_objects(es_query, index, doctype))
        else:
            req_arr = self.fetch_objects(es_query, index, doctype)

        if index == 'requests':
            logging.info('Found %d requests for %s' % (len(req_arr), es_query))
        elif index == 'relval_requests':
            logging.info('Found %s RelVal requests from %s' % (len(req_arr), es_query))
        elif index == 'rereco_requests':
            logging.info('Found %d ReReco requests for %s' % (len(req_arr), es_query))

        results = []
        # Iterate over array and collect details (McM documents)
        for req in req_arr:
            dataset_list = req['output_dataset']
            if len(dataset_list) > 0:
                if index == 'rereco_requests' or index == 'relval_requests':
                    dataset = dataset_list[-1]
                else:
                    dataset = dataset_list[0]
            else:
                dataset = None

            if not dataset and estimate_completed_events and index == 'requests':
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

            if not include_stats_document:
                req['reqmgr_name'] = []

            # Iterate through all workflow names, starting from the newest one
            # and stopping once any valid workflow is found
            req['reqmgr_name'] = sorted(req.get('reqmgr_name', []), key=lambda k: '_'.join(k.split('_')[-3:]), reverse=True)
            logging.info('ReqMgr names for %s are %s' % (req['prepid'], req.get('reqmgr_name', [])))
            logging.info('Dataset for %s is %s' % (req['prepid'], dataset))
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
                results.append((stats_document, mcm_document))
                break
            else:
                # Add reqmgr as name and output dataset to request
                mcm_document = dict(req)
                mcm_document.update({'expected': req['total_events'],
                                     'output_dataset': dataset})
                results.append((None, mcm_document))


        self.__cache.set(cache_key, results)
        return results

    def apply_filters(self, data, priority_filter, pwg_filter, status_filter):
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

        if status_filter is not None:
            status_filter = [x.lower() for x in status_filter if x]

        all_pwgs = {}
        all_statuses = {}
        for item in data:
            pwg = item.get('pwg', '').upper()
            if pwg not in all_pwgs:
                if pwg_filter is not None:
                    all_pwgs[pwg] = pwg in pwg_filter
                else:
                    all_pwgs[pwg] = True

            status = item.get('status', '').lower()
            if status not in all_statuses:
                if status_filter is not None:
                    all_statuses[status] = status in status_filter
                else:
                    all_statuses[status] = True

            priority = item.get('priority')
            if priority is not None:
                if priority_filter is not None:
                    lower_priority = priority_filter[0]
                    upper_priority = priority_filter[1]
                    if lower_priority is not None and priority < lower_priority:
                        continue

                    if upper_priority is not None and priority > upper_priority:
                        continue

            if all_pwgs[pwg] and all_statuses[status]:
                new_data.append(item)

        logging.info('Requests after filtering %s' % (len(new_data)))
        return new_data, all_pwgs, all_statuses
