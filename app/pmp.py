from flask import Flask
from flask import render_template

app = Flask(__name__)

@app.route('/')
def index():
    app.logger.debug('index opened')
    #return send_file('templates/index.html')
    return make_response(open('templates/index.html').read())

@app.route('/about')
def about():
    return 'About'

@app.route('/get_stats')
def about():
    return 'Get Stats'

@app.route('/dashboard')
def about():
    return 'Dashboard'

@app.route('/load_stats')
def about():
    return 'Load Stats'

@app.route('/hello/<idx>/int:<idx2>')
def hello_world(idx, idx2):
    return 'Hello World!%s%s' % (idx,idx2)

@app.errorhandler(404)
def page_not_found(error):
    return render_template('page_not_found.html'), 404

if __name__ == '__main__':
    # TODO: debug=False in production
    app.run(debug=True, host='0.0.0.0', port=80)
