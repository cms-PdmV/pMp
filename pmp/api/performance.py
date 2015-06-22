from pyelasticsearch import ElasticSearch
import config
import copy
import json
import math
import time


class PerformanceAPI():
    '''
    Used to return list of requests with some history points
    '''
    def __init__(self):
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 1000000

    def get(self, campaign):

        # change all to wildcard
        if campaign == 'all':
            campaign = '*'

        # get list of requests - field has to be not analyzed by es
        res = [s['_source'] for s in
               self.es.search(('member_of_campaign:%s' % campaign),
                              index='requests', size=self.overflow)
               ['hits']['hits']]

        # loop over and remove db documents
        for r in res:
            for field in ['time_event', 'total_events', 'completed_events',
                          'reqmgr_name', 'efficiency', 'output_dataset']:
                try:
                    del r[field]
                except KeyError:
                    pass

            # duplicates fix
            patch_history = {}
            for h in r['history']:
                patch_history[h['action']] = h['time']

            r['history'] = patch_history

        return json.dumps({"results": res})
