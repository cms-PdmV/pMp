from pyelasticsearch import ElasticSearch
import config
import copy
import json
import math
import time

class SuggestionsAPI():
    '''
    Used to search in elastic for simmilar prepid as given
    '''

    def __init__(self, typeof):
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 20
        self.announced = (typeof == 'announced')
        self.growing = (typeof == 'growing')
        self.historical = (typeof == 'historical')
        self.performance = (typeof == 'performance')

    def get(self, query):
        searchable = query.replace('-', '\-')
        if '-' in query:
            search = ('prepid:%s' % searchable)
            search_stats = ('pdmv_request_name:%s' % searchable)
        else:
            search = ('prepid:*%s*' % searchable)
            search_stats = ('pdmv_request_name:*%s*' % searchable)

        ext0 = []
        ext1 = []
        ext2 = []

        if (self.historical or self.growing or self.announced
            or self.performance):
            # campaigns are expected in all modes
            ext0 = [s['_id'] for s in
                    self.es.search(search, index='campaigns',
                                   size=self.overflow)['hits']['hits']]

            # extended search for historical
            if self.historical:
                ext1 = [s['_id'] for s in
                        self.es.search(search, index='requests',
                                       size=self.overflow)['hits']['hits']]

                ext2 = [s['_id'] for s in
                        self.es.search(search_stats, index='stats',
                                       size=self.overflow)['hits']['hits']]

            # extended search fo growing
            if self.growing:
                ext1 = [s['_id'] for s in
                        self.es.search(search, index="chained_campaigns",
                                       size=self.overflow)['hits']['hits']]

                ext2 = [s['_id'] for s in
                        self.es.search(search, index="chained_requests",
                                       size=self.overflow)['hits']['hits']]

        # order of ext does matter because of the typeahead in bootstrap
        return json.dumps({"results": ext0 + ext1 + ext2})
