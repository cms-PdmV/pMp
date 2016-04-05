"""Fetches processing strings from Request Manager. It felt important to extract this functionality
because it's something quite new to pMp - that is, fetching information directly from Request
manager, instead of through 
"""
import httplib
import logging
from utils import Utils

class NoProcessingString(Exception):
    pass

class ProcessingStringProvider(object):
    """Provides an interface for getting processing strings from Request Manager and handles errors
    and other intricacies of http requests"""
    def __init__(self, reqmgr_host, reqmgr_path, reqmgr_host_backup=None):
        self._reqmgr_host = reqmgr_host
        self._reqmgr_host_backup = reqmgr_host_backup
        self._reqmgr_path = reqmgr_path
        self._connection = Utils.init_connection(reqmgr_host)

        if reqmgr_host_backup is not None:
            self._use_backup = True # for dev
            self._backup_connection = Utils.init_connection(reqmgr_host_backup)
        else:
            self._use_backup = False

    def get(self, reqmgr_name):
        """Try getting a processing string and handle some of the common errors - raises
        NoProcessingString with a meaningful message if an error occurs"""
        try:
            response, status = Utils.httpget(self._connection,
                self._reqmgr_host + self._reqmgr_path + reqmgr_name)
        except httplib.HTTPException as ex1:
            logging.exception(Utils.get_time() + ' HTTP error while contacting Request Manager')

            # Need to renew the connection for next time because an error in httplib can sometimes
            # leave the connection object in an invalid state
            self._connection = Utils.init_connection(self._reqmgr_host)

            if self._use_backup:
                logging.info(Utils.get_time() + ' Contacting given backup Request Manager')

                try:
                    response, status = Utils.httpget(self._backup_connection,
                        self._reqmgr_host_backup + self._reqmgr_path + reqmgr_name)
                except httplib.HTTPException as ex2:
                    logging.exception(Utils.get_time() + ' HTTP error while contacting given'
                        + ' backup Request Manager')

                    # Renewing the backup connection
                    self._backup_connection = Utils.init_connection(self._reqmgr_host_backup)

                    raise NoProcessingString('Errors occurred when fetching processing string'
                        + ' from Request Manager')
            else:
                raise NoProcessingString('An error occurred when fetching processing string'
                    + ' from Request Manager')

        # By this point, errors should have been raised - assume we have some kind of result
        if status == 200:
            try:
                return json.loads(response)['ProcessingString']
            except ValueError:
                raise NoProcessingString('Error parsing response from Request Manager')
            except KeyError:
                raise NoProcessingString('Response from Request Manager did not contain a'
                    + ' processing string')
        else:
            raise NoProcessingString('Whoops - got HTTP status ' + str(status)
                + ' from Request Manager')

