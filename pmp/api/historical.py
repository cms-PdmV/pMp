from pmp.api.utils import utils as apiutils
from pmp.api.models import esadapter
import json
import time


class HistoricalAPI(esadapter.InitConnection):
    """
    Used to return list of points for historical plots
    """
    def __init__(self):
        esadapter.InitConnection.__init__(self)
        self.campaign = True

    def completed_deep(self, request):
        ce = 0
        if not len(request['output_dataset']):
            return 0
        od = request['output_dataset'][0]
        for rm in request['reqmgr_name']:
            try:
                stats = self.es.get('stats', 'stats', rm)['_source']
            except esadapter.pyelasticsearch.exceptions\
                    .ElasticHttpNotFoundError:
                continue

            if stats['pdmv_dataset_name'] == od:
                try:
                    s = stats['pdmv_monitor_history'][0]
                    ce = max(ce, s['pdmv_evts_in_DAS'] +
                             s['pdmv_open_evts_in_DAS'])
                except KeyError:
                    continue
            elif 'pdmv_monitor_datasets' in stats:
                for md in stats['pdmv_monitor_datasets']:
                    if md['dataset'] == od:
                        s = md['monitor'][0]
                        ce = max(ce, s['pdmv_evts_in_DAS'] +
                                 s['pdmv_open_evts_in_DAS'])
        return ce

    def parse_time(self, t):
        return time.mktime(time.strptime(t))*1000

    def db_query(self, query):
        '''
        Query DB and return array of raw documents
        '''

        iterable = []

        # try to query for campaign and get list of requests
        req_arr = [s['_source'] for s in
                   self.es.search(('member_of_campaign:%s' % query),
                                  index='requests',
                                  size=self.overflow)['hits']['hits']]

        # if empty, assume query is a request
        if not len(req_arr):
            self.campaign = False
            try:
                req_arr = [self.es.get('requests',
                                       'request', query)['_source']]
            except esadapter.pyelasticsearch.exceptions\
                    .ElasticHttpNotFoundError:
                # if exception thrown this may be a workflow
                iterable = [query]

        # iterate over array and collect details
        for req in req_arr:
            try:
                dataset_list = req['output_dataset']
                if len(dataset_list):
                    ds = dataset_list[0]
                else:
                    ds = None

                for reqmgr in req['reqmgr_name']:
                    i = {}
                    i['expected'] = req['total_events']
                    i['name'] = reqmgr
                    i['output_dataset'] = ds
                    i['priority'] = req['priority']
                    i['pwg'] = req['pwg']
                    i['request'] = True
                    i['status'] = req['status']
                    iterable.append(i)
            except KeyError:
                pass

        # iterate over workflows and yield documents
        for i in iterable:
            if 'request' in i:
                try:
                    yield [i['request'],
                           self.es.get('stats', 'stats', i['name'])
                           ['_source'], i]
                except esadapter.pyelasticsearch.exceptions\
                        .ElasticHttpNotFoundError:
                    yield [True, None, i]
            else:
                try:
                    yield [False,
                           self.es.get('stats', 'stats', i)
                           ['_source'], None]
                except esadapter.pyelasticsearch.exceptions\
                        .ElasticHttpNotFoundError:
                    yield [False, None, None]

    def rm_useless(self, arr):
        '''
        Compressing data: remove first probe of resubmissions and points that
        are equal to previous measurement
        '''
        r = []
        prev = {'e': -1, 'x': -1}
        for (x, a) in enumerate(arr):
            if (a['e'] != prev['e'] or a['x'] != prev['x']) \
                    and (a['e'] != 0 or x == 0):
                r.append(a)
                prev = a
        return r

    def prepare_response(self, query, probe, p_min, p_max, status_i, pwg_i):
        stop = False
        r = []
        status = {}
        pwg = {}

        for q in query:

            # Process the db documents
            for (is_request, document, details) in self.db_query(q):

                # skip empty documents
                if document is None:
                    continue

                # filter out requests
                if is_request:

                    def get_filter_dict(doc, arr, inp):
                        if doc not in arr:
                            arr[doc] = False
                            if inp is None:
                                arr[doc] = True
                            else:
                                for i in inp:
                                    if i == doc:
                                        arr[doc] = True
                                        break
                        return arr

                    # generate stauts dict
                    status = get_filter_dict(details['status'], status,
                                             status_i)
                    # generate pwg dict
                    pwg = get_filter_dict(details['pwg'], pwg, pwg_i)
                    # pwg filtering
                    if not (pwg_i is None or details['pwg'] in pwg_i):
                        continue
                    # status filtering
                    if not (status_i is None or details['status'] in status_i):
                        continue
                    # filter out invalidated 'new'
                    if details['status'] not in ['done', 'submitted']:
                        continue
                    # priority filtering
                    if (details['priority'] < p_min or (
                            details['priority'] > p_max and p_max != -1)):
                        continue
                    no_secondary_datasets = True
                    # skip requests with not desired output dataset
                    if document['pdmv_dataset_name'] != \
                            details['output_dataset']:
                        if 'pdmv_monitor_datasets' in document:
                            for monitor in document['pdmv_monitor_datasets']:
                                if monitor['dataset'] == \
                                        details['output_dataset']:
                                    no_secondary_datasets = False
                        if details['output_dataset'] is not None and \
                                document['pdmv_dataset_name'] != 'None Yet' \
                                and document['pdmv_type'] != 'TaskChain' \
                                and no_secondary_datasets:
                            continue

                # skip legacy request with no prep_id
                if document['pdmv_prep_id'] == '':
                    continue

                # create an array of requests to be processed
                response = {}
                response['data'] = []
                response['request'] = document['pdmv_prep_id']

                if not is_request and (document['pdmv_type'] == 'TaskChain'):
                    # when input is workflow and a taskchain
                    for t in document['pdmv_monitor_datasets']:
                        res = {}
                        res['request'] = t['dataset']
                        res['data'] = []
                        for record in t['monitor']:
                            if len(record['pdmv_monitor_time']):
                                data = {}
                                data['e'] = (record['pdmv_evts_in_DAS'] +
                                             record['pdmv_open_evts_in_DAS'])
                                data['t'] = self.parse_time(
                                    record['pdmv_monitor_time'])
                                data['x'] = document['pdmv_expected_events']
                            res['data'].append(data)
                        r.append(res)
                    re = {}
                    re['data'] = r
                    re['status'] = {}
                    re['pwg'] = {}
                    re['taskchain'] = True
                    stop = True

                elif (details is None or
                      document['pdmv_dataset_name'] == details['output_dataset']) \
                        and document['pdmv_type'] != 'TaskChain' \
                        and 'pdmv_monitor_history' in document:
                    # usually pdmv_monitor_history has more information than
                    # pdmv_datasets: we try to use this
                    for record in document['pdmv_monitor_history']:
                        data = {}

                        # if the output in mcm is not specified yet set 0
                        if details is None or \
                                details['output_dataset'] is not None:
                            data['e'] = (record['pdmv_evts_in_DAS']
                                         + record['pdmv_open_evts_in_DAS'])
                        else:
                            data['e'] = 0

                        data['d'] = 0
                        if (details is None or details['status'] == 'done'):
                            data['d'] = data['e']

                        # get timestamp, if field is empty set 1/1/2013
                        if len(record['pdmv_monitor_time']):
                            data['t'] = self.parse_time(
                                record['pdmv_monitor_time'])
                        else:
                            data['t'] = self.parse_time(
                                "Tue Jan 1 00:00:00 2013")

                        # x is expected events
                        if is_request:
                            data['x'] = details['expected']
                        else:
                            data['x'] = document['pdmv_expected_events']

                        response['data'].append(data)

                elif ('pdmv_monitor_datasets' in document
                      and (document['pdmv_type'] == 'TaskChain'
                           or not no_secondary_datasets)):
                    # handling taskchain requests where output dataset
                    # is not the main one
                    for record in document['pdmv_monitor_datasets']:
                        if record['dataset'] == details['output_dataset']:
                            for m in record['monitor']:
                                data = {}
                                # if the output in mcm is not specified yet,
                                # treat as this has not produced anything
                                # ensures present = historical
                                if details is None or \
                                        details['output_dataset'] is not None:
                                    data['e'] = (m['pdmv_evts_in_DAS']
                                                 + m['pdmv_open_evts_in_DAS'])
                                else:
                                    data['e'] = 0

                                data['d'] = 0
                                if details['status'] == 'done':
                                    data['d'] = data['e']

                                data['t'] = self.parse_time(
                                    m['pdmv_monitor_time'])

                                # x is expected events
                                if is_request:
                                    data['x'] = details['expected']
                                else:
                                    data['x'] = \
                                        document['pdmv_expected_events']
                                response['data'].append(data)
                r.append(response)
        if stop:
            return re

        # Step 1: Get accumulated requests
        tmp = {}
        for x in r:
            s = x['request']
            if s not in tmp:
                tmp[s] = {}
                tmp[s]['data'] = []
            tmp[s]['data'] += x['data']
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

        filter_times = []
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
            d = {'d': 0, 'e': 0, 't': ft, 'x': 0}
            for t in tmp:
                prevx = {'d': 0, 'e': 0, 'x': 0}
                for (i, x) in enumerate(tmp[t]['data']):
                    if x['t'] > ft:
                        d['d'] += prevx['d']
                        d['e'] += prevx['e']
                        d['x'] += prevx['x']
                        break
                    elif x['t'] == ft or i == len(tmp[t]['data'])-1:
                        d['d'] += x['d']
                        d['e'] += x['e']
                        d['x'] += x['x']
                        break
                    else:
                        prevx = x
            data.append(d)

        # add last point which is now()
        if len(data):
            d = {'d': data[-1]['d'], 'e': data[-1]['e'],
                 't': int(round(time.time() * 1000)), 'x': data[-1]['x']}
            data.append(d)

        submitted = {}
        if self.campaign:
            requests = []
            for q in query:
                requests += [s['_source'] for s in
                             self.es.search(('member_of_campaign:%s' % q),
                                            index='requests',
                                            size=self.overflow)
                             ['hits']['hits']]
            for r in requests:
                if ((r['status'] == 'submitted')
                    and (pwg_i is None or r['pwg'] in pwg_i)
                    and (r['priority'] > p_min
                         and (r['priority'] < p_max or p_max == -1))):
                    completed = self.completed_deep(r)
                    if completed:
                        submitted[r['prepid']] = (100 * completed /
                                                  r['total_events'])

        return {'data': data, 'pwg': pwg, 'submitted': submitted,
                'status': status, 'taskchain': False}

    def get(self, query, probe=100, priority=",",
            status=None, pwg=None):
        priority = apiutils.APIUtils().parse_priority_csv(priority.split(','))
        res = self.prepare_response(query.split(','), probe, priority[0],
                                    priority[1],
                                    apiutils.APIUtils().parse_csv(status),
                                    apiutils.APIUtils().parse_csv(pwg))
        return json.dumps({"results": res})
