"""A list of classes supporting performance statistics API"""
from pmp.api.common import APIBase
import json


class PerformanceAPI(APIBase):
    """Return list of requests with history points"""

    def __init__(self):
        APIBase.__init__(self)

    def es_search(self, campaign, index):
        return self.es.search(q='member_of_campaign:%s' % (campaign),
                              index=index,
                              size=self.results_window_size)['hits']

    def get(self, campaign):
        """
        Return historical points for each request in given campaign"""
        # change 'all' to wildcard
        if campaign == 'all':
            search = self.es_search('*', 'requests') + self.es_search('*', 'rereco_requests')
        else:
            # get the list of requests
            search = self.es_search(campaign, 'requests')

            if search['total'] == 0:
                # Try ReReco index
                search = self.es_search(campaign, 'rereco_requests')

        # Enum provides ordering for comparison between statuses (in history, hence 'created')
        status_order = {
            'created': 0,
            'validation': 1,
            'approved': 2,
            'submitted': 3,
            'done': 4
        }
        earliest_status = 'done'

        response = [s['_source'] for s in search['hits']]

        # loop over and remove documents' fields
        remove = []
        for request in response:
            # Remove new and unchained to clean up output plots
            if request['status'] == 'new' and len(request.get('member_of_chain', [])) == 0:
                remove.append(request)
                continue

            for field in ['time_event', 'total_events', 'completed_events',
                          'reqmgr_name', 'efficiency', 'output_dataset',
                          'flown_with', 'member_of_chain']:
                if field in request:
                    del request[field]

            # duplicates fix ie. when request was reset
            patch_history = {}
            for history in request['history']:
                patch_history[history['action']] = history['time']

                # Keep a log of the "earliest" status found. Fixes ReReco request display
                # given that they start directly at "submitted"
                if status_order[history['action']] < status_order[earliest_status]:
                    earliest_status = history['action']

            request['history'] = patch_history
            request['input'] = request['member_of_campaign']

        for to_remove in remove:
            response.remove(to_remove)

        return json.dumps({'results': {"data": response, 'first_status': earliest_status}})
