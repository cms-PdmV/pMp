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
from pmp.api.historical import HistoricalAPI
from pmp.api.performance import PerformanceAPI
from pmp.api.present import PresentAPI

import json
import config
import flask


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


@app.route('/api/historical')
def api_historical():
    """API call for complex historical queries
    i - list of inputs (csv)
    granularity - int number of x datapoints
    priority - in a form of string <min_pririty,max_priority>
    status - list of statuses to include (csv)
    pwg - list of pwg to include (csv)
    """
    i = flask.request.args.get('r', '')
    granularity = flask.request.args.get('granularity', 100)
    if not isinstance(granularity, int):
        try:
            granularity = int(granularity)
        except:
            granularity = 100

    priority = flask.request.args.get('priority', None)
    if priority:
        priority = priority.split(',')
        if len(priority) < 2:
            priority = None
        else:
            try:
                priority[0] = int(priority[0]) if priority[0] != '' else None
                priority[1] = int(priority[1]) if priority[1] != '' else None
            except:
                priority = None

    pwg = flask.request.args.get('pwg', None)
    if pwg:
        pwg = pwg.split(',')

    status = flask.request.args.get('status', None)
    if status:
        status = status.split(',')

    i = sanitize(i)
    result = HistoricalAPI().get(i,
                                 data_point_count=granularity,
                                 priority_filter=priority,
                                 pwg_filter=pwg,
                                 status_filter=status)
    # cache.add(request.path, result, timeout=config.CACHE_TIMEOUT)
    return result


@app.route('/api/performance')
def api_performance():
    i = flask.request.args.get('r', '')
    priority = flask.request.args.get('priority', None)
    if priority:
        priority = priority.split(',')
        if len(priority) < 2:
            priority = None
        else:
            try:
                priority[0] = int(priority[0]) if priority[0] != '' else None
                priority[1] = int(priority[1]) if priority[1] != '' else None
            except:
                priority = None

    pwg = flask.request.args.get('pwg', None)
    if pwg:
        pwg = pwg.split(',')

    status = flask.request.args.get('status', None)
    if status:
        status = status.split(',')

    i = sanitize(i)
    result = PerformanceAPI().get(i,
                                 priority_filter=priority,
                                 pwg_filter=pwg,
                                 status_filter=status)
    # cache.add(request.path, result, timeout=config.CACHE_TIMEOUT)
    return result


@app.route('/api/present')
def api_present():
    i = flask.request.args.get('r', '')
    priority = flask.request.args.get('priority', None)
    if priority:
        priority = priority.split(',')
        if len(priority) < 2:
            priority = None
        else:
            try:
                priority[0] = int(priority[0]) if priority[0] != '' else None
                priority[1] = int(priority[1]) if priority[1] != '' else None
            except:
                priority = None

    pwg = flask.request.args.get('pwg', None)
    if pwg:
        pwg = pwg.split(',')

    status = flask.request.args.get('status', None)
    if status:
        status = status.split(',')

    chained_mode = flask.request.args.get('chained_mode', None) == 'True'
    growing_mode = flask.request.args.get('growing_mode', None) == 'True'

    i = sanitize(i)
    result = PresentAPI().get(i,
                              chained_mode=chained_mode,
                              growing_mode=growing_mode,
                              priority_filter=priority,
                              pwg_filter=pwg,
                              status_filter=status)
    # cache.add(request.path, result, timeout=config.CACHE_TIMEOUT)
    return result


@app.route('/api/suggest/<fragment>/<typeof>')
def suggest(fragment, typeof):
    """API call for typeahead
    fragment - input string to search in db
    typeof - lifetime/growing/announced/performance
    """
    fragment = sanitize(fragment)

    result = make_response(models.APICall.suggestions(typeof, fragment))
    # cache.add(request.path, result, timeout=config.CACHE_TIMEOUT)
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

    # settings = dict(ssl_options={'certfile': config.CERTFILE,
    #                              'keyfile': config.KEYFILE})
    # 
    # http_server = HTTPServer(WSGIContainer(app), **settings)
    # http_server.listen(config.PORT)
    # IOLoop.instance().start()
    app.run(host='0.0.0.0',
            port=config.PORT,
            debug=True,
            threaded=True,
            ssl_context=(config.CERTFILE, config.KEYFILE))

