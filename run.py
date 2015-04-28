from tornado.wsgi import WSGIContainer
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
from pmp import app

ADMINS = ['cms-pdmv-serv@cern.ch']

if __name__ == '__main__':
    if not app.debug:
        import logging
        from logging import Formatter
        from logging.handlers import SMTPHandler
        mail_handler = SMTPHandler('127.0.0.1',
                                   'vocms089@noreply.com',
                                   ADMINS, 'Production Monitoring Platform: FAILURE')
        mail_handler.setLevel(logging.ERROR)
        mail_handler.setFormatter(Formatter(
                '''
                Message type: %(levelname)s
                Location: %(pathname)s:%(lineno)d
                Module: %(module)s
                Function: %(funcName)s
                Time: %(asctime)s
                Message: %(message)s
                '''
                ))
        app.logger.addHandler(mail_handler)

    settings = dict(
        ssl_options = {
            'certfile': '/home/crtkey/localhost.crt',
            'keyfile': '/home/crtkey/localhost.key'
            }
        )

    http_server = HTTPServer(WSGIContainer(app), **settings)
    http_server.listen(443)
    IOLoop.instance().start()
