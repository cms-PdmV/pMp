"""pMp production run script
Configuration file in config.py
> sudo python run.py
"""
from tornado.wsgi import WSGIContainer
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
from pmp import app
import config
import sys

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'dev':
        global DEBUG
        DEBUG = True
        app.run(host='0.0.0.0', port=80)
    else:
        if not app.debug:
            import logging
            from logging import Formatter
            from logging.handlers import SMTPHandler
            MAIL_HANDLER = SMTPHandler(config.HOST, config.HOSTMAIL,
                                       config.ADMINS,
                                       'Production Monitoring Platform')
            MAIL_HANDLER.setLevel(logging.ERROR)
            MAIL_HANDLER.setFormatter(Formatter('''
            Message type: %(levelname)s
            Location: %(pathname)s:%(lineno)d
            Module: %(module)s
            Function: %(funcName)s
            Time: %(asctime)s
            Message: %(message)s
            '''))
            app.logger.addHandler(MAIL_HANDLER)

        SETTINGS = dict(ssl_options={'certfile': config.CERTFILE,
                                     'keyfile': config.KEYFILE})
        HTTP_SERVER = HTTPServer(WSGIContainer(app), **SETTINGS)
        HTTP_SERVER.listen(config.PORT)
        IOLoop.instance().start()
