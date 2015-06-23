from models import esadapter
from pyelasticsearch import ElasticSearch
import config
import copy
import json
import math
import time

class LastUpdateAPI(esadapter.InitConnection):

    def get(self, query):
        query = query.split(',')
        last_update = 0
        for q in query:
            l = self.es.get(q, 'seq', 'last_seq')['_source']
            if last_update == 0 or l['time'] < last_update:
                last_update = l['time']
        lu = {}
        lu['last_update'] = last_update
        return json.dumps({"results": lu})
