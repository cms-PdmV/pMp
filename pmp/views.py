from flask import make_response, redirect, render_template
from pmp import app, models

import json


@app.route('/404')
def four_oh_four():
    return render_template('page_not_found.html'), 404


@app.route('/about')
def about():
    return redirect('https://twiki.cern.ch/twiki/bin/viewauth/CMS/PdmVpMp',
                    code=302)


@app.route('/')
@app.route('/present')
@app.route('/historical')
def dashboard():
    return make_response(open('pmp/templates/graph.html').read())


@app.route('/api/<field>/<typeof>')
def api(field, typeof):
    if typeof == 'simple':
        gc = models.GetCampaign()
    elif typeof == 'chain':
        gc = models.GetChain()
    elif typeof == 'lifetime':
        gc = models.GetLifetime()
    return make_response(gc.get(field))


@app.route('/api/<f>/lifetime/<p>/<priority>/<status>/<pwg>')
def api_extended(f, p, priority, status, pwg):
    gc = models.GetLifetime()

    priority = priority.split(',')

    if priority[0] == '':
        priority[0] = 0
    if priority[1] == '':
        priority[1] = -1

    if status == 'all':
        status = None
    else:
        status = status.split(',')

    if pwg == 'all':
        pwg = None
    else:
        pwg = pwg.split(',')

    return make_response(gc.get(f, int(p), int(priority[0]), int(priority[1]),
                                status, pwg))


@app.route('/api/suggest/<input>/<typeof>')
def suggest(input, typeof):
    gc = models.GetSuggestions(typeof)
    return make_response(gc.get(input))
