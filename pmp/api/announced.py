"""Announced API"""
from pmp.api.models import esadapter
import json


class AnnouncedAPI(esadapter.InitConnection):
    """Used to return list of requests in a given campaign"""
    @staticmethod
    def number_of_events_for_done(request):
        """Requests that are done should return completed events value;
        Requests without output_dataset should have zero events
        """
        if 'output_dataset' in request and len(request['output_dataset']):
            return request['completed_events']
        else:
            return 0

    @staticmethod
    def number_of_events_for_submitted(request):
        """Requests that have just been submitted and no req_mgr data"""
        if 'reqmgr_name' in request and len(request['reqmgr_name']):
            return request['total_events']
        else:
            return 0

    def get(self, campaign):
        """Execute announced API"""

        # change all to wildcard
        if campaign == 'all':
            campaign = '*'

        # get list of requests - field has to be not analyzed by es
        respose = [s['_source'] for s in
                   self.es.search(('member_of_campaign:%s' % campaign),
                                  index='requests', size=self.overflow)
                   ['hits']['hits']]

        # loop over and parse the db data
        for res in respose:
            if res['status'] == 'done':
                res['total_events'] = self.number_of_events_for_done(res)
            elif res['status'] == 'submitted':
                res['total_events'] = self.number_of_events_for_submitted(res)

            # requests that are new (-1) should have zero events
            if res['total_events'] == -1:
                res['total_events'] = 0

            if res['time_event'] == -1:
                res['time_event'] = 0

            # remove unnecessary fields to speed up api
            for field in ['completed_events', 'reqmgr_name', 'history',
                          'output_dataset']:
                if field in res:
                    del res[field]
        return json.dumps({"results": respose})
