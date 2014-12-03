from flask import Flask
from flask import make_response
from flask import render_template

app = Flask(__name__, static_url_path='')

@app.route('/')
def index():
    return make_response(open('app/templates/index.html').read())

@app.route('/dashboard')
def dashboard():
    return make_response(open('app/templates/dashboard.html').read())

"""
@app.route('/about')
def about():
    return 'About'

@app.route('/getstats')
def getstats():
    return 'Get Stats'

@app.route('/loadstats')
def loadstats():
    return 'Load Stats'

@app.route('/hello/<idx>/int:<idx2>')
def hello_world(idx, idx2):
    return 'Hello World!%s%s' % (idx,idx2)
"""
@app.errorhandler(404)
def page_not_found(error):
    return render_template('page_not_found.html'), 404

if __name__ == '__main__':
    # TODO: debug=False in production
    app.run(debug=True, host='0.0.0.0', port=80)
