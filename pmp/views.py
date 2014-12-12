from flask import make_response
from pmp import app, models


@app.route('/')
def index():
    return make_response(open('pmp/templates/index.html').read())


@app.route('/about')
def about():
    return 'About'


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
