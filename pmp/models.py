from pyelasticsearch import ElasticSearch
import config
import copy
import json
import math
import time


class GetGrowing():

    def __init__(self):
        self.count_fake = 0
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 1000000

    def fake_suffix(self):
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
        # get all chained campaigns which contain selected CAMPAIGN
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
                    if (not len(mcm_r['output_dataset'])
                        or mcm_r['total_events'] == -1):
                        mcm_r['total_events'] = 0
                    else:
                        mcm_r['total_events'] = mcm_r['completed_events']

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
                    if mcm_r['total_events'] == -1:
                        mcm_r['total_events'] = 0
                    list_of_request_for_ramunas.append(pop(mcm_r))
            for noyet in all_cc[cr[
                    'member_of_campaign']]['campaigns'][stop_at+1:]:
                # create a fake request with the proper member of campaign
                processing_r = all_requests[cr['chain'][stop_at]]
                fake_one = self.create_fake_request(processing_r, noyet[0],
                                                    total=upcoming)
                list_of_request_for_ramunas.append(fake_one)
        return json.dumps({"results": list_of_request_for_ramunas})


class GetAnnounced():
    '''
    Used to return list of requests with some properties in a given campaign
    '''
    def __init__(self):
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 1000000

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

            # requests that are new (-1) should have zero events
            if r['total_events'] == -1:
                r['total_events'] = 0

            if r['time_event'] == -1:
                r['time_event'] = 0

            # remove unnecessary fields to speed up api
            del r['completed_events']
            del r['reqmgr_name']
            del r['history']
            del r['output_dataset']

        return json.dumps({"results": res})


