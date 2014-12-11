import copy
import json

from collections import defaultdict
from flask import Flask
from flask import make_response
from flask import render_template
from pyelasticsearch import ElasticSearch
import sys

overflow = 100000
app = Flask(__name__, static_url_path='')
es = ElasticSearch('http://localhost:9200/')


class GetStats():

    def __init__(self):
        self.countDummy=0

    def fakeId(self):
        self.countDummy+=1
        return 'X'*(5-len("%d"%(self.countDummy)))+"%d"%(self.countDummy)
    
    def __createDummyRequest(self, req, memberOfCampaign, status="upcoming",total=None):
        fake_r = {}
        fake_r['status']= status
        fake_r['member_of_campaign']=memberOfCampaign
        for member in ['pwg','priority','total_events']:
            fake_r[member]=req[member]
        if total is not None:
            fake_r['total_events'] =total
        fake_r['prepid'] = '-'.join([req['pwg'], memberOfCampaign, self.fakeId()])
        fake_r['cloned_from'] = req['prepid']
        #self.logger.error("Total events is %s for %s"%( fake_r['total_events'], req['prepid']))
        return fake_r


    def GET(self, campaign):
        counts = defaultdict(lambda: defaultdict(int) )
        counts_e = defaultdict(lambda: defaultdict(int) )
        statuses=['new', 'validation', 'defined', 'approved' , 'submitted', 'done', 'upcoming']
        data = []
        data.append( ['Step'] + statuses )

        arg_list = campaign.split(',')

        # Get all chained campaigns which contain selected CAMPAIGN

        # reduction to only cc
        while True:
            again=False
            for arg in arg_list:
                if not arg.startswith('chain'):
                    # this is a flow, or a campaign : does not matter for the query
                    ccs = []
                    for c in es.search(('campaigns:%s' % arg), index='chained_campaigns', size=overflow)['hits']['hits']:
                        ccs.append(c['_source'])
                    arg_list.extend( map (lambda cc: cc['prepid'], ccs))
                    arg_list.remove( arg )
                    again=True
                    break
            if not again:
                break

        #  arg_list contains only chained campaigns
        steps=[] # what are the successive campaigns
        all_cr=[] # what are the chained requests to look at
        all_cc={}
        # unique it
        arg_list= list(set(arg_list))

        # collect all crs
        for a_cc in arg_list:
            try:
                mcm_cc = es.get('chained_campaigns', 'chain_campaign', a_cc)['_source']
            except Exception:
                # try to see if that's a flow
                return "%s does not exists" % ( a_cc )
            all_cc[a_cc] = mcm_cc ## keep it in mind
            all_cr.extend([s['_source'] for s in es.search(('member_of_campaign:%s' % a_cc), index='chained_requests', size=overflow)['hits']['hits']])
            #all_cr.extend( crdb.queries(['member_of_campaign==%s'%a_cc]))
            these_steps = map(lambda s : s[0], mcm_cc['campaigns'])
            if len(steps)==0:
                steps=these_steps
            else:
                # concatenate to existing steps
                # add possible steps at the beginning
                connection=0
                while not steps[connection] in these_steps:
                    connection+=1

                new_start= these_steps.index( steps[connection] )
                if new_start!=0:
                    # they do not start at the same campaign
                    for where in range(new_start):
                        steps.insert(where, these_steps[where])
                # verify strict overlapping ==> does not function properly and limits the flexibility
                for check in range(new_start, len(these_steps)):
                    if these_steps[check] not  in steps:
                        steps.append( these_steps[check] )

        # preload all requests !!!
        all_requests = {}
        for step in steps:
            #QUERY

            for r in [s['_source'] for s in es.search(('member_of_campaign:%s' % step), index='requests', size=overflow)['hits']['hits']]:
                all_requests[r['prepid']] = r

        # avoid double counting
        already_counted=set() 
        # the list of requests to be emitted to d3js
        list_of_request_for_ramunas=[] #

        for cr in all_cr: #
            upcoming=0 #
            if len(cr['chain'])==0: #
                ## crap data
                continue #
            # stop_at=cr['step']
            stop_at=len(cr['chain'])-1 #
            for (r_i,r) in enumerate(cr['chain']):
                if r_i > stop_at:
                    # this is a reserved request, will count as upcoming later
                    continue

                mcm_r = all_requests[r]
                upcoming=mcm_r['total_events'] #
                if r in already_counted:
                    continue
                else:
                    already_counted.add(r)

                counts[str(mcm_r['member_of_campaign'])] [mcm_r['status']] +=1
                if mcm_r['status'] in ['done']: #
                    counts_e[str(mcm_r['member_of_campaign'])] [mcm_r['status']] += mcm_r['completed_events']
                elif  mcm_r['status'] in ['submitted']: #
                    # split the stat in done and submitted accordingly
                    counts_e[str(mcm_r['member_of_campaign'])] ['done'] += mcm_r['completed_events'] #
                    counts_e[str(mcm_r['member_of_campaign'])] ['submitted'] += max([0, mcm_r['total_events'] - mcm_r['completed_events']]) #
                else:
                    counts_e[str(mcm_r['member_of_campaign'])] [mcm_r['status']] += mcm_r['total_events'] #

                # add it to emit
                def pop( mcm_r ): #
                    for member in mcm_r.keys():
                        if member not in ['prepid','pwg','priority','total_events','status','member_of_campaign']: #
                            mcm_r.pop(member) #
                    return mcm_r #
                # manipulation of total_events => completed ?
                # splitting of the request into done=completed_events and submitted=max([0, mcm_r['total_events'] - mcm_r['completed_events']]) ?
                if mcm_r['status'] == 'submitted':
                    mcm_r_fake_done = copy.deepcopy( mcm_r ) #
                    mcm_r_fake_done['status'] = 'done' #
                    mcm_r_fake_done['total_events'] = mcm_r['completed_events'] #
                    mcm_r_fake_subm = copy.deepcopy( mcm_r ) #
                    mcm_r_fake_subm['total_events'] = max([0, mcm_r['total_events'] - mcm_r['completed_events']]) #
                    list_of_request_for_ramunas.append( pop(mcm_r_fake_subm) ) #
                    list_of_request_for_ramunas.append( pop(mcm_r_fake_done) ) #
                else:
                    list_of_request_for_ramunas.append( pop(mcm_r) ) #

            for noyet in all_cc[cr['member_of_campaign']]['campaigns'][stop_at+1:]: #
                counts_e[ noyet[0] ]['upcoming']+=upcoming #
                # create a fake request with the proper member of campaign
                processing_r = all_requests[ cr['chain'][ stop_at ] ] #
                fake_one = self.__createDummyRequest( processing_r, noyet[0], total=upcoming ) #
                list_of_request_for_ramunas.append( fake_one ) #
                
        return json.dumps({"results": list_of_request_for_ramunas}) #


