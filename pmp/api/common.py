"""A list of classes for utils api"""
from io import StringIO
from datetime import datetime
from pmp.api.models import esadapter
from subprocess import call
import elasticsearch
import pycurl
import json
import os


class SuggestionsAPI(esadapter.InitConnection):
    """
    Used to search in elastic index for similar PrepIDs as given
    """
    def __init__(self, typeof):
        esadapter.InitConnection.__init__(self)
        self.overflow = 10
        self.max_suggestions = 20
        self.present = (typeof == 'present')
        self.historical = (typeof == 'historical')
        self.performance = (typeof == 'performance')

    def get(self, query):
        """Get suggestions for the query"""
        searchable = query.replace("-", r"\-")
        if '-' in query:
            search = ('prepid:%s' % searchable)
            search_stats = ('RequestName:%s' % searchable)
        else:
            search = ('prepid:*%s*' % searchable)
            search_stats = ('RequestName:*%s*' % searchable)

        results = []

        if self.historical or self.present or self.performance:
            # campaigns are expected in all modes
            results += [s['_id'] for s in
                        self.es.search(q=search,
                                       index='campaigns',
                                       size=self.overflow)['hits']['hits']]

            if self.historical or self.present:
                if len(results) < self.max_suggestions:
                    results += [s['_id'] for s in
                                self.es.search(q=search,
                                               index='flows',
                                               size=self.overflow)['hits']['hits']]

                if len(results) < self.max_suggestions:
                    results += [s['_id'] for s in
                                self.es.search(q=search,
                                               index='requests',
                                               size=self.overflow)['hits']['hits']]

                if len(results) < self.max_suggestions:
                    results += [s['_id'] for s in
                                self.es.search(q=search,
                                               index='rereco_requests',
                                               size=self.overflow)['hits']['hits']]

            if self.historical and len(results) < self.max_suggestions:
                results += [s['_id'] for s in
                            self.es.search(q=search_stats,
                                           index='stats',
                                           size=self.overflow)['hits']['hits']]

            if self.present and len(results) < self.max_suggestions:
                results += [s['_id'] for s in
                            self.es.search(q=search,
                                           index="chained_campaigns",
                                           size=self.overflow)['hits']['hits']]

        # order of ext does matter because of the typeahead in bootstrap
        return json.dumps({"results": results})


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
            results[collection_name] = count

        return json.dumps({"results": results})
