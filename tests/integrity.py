"""Integrity tests for pMp"""
from datetime import datetime
from cStringIO import StringIO
import logging
import simplejson as json
import pycurl
import elasticsearch
import sys


class TestIntegrityEventsInDAS(object):
    """Check if present has same numbers as historical"""

    def __init__(self, arg):
        self.db_url = 'http://127.0.0.1:9200'
        self.pmp_api = 'https://127.0.0.1/api/'
        self.elastic_search = elasticsearch.Elasticsearch(self.db_url)
        self.overflow = 100000
        self.setlog()
        self.announced = arg
        if self.announced:
            logging.info(str(datetime.now()) + ' Lauching check for announced')
            self.present_url = '/announced/false'
            self.historical_url = '/historical/3/,/done/all'
        else:
            logging.info(str(datetime.now()) + ' Launching check for growing')
            self.present_url = '/growing/false'
            self.historical_url = '/historical/3/,/all/all'

    @staticmethod
    def curl(url):
        """Perform curl"""
        out = StringIO()
        curl = pycurl.Curl()
        curl.setopt(pycurl.URL, str(url))
        curl.setopt(pycurl.WRITEFUNCTION, out.write)
        curl.setopt(pycurl.SSL_VERIFYPEER, 0)
        curl.setopt(pycurl.SSL_VERIFYHOST, 0)
        curl.perform()
        try:
            return (json.loads(out.getvalue()),
                    curl.getinfo(curl.RESPONSE_CODE))
        except ValueError:
            print "Status: %s/n%s" % (curl.getinfo(curl.RESPONSE_CODE),
                                      out.getvalue())

    @staticmethod
    def setlog():
        """Set logging level"""
        logging.basicConfig(level=logging.INFO)

    def get_historical(self, campaign):
        """Get data from historical API"""
        details, _ = self.curl(self.pmp_api + campaign + self.historical_url)
        if len(details['results']['data']):
            return details['results']['data'][-1]['e']
        else:
            return 0

    def get_announced(self, campaign):
        """Get data from announced API"""
        sum_events = 0
        for request in self.get_requests(campaign):
            sum_events += request['total_events']
        return sum_events

    def get_requests(self, campaign):
        """Get list of reqeusts on status done in a given campaign"""
        details, _ = self.curl(self.pmp_api + campaign + self.present_url)
        for request in details['results']:
            if request['status'] == 'done' \
                    and request['member_of_campaign'] == campaign:
                yield request

    def completed_deep(self, request):
        """Calculate true value of completed events"""
        completed_events = 0
        if not len(request['output_dataset']):
            return 0

        output_dataset = request['output_dataset'][0]
        for reqmgr in request['reqmgr_name']:
            try:
                stats = self.elastic_search.get(index='stats',
                                                doc_type='stats',
                                                id=reqmgr)['_source']
            except elasticsearch.NotFoundError:
                continue

            if stats['pdmv_dataset_name'] == output_dataset:
                sts = stats['pdmv_monitor_history'][0]
                completed_events = max(completed_events,
                                       sts['pdmv_evts_in_DAS'] +
                                       sts['pdmv_open_evts_in_DAS'])
            elif 'pdmv_monitor_datasets' in stats:
                for monitor in stats['pdmv_monitor_datasets']:
                    if monitor['dataset'] == output_dataset:
                        field = monitor['monitor'][0]
                        completed_events = max(completed_events,
                                               field['pdmv_evts_in_DAS'] +
                                               field['pdmv_open_evts_in_DAS'])
        return completed_events

    def get_requests_grow(self, campaign):
        """Get completed events for submitted requests"""
        requests = [s['_source'] for s in self.elastic_search.search(q=('member_of_campaign:%s' % campaign),
                                                                     index='requests',
                                                                     size=self.overflow)['hits']['hits']]
        for request in requests:
            if request['status'] == 'submitted':
                request['completed_events'] = self.completed_deep(request)
                yield request

    def run(self, deep_check=False):
        """Run tests"""
        # get list of campaigns
        campaigns = [s['_source'] for s in self.elastic_search.search(q='prepid:*',
                                                                      index='campaigns',
                                                                      size=self.overflow)['hits']['hits']]
        for campaign in campaigns:
            logging.info(str(datetime.now()) + " Checking " +
                         campaign['prepid'])

            if self.get_historical(campaign['prepid']) != \
                    self.get_announced(campaign['prepid']):
                logging.error(str(datetime.now()) + ' Inconsistency "events in' +
                              ' DAS" (historical) and status "done" (present' +
                              ') for ' + campaign['prepid'])
                if not deep_check:
                    continue
                logging.info(str(datetime.now()) + ' Checking requests')

                if self.announced:
                    for request in self.get_requests(campaign['prepid']):
                        if request['total_events'] != \
                                self.get_historical(request['prepid']):
                            logging.error(str(datetime.now()) +
                                          ' Inconsistency for ' +
                                          request['prepid'])
                else:
                    for request in self.get_requests_grow(campaign['prepid']):
                        if request['completed_events'] < \
                                self.get_historical(request['prepid']):
                            logging.error(str(datetime.now()) +
                                          ' Inconsistency for ' +
                                          request['prepid'])


