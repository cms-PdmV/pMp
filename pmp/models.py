from pyelasticsearch import ElasticSearch
import config
import copy
import json


class GetChain():

    def __init__(self):
        self.countDummy = 0
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 1000000

    def fakeId(self):
        self.countDummy += 1
        return 'X'*(5-len('%d' % (self.countDummy)))+'%d' % (self.countDummy)

    def __createDummyRequest(self, req, memberOfCampaign, status='upcoming',
                             total=None):
        fake_r = {}
        fake_r['status'] = status
        fake_r['member_of_campaign'] = memberOfCampaign
        for member in ['pwg', 'priority', 'total_events']:
            fake_r[member] = req[member]
        if total is not None:
            fake_r['total_events'] = total
        fake_r['prepid'] = '-'.join([req['pwg'],
                                     memberOfCampaign, self.fakeId()])
        fake_r['cloned_from'] = req['prepid']
        return fake_r

    def get(self, campaign):
        arg_list = campaign.split(',')
        # Get all chained campaigns which contain selected CAMPAIGN
        # reduction to only cc
        while True:
            again = False
            for arg in arg_list:
                if not arg.startswith('chain'):
                    # this is a flow, or a campaign: not matter for the query
                    ccs = [s['_source'] for s in
                           self.es.search(('campaigns:%s' % arg),
                                          index='chained_campaigns',
                                          size=self.overflow)['hits']['hits']]
                    arg_list.extend(map(lambda cc: cc['prepid'], ccs))
                    arg_list.remove(arg)
                    again = True
                    break
            if not again:
                break
        #  arg_list contains only chained campaigns
        steps = []  # what are the successive campaigns
        all_cr = []  # what are the chained requests to look at
        all_cc = {}
        # unique it
        arg_list = list(set(arg_list))
        # collect all crs
        for a_cc in arg_list:
            try:
                mcm_cc = self.es.get('chained_campaigns',
                                     'chain_campaign', a_cc)['_source']
            except Exception:
                # try to see if that's a flow
                return '%s does not exists' % (a_cc)
            all_cc[a_cc] = mcm_cc  # keep it in mind
            all_cr.extend([s['_source'] for s in
                           self.es.search(('member_of_campaign:%s' % a_cc),
                                          index='chained_requests',
                                          size=self.overflow)['hits']['hits']])
            these_steps = map(lambda s: s[0], mcm_cc['campaigns'])
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
        # preload all requests !!!
        all_requests = {}
        for step in steps:
            for r in [s['_source'] for s in
                      self.es.search(('member_of_campaign:%s' % step),
                                     index='requests',
                                     size=self.overflow)['hits']['hits']]:
                all_requests[r['prepid']] = r
        # avoid double counting
        already_counted = set()
        # the list of requests to be emitted to d3js
        list_of_request_for_ramunas = []
        for cr in all_cr:
            upcoming = 0
            if len(cr['chain']) == 0:
                # crap data
                continue
            stop_at = cr['step']
            stop_at = len(cr['chain'])-1
            for (r_i, r) in enumerate(cr['chain']):
                if r_i > stop_at:
                    # this is a reserved request, will count as upcoming later
                    continue
                mcm_r = all_requests[r]
                upcoming = mcm_r['total_events']
                if r in already_counted:
                    continue
                else:
                    already_counted.add(r)

                # add it to emit
                def pop(mcm_r):
                    for member in mcm_r.keys():
                        if member not in ['prepid', 'pwg', 'priority',
                                          'total_events', 'status',
                                          'member_of_campaign']:
                            mcm_r.pop(member)
                    return mcm_r

                if mcm_r['status'] == 'submitted':
                    mcm_r_fake_done = copy.deepcopy(mcm_r)
                    mcm_r_fake_done['status'] = 'done'
                    mcm_r_fake_done['total_events'] = mcm_r['completed_events']
                    mcm_r_fake_subm = copy.deepcopy(mcm_r)
                    mcm_r_fake_subm['total_events'] = max(
                        [0, mcm_r['total_events'] - mcm_r['completed_events']])
                    list_of_request_for_ramunas.append(pop(mcm_r_fake_subm))
                    list_of_request_for_ramunas.append(pop(mcm_r_fake_done))
                else:
                    list_of_request_for_ramunas.append(pop(mcm_r))
            for noyet in all_cc[cr[
                    'member_of_campaign']]['campaigns'][stop_at+1:]:
                # create a fake request with the proper member of campaign
                processing_r = all_requests[cr['chain'][stop_at]]
                fake_one = self.__createDummyRequest(processing_r, noyet[0],
                                                     total=upcoming)
                list_of_request_for_ramunas.append(fake_one)
        return json.dumps({"results": list_of_request_for_ramunas})


class GetCampaign():

    def __init__(self):
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 1000000

    def get(self, campaign):
        if campaign == 'all':
            campaign = '*'
        return json.dumps(
            {"results": [s['_source'] for s in
                         self.es.search(('member_of_campaign:%s' % campaign),
                                        index='requests',
                                        size=self.overflow)['hits']['hits']]})

class GetLifetime():

    def __init__(self):
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 1000000

    def get(self, request):
        return '{"results": [[1335035400000, 10, 50],[1335135400000, 33, 66],[1335294600000, 50, 0]]}'
        #return json.dumps(
        #    {"results": [s['_source'] for s in
        #                 self.es.search(('member_of_campaign:%s' % campaign),
        #                                index='requests',
        #                                size=self.overflow)['hits']['hits']]})


class GetSuggestions():

    def __init__(self, typeof):
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 20
        self.on = (typeof == 'true')

    def get(self, campaign):
        if '-' in campaign:
            self.search_string = ('prepid:%s' % campaign.replace('-', '\-'))
        else:
            self.search_string = ('prepid:*%s*' % campaign.replace('-', '\-'))

        if self.on:
            return json.dumps(
                {"results": [s['_id'] for s in self.es.search(
                            self.search_string, index="chained_campaigns",
                            size=self.overflow)['hits']['hits']]
                 + [s['_id'] for s in self.es.search(self.search_string,
                                                     index="chained_requests",
                                                     size=self.overflow)
                    ['hits']['hits']]
                 })
        else:
            return json.dumps(
                {"results": [s['_id'] for s in self.es.search(
                            self.search_string, index="campaigns",
                            size=self.overflow)['hits']['hits']]})
