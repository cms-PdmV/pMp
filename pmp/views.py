from flask import make_response, redirect, render_template, session
from pmp import app, models


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
    if 'init_values' in session:
        return render_template('graph.html', data=session['init_values'])
    return render_template('graph.html')


@app.route('/api/<member_of_campaign>/<typeof>')
def api(member_of_campaign, typeof):
    if typeof == 'simple':
        gc = models.GetCampaign()
    elif typeof == 'chain':
        gc = models.GetChain()
    return make_response(gc.get(member_of_campaign))


@app.route('/share/<gtype>/')
def share_type(gtype):
    return share(gtype, False, False, False, False, False, False, False, False,
                 False)


@app.route('/share/<gtype>/<int:member_of_campaign>/<int:total_events>/' +
           '<int:status>/<int:prepid>/<int:priority>/<int:pwg>/<int:scale>/' +
           '<int:mode>/<clist>')
def share(gtype, member_of_campaign, total_events, status, prepid, priority,
          pwg, scale, mode, clist):
    init_values = []
    if clist:
        init_values = [member_of_campaign, total_events, status, prepid,
                       priority, pwg, scale, mode, str(clist)]
    if gtype == "cam":
        session['init_values'] = init_values
        return redirect('/campaign', code=302)
    if gtype == "cha":
        session['init_values'] = init_values
        return redirect('/chain', code=302)
