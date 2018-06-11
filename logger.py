from logging import Formatter
from logging.handlers import SMTPHandler
from logging import handlers
from flask import request, g
from urllib2 import unquote
from pmp import app
import os
import config
import logging


__ACCESS_LOG_FORMAT = '{%(mem)s} [%(asctime)s][%(user)s] %(message)s'
__EMAIL_LOG_FORMAT = '''
Message type: %(levelname)s
Location: %(pathname)s:%(lineno)d
Module: %(module)s
Function: %(funcName)s
Time: %(asctime)s
Message: %(message)s'''


class MemoryFilter(logging.Filter):
    """
    This is a filter which injects contextual information into the log.
    """

    def filter(self, record):
        # memory usage
        try:
            _proc_status = '/proc/%d/status' % os.getpid()
            t = open(_proc_status)
            v = t.read()
            t.close()
            i = v.index('VmRSS')
            v = v[i:].split(None, 3)  # whitespace
            mem = "%s %s" % (v[1], v[2])
        except Exception:
            mem = "N/A"

        record.mem = mem
        return True


class UserFilter(logging.Filter):
    """
    This is a filter which injects contextual information into the log.
    """

    def filter(self, record):
        user_dict = {}
        for (key, value) in request.headers.iteritems():
            key = key.lower()
            if not key.startswith('adfs-'):
                key = key.replace('-', '_')
            else:
                key = key[5:]

            user_dict[key] = value

        if 'email' in user_dict:
            record.user = user_dict['email']
        else:
            record.user = "main_thread"
        return True


def after_this_request(f):
    if not hasattr(g, 'after_request_callbacks'):
        g.after_request_callbacks = []

    g.after_request_callbacks.append(f)
    return f


@app.after_request
def call_after_request_callbacks(response):
    for callback in getattr(g, 'after_request_callbacks', ()):
        callback(response)

    return response


@app.before_request
def log_access():
    query = "?" + request.query_string if request.query_string else ""
    full_url = request.path + unquote(query).decode('utf-8').encode('ascii', 'ignore')
    message = "%s %s %s %s" % (request.method, full_url, "%s", request.headers['User-Agent'])

    @after_this_request
    def after_request(response):
        g.message = g.message % response.status_code
        logging.getLogger('access_logger').info(g.message)

    g.message = message


def setup_access_logging(app):
    # Max log file size - 5Mb
    max_log_file_size = 1024 * 1024 * 10
    max_log_file_count = 100
    log_file_name = 'logs/access_log.log'
    logger = logging.getLogger('access_logger')
    logger.setLevel(logging.INFO)
    handler = handlers.RotatingFileHandler(log_file_name,
                                           'a',
                                           max_log_file_size,
                                           max_log_file_count)
    formatter = logging.Formatter(fmt=__ACCESS_LOG_FORMAT, datefmt='%d/%b/%Y:%H:%M:%S')
    handler.setFormatter(formatter)
    handler.addFilter(MemoryFilter())
    handler.addFilter(UserFilter())
    logger.addHandler(handler)


def setup_email_logging(app):
    mail_handler = SMTPHandler(config.HOST,
                               config.HOSTMAIL,
                               config.ADMINS,
                               'Production Monitoring Platform')
    mail_handler.setLevel(logging.ERROR)
    mail_handler.setFormatter(Formatter(__EMAIL_LOG_FORMAT))
    app.logger.addHandler(mail_handler)
