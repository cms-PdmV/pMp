#!/usr/bin/python

from datetime import datetime
from pyelasticsearch import ElasticSearch
from cStringIO import StringIO
import logging
import json
import pycurl
import sys


class TestIntegrityEventsInDAS():

    def __init__(self):
        self.db_url = 'http://127.0.0.1:9200'
        self.pmp_api = 'http://127.0.0.1/api/'
        self.es = ElasticSearch(self.db_url)
        self.overflow = 1000
        self.setlog()

    def curl(self, url, cookie=None):
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
        except Exception:
            print "Status: %s/n%s" % (curl.getinfo(curl.RESPONSE_CODE),
                                      out.getvalue())

    def setlog(self):
        logging.basicConfig(level=logging.INFO)

    def get_historical(self, campaign):
        details, status = self.curl(self.pmp_api + campaign
                                    + '/historical/3/,/done/all')
        if len(details['results']['data']):
            return details['results']['data'][-1]['e']
        else:
            return 0

    def get_announced(self, campaign):
        details, status = self.curl(self.pmp_api + campaign +'/announced')
        sum_events = 0
        for request in details['results']:
            if request['status'] == 'done':
                sum_events += request['total_events']
        return sum_events

    def get_requests(self, campaign):
        details, status = self.curl(self.pmp_api + campaign +'/announced')
        for request in details['results']:
            if request['status'] == 'done':
                yield request

    def run(self, deep_check=False):
        # get list of campaigns
        campaigns = [s['_source'] for s in
                     self.es.search('prepid:*', index='campaigns',
                                    size=self.overflow)['hits']['hits']]
        for c in campaigns:
            logging.info('%s Checking %s' % (str(datetime.now()), c['prepid']))
            if (self.get_historical(c['prepid']) !=
                self.get_announced(c['prepid'])):
                logging.error(str(datetime.now()) + ' Inconsistency "events in'
                              + ' DAS" (historical) and status "done" (present'
                              + ') for ' + c['prepid'])
                if not deep_check:
                    continue
                logging.info(str(datetime.now()) + ' Checking requests')
                for request in self.get_requests(c['prepid']):
                    if (request['total_events'] !=
                        self.get_historical(request['prepid'])):
                        logging.error(str(datetime.now()) + ' Inconsistency' +
                                      'for ' + request['prepid'])


if __name__ == "__main__":
    deep = False
    if len(sys.argv) > 1 and sys.argv[1] == "deep":
        deep = True
    tests = TestIntegrityEventsInDAS()
    tests.run(deep)
    
