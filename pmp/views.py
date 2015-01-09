from flask import make_response, redirect, render_template
from pmp import app, models

@app.route('/404')
def four_oh_four():
    return render_template('page_not_found.html'), 404

@app.route('/about')
def about():
    return redirect('https://twiki.cern.ch/twiki/bin/viewauth/CMS/PdmVpMp', code=302)

@app.route('/')
@app.route('/campaign')
@app.route('/chain')
def dashboard():
    return render_template('graph.html')

@app.route('/api/<member_of_campaign>/<typeof>')
def api(member_of_campaign, typeof):
    if typeof == 'simple':
        gc = models.GetCampaign()
    elif typeof == 'chain':
        gc = models.GetChain()
    return make_response(gc.get(member_of_campaign))

@app.route('/share/<typeof>/')
def share(typeof):
    return render_template('graph.html', foo=42)
