"""pMp production run script
Configuration file in config.py
> sudo python run.py
"""
from tornado.wsgi import WSGIContainer
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
from pmp import app
from logger import setup_access_logging, setup_email_logging
import config
import sys


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'dev':
        app.debug = True
        app.run(host='0.0.0.0', port=80)
    else:
        setup_access_logging(app)
        if not app.debug:
            setup_email_logging(app)

        SETTINGS = dict(ssl_options={'certfile': config.CERTFILE,
                                     'keyfile': config.KEYFILE})
        HTTP_SERVER = HTTPServer(WSGIContainer(app), **SETTINGS)
        HTTP_SERVER.bind(config.PORT)
        HTTP_SERVER.start(0)
        IOLoop.instance().start()
