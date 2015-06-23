from models import esadapter
import json


class AnnouncedAPI(esadapter.InitConnection):
    """
    Used to return list of requests in a given campaign
    """
    def get(self, campaign):

        # change all to wildcard
        if campaign == 'all':
            campaign = '*'

        # get list of requests - field has to be not analyzed by es
        res = [s['_source'] for s in
               self.es.search(('member_of_campaign:%s' % campaign),
                              index='requests', size=self.overflow)
               ['hits']['hits']]

        # loop over and parse the db data
        for r in res:
            # requests that are done should have completed events value
            if r['status'] == 'done':
                r['total_events'] = r['completed_events']
                # requests without output_dataset should have zero events
                if 'output_dataset' in r:
                    if not len(r['output_dataset']):
                        r['total_events'] = 0
                else:
                    r['total_events'] = 0
            # requests that have just been submitted and no req_mgr data
            if r['status'] == 'submitted':
                if 'reqmgr_name' in r:
                    if not len(r['reqmgr_name']):
                        r['total_events'] = 0
                else:
                    r['total_events'] = 0

            # requests that are new (-1) should have zero events
            if r['total_events'] == -1:
                r['total_events'] = 0

            if r['time_event'] == -1:
                r['time_event'] = 0

            # remove unnecessary fields to speed up api
            for f in ['completed_events', 'reqmgr_name', 'history',
                      'output_dataset']:
                if f in r:
                    del r[f]
        return json.dumps({"results": res})