class TestIntegrityExpectedEvents(object):
    """Check if present has same numbers as historical"""

    def __init__(self):
        self.db_url = 'http://127.0.0.1:9200'
        self.pmp_api = 'https://127.0.0.1/api/'
        self.elastic_search = elasticsearch.Elasticsearch(self.db_url)
        self.overflow = 100000
        self.setlog()
        logging.info(str(datetime.now()) + ' Lauching check for expected events')
        self.present_url = '/announced/false'
        self.historical_url = '/historical/3/,/submitted/all'

    @staticmethod
    def curl(url):
        """Perform curl"""
        out = StringIO()
        curl = pycurl.Curl()
        curl.setopt(pycurl.URL, str(url))
        curl.setopt(pycurl.WRITEFUNCTION, out.write)
        curl.setopt(pycurl.SSL_VERIFYPEER, 0)
        curl.setopt(pycurl.SSL_VERIFYHOST, 0)
        curl.perform()
        try:
            return (json.loads(out.getvalue()),
                    curl.getinfo(curl.RESPONSE_CODE))
        except ValueError:
            print "Status: %s/n%s" % (curl.getinfo(curl.RESPONSE_CODE),
                                      out.getvalue())

    @staticmethod
    def setlog():
        """Set logging level"""
        logging.basicConfig(level=logging.INFO)

    def get_historical(self, campaign):
        """Get data from historical API"""
        details, _ = self.curl(self.pmp_api + campaign + self.historical_url)
        if len(details['results']['data']):
            return details['results']['data'][-1]['x']
        else:
            return 0

    def get_announced(self, campaign):
        """Get data from announced API"""
        sum_events = 0
        for request in self.get_requests(campaign):
            sum_events += request['total_events']
        return sum_events

    def get_requests(self, campaign):
        """Get list of reqeusts on status submitted in a given campaign"""
        details, _ = self.curl(self.pmp_api + campaign + self.present_url)
        for request in details['results']:
            if request['status'] == 'submitted' \
                    and request['member_of_campaign'] == campaign:
                yield request

    def run(self, deep_check=False):
        """Run tests"""
        # get list of campaigns
        campaigns = [s['_source'] for s in self.elastic_search.search(q='prepid:*',
                                                                      index='campaigns',
                                                                      size=self.overflow)['hits']['hits']]
        for campaign in campaigns:
            logging.info(str(datetime.now()) + " Checking " +
                         campaign['prepid'])

            if self.get_historical(campaign['prepid']) != \
                    self.get_announced(campaign['prepid']):
                logging.error(str(datetime.now()) + ' Inconsistency "expected ' +
                              'events" (historical) and status "submitted" ' +
                              '(present) for ' + campaign['prepid'])
                if not deep_check:
                    continue
                logging.info(str(datetime.now()) + ' Checking requests')

                for request in self.get_requests(campaign['prepid']):
                    if request['total_events'] != \
                            self.get_historical(request['prepid']):
                        logging.error(str(datetime.now()) +
                                      ' Inconsistency for ' +
                                      request['prepid'])


if __name__ == "__main__":
    DEEP = False
    if len(sys.argv) > 1 and sys.argv[1] == "deep":
        DEEP = True
    TESTS = TestIntegrityEventsInDAS(True)
    TESTS.run(DEEP)
    TESTS = TestIntegrityEventsInDAS(False)
    TESTS.run(DEEP)
    TESTS2 = TestIntegrityExpectedEvents()
    TESTS2.run(DEEP)
