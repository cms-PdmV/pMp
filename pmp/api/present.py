"""A list of classes supporting present statistics API"""
from pmp.api.models import esadapter
import copy
import json


class AnnouncedAPI(esadapter.InitConnection):
    """Used to return list of requests in a given campaign"""

    @staticmethod
    def pop(mcm_r):
        """Remove unused fileds"""
        for member in mcm_r.keys():
            if member not in ['prepid', 'pwg', 'efficiency', 'total_events',
                              'status', 'priority', 'member_of_campaign',
                              'time_event', 'input', 'completed_events',
                              'output_dataset']:
                mcm_r.pop(member)
        return mcm_r

    def completed_deep(self, request):
        """Return number of completed events from based on stats not McM"""
        completed_events = 0
        if not len(request['output_dataset']):
            return 0
        output_dataset = request['output_dataset'][0]
        for workflow in request['reqmgr_name']:
            try:
                stats = self.es.get('stats', 'stats', workflow)['_source']
            except esadapter.pyelasticsearch.exceptions\
                    .ElasticHttpNotFoundError:
                continue

            if stats['pdmv_dataset_name'] == output_dataset:
                try:
                    completed_events = self.stats_maximum(
                        stats['pdmv_monitor_history'][0], completed_events)
                except KeyError:
                    continue
            elif 'pdmv_monitor_datasets' in stats:
                for monitor in stats['pdmv_monitor_datasets']:
                    if monitor['dataset'] == output_dataset:
                        completed_events = self.stats_maximum(
                            monitor['monitor'][0], completed_events)
        return completed_events

    def get_fakes_from_submitted(self, mcm_r):
        """Split submitted requests"""
        real_completed_events = self.completed_deep(mcm_r)
        mcm_r_fake_done = copy.deepcopy(mcm_r)
        mcm_r_fake_done['status'] = 'done'
        mcm_r_fake_done['total_events'] = real_completed_events
        mcm_r_fake_subm = copy.deepcopy(mcm_r)
        mcm_r_fake_subm['total_events'] = max(
            [0, mcm_r['total_events'] - real_completed_events])
        return [self.pop(mcm_r_fake_subm), self.pop(mcm_r_fake_done)]

    def query_database(self, field, query):
        """Get list of requests - field has to be not analyzed by es"""
        return [s['_source'] for s in
                self.es.search(('%s:%s' % (field, query)),
                               index='requests', size=self.overflow)
                ['hits']['hits']]

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

    def is_instance(self, prepid, typeof, index):
        """Checks if prepid matches any typeof in the index"""
        try:
            self.es.get(index, typeof, prepid)['_source']
        except esadapter.pyelasticsearch.exceptions.ElasticHttpNotFoundError:
            return False
        return True

    def parse_query(self, query):
        """Returns parsed query and correct field"""
        if query == 'all':
            # change all to wildcard or check if chain
            return 'member_of_campaign', '*'
        elif self.is_instance(query, 'flow', 'flows'):
            return 'flown_with', query
        elif self.is_instance(query, 'campaign', 'campaigns'):
            return 'member_of_campaign', query
        return None, query

    def get(self, query, flip_to_done):
        """Execute announced API"""
        response = []
        field, query = self.parse_query(query)

        if field is not None:
            # campaign or flow
            response = self.query_database(field, query)
        else:
            # possibly request
            try:
                response = [self.es.get('requests', 'request',
                                        query)['_source']]
            except esadapter.pyelasticsearch.exceptions\
                    .ElasticHttpNotFoundError:
                pass

        dump_requests = []
        remove_requests = []
        # loop over and parse the db data
        for res in response:
            if res['status'] == 'done':
                res['total_events'] = self.number_of_events_for_done(res)
            elif res['status'] == 'submitted':
                res['total_events'] = self.number_of_events_for_submitted(res)

            # requests that are new (-1) should have zero events
            if res['total_events'] == -1:
                res['total_events'] = 0

            if res['time_event'] == -1:
                res['time_event'] = 0

            # assign to which query request belongs
            if query == '*':
                res['input'] = res['member_of_campaign']
            else:
                res['input'] = query

            if flip_to_done and res['status'] == 'submitted':
                dump_requests += self.get_fakes_from_submitted(res)
                remove_requests.append(res)
                continue

            # remove unnecessary fields to speed up api
            for field in ['completed_events', 'reqmgr_name', 'history',
                          'output_dataset']:
                if field in res:
                    del res[field]
            
        for rr in remove_requests:
            response.remove(rr)
        response += dump_requests
        return json.dumps({"results": response})

    @staticmethod
    def stats_maximum(data, previous):
        """Return maximum number of completed events"""
        return max(previous,
                   data['pdmv_evts_in_DAS'] + data['pdmv_open_evts_in_DAS'])


