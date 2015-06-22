from pyelasticsearch import ElasticSearch
import config
import copy
import json
import math
import time

class ChainAPI():

    def __init__(self):
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 1000

    def get(self):
        ccs = [s['_source'] for s in
               self.es.search('prepid:*', index='chained_campaigns',
                              size=self.overflow)['hits']['hits']]
        return json.dumps({"results": ccs})
