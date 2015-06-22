from flask import make_response, redirect, render_template
from pmp import app, models
from flask import request
from cStringIO import StringIO
import json
import pycurl


@app.route('/404')
def four_oh_four():
    '''
    Redirect on 404
    '''
    return render_template('invalid.html'), 404


@app.route('/about')
def about():
    '''
    Redirect to Twiki
    '''
    return redirect('https://twiki.cern.ch/twiki/bin/viewauth/CMS/PdmVpMp',
                    code=302)


@app.route('/')
@app.route('/chains')
@app.route('/historical')
@app.route('/performance')
@app.route('/present')
def dashboard():
    '''
    Redirect to graph template
    '''
    return make_response(open('pmp/templates/valid.html').read())


@app.route('/api/<i>/<typeof>')
def api(i, typeof):
    '''
    Simple API call
    '''
    g = None
    if typeof == 'announced':
        g = models.APICall()
        return make_response(g.present_announced_mode(i))
    elif typeof == 'chain':
        g = models.APICall()
        return make_response(g.chain_landscape())
    elif typeof == 'growing':
        g = models.APICall()
        return make_response(g.present_growing_mode(i))
    elif typeof == 'historical':
        g = models.APICall()
        return make_response(g.historical_simple(i))
    elif typeof == 'performance':
        g = models.APICall()
        return make_response(g.performance(i))
    elif typeof == 'lastupdate':
        g = models.APICall()
        return make_response(g.last_update(i))
    if g is None:
        return make_response('{}')
    return make_response(g.get(i))


@app.route('/api/<i>/historical/<p>/<priority>/<status>/<pwg>')
def api_historical_extended(i, p, priority, status, pwg):
    '''
    API call for complex historical queries
    i - list of inputs (csv)
    p - int number of probes
    priority - in a for of min_pririty,max_priority
    status - list of statuses to include (csv)
    pwg - list of pwg to include (csv)
    taskchain - boolean to load in taskchain mode
    '''
    g = models.APICall()
    priority = parse_priority_csv(priority.split(','))
    return g.historical_complex(i, int(p), int(priority[0]), int(priority[1]),
                                parse_csv(status), parse_csv(pwg))


@app.route('/api/suggest/<input>/<typeof>')
def suggest(input, typeof):
    '''
    API call for typeahead
    input - input string to search in db
    typeof - lifetime/growing/announced/performance
    '''
    g = models.APICall()
    return make_response(g.suggestions(typeof, input))


@app.route('/shorten/<path:url>')
def shorten(url):
    '''
    Shorten URL
    '''
    c = ("http://tinyurl.com/api-create.php?url=" + url
         + "?" + request.query_string)
    out = StringIO()
    curl = pycurl.Curl()
    curl.setopt(pycurl.URL, str(c))
    curl.setopt(pycurl.WRITEFUNCTION, out.write)
    curl.perform()
    return make_response(out.getvalue())


def parse_csv(parsable):
    '''
    Generate array from csv
    '''
    if parsable == 'all':
        return None
    else:
        return parsable.split(',')


def parse_priority_csv(arr):
    '''
    Generate array from priority csv
    '''
    for p, _ in enumerate(arr):
        if arr[p] == '':
            arr[p] = -p
    return arr
