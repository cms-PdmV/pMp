#! /usr/bin/python

from datetime import datetime
import json
import os
import pycurl
import re
from ConfigParser import SafeConfigParser
from cStringIO import StringIO
from subprocess import call


class Config():

    def __init__(self):
        parser = SafeConfigParser()
        parser.read('dev.conf')

        self.cookie = os.environ['HOME'] + parser.get('paths', 'cookie')
        self.db_requests = parser.get('urls', 'requests_db')
        self.exclude_list = re.split(", ", parser.get('exclude', 'requests'))
        self.last_seq = parser.get('urls', 'last_seq')
        self.pmp_db = parser.get('urls', 'pmp_db')
        self.remove_list = re.split(", ", parser.get('remove_params', 'list'))
        self.url_mcm = parser.get('urls', 'mcm')
        self.url_requests = self.url_mcm + self.db_requests
        self.url_requests_changes = (self.url_requests +
                                     parser.get('urls',
                                                'requests_db_query_changes'))


class Utils():

    def is_file(self, file):
        return os.path.isfile(file) and os.access(file, os.R_OK)

    def get_cookie(self, url, path):
        call(["cern-get-sso-cookie", "--krb", "--nocertverify", "-u", url,
              "-o", path])
    
    def get_time(self):
        return datetime.now()

    def rm(self, file):
        if self.is_file(file):
            os.remove(file)

    def curl(self, request, url, data=None, cookie=None):
        out = StringIO()
        curl = pycurl.Curl()
        curl.setopt(pycurl.URL, str(url))
        curl.setopt(pycurl.WRITEFUNCTION, out.write)
        if request == "GET" and cookie is not None:
            curl.setopt(pycurl.COOKIEFILE, cookie)
            curl.setopt(pycurl.COOKIEJAR, cookie)
        elif request == "DELETE":
            curl.setopt(pycurl.CUSTOMREQUEST, "DELETE")
        elif request == "PUT":
            curl.setopt(pycurl.CUSTOMREQUEST, "PUT")
            curl.setopt(pycurl.POST, 1)
            curl.setopt(pycurl.POSTFIELDS, '%s' % json.dumps(data))
        curl.perform()
        try:
            return (json.loads(out.getvalue()),
                    curl.getinfo(curl.RESPONSE_CODE))
        except Exception:
            print "Status: %s/n%s" % (curl.getinfo(curl.RESPONSE_CODE),
                                      out.getvalue())
