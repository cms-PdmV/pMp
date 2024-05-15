"""
Gunicorn WSGI server configuration
For details about configuration precedence,
please see: https://docs.gunicorn.org/en/stable/configure.html
"""
import multiprocessing
from run import app
from config import DEBUG, HOST, PORT

loglevel = "debug" if DEBUG else "info"
bind = f"{HOST}:{PORT}"
workers = multiprocessing.cpu_count() * 2 + 1
timeout = 240
