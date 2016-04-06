"""Fetches processing strings from Request Manager. It felt important to extract this functionality
because it's something quite new to pMp - that is, fetching information directly from Request
manager, instead of through 
"""
import httplib
import logging
from utils import Utils
import json
import requests
import os

class NoProcessingString(Exception):
    pass

class ProcessingStringProvider(object):
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

    def get(self, reqmgr_name):
        """Try getting a processing string and handle some of the common errors - raises
        NoProcessingString if an error occurs"""
        url = self.reqmgr_url + reqmgr_name

        processing_string = self._fetch(self.reqmgr_url + reqmgr_name)

        if len(processing_string) == 0:
            if self.use_backup:
                logging.warning(Utils.get_time() + ' Trying Request Manager backup')
                processing_string = self._fetch(self.reqmgr_backup_url
                    + reqmgr_name)

                if len(processing_string) == 0:
                    raise NoProcessingString(Utils.get_time() + ' No processing string found in '
                        + ' Request Manager or backup')
            else:
                raise NoProcessingString(Utils.get_time() + ' No processing string found')

        return processing_string

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
                    return response.json()['ProcessingString']
                except KeyError:
                    logging.warning(Utils.get_time() + ' No processing string in response from '
                        + url)
                except ValueError:
                    logging.error(Utils.get_time() + ' Malformed response from ' + url)

        # Default to returning the empty string
        return ''
