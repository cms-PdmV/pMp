#!/usr/bin/python

from datetime import datetime
from pyelasticsearch import ElasticSearch
import logging


class TestIntegrityEventsInDAS():

    def __init__(self):
        self.db_url = 'http://127.0.0.1:9200'
        self.es = ElasticSearch(self.db_url)
        self.overflow = 1000
        self.setlog()

    def setlog(self):
        logging.basicConfig(level=logging.INFO)

    def get_historical(self, campaign):
        return 0

    def get_present(self, campaign):
        return 1

    def run(self):
        # get list of campaigns
        campaigns = [s['_source'] for s in
                     self.es.search('prepid:*', index='campaigns',
                                    size=self.overflow)['hits']['hits']]
        for c in campaigns:
            if (self.get_historical(c['prepid']) !=
                self.get_present(c['prepid'])):
                logging.error(str(datetime.now()) + ' Inconsistency "events in'
                              + ' DAS" (historical) and status "done" (present)'
                              + ' for ' + c['prepid'])
        # get number in historical
        # get number in present


if __name__ == "__main__":
    tests = TestIntegrityEventsInDAS()
    tests.run()
    
