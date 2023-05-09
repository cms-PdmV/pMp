"""Utils classes for pMp scripts"""
import os
import re
import logging
import time
from fetchd.search_engine import search_engine, SearchEngine
from configparser import ConfigParser
from datetime import datetime

# Requests package
import requests
from requests.exceptions import HTTPError
from requests_gssapi import HTTPSPNEGOAuth, OPTIONAL


class Config(object):
    """
    Load cofiguration from file
    Be aware that search engine url must have a trailing slash
    """

    def __init__(self, index):
        self.dir = os.path.dirname(os.path.realpath(__file__))
        parser = ConfigParser()
        parser.read(self.dir + "/default.conf")

        # Universal fields
        self.exclude_list = re.split(", ", parser.get("exclude", "list"))
        self.reqmgr_url = parser.get("reqmgr", "url")
        self.reqmgr_url = parser.get("pmp", "last_seq_mapping")

        # Index specific fields
        self.source_db = parser.get(index, "source_db")
        self.source_db_changes = parser.get(index, "source_db_changes")
        self.fetch_fields = re.split(", ", parser.get(index, "fetch_fields"))
        self.mapping = parser.get(index, "mapping")
        self.db = search_engine.url
        self.pmp_index = self.db + parser.get(index, "pmp_index")
        self.pmp_type = self.pmp_index + parser.get(index, "pmp_type")
        self.last_seq = self.db + "last_sequences/last_seq" + "/" + index


class Utils(object):
    """Utils for pMp scripts"""

    @staticmethod
    def get_time():
        """Return current time string"""
        return str(datetime.now())

    @staticmethod
    def setup_console_logging():
        CONSOLE_LOG_FORMAT = "[%(asctime)s][%(levelname)s] %(message)s"
        logging.basicConfig(format=CONSOLE_LOG_FORMAT, level=logging.INFO)

    @staticmethod
    def curl(
        method,
        url,
        data=None,
        return_error=False,
        parse_json=True,
        retry_on_failure=True,
    ):
        """
        Perform an HTTP request
        """
        auth = None
        ca_cert = None
        using_opensearch = search_engine.engine_instance_of(SearchEngine.OPENSEARCH)
        using_kerberos = search_engine.kerberos

        if using_opensearch:
            ca_cert = search_engine.ca_cert
            if using_kerberos:
                auth = HTTPSPNEGOAuth(mutual_authentication=OPTIONAL)
        try:
            response = requests.request(
                method=method, url=url, data=data, verify=ca_cert, auth=auth
            )
            body = response.json() if parse_json else response.text
            status_code = response.status_code
            response.raise_for_status()
            return (body, status_code)
        except HTTPError:
            logging.error("Status: %s/n%s", status_code, body)
            if retry_on_failure:
                time.sleep(5)
                logging.info("Will retry %s to %s", method, url)
                return Utils.curl(
                    method, url, data, return_error, parse_json, retry_on_failure=False
                )

            if return_error:
                return None, status_code
