#! /usr/bin/python

import json
import os
import pycurl
import re
from datetime import datetime
from ConfigParser import SafeConfigParser
from cStringIO import StringIO
from subprocess import call


class Config():
    """
    configuration parser to make the service running
    """
    def __init__(self, typeof, path):
        parser = SafeConfigParser()
        parser.read(path)

        self.cookie = parser.get('cookie', 'path')
        self.exclude_list = re.split(", ", parser.get('exclude', 'list'))
        self.remove_list = re.split(", ", parser.get('remove_params', 'list'))

        self.url_mcm = parser.get(typeof, 'db_source')
        self.db = parser.get(typeof, 'db')
        self.url_db = self.url_mcm + self.db
        self.url_db_changes = (self.url_db +
                               parser.get('general', 'db_query_changes'))
        self.url_db_first = (self.url_db +
                               parser.get('general', 'db_query_first'))
        self.url_db_all = (self.url_db +
                               parser.get('general', 'db_query_all_doc'))
        self.url_pmp = parser.get('general', 'pmp')
        self.pmp_db_index = self.url_pmp + parser.get(typeof, 'pmp_db_index')
        self.pmp_db = self.pmp_db_index + parser.get(typeof, 'pmp_db')
        self.last_seq = self.pmp_db_index + parser.get(typeof, 'last_seq')
        self.mapping = parser.get(typeof, 'mapping')


class Utils():

    def get_time(self):
        return datetime.now()

    def curl(self, request, url, data=None, cookie=None):
        out = StringIO()
        curl = pycurl.Curl()
        curl.setopt(pycurl.URL, str(url))
        curl.setopt(pycurl.WRITEFUNCTION, out.write)
        curl.setopt(pycurl.SSL_VERIFYPEER, 0)
        curl.setopt(pycurl.SSL_VERIFYHOST, 0)
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
