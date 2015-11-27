"""pMp views"""
from flask import make_response, redirect, render_template
from pmp import app, models, cache
from flask import request
import config
import simplejson as json

def sanitize(string):
    return string.replace("\\", "")

@app.before_request
def check_cache():
    path = request.path

    if path.startswith('/api') and 'lastupdate' not in path:
        cache_item = cache.get(request.path)

        if cache_item is not None:
            return cache_item

@app.route('/404')
def four_oh_four():
    """Redirect on 404"""
    return make_response(open('pmp/static/build/invalid.min.html').read())


@app.route('/about')
def about():
    """Redirect to Twiki"""
    return redirect('https://twiki.cern.ch/twiki/bin/viewauth/CMS/PdmVpMp',
                    code=302)


@app.route('/')
@app.route('/chains')
@app.route('/historical')
@app.route('/index')
@app.route('/performance')
@app.route('/present')
def dashboard():
    """Redirect to graph template"""
    if app.debug:
        return make_response(open('pmp/static/build/valid.dev.html').read())
    else:
        return make_response(open('pmp/static/build/valid.min.html').read())


@app.route('/api/<i>/<typeof>/<extra>')
def api(i, typeof, extra):
    """Simple API call"""
    i = sanitize(i)
    call = models.APICall()
    res = make_response('{}')

    if typeof == 'announced':
        res = make_response(call.present_announced_mode(i, extra == 'true'))
    elif typeof == 'chain':
        res = make_response(call.chain_landscape())
    elif typeof == 'crazy':
        res = make_response(call.crazy(i))
    elif typeof == 'growing':
        res = make_response(call.present_growing_mode(i, extra == 'true'))
    elif typeof == 'historical':
        res = make_response(call.historical_simple(i))
    elif typeof == 'performance':
        res = make_response(call.performance(i))
    elif typeof == 'priority':
        res = make_response(call.priority(i))
    elif typeof == 'lastupdate':
        res = make_response(call.last_update(i))
    elif typeof == 'overall':
        res = make_response(call.overall(i))

    cache.add(request.path, res, timeout=config.CACHE_TIMEOUT)
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
    i = sanitize(i)
    if status is "":
        status = None
    if pwg is "":
        pwg = None
    filters = dict()
    filters['status'] = status
    filters['pwg'] = pwg

    result = models.APICall().historical_complex(i, probes, priority, filters)
    cache.add(request.path, result, timeout=config.CACHE_TIMEOUT)
    return result


@app.route('/api/<i>/submitted/<priority>/<pwg>')
def api_submitted(i, priority, pwg):
    """API call for complex historical queries
    i - list of inputs (csv)
    priority - in a form of string <min_pririty,max_priority>
    pwg - list of pwg to include (csv)
    """
    i = sanitize(i)

    result = models.APICall().submitted_stats(i, priority, pwg)
    cache.add(request.path, result, timeout=config.CACHE_TIMEOUT)
    return result


@app.route('/api/suggest/<fragment>/<typeof>')
def suggest(fragment, typeof):
    """API call for typeahead
    fragment - input string to search in db
    typeof - lifetime/growing/announced/performance
    """
    fragment = sanitize(fragment)

    result = make_response(models.APICall().suggestions(typeof, fragment))
    cache.add(request.path, result, timeout=config.CACHE_TIMEOUT)
    return result


@app.route('/shorten/<path:url>')
def shorten(url):
    """Shorten URL"""
    return make_response(models.APICall().shorten_url(url,
                                                      request.query_string))

@app.route('/ts', methods=['POST'])
def take_screenshot():
    """Take screenshot"""
    data = json.loads(request.data)
    return models.APICall().take_screenshot(data['data'], data['ext'])

