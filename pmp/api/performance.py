"""A list of classes supporting performance statistics API"""
from pmp.api.models import esadapter
import json


class PerformanceAPI(esadapter.InitConnection):
    """Return list of requests with history points"""

    def get(self, campaign):
        """Retruning historical points for each request in given campaign"""
        # change 'all' to wildcard
        if campaign == 'all':
            campaign = '*'

        # get the list of requests
        response = [s['_source'] for s in
                    self.es.search(('member_of_campaign:%s' % campaign),
                                   index='requests', size=self.overflow)
                    ['hits']['hits']]

        # loop over and remove documents' fields
        for request in response:
            for field in ['time_event', 'total_events', 'completed_events',
                          'reqmgr_name', 'efficiency', 'output_dataset']:
                if field in request:
                    del request[field]

            # duplicates fix ie. when request was reset
            patch_history = {}
            for history in request['history']:
                patch_history[history['action']] = history['time']
            request['history'] = patch_history

        return json.dumps({"results": response})
