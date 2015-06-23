from models import dbadapter
from pyelasticsearch import ElasticSearch
import copy
import json
import math
import time

class ChainAPI(adapter.ESAdapter):

    def get(self):
        ccs = [s['_source'] for s in
               self.es.search('prepid:*', index='chained_campaigns',
                              size=self.overflow)['hits']['hits']]
        return json.dumps({"results": ccs})
    
