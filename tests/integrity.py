#!/usr/bin/python

from pyelasticsearch import ElasticSearch

class TestIntegrityEventsInDAS():

    def __init__(self):
        self.db_url = 'http://127.0.0.1:9200'
        self.overflow = 1000
        self.es = ElasticSearch(self.db_url)

    def run(self):
        # get list of campaigns
        campaigns = [s['_source'] for s in
                     self.es.search('prepid:*', index='campaigns',
                                    size=self.overflow)['hits']['hits']]
        print campaigns

        # for each
        # get number in historical
        # get number in present
        # log error


if __name__ == "__main__":
    tests = TestIntegrityEventsInDAS()
    tests.run()
    
