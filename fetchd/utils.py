"""Utils classes for pMp scripts"""
import json
import os
import re
import pycurl
import logging
import time
from configparser import ConfigParser
from datetime import datetime
from io import BytesIO


class Config(object):
    """
    Load cofiguration from file
    """
    def __init__(self, index):
        self.dir = os.path.dirname(os.path.realpath(__file__))
        parser = ConfigParser()
        parser.read(self.dir + '/default.conf')

        # Universal fields
        self.exclude_list = re.split(", ", parser.get('exclude', 'list'))
        self.reqmgr_url = parser.get('reqmgr', 'url')
        self.reqmgr_url = parser.get('pmp', 'last_seq_mapping')

        # Index specific fields
        self.source_db = parser.get(index, 'source_db')
        self.source_db_changes = parser.get(index, 'source_db_changes')
        self.fetch_fields = re.split(", ", parser.get(index, 'fetch_fields'))
        self.mapping = parser.get(index, 'mapping')
        self.db = parser.get('pmp', 'db')
        self.pmp_index = parser.get('pmp', 'db') + parser.get(index, 'pmp_index')
        self.pmp_type = self.pmp_index + parser.get(index, 'pmp_type')
        self.last_seq = parser.get('pmp', 'last_seq') + index


class Utils(object):
    """Utils for pMp scripts"""

    @staticmethod
    def get_time():
        """Return current time string"""
        return str(datetime.now())

    @staticmethod
    def setup_console_logging():
        CONSOLE_LOG_FORMAT = '[%(asctime)s][%(levelname)s] %(message)s'
        logging.basicConfig(format=CONSOLE_LOG_FORMAT, level=logging.INFO)

    @staticmethod
    def curl(method, url, data=None, return_error=False, parse_json=True, retry_on_failure=True):
        """
        Perform CURL - return_error kwarg returns status after failure - defaults to None
        To install pycurl:
        sudo pip3 install --no-cache-dir --compile --ignore-installed --install-option="--with-nss" pycurl
        """
        out = BytesIO()
        curl = pycurl.Curl()
        curl.setopt(pycurl.URL, str(url))
        curl.setopt(pycurl.WRITEFUNCTION, out.write)
        curl.setopt(pycurl.SSL_VERIFYPEER, 0)
        curl.setopt(pycurl.SSL_VERIFYHOST, 0)
        curl.setopt(pycurl.FOLLOWLOCATION, 1)

        if method == "GET" or method == "DELETE":
            curl.setopt(pycurl.CUSTOMREQUEST, method)
        elif method == "PUT" or method == "POST":
            curl.setopt(pycurl.CUSTOMREQUEST, method)
            curl.setopt(pycurl.POST, 1)
            if data:
                curl.setopt(pycurl.POSTFIELDS, '%s' % json.dumps(data))
            else:
                curl.setopt(pycurl.POSTFIELDS, '{}')

            curl.setopt(pycurl.HTTPHEADER, ['Content-Type:application/json'])

        curl.perform()
        try:
            if parse_json:
                return (json.loads(out.getvalue().decode('UTF-8')),
                        curl.getinfo(curl.RESPONSE_CODE))
            else:
                return (out.getvalue().decode('UTF-8'),
                        curl.getinfo(curl.RESPONSE_CODE))
        except ValueError:
            logging.error("Status: %s/n%s" % (curl.getinfo(curl.RESPONSE_CODE),
                                              out.getvalue().decode('UTF-8')))
            if retry_on_failure:
                time.sleep(5)
                logging.info('Will retry %s to %s' % (method, url))
                return Utils.curl(method, url, data, return_error, parse_json, retry_on_failure=False)

            if return_error:
                return None, curl.getinfo(curl.RESPONSE_CODE)
