"""pMp views"""
from flask import make_response, redirect, render_template
from pmp import app, models
from flask import request


@app.route('/404')
def four_oh_four():
    """Redirect on 404"""
    return render_template('invalid.html'), 404


@app.route('/about')
def about():
    """Redirect to Twiki"""
    return redirect('https://twiki.cern.ch/twiki/bin/viewauth/CMS/PdmVpMp',
                    code=302)


@app.route('/')
@app.route('/chains')
@app.route('/historical')
@app.route('/performance')
@app.route('/present')
def dashboard():
    """Redirect to graph template"""
    return make_response(open('pmp/templates/valid.html').read())


@app.route('/api/<i>/<typeof>')
def api(i, typeof):
    """Simple API call"""
    call = models.APICall()
    res = make_response('{}')
    if typeof == 'announced':
        res = make_response(call.present_announced_mode(i))
    elif typeof == 'chain':
        res = make_response(call.chain_landscape())
    elif typeof == 'growing':
        res = make_response(call.present_growing_mode(i))
    elif typeof == 'historical':
        res = make_response(call.historical_simple(i))
    elif typeof == 'performance':
        res = make_response(call.performance(i))
    elif typeof == 'lastupdate':
        res = make_response(call.last_update(i))
    return res


@app.route('/api/<i>/historical/<probes>/<priority>/<status>/<pwg>')
def api_historical_extended(i, probes, priority, status, pwg):
    """API call for complex historical queries
    i - list of inputs (csv)
    probes - int number of probes
    priority - in a form of string <min_pririty,max_priority>
    status - list of statuses to include (csv)
    pwg - list of pwg to include (csv)
    """
    if status is "":
        status = None
    if pwg is "":
        pwg = None
    filters = dict()
    filters['status'] = status
    filters['pwg'] = pwg
    return models.APICall().historical_complex(i, probes, priority, filters)


@app.route('/api/<i>/submitted/<priority>/<pwg>')
def api_submitted(i, priority, pwg):
    """API call for complex historical queries
    i - list of inputs (csv)
    priority - in a form of string <min_pririty,max_priority>
    pwg - list of pwg to include (csv)
    """
    return models.APICall().submitted_stats(i, priority, pwg)


@app.route('/api/suggest/<fragment>/<typeof>')
def suggest(fragment, typeof):
    """API call for typeahead
    fragment - input string to search in db
    typeof - lifetime/growing/announced/performance
    """
    return make_response(models.APICall().suggestions(typeof, fragment))


@app.route('/shorten/<path:url>')
def shorten(url):
    """Shorten URL"""
    return make_response(models.APICall().shorten_url(url,
                                                      request.query_string))

@app.route('/ts/<format>/<path:svg>')
def take_screenshot(ext, svg):
    """Take screenshot"""
    return models.APICall().take_screenshot(svg, ext)

