from models import esadapter
from pyelasticsearch import ElasticSearch
import config
import copy
import json
import math
import time

class AnnouncedAPI(esadapter.InitConnection):
    '''
    Used to return list of requests with some properties in a given campaign
    '''
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
                try:
                    # requests without output_dataset should have zero events
                    if not len(r['output_dataset']):
                        r['total_events'] = 0
                except KeyError:
                    r['total_events'] = 0
                    pass
            if r['status'] == 'submitted':
                try:
                    if not len(r['reqmgr_name']):
                        r['total_events'] = 0
                except KeyError:
                    r['total_events'] = 0
                    pass

            # requests that are new (-1) should have zero events
            if r['total_events'] == -1:
                r['total_events'] = 0

            if r['time_event'] == -1:
                r['time_event'] = 0

            # remove unnecessary fields to speed up api
            try:
                del r['completed_events']
                del r['reqmgr_name']
                del r['history']
                del r['output_dataset']
            except KeyError:
                print r['prepid']

        return json.dumps({"results": res})
