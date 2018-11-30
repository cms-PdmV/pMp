"""A list of classes for utils api"""
from io import StringIO
from datetime import datetime
from subprocess import call
from fetchd.utils import Utils
import pmp.api.esadapter as esadapter
import elasticsearch
import pycurl
import json
import os
import logging


class SuggestionsAPI(esadapter.InitConnection):
    """
    Used to search in elastic index for similar PrepIDs as given
    """
    def __init__(self, typeof):
        esadapter.InitConnection.__init__(self)
        self.results_window_size = 5
        self.max_suggestions = 15
        self.present = (typeof == 'present')
        self.historical = (typeof == 'historical')
        self.performance = (typeof == 'performance')

    def search(self, query, index):
        try:
            return [s['_id'] for s in
                    self.es.search(q=query,
                                   index=index,
                                   size=self.results_window_size)['hits']['hits']]
        except elasticsearch.NotFoundError:
            return []

    def get(self, query):
        """Get suggestions for the query"""
        searchable = query.replace("-", r"\-")
        if '-' in query:
            search = ('prepid:%s' % searchable)
            # search_stats = ('RequestName:%s' % searchable)
        else:
            search = ('prepid:*%s*' % searchable)
            # search_stats = ('RequestName:*%s*' % searchable)

        results = []

        results += [{'type': 'CAMPAIGN', 'label': x} for x in self.search(search, 'campaigns')]

        if len(results) < self.max_suggestions:
            results += [{'type': 'PROCESSING STRING', 'label': x} for x in self.search(search, 'processing_strings')]

        if len(results) < self.max_suggestions:
            results += [{'type': 'TAG', 'label': x} for x in self.search(search, 'tags')]

        if self.historical or self.present:
            if len(results) < self.max_suggestions:
                results += [{'type': 'FLOW', 'label': x} for x in self.search(search, 'flows')]

            if len(results) < self.max_suggestions:
                results += [{'type': 'REQUEST', 'label': x} for x in self.search(search, 'requests')]

            if len(results) < self.max_suggestions:
                results += [{'type': 'RERECO', 'label': x} for x in self.search(search, 'rereco_requests')]

        # if self.historical and len(results) < self.max_suggestions:
        #     results += [{'type': 'WORKFLOW', 'label': x} for x in self.search(search_stats, 'workflows')]

        if self.present and len(results) < self.max_suggestions:
            results += [{'type': 'CHAINED CAMPAIGN', 'label': x} for x in self.search(search, 'chained_campaigns')]

        # order of ext does matter because of the typeahead in bootstrap
        return json.dumps({'results': results})


class LastUpdateAPI(esadapter.InitConnection):
    """Get time of last successful update to the database"""
    def get(self, query):
        """Returning time since the epoch
        query - csv of collections to check
        """
        last_update = 0
        response = {}

        try:
            response['last_update'] = self.es.get(index='meta',
                                                  doc_type='meta',
                                                  id='last_completed_update')['_source']['datetime']
            response['source'] = 'last completed update'
        except elasticsearch.TransportError:
            # there's no last_completed_update document!
            last_update = 1
            # for collection in query.split(','):
            #     # loop and select lowest
            #     details = self.es.get(index='last_sequences',
            #                           doc_type='last_seq',
            #                           id=collection)['_source']
            #     if last_update == 0 or details['time'] < last_update:
            #         last_update = details['time']

            response['last_update'] = last_update
            response['source'] = 'last sequence'

        return json.dumps({"results": response})


class ShortenAPI(object):
    """Shorten URL with tinyurl api"""

    def __init__(self):
        # api url
        self.base_url = "http://tinyurl.com/api-create.php?url="

    @staticmethod
    def generate_url(base, url, params):
        """URL generation"""
        return str(base + url + "?" + params)

    def get(self, url, params):
        """Curl tinyurl and return url"""
        out = StringIO()
        curl = pycurl.Curl()
        curl.setopt(pycurl.URL, self.generate_url(self.base_url, url, params))
        curl.setopt(pycurl.WRITEFUNCTION, out.write)
        curl.perform()
        return out.getvalue()


class TakeScreenshotAPI(object):
    """Generate screenshot/report api"""

    def __init__(self):
        self.static_dir = 'pmp/static/'

    @staticmethod
    def get_time():
        """Get current time"""
        return str(datetime.now())

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
        return gen_name + '.' + output_format


class OverallAPI(object):
    """
    Get number statistics from DB
    """
    def get(self, collections):
        """
        Query DB and return response
        """
        import sys
        sys.path.append(os.path.abspath(os.path.dirname(__file__) + '/' + '..'))
        from fetchd.utils import Utils
        import config
        results = {}
        for collection_name in collections:
            response, _ = Utils.curl('GET', config.DATABASE_URL + collection_name + '/_count')
            count = response.get('count', 0)
            results[collection_name.replace('_', ' ')] = count

        return json.dumps({"results": results})


class APIBase(esadapter.InitConnection):
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
        Returns correct field, index name and doctype
        Returns field, index name, doctype and query
        """
        if query == 'all':
            # change all to wildcard or check if chain
            return 'member_of_campaign', 'requests', 'request', '*'

        elif self.is_instance(query, 'campaigns', 'campaign'):
            return 'member_of_campaign', 'requests', 'request', query

        elif self.is_instance(query, 'requests', 'request'):
            return None, 'requests', 'request', query

        elif self.is_instance(query, 'flows', 'flow'):
            return 'flown_with', 'requests', 'request', query

        elif self.is_instance(query, 'rereco_requests', 'rereco_request'):
            return None, 'rereco_requests', 'rereco_request', query

        elif self.is_instance(query, 'processing_strings', 'processing_string'):
            return 'processing_string', 'rereco_requests', 'rereco_request', query

        elif self.is_instance(query, 'tags', 'tag'):
            return 'tags', 'requests', 'request', query

        return None, None, None, None

    def db_query(self, query, include_stats_document=True):
        """
        Query DB and return array of raw documents
        Tuple of three things is returned: stats document, mcm document
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

            if not include_stats_document:
                req['reqmgr_name'] = []

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
