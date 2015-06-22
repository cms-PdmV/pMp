from tornado.wsgi import WSGIContainer
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
from pmp import app
import config

if __name__ == '__main__':
    if not app.debug:
        import logging
        from logging import Formatter
        from logging.handlers import SMTPHandler
        mail_handler = SMTPHandler(config.HOST, config.HOSTMAIL, config.ADMINS,
                                   'Production Monitoring Platform: FAILURE')
        mail_handler.setLevel(logging.ERROR)
        mail_handler.setFormatter(Formatter('''
        Message type: %(levelname)s
        Location: %(pathname)s:%(lineno)d
        Module: %(module)s
        Function: %(funcName)s
        Time: %(asctime)s
        Message: %(message)s
        '''))
        app.logger.addHandler(mail_handler)

    settings = dict(
        ssl_options={'certfile': config.CERTFILE, 'keyfile': config.KEYFILE}
        )

    http_server = HTTPServer(WSGIContainer(app), **settings)
    http_server.listen(config.PORT)
    IOLoop.instance().start()
