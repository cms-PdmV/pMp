import json

from flask import Flask
from flask import make_response
from flask import render_template

from pyelasticsearch import ElasticSearch

app = Flask(__name__, static_url_path='')
es = ElasticSearch('http://localhost:9200/')

def get_request(r):
    return json.dumps(es.get('requests', 'request', r))


def search(campaign):
    print campaign
    response = {}
    response['results'] = []
    for s in es.search(('member_of_campaingn=%s' % campaign),
                       index='requests')['hits']['hits']:
        response['results'].append(s['_source'])
    return make_response(json.dumps(response))


@app.route('/')
def index():
    return make_response(open('app/templates/index.html').read())

@app.route('/dashboard')
def dashboard():
    return make_response(open('app/templates/dashboard.html').read())

@app.route('/api/<member_of_campaign>')
def api(member_of_campaign):
    print member_of_campaign
    return make_response(search(member_of_campaign))
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
