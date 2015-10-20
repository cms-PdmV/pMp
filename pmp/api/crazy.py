"""A list of classes supporting crazy API"""
from pmp.api.models import esadapter
import json


class CrazyAPI(esadapter.InitConnection):
    """Get full collection of chain campaigns' links"""

    def get(self, campaign):
        dumping = {}
        response = [s['_source'] for s in
                    self.es.search(('member_of_campaign:%s' % (campaign)),
                                   index='requests', size=self.overflow)
                    ['hits']['hits']]
        sum = 0
        exp = 0
        for r in response:
            if r['status'] in ['done', 'submitted']:
                exp += r['total_events']
                ratio = float(r['completed_events'])/r['total_events']
                if ratio > 1:
                    diff = r['completed_events'] - r['total_events']
                    dumping[r['prepid']] = diff
                    sum += diff
        dumping['sum'] = sum
        dumping['expected'] = exp

        return json.dumps({"results": dumping})