def get_request(r):
    return json.dumps(es.get('requests', 'request', r))

def search_simple(campaign):
    response = {}
    response['results'] = []
    if campaign == 'all':
        campaign = '*'
    for s in es.search(('member_of_campaign:%s' % campaign),
                       index='requests', size=overflow)['hits']['hits']:
        response['results'].append(s['_source'])
    return make_response(json.dumps(response))

def search_chain(campaign):
    gs = GetStats()
    return gs.GET(campaign)

@app.route('/')
def index():
    return make_response(open('app/templates/index.html').read())

@app.route('/campaign')
@app.route('/chain')
def dashboard():
    return make_response(open('app/templates/graph.html').read())

@app.route('/api/<member_of_campaign>/<typeof>')
def api(member_of_campaign, typeof):
    if typeof == 'simple':
        return make_response(search_simple(member_of_campaign))
    elif typeof == 'chain':
        return make_response(search_chain(member_of_campaign))
"""
@app.route('/about')
def about():
    return 'About'

@app.route('/getstats')
def getstats():
    return 'Get Stats'

@app.route('/loadstats')
def loadstats():
    return 'Load Stats'

@app.route('/hello/<idx>/int:<idx2>')
def hello_world(idx, idx2):
    return 'Hello World!%s%s' % (idx,idx2)
"""
@app.errorhandler(404)
def page_not_found(error):
    return render_template('page_not_found.html'), 404

if __name__ == '__main__':
    # TODO: debug=False in production
    app.run(debug=True, host='0.0.0.0', port=80)
