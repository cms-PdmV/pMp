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
@app.route('/campaign')
@app.route('/chain')
def dashboard():
    return make_response(open('pmp/templates/graph.html').read())

@app.route('/api/<member_of_campaign>/<typeof>')
def api(member_of_campaign, typeof):
    if typeof == 'simple':
        gc = models.GetCampaign()
    elif typeof == 'chain':
        gc = models.GetChain()
    return make_response(gc.get(member_of_campaign))

@app.route('/api/suggest/<input>')
def suggest(input):
    print input
    m_response = {}
    m_response["result"] = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Dakota', 'North Carolina', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming']
    return make_response(json.dumps(m_response))
