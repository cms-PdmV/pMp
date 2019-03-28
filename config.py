"""Change configuration here"""
import os
ADMINS = ['pdmvserv@cern.ch']
CERTFILE = '/home/crtkey/localhost.crt'
KEYFILE = '/home/crtkey/localhost.key'
DEBUG = True
DATABASE_URL = 'http://127.0.0.1:9200/'
HOST = '127.0.0.1'
HOSTMAIL = os.getenv('HOSTNAME') + '@noreply.com'
PORT = 443
SECRET_KEY = ''
CACHE_TIMEOUT = 600
CACHE_SIZE = 200