class GrowingAPI(esadapter.InitConnection):
    """Return list of requests chained input with fake upcoming field"""

    def __init__(self):
        esadapter.InitConnection.__init__(self)
        self.count_fake = 0


    def completed_deep(self, request):
        """Return number of completed events from based on stats not McM"""
        completed_events = 0
        if not len(request['output_dataset']):
            return 0
        output_dataset = request['output_dataset'][0]
        for workflow in request['reqmgr_name']:
            try:
                stats = self.es.get('stats', 'stats', workflow)['_source']
            except esadapter.pyelasticsearch.exceptions\
                    .ElasticHttpNotFoundError:
                continue

            if stats['pdmv_dataset_name'] == output_dataset:
                try:
                    completed_events = self.stats_maximum(
                        stats['pdmv_monitor_history'][0], completed_events)
                except KeyError:
                    continue
            elif 'pdmv_monitor_datasets' in stats:
                for monitor in stats['pdmv_monitor_datasets']:
                    if monitor['dataset'] == output_dataset:
                        completed_events = self.stats_maximum(
                            monitor['monitor'][0], completed_events)
        return completed_events

    def fake_suffix(self):
        """Create suffix for the fake requests"""
        self.count_fake += 1
        return 'X'*(5-min(len(str(self.count_fake)), 4))+str(self.count_fake)

    def create_fake_request(self, original_request, member_of_campaign,
                            status='upcoming', total=None):
        """Generate and return fake request"""
        fake_request = {}
        fake_request['status'] = status
        fake_request['member_of_campaign'] = member_of_campaign

        for field in ['pwg', 'priority', 'total_events', 'time_event']:
            fake_request[field] = original_request[field]

        if total is not None:
            fake_request['total_events'] = total
        else:
            fake_request['total_events'] = 0
        fake_request['prepid'] = '-'.join([original_request['pwg'],
                                           member_of_campaign,
                                           self.fake_suffix()])
        return fake_request

    def get_chained_campaigns(self, query):
        """Get all chained campaigns which contain selected campaign reduction
        to chained campaigns only
        """
        while True:
            again = False
            for arg in query:
                if not arg.startswith('chain'):
                    # this is a flow, or a campaign: not matter for the query
                    ccs = [s['_source'] for s in
                           self.es.search(('campaigns:%s' % arg),
                                          index='chained_campaigns',
                                          size=self.overflow)['hits']['hits']]
                    query.extend([item['prepid'] for item in ccs])
                    query.remove(arg)
                    again = True
                    break
            if not again:
                break
        return query

    def get_chained_requests(self, arg_list):
        """Collect all chained requests"""
        steps = []  # what are the successive campaigns
        all_cr = []  # what are the chained requests to look at
        all_cc = {}
        for a_cc in arg_list:
            try:
                mcm_cc = self.es.get('chained_campaigns',
                                     'chained_campaign', a_cc)['_source']
            except esadapter.pyelasticsearch.exceptions\
                    .ElasticHttpNotFoundError:
                # ask for forgivness
                continue

            all_cc[a_cc] = mcm_cc  # keep it in mind
            all_cr.extend([s['_source'] for s in
                           self.es.search(('member_of_campaign:%s' % a_cc),
                                          index='chained_requests',
                                          size=self.overflow)['hits']['hits']])
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

    @staticmethod
    def pop(mcm_r):
        """Remove unused fileds"""
        for member in mcm_r.keys():
            if member not in ['prepid', 'pwg', 'efficiency', 'total_events',
                              'status', 'priority', 'member_of_campaign',
                              'time_event', 'input', 'completed_events',
                              'output_dataset']:
                mcm_r.pop(member)
        return mcm_r

    @staticmethod
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
                             self.es.search(('member_of_campaign:%s' % step),
                                            index='requests',
                                            size=self.overflow)
                             ['hits']['hits']]:
                all_requests[response['prepid']] = response
        return all_requests

    def get_requests_in_same_chain(self, query):
        parent_chains = self.es.get('requests', 'request', query,
                fields='member_of_chain')['fields']['member_of_chain']
        common_requests = []
        common_request_prepids = [] # To avoid duplicates

        for chain in parent_chains:
            requests = self.es.get('chained_requests', 'chained_request', chain,
                    fields='chain')['fields']['chain']

            for request in requests:
                request_object = self.es.get('requests', 'request', request)['_source']
                if request_object['prepid'] not in common_request_prepids:
                    common_requests.append(request_object)
                    common_request_prepids.append(request_object['prepid'])

        return common_requests

    def get_fakes_from_submitted(self, mcm_r):
        """Split submitted requests"""
        real_completed_events = self.completed_deep(mcm_r)
        mcm_r_fake_done = copy.deepcopy(mcm_r)
        mcm_r_fake_done['status'] = 'done'
        mcm_r_fake_done['total_events'] = real_completed_events
        mcm_r_fake_subm = copy.deepcopy(mcm_r)
        mcm_r_fake_subm['total_events'] = max(
            [0, mcm_r['total_events'] - real_completed_events])
        return [self.pop(mcm_r_fake_subm), self.pop(mcm_r_fake_done)]

    def is_instance(self, prepid, typeof, index):
        """Checks if prepid matches any typeof in the index"""
        try:
            self.es.get(index, typeof, prepid)['_source']
        except esadapter.pyelasticsearch.exceptions.ElasticHttpNotFoundError:
            return False
        return True

    def get(self, query, flip_to_done):
        """Execute growing API"""
        if self.is_instance(query, "request", "requests"):
            # Get requests instead and return (FIXME: Feels like a dirty hack)
            return json.dumps({'results': self.get_requests_in_same_chain(query)})

        all_requests, all_cr, all_cc = self.get_chained_requests(
            list(set(self.get_chained_campaigns(query.split(',')))))
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
                if r_i > (len(chain_request['chain'])-1) or \
                        request in already_counted:
                    # this is a reserved request, will count as upcoming later
                    continue
                already_counted.add(request)
                if request in all_requests:
                    mcm_r = all_requests[request]
                if request in req_copy:
                    del req_copy[request]

                mcm_r['total_events'] = self.get_total_events(mcm_r)
                
                if mcm_r['status'] == 'submitted' and flip_to_done:
                    dump_requests += self.get_fakes_from_submitted(mcm_r)
                else:
                    dump_requests.append(self.pop(mcm_r))

                upcoming = int(mcm_r['total_events']*abs(mcm_r['efficiency']))
            for noyet in all_cc[chain_request['member_of_campaign']]\
                    ['campaigns'][len(chain_request['chain']):]:
                try:
                    # create a fake request with the proper member of campaign
                    dump_requests.append(self.create_fake_request( \
                            all_requests[chain_request['chain'] \
                                             [len(chain_request['chain'])-1]],
                            noyet[0], total=upcoming))
                except KeyError:
                    pass

        # add req that does not belong to chain (from org campaign)
        for req in req_copy:
            req = req_copy[req]
            if req['member_of_campaign'] == query:
                req['total_events'] = self.get_total_events(req)
                dump_requests.append(req)

        return json.dumps({"results": dump_requests})

    @staticmethod
    def stats_maximum(data, previous):
        """Return maximum number of completed events"""
        return max(previous,
                   data['pdmv_evts_in_DAS'] + data['pdmv_open_evts_in_DAS'])
