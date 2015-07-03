"""A list of classes for utils api"""
from cStringIO import StringIO
from datetime import datetime
from pmp.api.models import esadapter
from subprocess import call
import pycurl
import json
import os


class SuggestionsAPI(esadapter.InitConnection):
    """Used to search in elastic for simmilar prepid as given"""
    def __init__(self, typeof):
        esadapter.InitConnection.__init__(self)
        self.overflow = 10
        self.announced = (typeof == 'announced')
        self.growing = (typeof == 'growing')
        self.historical = (typeof == 'historical')
        self.performance = (typeof == 'performance')

    def get(self, query):
        """Get suggestions for the query"""
        searchable = query.replace("-", r"\-")
        if '-' in query:
            search = ('prepid:%s' % searchable)
            search_stats = ('pdmv_request_name:%s' % searchable)
        else:
            search = ('prepid:*%s*' % searchable)
            search_stats = ('pdmv_request_name:*%s*' % searchable)

        results = []

        if self.historical or self.growing or self.announced \
                or self.performance:
            # campaigns are expected in all modes
            results += [s['_id'] for s in
                        self.es.search(search, index='campaigns',
                                       size=self.overflow)['hits']['hits']]

            # extended search for historical
            if self.historical:
                results += [s['_id'] for s in
                            self.es.search(search, index='requests',
                                           size=self.overflow)['hits']['hits']]

                results += [s['_id'] for s in
                            self.es.search(search_stats, index='stats',
                                           size=self.overflow)['hits']['hits']]

            # extended search fo growing
            if self.growing:
                results += [s['_id'] for s in
                            self.es.search(search, index="chained_campaigns",
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
        for collection in query.split(','):
            # loop and select lowest
            details = self.es.get(collection, 'seq', 'last_seq')['_source']
            if last_update == 0 or details['time'] < last_update:
                last_update = details['time']
        response = dict()
        response['last_update'] = last_update
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