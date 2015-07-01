"""A list of classes supporting landscape API"""
from pmp.api.models import esadapter
import json


class ChainAPI(esadapter.InitConnection):
    """Get full collection of chain campaigns' links"""

    def get(self):
        """Returning links data between campaigns"""
        response = [s['_source'] for s in
                    self.es.search('prepid:*', index='chained_campaigns',
                                   size=self.overflow)['hits']['hits']]
        return json.dumps({"results": response})