class GetLifetime():

    def __init__(self):
        self.es = ElasticSearch(config.DATABASE_URL)
        # normally es will crop results to 20
        # and a million rows is more than we have in db
        self.overflow = 1000000

    def select_dataset(self, ds1, ds2):
        """
        This is inherit from Stats statsMonitoring.py
        """
        t1=ds1.split('/')[1:]
        t2=ds2.split('/')[1:]
        if len(t1[1]) > len(t2[1]):
            return 1
        else:
            def tierP(t):
                tierPriority=[
                    '/RECO',
                    'SIM-RECO',
                    'DIGI-RECO',
                    'AOD',
                    'SIM-RAW-RECO',
                    'DQM' ,
                    'GEN-SIM',
                    'RAW-RECO',
                    'USER',
                    'ALCARECO']
                for (p, tier) in enumerate(tierPriority):
                    if tier in t:
                        return p
                return t
            p1 = tierP(t1[2])
            p2 = tierP(t2[2])
            decision = (p1 > p2)
            return decision * 2 - 1
            
    def db_query(self, input):
        """
        Query DB and return array of raw documents
        """
        iterable = []
        try:
            # check if the input is a campaign
            req_arr = [s['_source'] for s in
                       self.es.search(('member_of_campaign:%s' % input),
                                      index='requests',
                                      size=self.overflow)['hits']['hits']]
            for r in req_arr:
                try:
                    dataset_list = r['output_dataset']
                    dataset_list.sort(cmp=self.select_dataset)
                    request_output_type = dataset_list[0]
                    request_output_type = request_output_type.split('/')[-1]
                   
                    for e in r['reqmgr_name']:
                        i = {}
                        i['status'] = r['status']
                        i['pwg'] = r['pwg']
                        i['priority'] = r['priority']
                        i['name'] = e
                        i['request_output_type'] = request_output_type
                        iterable.append(i)
                except:
                    pass
        except:
            pass

        if not len(iterable):
            try:
                # check if the input is a request
                s = self.es.get('requests', 'request', input)['_source']
                dataset_list = s['output_dataset']
                dataset_list.sort(cmp=self.select_dataset)
                request_output_type = dataset_list[0]
                request_output_type = request_output_type.split('/')[-1]
                for e in s['reqmgr_name']:
                    i = {}
                    i['status'] = s['status']
                    i['pwg'] = s['pwg']
                    i['priority'] = s['priority']
                    i['name'] = e
                    i['request_output_type'] = request_output_type
                    iterable.append(i)
            except:
                # input can be a reqmgr_name
                iterable = [input]
        for i in iterable:
            if not 'status' in i:
                try:
                    yield [self.es.get('stats', 'stats', i)['_source'],
                           None, None, None, None]
                except:
                    yield [None, None, None, None, None]
            else:
                try:
                    yield [self.es.get('stats', 'stats', i['name'])['_source'],
                           i['status'], i['pwg'], i['priority'], i['request_output_type']]
                except:
                    yield [None, None, None, None, None]

    def rm_useless(self, arr):
        r = []
        prev = {'a': -1, 'e': -1, 'x': -1}
        # remove first probe of resubmissions
        # and points that are equal to previous measurement
        for (x, a) in enumerate(arr):
            if (a['a'] != 0 or x == 0) and (
                a['a'] != prev['a'] or a['e'] != prev['e'] or a['x'] != prev['x']):
                r.append(a)
                prev = a
        return r

    def prepare_response(self, query, probe, p_min, p_max, status_i, pwg_i, tc):
        taskchain = True
        stop = False
        r = []
        status = {}
        pwg = {}

        for q in query:
            # Process the db documents
            for (d, s, p, pr, rot) in self.db_query(q):
                if d is None:
                    continue
                if not s is None and not s in status:
                    status[s] = False
                    if status_i is None:
                        status[s] = True
                    else:
                        for i in status_i:
                            if i == s:
                                status[s] = True
                                break
                if not p is None and not p in pwg:
                    pwg[p] = False
                    if pwg_i is None:
                        pwg[p] = True
                    else:
                        for i in pwg_i:
                            if i == p:
                                pwg[p] = True
                                break
                # pwg filtering 
                if not p is None and (not pwg_i is None) and (not p in pwg_i):
                    continue
                # status filtering 
                if not s is None and (not status_i is None) and (not s in status_i):
                    continue
                # priority filtering
                if not pr is None and (pr < p_min or (pr > p_max and p_max != -1)):
                    continue
                # create an array of requests to be processed
                response = {}
                response['data'] = []
                response['request'] = d['pdmv_prep_id']
                response['type'] = d['pdmv_dataset_name'].split('/')[-1]

                taskchain = taskchain and (d['pdmv_type'] == 'TaskChain')
                if tc and taskchain:
                    # load taskchain instead of normal req
                    for t in d['pdmv_monitor_taskchain']:
                        res = {}
                        res['request'] = t['dataset']
                        res['data'] = []
                        for record in t['monitor']:
                            if len(record['pdmv_monitor_time']):
                                data = {}
                                data['a'] = (record['pdmv_evts_in_DAS'] +
                                             record['pdmv_open_evts_in_DAS'])
                                data['t'] = time.mktime(time.strptime(
                                        record['pdmv_monitor_time']))*1000
                                data['x'] = d['pdmv_expected_events']
                            res['data'].append(data)
                        r.append(res)
                    re = {}
                    re['data'] = r  
                    re['status'] = {}
                    re['pwg'] = {}
                    re['taskchain'] = taskchain
                    stop = True
                        
                elif tc:
                    # perhaps someone is playing with url
                    stop = True
                    re = {}
                    
                else:
                    if 'pdmv_monitor_history' in d:
                        for record in d['pdmv_monitor_history']:
                            if len(record['pdmv_monitor_time']):
                                data = {}
                                data['a'] = record['pdmv_evts_in_DAS'] + record['pdmv_open_evts_in_DAS']
                                data['e'] = record['pdmv_evts_in_DAS']
                                data['t'] = time.mktime(time.strptime(record['pdmv_monitor_time']))*1000
                                data['x'] = d['pdmv_expected_events']
                                response['data'].append(data)
                    r.append(response)

        if stop:
            return re


        # Step 1: Get accumulated requests
        tmp = {}
        for x in r:
            s = x['request']
            try: 
                if x['type'] == tmp[s]['type']:
                    tmp[s]['data'] += x['data']
                    tmp[s]['data'] = sorted(tmp[s]['data'], key=lambda e: e['t'])
                    tmp[s]['data'] = self.rm_useless(tmp[s]['data'])
            except KeyError:
                if rot is None or rot == x['type']:

                    tmp[s] = {}
                    tmp[s]['type'] = x['type']
                    tmp[s]['data'] = x['data']

                    tmp[s]['data'] = sorted(tmp[s]['data'], key=lambda e: e['t'])
                    tmp[s]['data'] = self.rm_useless(tmp[s]['data'])

        # Step 2: Get and sort timestamps
        times = []
        for t in tmp:
            times += (x['t'] for x in tmp[t]['data'])

        times = sorted(set(times))

        if len(times) > (probe-1):
            skiper = len(times) / (probe-1)
        else:
            skiper = -1

        filter_times  = []
        i = 0
        for (x, t) in enumerate(times):
            if i < skiper and x < len(times) - 1 and x != 0:
                i += 1
            else:
                filter_times.append(t)
                i = 0
        
        # Step 3 & 4: Cycle through requests and add data points
        data = []
        for ft in filter_times:
            d = {'a': 0, 'e':0, 't': ft, 'x': 0}
            for t in tmp:
                prevx = {'a': 0, 'e':0, 'x': 0}
                for (i, x) in enumerate(tmp[t]['data']):
                    if x['t'] > ft:
                        d['a'] += prevx['a']
                        d['e'] += prevx['e']
                        d['x'] += prevx['x']
                        break
                    elif x['t'] == ft or i == len(tmp[t]['data'])-1:
                        d['a'] += x['a']
                        d['e'] += x['e']
                        d['x'] += x['x']
                        break
                    else:
                        prevx = x
            data.append(d)
        
        re = {}
        re['data'] = data
        re['status'] = status
        re['pwg'] = pwg
        re['taskchain'] = taskchain
        return re

    def get(self, query, probe=100, priority_min=0, priority_max=-1,
            status=None, pwg=None, taskchain=False):
        return json.dumps({"results": self.prepare_response(query.split(','), probe,
                                                            priority_min, priority_max,
                                                            status, pwg, taskchain)})

