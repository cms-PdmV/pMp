"""A list of classes supporting present statistics API"""
from pmp.api.common import APIBase
import copy
import json
import elasticsearch


class AnnouncedAPI(APIBase):
    """
    Used to return list of requests in a given campaign
    """
    def __init__(self):
        APIBase.__init__(self)

    def remove_unnecessary_fields(self, mcm_request):
        """
        Remove unused fileds
        """
        for member in list(mcm_request):
            if member not in ['prepid',
                              'pwg',
                              'efficiency',
                              'total_events',
                              'status',
                              'priority',
                              'member_of_campaign',
                              'time_event',
                              'completed_events',
                              'output_dataset']:
                mcm_request.pop(member)

        return mcm_request

    def orphan_requests(self, req_mgr):
        """
        Orphan requests are the ones not corresponding to anything in
        production. They were submitted and rejected and they hang in McM
        due to lack of action eg. delete or reset. This check is needed to
        ensure pMp internal integrity between historical and present statistics
        """
        for workflow in req_mgr:
            try:
                self.es.get(index='workflows', doc_type='workflow', id=workflow)
                return False
            except elasticsearch.NotFoundError:
                continue

        return True

    def get_fakes_from_submitted(self, mcm_request):
        """Split submitted requests"""
        real_completed_events = self.completed_deep(mcm_request)
        mcm_r_fake_done = copy.deepcopy(mcm_request)
        mcm_r_fake_done['status'] = 'done'
        mcm_r_fake_done['total_events'] = real_completed_events
        mcm_r_fake_subm = copy.deepcopy(mcm_request)
        mcm_r_fake_subm['total_events'] = max([0, mcm_request['total_events'] - real_completed_events])
        return [self.remove_unnecessary_fields(mcm_r_fake_subm), self.remove_unnecessary_fields(mcm_r_fake_done)]

    def number_of_events_for_done(self, request):
        """Requests that are done should return completed events value;
        Requests without output_dataset should have zero events
        """
        if len(request.get('output_dataset', [])) > 0:
            return request['completed_events']
        else:
            return 0

    def number_of_events_for_submitted(self, request):
        """Requests that have just been submitted and no req_mgr data"""
        if 'reqmgr_name' in request and len(request['reqmgr_name']):
            if not self.orphan_requests(request['reqmgr_name']):
                return request['total_events']

        return 0

    def get_results(self, query, flip_to_done):
        """
        Execute announced API - for compatibility with chained API, which uses this for
        ReReco campaigns
        """
        response = []
        field, index, doctype, query = self.parse_query(query)
        if field is not None:
            # campaign, flow or processing_string - search for requests by that member
            response = [s['_source'] for s in self.es.search(q=('%s:%s' % (field, query)),
                                                             index=index,
                                                             size=self.results_window_size)['hits']['hits']]
        else:
            # It's probably a request or rereco_request
            try:
                response = [self.es.get(index=index, doc_type=doctype, id=query)['_source']]
            except elasticsearch.NotFoundError:
                pass

        fake_requests = []
        remove_requests = []
        # loop over and parse the db data
        for res in response:
            # Remove new and unchained to clean up output plots
            if res['status'] == 'new' and len(res.get('member_of_chain', [])) == 0:
                remove_requests.append(res)
                continue

            if res['status'] == 'done':
                res['total_events'] = self.number_of_events_for_done(res)
            elif res['status'] == 'submitted':
                res['total_events'] = self.number_of_events_for_submitted(res)

            # requests that are new (-1) should have zero events
            if res['total_events'] == -1:
                res['total_events'] = 0

            if res.get('time_event', 0) == -1:
                res['time_event'] = 0

            if flip_to_done and res['status'] == 'submitted':
                fake_requests.extend(self.get_fakes_from_submitted(res))
                remove_requests.append(res)
                continue

            self.remove_unnecessary_fields(res)

        for req in remove_requests:
            response.remove(req)

        response += fake_requests
        return response

    def get(self, query, flip_to_done):
        """
        Execute announced API
        """
        return json.dumps({'results': self.get_results(query, flip_to_done)})


