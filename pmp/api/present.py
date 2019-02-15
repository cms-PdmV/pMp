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

    def sum(self, thing):
        if thing is None:
            return 0

        if isinstance(thing, int):
            return thing

        if isinstance(thing, float):
            return int(thing + 0.5)

        return sum(thing)

    def prepare_response(self, query, estimate_completed_events):
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
            for stats_document, mcm_document in self.db_query(one, include_stats_document=True, estimate_completed_events=estimate_completed_events):
                # skip legacy request with no prep_id
                if len(mcm_document.get('prepid', '')) == 0:
                    continue

                if mcm_document['prepid'] in seen_prepids:
                    logging.warning('%s is already in seen_prepids. Why is it here again?' % (mcm_document['prepid']))
                    continue

                completed_events = 0
                if stats_document is not None:
                     if 'event_number_history' in stats_document:
                        for history_record in stats_document['event_number_history']:
                            if history_record['dataset'] != mcm_document['output_dataset']:
                                continue

                            if len(history_record.get('history', [])) == 0:
                                break

                            newest_entry = sorted(history_record.get('history', []), key=lambda k: k['time'])[-1]
                            if newest_entry['type'] == 'VALID' or newest_entry['type'] == 'PRODUCTION':
                                completed_events = newest_entry.get('events', 0)

                seen_prepids.add(mcm_document['prepid'])
                response_list.append({'member_of_campaign': mcm_document['member_of_campaign'],
                                      'prepid': mcm_document['prepid'],
                                      'pwg': mcm_document['pwg'],
                                      'status': mcm_document['status'],
                                      'priority': mcm_document['priority'],
                                      'member_of_chain': mcm_document.get('member_of_chain', []),
                                      'is_member_of_chain': 'YES' if len(mcm_document.get('member_of_chain', [])) > 0 else 'NO',
                                      'time_event_sum': self.sum(mcm_document.get('time_event', [])),
                                      'total_events': mcm_document['total_events'],
                                      'dataset_name': mcm_document.get('dataset_name', ''),
                                      'completed_events': completed_events,
                                      'estimate_from': mcm_document.get('estimate_from')})

        return response_list

    def get(self, query, chained_mode=False, estimate_completed_events=False, priority_filter=None, pwg_filter=None, status_filter=None):

        """
        Get the historical data based on query, data point count, priority and filter
        """
        logging.info('query=%s (%s) | chained_mode=%s (%s) | priority_filter=%s (%s) | pwg_filter=%s (%s) | status_filter=%s (%s)' % (query,
                                                                                                                                      type(query),
                                                                                                                                      chained_mode,
                                                                                                                                      type(chained_mode),
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
        response = self.prepare_response(query, estimate_completed_events)
        # Apply priority, PWG and status filters
        response, pwgs, statuses = self.apply_filters(response, priority_filter, pwg_filter, status_filter)
        res = {'data': response,
               'pwg': pwgs,
               'status': statuses}
        logging.info('Will return')
        return json.dumps({'results': res})
