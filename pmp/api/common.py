"""A list of classes for utils api"""
from cStringIO import StringIO
from datetime import datetime
from pmp.api.models import esadapter
from subprocess import call
import elasticsearch
import pycurl
import simplejson as json
import os
import matplotlib as mpl
mpl.use('Agg')
from matplotlib.ticker import Formatter
import matplotlib.pyplot as plt
import time


class SuggestionsAPI(esadapter.InitConnection):
    """Used to search in elastic for simmilar prepid as given"""
    def __init__(self, typeof):
        esadapter.InitConnection.__init__(self)
        self.overflow = 10
        self.present = (typeof == 'present')
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

        if self.historical or self.present or self.performance:
            # campaigns are expected in all modes
            results += [s['_id'] for s in
                        self.es.search(q=search,
                                       index='campaigns',
                                       size=self.overflow)['hits']['hits']]
            results += [s['_id'] for s in
                        self.es.search(q=search,
                                       index='processing_strings',
                                       size=self.overflow)['hits']['hits']]

            if self.historical or self.present:
                results += [s['_id'] for s in
                            self.es.search(q=search,
                                           index='flows',
                                           size=self.overflow)['hits']['hits']]
                results += [s['_id'] for s in
                            self.es.search(q=search,
                                           index='requests',
                                           size=self.overflow)['hits']['hits']]
                results += [s['_id'] for s in
                            self.es.search(q=search,
                                           index='rereco_requests',
                                           size=self.overflow)['hits']['hits']]

            if self.historical:
                results += [s['_id'] for s in
                            self.es.search(q=search_stats,
                                           index='stats',
                                           size=self.overflow)['hits']['hits']]

            if self.present:
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
            for collection in query.split(','):
                # loop and select lowest
                details = self.es.get(index='last_sequences',
                                      doc_type='last_seq',
                                      id=collection)['_source']
                if last_update == 0 or details['time'] < last_update:
                    last_update = details['time']

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


class OverallAPI(esadapter.InitConnection):
    """Get overall statistics from DB"""

    def __init__(self):
        esadapter.InitConnection.__init__(self)
        self.overflow = 0

    def get(self, collections):
        """Query DB and return response"""
        results = {}
        for c in collections:
            if c != 'stats':
                results[c] = self.es.search(q='prepid:*',
                                            index=c,
                                            size=self.overflow)["hits"]["total"]
            else:
                results['workflows'] = self.es.search(q='pdmv_prep_id:*',
                                                      index=c,
                                                      size=self.overflow)["hits"]["total"]

        return json.dumps({"results": results})


class MakeImage(object):

    class CustomMajorFormatter(Formatter):
        def __init__(self):
            self.suffixes = ['', 'k', 'M', 'G', 'T', 'P']

        def __call__(self, x, pos=None):
            if x == 0:
                return ''

            suffix = ''
            for exp in xrange(0, 4):
                if x / (1000 ** exp) < 1000:
                    suffix = self.suffixes[exp]
                    x = x / (1000 ** exp)
                    break

            return ('%.1f' % (x)).replace('.0', '') + suffix

    class CustomTimestampFormatter(Formatter):
        def __call__(self, x, pos=None):
            return time.strftime('%Hh, %b %m, %Y', time.localtime(x / 1000))

    def __init__(self):
        self.labels = ['Done events in DAS', 'Events in DAS', 'Expected events']
        self.colors = ['#01579B', '#FF6F00', '#263238']

    def make_file_path(self, path_hash):
        return 'pmp/static/tmp/pmp_%s.png' % (path_hash)

    def trim_dataset_name(self, dataset_name):
        return '.../%s' % ('/'.join(dataset_name.split('/')[2:]))

    def split_total_open_done(self, data):
        total_events = []
        open_events = []
        done_events = []
        timestamps = []
        data = sorted(data, key=lambda x: x['t'])
        for d in data:
            if len(total_events) > 0:
                total_events.append(total_events[-1])
                open_events.append(open_events[-1])
                done_events.append(done_events[-1])
                timestamps.append(d['t'])

            total_events.append(d['x'] - max(d['e'], d['d']))
            open_events.append(d['e'] - d['d'])
            done_events.append(d['d'])
            timestamps.append(d['t'])

        return total_events, open_events, done_events, timestamps

    def make_taskchain_image(self, data, path_hash):
        max_total = 0
        for dataset in data:
            total_events, _, done_events, timestamps = self.split_total_open_done(dataset['data'])
            plt.plot(timestamps, done_events, label=self.trim_dataset_name(dataset['request']))
            if max(total_events + done_events) > max_total:
                max_total = max(total_events + done_events)

        plt.gca().get_yaxis().set_major_formatter(self.CustomMajorFormatter())
        plt.gca().get_xaxis().set_major_formatter(self.CustomTimestampFormatter())
        plt.xticks(rotation=15)
        plt.ylim(ymax=max_total * 1.2)
        plt.legend(loc='upper left')
        plt.gcf().set_size_inches(10, 6)
        filename = self.make_file_path(path_hash)
        plt.savefig(filename, dpi=100, bbox_inches='tight', pad_inches=0.1)
        plt.close()
        return filename.replace('/static', '')

    def make_image(self, data, path_hash):
        total_events, open_events, done_events, timestamps = self.split_total_open_done(data)

        plt.stackplot(timestamps,
                      [done_events, open_events, total_events],
                      labels=self.labels,
                      colors=self.colors,
                      alpha=0.4)
        plt.gca().get_yaxis().set_major_formatter(self.CustomMajorFormatter())
        plt.gca().get_xaxis().set_major_formatter(self.CustomTimestampFormatter())
        plt.xticks(rotation=15)
        plt.legend(loc='upper left')
        plt.gcf().set_size_inches(10, 6)
        filename = self.make_file_path(path_hash)
        plt.savefig(filename, dpi=100, bbox_inches='tight', pad_inches=0.1)
        plt.close()
        return filename.replace('/static', '')

    def get(self, data):
        if data['taskchain']:
            return self.make_taskchain_image(data['data'], data['path_hash'])
        else:
            return self.make_image(data['data'], data['path_hash'])
