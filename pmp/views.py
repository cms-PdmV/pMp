from flask import make_response, redirect, render_template
from pmp import app, models
from flask import request
import json


@app.route('/404')
def four_oh_four():
    """
    Redirect on 404
    """
    return render_template('invalid.html'), 404


@app.route('/about')
def about():
    """
    Redirect to Twiki
    """
    return redirect('https://twiki.cern.ch/twiki/bin/viewauth/CMS/PdmVpMp',
                    code=302)


@app.route('/')
@app.route('/chains')
@app.route('/historical')
@app.route('/performance')
@app.route('/present')
def dashboard():
    """
    Redirect to graph template
    """
    return make_response(open('pmp/templates/valid.html').read())


@app.route('/api/<i>/<typeof>')
def api(i, typeof):
    """
    Simple API call
    """
    g = models.APICall()
    if typeof == 'announced':
        return make_response(g.present_announced_mode(i))
    elif typeof == 'chain':
        return make_response(g.chain_landscape())
    elif typeof == 'growing':
        return make_response(g.present_growing_mode(i))
    elif typeof == 'historical':
        return make_response(g.historical_simple(i))
    elif typeof == 'performance':
        return make_response(g.performance(i))
    elif typeof == 'lastupdate':
        return make_response(g.last_update(i))
    else:
        return make_response('{}')


@app.route('/api/<i>/historical/<p>/<priority>/<status>/<pwg>')
def api_historical_extended(i, p, priority, status, pwg):
    """
    API call for complex historical queries
    i - list of inputs (csv)
    p - int number of probes
    priority - in a form of string <min_pririty,max_priority>
    status - list of statuses to include (csv)
    pwg - list of pwg to include (csv)
    taskchain - boolean to load in taskchain mode
    """
    return models.APICall().historical_complex(i, p, priority, status, pwg)


@app.route('/api/suggest/<input>/<typeof>')
def suggest(input, typeof):
    """
    API call for typeahead
    input - input string to search in db
    typeof - lifetime/growing/announced/performance
    """
    return make_response(models.APICall().suggestions(typeof, input))


@app.route('/shorten/<path:url>')
def shorten(url):
    """
    Shorten URL
    """
    return make_response(models.APICall().shorten_url(url,
                                                      request.query_string))

@app.route('/ts/<path:svg>')
def take_screenshot(svg):
    """
    Take screenshot
    """
    return make_response(models.APICall().take_screenshot(svg))
