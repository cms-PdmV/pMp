from models import esadapter
import json


class PerformanceAPI(esadapter.InitConnection):
    """
    Return list of requests with history points
    """
    def get(self, campaign):

        # change 'all' to wildcard
        if campaign == 'all':
            campaign = '*'

        # get the list of requests
        res = [s['_source'] for s in
               self.es.search(('member_of_campaign:%s' % campaign),
                              index='requests', size=self.overflow)
               ['hits']['hits']]

        # loop over and remove documents' fields
        for r in res:
            for field in ['time_event', 'total_events', 'completed_events',
                          'reqmgr_name', 'efficiency', 'output_dataset']:
                if field in r:
                    del r[field]

            # duplicates fix ie. when request was reset
            patch_history = {}
            for h in r['history']:
                patch_history[h['action']] = h['time']
            r['history'] = patch_history

        return json.dumps({"results": res})
