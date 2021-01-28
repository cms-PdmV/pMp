"""
pMp production run script
Configuration file in config.py
> sudo python run.py
"""
from flask import Flask, make_response, redirect, request, render_template, jsonify
from pmp.api.historical import HistoricalAPI
from pmp.api.performance import PerformanceAPI
from pmp.api.present import PresentAPI
from pmp.api.common import OverallAPI, SuggestionsAPI, ShortenAPI, ScreenshotAPI, LastUpdateAPI, AdminAPI, ObjectListAPI

import json
import config
import flask


app = Flask(__name__,
            template_folder='./pmp/templates',
            static_url_path='',
            static_folder='./pmp')


@app.errorhandler(404)
def page_not_found(error):
    """Return invalid template"""
    return make_response(open('pmp/static/build/invalid.min.html').read()), 404


def sanitize(string):
    return string.replace("\\", "")


@app.route('/404')
def four_oh_four():
    """Redirect on 404"""
    return make_response(open('pmp/static/build/invalid.min.html').read())


@app.route('/about')
def about():
    """Redirect to Twiki"""
    return redirect('https://twiki.cern.ch/twiki/bin/viewauth/CMS/PdmVpMp',
                    code=302)


@app.route('/admin')
def admin():
    info = AdminAPI().get()
    return render_template('admin.html', data=info)


@app.route('/')
@app.route('/historical')
@app.route('/index')
@app.route('/performance')
@app.route('/present')
def dashboard():
    """Redirect to graph template"""
    return make_response(open('pmp/static/build/valid.min.html').read())

@app.route('/api/overall')
def api_overall():
    """
    API call to get statistics of pMp database
    """
    i = flask.request.args.get('r', '')
    i = sanitize(i).split(',')
    result = OverallAPI().get(i)

    return result


@app.route('/api/objects')
def api_objects():
    """
    API call to get list of objects in certain collection
    """
    i = flask.request.args.get('r', '')
    i = sanitize(i).split(',')
    if len(i) > 0:
        result = ObjectListAPI().get(i[0])
        return jsonify(result)

    return jsonify([])


@app.route('/api/lastupdate')
def api_lastupdate():
    """
    API to get date and time of last update
    """
    result = LastUpdateAPI().get()

    return jsonify(result)

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
    granularity = flask.request.args.get('granularity', 250)
    if not isinstance(granularity, int):
        try:
            granularity = int(granularity)
        except:
            granularity = 250

    if granularity < 1:
        granularity = 250

    priority = flask.request.args.get('priority', None)
    if priority is not None:
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
    if pwg is not None:
        pwg = pwg.split(',')

    interested_pwg = flask.request.args.get('interested_pwg', None)
    if interested_pwg is not None:
        interested_pwg = interested_pwg.split(',')

    status = flask.request.args.get('status', None)
    if status is not None:
        status = status.split(',')

    estimate_completed_events = flask.request.args.get('estimateCompleted', '').lower() == 'true'
    aggregate = flask.request.args.get('aggregate', 'true').lower() != 'false'

    i = sanitize(i)
    result = HistoricalAPI().get(i,
                                 data_point_count=granularity,
                                 estimate_completed_events=estimate_completed_events,
                                 priority_filter=priority,
                                 pwg_filter=pwg,
                                 interested_pwg_filter=interested_pwg,
                                 status_filter=status,
                                 aggregate=aggregate)

    return result


@app.route('/api/performance')
def api_performance():
    i = flask.request.args.get('r', '')
    priority = flask.request.args.get('priority', None)
    if priority is not None:
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
    if pwg is not None:
        pwg = pwg.split(',')

    interested_pwg = flask.request.args.get('interested_pwg', None)
    if interested_pwg is not None:
        interested_pwg = interested_pwg.split(',')

    status = flask.request.args.get('status', None)
    if status is not None:
        status = status.split(',')

    i = sanitize(i)
    result = PerformanceAPI().get(i,
                                 priority_filter=priority,
                                 pwg_filter=pwg,
                                 interested_pwg_filter=interested_pwg,
                                 status_filter=status)

    return result


@app.route('/api/present')
def api_present():
    i = flask.request.args.get('r', '')
    priority = flask.request.args.get('priority', None)
    if priority is not None:
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
    if pwg is not None:
        pwg = pwg.split(',')

    interested_pwg = flask.request.args.get('interested_pwg', None)
    if interested_pwg is not None:
        interested_pwg = interested_pwg.split(',')

    status = flask.request.args.get('status', None)
    if status is not None:
        status = status.split(',')

    estimate_completed_events = flask.request.args.get('estimateCompleted', '').lower() == 'true'

    i = sanitize(i)
    result = PresentAPI().get(i,
                              estimate_completed_events=estimate_completed_events,
                              priority_filter=priority,
                              pwg_filter=pwg,
                              interested_pwg_filter=interested_pwg,
                              status_filter=status)

    return result


@app.route('/api/suggest/<string:statistics_type>/<string:fragment>')
def api_suggest(statistics_type, fragment):
    """A
    PI call for suggestions
    """
    fragment = sanitize(fragment)

    result = SuggestionsAPI(statistics_type).get(fragment)
    return result


@app.route('/api/shorten')
def api_shorten():
    """Shorten URL"""
    url = flask.request.args.get('r', None)
    if url:
        return ShortenAPI().get(url)
    else:
        return {}


@app.route('/api/screenshot', methods=['POST'])
def api_screenshot():
    """Take screenshot"""
    data = request.data.decode('utf-8')
    data = json.loads(data)
    return ScreenshotAPI().get(data['data'], data['ext'])


if __name__ == '__main__':
    from fetchd.utils import Utils
    Utils.setup_console_logging()
    app.run(host='0.0.0.0',
            port=config.PORT,
            debug=config.DEBUG,
            threaded=True,
            ssl_context=(config.CERTFILE, config.KEYFILE))

