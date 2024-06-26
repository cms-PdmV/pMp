"""Utils classes for pMp scripts"""
import os
import re
import logging
import time
from urllib.parse import urlparse
from configparser import ConfigParser
from datetime import datetime

# Requests package
import requests
from requests.exceptions import HTTPError

# Import SearchEngine module
# If the application is running as a web server, it will be available into the fetchd package
# If it is running as a batch job, it is not required to make reference to the package
try:
    from fetchd.search_engine import search_engine, SearchEngine
except ModuleNotFoundError:
    from search_engine import search_engine, SearchEngine


class Config(object):
    """
    Load cofiguration from file
    Be aware that search engine url must have a trailing slash
    """

    def __init__(self, index):
        self.index_name = index
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
        self.pmp_type = self.pmp_index + "_doc" + "/"
        self.last_seq = self.db + "last_sequences/_doc" + "/" + self.index_name


class Utils:
    """Utils for pMp scripts"""

    def __init__(self):
        # Persists HTTP connections to improve performance
        # and not overload the DNS
        self.__session_pool: dict[str, requests.Session] = {}
        self.curl = self.__curl

    def __curl(
        self,
        method,
        url,
        data=None,
        return_error=False,
        parse_json=True,
        retry_on_failure=True,
    ):
        """
        Enable curl method with persistent HTTP connection
        """
        # Retrieve the domain name
        parsed_url = urlparse(url)
        domain: str = str(parsed_url.netloc)

        # Retrieve a session from the session pool for the domain
        session: requests.Session = self.__session_pool.get(domain)
        if not session:
            session: requests.Session = requests.Session()
            self.__session_pool[domain] = session

        return Utils.curl(
            method,
            url,
            data=data,
            return_error=return_error,
            parse_json=parse_json,
            retry_on_failure=retry_on_failure,
            session=session,
        )

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
        session: requests.Session = None,
    ):
        """
        Perform an HTTP request
        """
        # Using a persisting HTTP connection
        http = session if session else requests
        ca_cert: str | bool = True
        using_opensearch = search_engine.engine_instance_of(SearchEngine.OPENSEARCH)
        headers = {"Content-Type": "application/json"}

        if using_opensearch:
            retrieved_ca_cert = search_engine.ca_cert
            ca_cert = retrieved_ca_cert if retrieved_ca_cert else False
        try:
            response: requests.Response = http.request(
                method=method,
                url=url,
                json=data,
                headers=headers,
                verify=ca_cert,
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
