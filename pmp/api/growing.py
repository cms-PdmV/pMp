from models import esadapter
import copy
import json
import math
import time


class GrowingAPI(esadapter.InitConnection):
    """
    Return list of requests chained to given camapign with fake upcoming field
    """
    def __init__(self):
        esadapter.InitConnection.__init__(self)
        self.count_fake = 0

    def completed_deep(self, request):
        """
        Check the real number of completed events based on stats
        """
        ce = 0
        if not len(request['output_dataset']):
            return 0

        od = request['output_dataset'][0]
        for rm in request['reqmgr_name']:
            try:
                stats = self.es.get('stats', 'stats', rm)['_source']
            except:
                continue

            if stats['pdmv_dataset_name'] == od:
                try:
                    s = stats['pdmv_monitor_history'][0]
                    ce = max(ce, s['pdmv_evts_in_DAS'] +
                             s['pdmv_open_evts_in_DAS'])
                except:
                    # due to delay in stats
                    continue
            elif 'pdmv_monitor_datasets' in stats:
                for md in stats['pdmv_monitor_datasets']:
                    if md['dataset'] == od:
                        s = md['monitor'][0]
                        ce = max(ce, s['pdmv_evts_in_DAS'] +
                                 s['pdmv_open_evts_in_DAS'])
        return ce

    def fake_suffix(self):
        """
        Create suffix for the fake requests
        """
        self.count_fake += 1
        return 'X'*(5-min(len(str(self.count_fake)), 4))+str(self.count_fake)

    def create_fake_request(self, original_request, member_of_campaign,
                            status='upcoming', total=None):
        fake_request = {}
        fake_request['status'] = status
        fake_request['member_of_campaign'] = member_of_campaign

        for f in ['pwg', 'priority', 'total_events', 'time_event']:
            fake_request[f] = original_request[f]

        if total is not None:
            fake_request['total_events'] = total
        else:
            fake_request['total_events'] = 0
        fake_request['prepid'] = '-'.join([original_request['pwg'],
                                           member_of_campaign,
                                           self.fake_suffix()])
        return fake_request

    def get(self, campaign):
        arg_list = campaign.split(',')
        # get all chained campaigns which contain selected campaign
        # reduction to only chained campaigns
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
                    # arg is going to be duplicated
                    arg_list.remove(arg)
                    again = True
                    break
            if not again:
                break
        # arg_list contains only chained campaigns
        steps = []  # what are the successive campaigns
        all_cr = []  # what are the chained requests to look at
        all_cc = {}
        # unique it
        arg_list = list(set(arg_list))
        # collect all cr
        for a_cc in arg_list:
            try:
                mcm_cc = self.es.get('chained_campaigns',
                                     'chained_campaign', a_cc)['_source']
            except Exception:
                # try to see if that's a flow
                # TODO: patch for this exception
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
        req_copy = dict(all_requests)
        # avoid double counting
        already_counted = set()
        # the list of requests to be emitted to d3js
        dump_requests = []
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
                if r in all_requests:
                    mcm_r = all_requests[r]
                if r in req_copy:
                    del req_copy[r]
                upcoming = int(mcm_r['total_events']*abs(mcm_r['efficiency']))

                if r in already_counted:
                    continue
                else:
                    already_counted.add(r)

                # add it to emit
                def pop(mcm_r):
                    for member in mcm_r.keys():
                        if member not in ['prepid', 'pwg', 'efficiency',
                                          'total_events', 'status', 'priority',
                                          'member_of_campaign', 'time_event']:
                            mcm_r.pop(member)
                    return mcm_r

                if mcm_r['status'] == 'done':
                    mcm_r['total_events'] = mcm_r['completed_events']
                    if mcm_r['total_events'] == -1 or \
                            not len(mcm_r['output_dataset']):
                        mcm_r['total_events'] = 0
                if mcm_r['status'] == 'submitted':
                    if 'reqmgr_name' in mcm_r:
                        if not len(mcm_r['reqmgr_name']):
                            mcm_r['total_events'] = 0

                if mcm_r['status'] == 'submitted':
                    mcm_r_fake_done = copy.deepcopy(mcm_r)
                    mcm_r_fake_done['status'] = 'done'
                    real_completed_events = self.completed_deep(mcm_r)
                    mcm_r_fake_done['total_events'] = real_completed_events
                    mcm_r_fake_subm = copy.deepcopy(mcm_r)
                    mcm_r_fake_subm['total_events'] = max(
                        [0, mcm_r['total_events'] - real_completed_events])
                    dump_requests.append(pop(mcm_r_fake_subm))
                    dump_requests.append(pop(mcm_r_fake_done))
                else:
                    if mcm_r['total_events'] == -1:
                        mcm_r['total_events'] = 0
                    dump_requests.append(pop(mcm_r))
            for noyet in all_cc[cr[
                    'member_of_campaign']]['campaigns'][stop_at+1:]:
                # create a fake request with the proper member of campaign
                processing_r = all_requests[cr['chain'][stop_at]]
                fake_one = self.create_fake_request(processing_r, noyet[0],
                                                    total=upcoming)
                dump_requests.append(fake_one)
        # add req that does not belong to chain (from org campaign)
        for r in req_copy:
            r = req_copy[r]
            if r['member_of_campaign'] == campaign:
                if r['status'] == 'done':
                    if not len(r['output_dataset']) or r['total_events'] == -1:
                        r['total_events'] = 0
                    else:
                        r['total_events'] = r['completed_events']
                if r['total_events'] == -1:
                    r['total_events'] = 0
                dump_requests.append(r)

        return json.dumps({"results": dump_requests})