class GetPerformance():
    '''
    Used to return list of requests with some history points
    '''
    def __init__(self):
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 1000000

    def get(self, campaign):

        # change all to wildcard
        if campaign == 'all':
            campaign = '*'

        # get list of requests - field has to be not analyzed by es
        res = [s['_source'] for s in
               self.es.search(('member_of_campaign:%s' % campaign),
                              index='requests', size=self.overflow)
               ['hits']['hits']]

        # loop over and remove db documents
        for r in res:
            for field in ['time_event', 'total_events', 'completed_events',
                          'reqmgr_name', 'efficiency', 'output_dataset']:
                try:
                    del r[field]
                except KeyError:
                    pass
        return json.dumps({"results": res})


class GetSuggestions():
    '''
    Used to search in elastic for simmilar prepid as given
    '''

    def __init__(self, typeof):
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 20
        self.announced = (typeof == 'announced')
        self.growing = (typeof == 'growing')
        self.lifetime = (typeof == 'lifetime')
        self.performance = (typeof == 'performance')

    def get(self, query):
        searchable = query.replace('-', '\-')
        if '-' in query:
            search = ('prepid:%s' % searchable)
            search_stats = ('pdmv_request_name:%s' % searchable)
        else:
            search = ('prepid:*%s*' % searchable)
            search_stats = ('pdmv_request_name:*%s*' % searchable)

        ext0 = []
        ext1 = []
        ext2 = []

        if self.lifetime or self.growing or self.announced or self.performance:
            # campaigns are expected in all modes
            ext0 = [s['_id'] for s in
                    self.es.search(search, index='campaigns',
                                   size=self.overflow)['hits']['hits']]

            # extended search for lifetime
            if self.lifetime:
                ext1 = [s['_id'] for s in
                        self.es.search(search, index='requests',
                                       size=self.overflow)['hits']['hits']]

                ext2 = [s['_id'] for s in
                        self.es.search(search_stats, index='stats',
                                       size=self.overflow)['hits']['hits']]

            # extended search fo growing
            if self.growing:
                ext1 = [s['_id'] for s in
                        self.es.search(search, index="chained_campaigns",
                                       size=self.overflow)['hits']['hits']]

                ext2 = [s['_id'] for s in
                        self.es.search(search, index="chained_requests",
                                       size=self.overflow)['hits']['hits']]

        # order of ext does matter because of the typeahead in bootstrap
        return json.dumps({"results": ext0 + ext1 + ext2})
