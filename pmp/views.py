from flask import make_response, redirect
from pmp import app, models


@app.route('/about')
def about():
    return redirect('https://twiki.cern.ch/twiki/bin/viewauth/CMS/PdmVpMp', code=302)

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
