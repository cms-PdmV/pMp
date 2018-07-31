"""
pMp production run script
Configuration file in config.py
> sudo python run.py
"""
from tornado.wsgi import WSGIContainer
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
from flask import Flask, make_response, redirect
from pmp import models
from flask import request
from werkzeug.contrib.cache import SimpleCache

import json
import config


app = Flask(__name__,
            static_url_path='',
            static_folder='./pmp/static')
cache = SimpleCache()


@app.errorhandler(404)
def page_not_found(error):
    """Return invalid template"""
    return make_response(open('pmp/static/build/invalid.min.html').read()), 404


def sanitize(string):
    return string.replace("\\", "")


@app.before_request
def check_cache():
    path = request.path

    if path.startswith('/api') and 'lastupdate' not in path and 'overall' not in path:
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
@app.route('/historical')
@app.route('/index')
@app.route('/performance')
@app.route('/present')
def dashboard():
    """Redirect to graph template"""
    return make_response(open('pmp/static/build/valid.min.html').read())


@app.route('/api/<i>/<typeof>/<extra>')
def api(i, typeof, extra):
    """Simple API call"""
    i = sanitize(i)
    res = make_response('{}')

    if typeof == 'announced':
        res = make_response(models.APICall.present_announced_mode(i, extra == 'true'))
    elif typeof == 'growing':
        res = make_response(models.APICall.present_growing_mode(i, extra == 'true'))
    elif typeof == 'historical':
        res = make_response(models.APICall.historical_simple(i))
    elif typeof == 'performance':
        res = make_response(models.APICall.performance(i))
    elif typeof == 'lastupdate':
        res = make_response(models.APICall.last_update(i))
    elif typeof == 'overall':
        res = make_response(models.APICall.overall(i))

    cache.add(request.path, res, timeout=config.CACHE_TIMEOUT)
    return res


@app.route('/api/<i>/historical/<granularity>/<priority>/<status>/<pwg>')
def api_historical_extended(i, granularity, priority, status, pwg):
    """API call for complex historical queries
    i - list of inputs (csv)
    granularity - int number of x datapoints
    priority - in a form of string <min_pririty,max_priority>
    status - list of statuses to include (csv)
    pwg - list of pwg to include (csv)
    """
    i = sanitize(i)
    if status == '':
        status = None

    if pwg == '':
        pwg = None

    filters = dict()
    filters['status'] = status
    filters['pwg'] = pwg

    result = models.APICall.historical_complex(i, granularity, priority, filters)
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

    result = models.APICall.submitted_stats(i, priority, pwg)
    cache.add(request.path, result, timeout=config.CACHE_TIMEOUT)
    return result


@app.route('/api/suggest/<fragment>/<typeof>')
def suggest(fragment, typeof):
    """API call for typeahead
    fragment - input string to search in db
    typeof - lifetime/growing/announced/performance
    """
    fragment = sanitize(fragment)

    result = make_response(models.APICall.suggestions(typeof, fragment))
    cache.add(request.path, result, timeout=config.CACHE_TIMEOUT)
    return result


@app.route('/shorten/<path:url>')
def shorten(url):
    """Shorten URL"""
    return make_response(models.APICall.shorten_url(url,
                                                    request.query_string))


@app.route('/ts', methods=['POST'])
def take_screenshot():
    """Take screenshot"""
    data = json.loads(request.data)
    return models.APICall.take_screenshot(data['data'], data['ext'])


if __name__ == '__main__':
    # from logger import setup_access_logging, setup_email_logging
    # setup_access_logging(app)
    # if not app.debug:
    #     setup_email_logging(app)

    from fetchd.utils import Utils
    Utils.setup_console_logging()

    settings = dict(ssl_options={'certfile': config.CERTFILE,
                                 'keyfile': config.KEYFILE})

    http_server = HTTPServer(WSGIContainer(app), **settings)
    http_server.listen(config.PORT)
    IOLoop.instance().start()
