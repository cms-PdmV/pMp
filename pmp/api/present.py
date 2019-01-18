"""A list of classes supporting present statistics API"""
from pmp.api.common import APIBase
import json

import logging

class PresentAPI(APIBase):

    def __init__(self):
        APIBase.__init__(self)

    def get_campaigns_from_query(self, query):
        campaigns = set()
        for one in query.split(','):
            one = one.strip()
            if not one:
                # Skip empty values
                continue

            for _, mcm_document in self.db_query(one, include_stats_document=False):
                if mcm_document is None:
                    # Well, there's nothing to do, is there?
                    continue

                campaign = mcm_document.get('member_of_campaign')
                if not campaign or campaign in campaigns:
                    continue

                chained_campaigns = self.fetch_objects(field='campaigns',
                                                       query=campaign,
                                                       index='chained_campaigns',
                                                       doctype='chained_campaign')
                for chained_campaign in chained_campaigns:
                    for campaign_flow_pair in chained_campaign.get('campaigns'):
                        campaigns.add(campaign_flow_pair[0])

        # Return only unique values
        logging.info('Campaigns from query "%s" are %s' % (query, campaigns))
        return list(campaigns)

    def prepare_response(self, query):
        response_list = []
        query = query.split(',')
        seen_prepids = set()
        for one in query:
            # Keep track of the prepids we've seen, so that we only add submission data points once
            logging.info('Processing %s' % (one))
            if not one:
                # Skip empty values
                continue

            # Process the db documents
            for _, mcm_document in self.db_query(one, include_stats_document=True):
                # skip legacy request with no prep_id
                if len(mcm_document.get('prepid', '')) == 0:
                    continue

                if mcm_document['prepid'] in seen_prepids:
                    logging.warning('%s is already in seen_prepids. Why is it here again?' % (mcm_document['prepid']))
                    continue

                seen_prepids.add(mcm_document['prepid'])
                response_list.append({'member_of_campaign': mcm_document['member_of_campaign'],
                                      'prepid': mcm_document['prepid'],
                                      'pwg': mcm_document['pwg'],
                                      'status': mcm_document['status'],
                                      'priority': mcm_document['priority'],
                                      'total_events': mcm_document['total_events']})

        return response_list

    def get(self, query, chained_mode=False, growing_mode=False, priority_filter=None, pwg_filter=None, status_filter=None):

        """
        Get the historical data based on query, data point count, priority and filter
        """
        logging.info('query=%s (%s) | chained_mode=%s (%s) | growing_mode=%s (%s) | priority_filter=%s (%s) | pwg_filter=%s (%s) | status_filter=%s (%s)' % (query,
                                                                                                                                                             type(query),
                                                                                                                                                             chained_mode,
                                                                                                                                                             type(chained_mode),
                                                                                                                                                             growing_mode,
                                                                                                                                                             type(growing_mode),
                                                                                                                                                             priority_filter,
                                                                                                                                                             type(priority_filter),
                                                                                                                                                             pwg_filter,
                                                                                                                                                             type(pwg_filter),
                                                                                                                                                             status_filter,
                                                                                                                                                             type(status_filter)))

        if chained_mode:
            campaigns = self.get_campaigns_from_query(query)
            logging.info('Campaign Mode! Campaigns for query %s are %s' % (query, campaigns))
            query = ','.join(campaigns)

        # Construct data by given query
        response = self.prepare_response(query)
        # Apply priority, PWG and status filters
        response, pwgs, statuses = self.apply_filters(response, priority_filter, pwg_filter, status_filter)
        res = {'data': response,
               'pwg': pwgs,
               'status': statuses}
        logging.info('Will return')
        return json.dumps({'results': res})