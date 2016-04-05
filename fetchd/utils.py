"""Utils classes for pMp scripts"""
import simplejson as json
import os
import pycurl
import re
import httplib
from ConfigParser import SafeConfigParser
from cStringIO import StringIO
from datetime import datetime
from subprocess import call


class Config(object):
    """Load cofiguration from file"""

    def __init__(self, typeof):
        self.dir = os.path.dirname(os.path.realpath(__file__))
        parser = SafeConfigParser()
        parser.read(self.dir + '/dev.conf')

        database = parser.get(typeof, 'db')
        url_pmp = parser.get('general', 'pmp')

        self.reqmgr_domain = parser.get('reqmgr', 'domain')
        self.reqmgr_domain_backup = parser.get('reqmgr', 'domain_backup')
        self.reqmgr_path = parser.get('reqmgr', 'path')
        self.cookie = os.environ['HOME'] + parser.get('cookie', 'path')
        self.exclude_list = re.split(", ", parser.get('exclude', 'list'))
        self.fetch_fields = re.split(", ", parser.get(typeof, 'fetch_fields'))
        self.url_mcm = parser.get(typeof, 'db_source')
        self.url_db = self.url_mcm + database
        self.url_db_changes = self.url_db + \
            parser.get('general', 'db_query_changes')
        self.url_db_first = self.url_db + \
            parser.get('general', 'db_query_first')
        self.url_db_all = self.url_db + \
            parser.get('general', 'db_query_all_doc')
        self.pmp_db_index = url_pmp + parser.get(typeof, 'pmp_db_index')
        self.pmp_db = self.pmp_db_index + parser.get(typeof, 'pmp_db')
        self.last_seq = self.pmp_db_index + parser.get(typeof, 'last_seq')
        self.mapping = parser.get(typeof, 'mapping')


class Utils(object):
    """Utils for pMp scripts"""

    @staticmethod
    def is_file(m_file):
        """Retrun true if file exists and accessible"""
        return os.path.isfile(m_file) and os.access(m_file, os.R_OK)

    @staticmethod
    def init_connection(url):
        return httplib.HTTPSConnection(url, port=443,
                cert_file=os.getenv('X509_USER_PROXY'),
                key_file=os.getenv('X509_USER_PROXY'))

    @staticmethod
    def httpget(conn, query):
        conn.request("GET", query.replace('#', '%23'))
        response = conn.getresponse()
        return response.read(), response.status

    def get_cookie(self, url, path):
        """Execute CERN's get SSO cookie"""
        self.rm_file(path)
        call(["cern-get-sso-cookie", "--krb", "--nocertverify", "-u", url,
              "-o", path])

    @staticmethod
    def get_time():
        """Return current time string"""
        return str(datetime.now())

    def rm_file(self, m_file):
        """Remove file"""
        if self.is_file(m_file):
            os.remove(m_file)

    @staticmethod
    def curl(request, url, data=None, cookie=None, return_error=False):
        """Perform CURL - return_error kwarg returns status after failure - defaults to None"""
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
        except ValueError:
            print "Status: %s/n%s" % (curl.getinfo(curl.RESPONSE_CODE),
                                      out.getvalue())
            if return_error:
                return None, curl.getinfo(curl.RESPONSE_CODE)

