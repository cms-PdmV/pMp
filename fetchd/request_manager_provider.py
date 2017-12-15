"""Fetches  from Request Manager. It felt important to extract this functionality
because it's something quite new to pMp - that is, fetching information directly from Request
manager, instead of through 
"""
import httplib
import logging
from utils import Utils
import json
import requests
import os

class NoDataFromRequestManager(Exception):
    pass

class RequestManagerProvider(object):
    """Provides an interface for getting processing strings from Request Manager and handles errors
    and other intricacies of http requests"""
    def __init__(self, reqmgr_url, reqmgr_backup_url=None):
        self.reqmgr_url = reqmgr_url
        self.reqmgr_backup_url = reqmgr_backup_url
        self.session = requests.Session()
        self.session.verify = False
        self.session.cert = os.getenv('X509_USER_PROXY')

        # Set use_backup - if we have the url, use it
        self.use_backup = reqmgr_backup_url is not None

    def get(self, reqmgr_name, fields):
        """Try getting a processing string and handle some of the common errors - raises
        NoProcessingString if an error occurs. `fields` is a list of string keys to be retrieved
        from Request Manager
        """
        try:
            fetched_data = self._fetch(self.reqmgr_url + reqmgr_name)
            if 'result' in fetched_data:
                reqmgr_info = fetched_data['result'][0][reqmgr_name]
            else:
                reqmgr_info = fetched_data
        except NoDataFromRequestManager:
            if self.use_backup:
                logging.warning(Utils.get_time() + ' Trying Request Manager backup')
                reqmgr_info = self._fetch(self.reqmgr_backup_url + reqmgr_name)
            else:
                raise

        # No exceptions by this point!
        info = {}

        for field in fields:
            if field in reqmgr_info:
                info[field] = reqmgr_info[field]

        return info

    def _fetch(self, url):
        """Go and get the processing string from url, or the empty string if it goes west"""
        try:
            response = self.session.get(url)
        except requests.exceptions.RequestException as ex:
            logging.exception(Utils.get_time() + ' Error occurred in request to ' + url)
        else:
            if response.status_code != 200:
                logging.error(Utils.get_time() + ' Got HTTP status ' + str(response.status_code)
                    + ' from ' + url)
            else:
                try:
                    return response.json()
                except ValueError:
                    logging.error(Utils.get_time() + ' Malformed response from ' + url)

        # If we haven't returned by now, there was a problem :((((((((((
        raise NoDataFromRequestManager(Utils.get_time() + ' Problem with ' + url)