class GrowingAPI(AnnouncedAPI):
    """
    Return list of requests chained input with fake upcoming field
    """
    def __init__(self):
        AnnouncedAPI.__init__(self)
        self.count_fake = 0

    def fake_suffix(self):
        """
        Create suffix for the fake requests
        """
        self.count_fake += 1
        return 'X' * (5 - len(str(self.count_fake))) + str(self.count_fake)

    def create_fake_request(self, original_request, member_of_campaign, status='upcoming', total=0):
        """
        Generate and return fake request
        """
        return {
            'status': status,
            'member_of_campaign': member_of_campaign,
            'pwg': original_request['pwg'],
            'priority': original_request['priority'],
            'total_events': original_request['total_events'],
            'time_event': original_request['time_event'],
            'total_events': total,
            'prepid': '-'.join([original_request['pwg'], member_of_campaign, self.fake_suffix()])
        }

    def get_chained_campaigns(self, query):
        """
        Get all chained campaigns which contain selected campaign reduction
        to chained campaigns only
        """
        while True:
            again = False
            for arg in query:
                if not arg.startswith('chain'):
                    # this is a flow, or a campaign: not matter for the query
                    ccs = [s['_source'] for s in self.es.search(q=('campaigns:%s' % arg),
                                                                index='chained_campaigns',
                                                                size=self.results_window_size)['hits']['hits']]
                    query.extend([item['prepid'] for item in ccs])
                    query.remove(arg)
                    again = True
                    break

            if not again:
                break

        return query

    def get_chained_requests(self, arg_list):
        """
        Collect all chained requests
        """
        steps = []  # what are the successive campaigns
        all_cr = []  # what are the chained requests to look at
        all_cc = {}
        for a_cc in arg_list:
            try:
                mcm_cc = self.es.get(index='chained_campaigns',
                                     doc_type='chained_campaign',
                                     id=a_cc)['_source']
            except elasticsearch.NotFoundError:
                # ask for forgivness
                continue

            all_cc[a_cc] = mcm_cc  # keep it in mind
            all_cr.extend([s['_source'] for s in
                           self.es.search(q=('member_of_campaign:%s' % a_cc),
                                          index='chained_requests',
                                          size=self.results_window_size)['hits']['hits']])
            these_steps = [item[0] for item in mcm_cc['campaigns']]
            if len(steps) == 0:
                steps = these_steps
            else:
                # concatenate to existing steps
                # add possible steps at the beginning
                connection = 0
                while not steps[connection] in these_steps:
                    connection += 1
                new_start = these_steps.index(steps[connection])
                if new_start != 0:
                    # they do not start at the same campaign
                    for where in range(new_start):
                        steps.insert(where, these_steps[where])
                # verify strict overlapping
                # ==> does not function properly and limits the flexibility
                for check in range(new_start, len(these_steps)):
                    if these_steps[check] not in steps:
                        steps.append(these_steps[check])
        return self.get_all_requests(steps), all_cr, all_cc

    def get_total_events(mcm_r):
        """Parse total_events field"""
        if mcm_r['status'] == 'done':
            mcm_r['total_events'] = mcm_r['completed_events']
            if mcm_r['total_events'] == -1 or not len(mcm_r['output_dataset']):
                return 0

        if mcm_r['status'] == 'submitted':
            if 'reqmgr_name' in mcm_r and not len(mcm_r['reqmgr_name']):
                return 0

        if mcm_r['total_events'] == -1:
            mcm_r['total_events'] = 0

        return mcm_r['total_events']

    def get_all_requests(self, steps):
        """Preload all requests"""
        all_requests = {}
        for step in steps:
            for response in [s['_source'] for s in
                             self.es.search(q=('member_of_campaign:%s' % step),
                                            index='requests',
                                            size=self.results_window_size)
                             ['hits']['hits']]:
                all_requests[response['prepid']] = response

        return all_requests

    def get(self, query, flip_to_done):
        """
        Execute growing API
        """
        # Take out the ReReco campaigns so we can add them in later (otherwise they'd just be
        # excluded, because they're not chained to anything)
        query_parts = query.split(',')
        rereco_parts = []
        other_parts = []

        # Include ReReco campaigns in the results
        for part in query_parts:
            if self.is_instance(part, 'processing_strings', 'processing_string'):
                rereco_parts.append(part)
            else:
                other_parts.append(part)

        all_requests, all_cr, all_cc = self.get_chained_requests(list(set(self.get_chained_campaigns(other_parts))))
        req_copy = dict(all_requests)

        # avoid double counting
        already_counted = set()
        # the list of requests to be emitted to d3js
        dump_requests = []
        for chain_request in all_cr:
            upcoming = 0
            if len(chain_request['chain']) == 0:
                continue

            for (r_i, request) in enumerate(chain_request['chain']):
                if request in already_counted:
                    continue

                already_counted.add(request)
                if request in all_requests:
                    mcm_r = all_requests[request]

                if request in req_copy:
                    del req_copy[request]

                mcm_r['total_events'] = self.get_total_events(mcm_r)
                upcoming = int(mcm_r['total_events'] * abs(mcm_r['efficiency']))
                if mcm_r['status'] == 'submitted' and flip_to_done:
                    dump_requests += self.get_fakes_from_submitted(mcm_r)
                else:
                    dump_requests.append(self.pop(mcm_r))

            for noyet in all_cc[chain_request['member_of_campaign']]['campaigns'][len(chain_request['chain']):]:
                try:
                    # create a fake request with the proper member of campaign
                    dump_requests.append(self.create_fake_request(all_requests[chain_request['chain'][-1]],
                                                                  noyet[0],
                                                                  total=upcoming))
                except KeyError:
                    pass

        # add req that does not belong to chain (from org campaign)
        for req in req_copy:
            req = req_copy[req]
            if req['member_of_campaign'] in query_parts:
                req['total_events'] = self.get_total_events(req)
                dump_requests.append(self.pop(req))

        if len(rereco_parts):
            dump_requests += self.get_results(','.join(rereco_parts), flip_to_done)

        return json.dumps({"results": dump_requests})
