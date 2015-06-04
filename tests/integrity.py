#!/usr/bin/python

from datetime import datetime
from pyelasticsearch import ElasticSearch
from cStringIO import StringIO
import logging
import json
import pycurl
import sys


class TestIntegrityEventsInDAS():

    def __init__(self, arg):
        self.db_url = 'http://127.0.0.1:9200'
        self.pmp_api = 'http://127.0.0.1/api/'
        self.es = ElasticSearch(self.db_url)
        self.overflow = 100000
        self.setlog()
        self.announced = arg
        if self.announced:
            logging.info(str(datetime.now()) + ' Lauching check for announced')
            self.present_url = '/announced'
            self.historical_url = '/historical/3/,/done/all'
        else:
            logging.info(str(datetime.now()) + ' Launching check for growing')
            self.present_url = '/growing'
            self.historical_url = '/historical/3/,/all/all'

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
                                    + self.historical_url)
        if len(details['results']['data']):
            return details['results']['data'][-1]['e']
        else:
            return 0

    def get_announced(self, campaign):
        sum_events = 0
        for request in self.get_requests(campaign):
            sum_events += request['total_events']
        return sum_events

    def get_requests(self, campaign):
        details, status = self.curl(self.pmp_api + campaign + self.present_url)
        for request in details['results']:
            if (request['status'] == 'done'
                and request['member_of_campaign'] == campaign):
                yield request

    def get_requests_grow(self, campaign):
        requests = [s['_source'] for s in
                     self.es.search(('member_of_campaign:%s' % campaign),
                                    index='requests',
                                    size=self.overflow)['hits']['hits']]
        for r in requests:
            if r['status'] == 'submitted':
                yield r

    def run(self, deep_check=False):
        # get list of campaigns
        campaigns = [s['_source'] for s in
                     self.es.search('prepid:*', index='campaigns',
                                    size=self.overflow)['hits']['hits']]
        for c in campaigns:
            logging.info('%s Checking %s' % (datetime.now(), c['prepid']))
            if (self.get_historical(c['prepid']) !=
                self.get_announced(c['prepid'])):
                logging.error(str(datetime.now()) + ' Inconsistency "events in'
                              + ' DAS" (historical) and status "done" (present'
                              + ') for ' + c['prepid'])
                if not deep_check:
                    continue
                logging.info(str(datetime.now()) + ' Checking requests')

                if self.announced:
                    for request in self.get_requests(c['prepid']):
                        if (request['total_events'] !=
                            self.get_historical(request['prepid'])):
                            logging.error(str(datetime.now()) +
                                          ' Inconsistency for ' +
                                          request['prepid'])
                else:
                    for request in self.get_requests_grow(c['prepid']):
                        if (request['completed_events'] <  
                            (1*self.get_historical(request['prepid']))):
                            logging.error(str(datetime.now()) +
                                          ' Inconsistency for ' +
                                          request['prepid'])


if __name__ == "__main__":
    deep = False
    if len(sys.argv) > 1 and sys.argv[1] == "deep":
        deep = True
    tests = TestIntegrityEventsInDAS(True)
    tests.run(deep)
    tests = TestIntegrityEventsInDAS(False)
    tests.run(deep)

