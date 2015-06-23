from models import esadapter
import json


class ChainAPI(esadapter.InitConnection):
    """
    Get full collection of chain campaigns
    """
    def get(self):
        ccs = [s['_source'] for s in
               self.es.search('prepid:*', index='chained_campaigns',
                              size=self.overflow)['hits']['hits']]
        return json.dumps({"results": ccs})
