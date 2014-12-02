#! /usr/bin/python

from datetime import datetime
import json
import logging
import time
import utils

# logging.basicConfig(filename='info.log', level=logging.INFO)
logging.basicConfig(level=logging.WARNING)


def get_time():
    return datetime.now()


def get_changes(utl, cfg):
    res, status = utl.curl('GET', cfg.last_seq)
    if status == 200:
        last_seq = res['_source']['val']
        logging.info('%s Updating since %s' % (get_time(), last_seq))
    else:
        last_seq = 0
        logging.warning('%s Cannot get last sequence. Stauts %s' %
                        (get_time(), status))

    res, status = utl.curl('GET',
                           '%s=%s' % (cfg.url_requests_changes, last_seq),
                           cookie=cfg.cookie)
    if status == 200:
        _, s = utl.curl('PUT', cfg.last_seq,
                        json.loads('{"val": %s}' % res['last_seq']))

        if s not in [200, 201]:
            logging.error('%s Cannot update last_seq' % get_time())

        if len(res['results']):
            for r in res['results']:
                yield r['id'], ('deleted' in r)
        else:
            logging.info('%s Nothing to do. No changes since last update.' %
                         get_time())

    else:
        logging.error('%s Status %s while getting list of changes' %
                      (get_time, status))


if __name__ == "__main__":
    logging.info('%s Getting configuration' % get_time())
    cfg = utils.Config()
    utl = utils.Utils()

    if not utl.is_file(cfg.cookie):
        logging.info('%s Getting SSO Cookie' % get_time())
        utl.get_cookie(cfg.url_mcm, cfg.cookie)

    for r, deleted in get_changes(utl, cfg):
        if r not in cfg.exclude_list:

            if deleted:
                _, s = utl.curl('DELETE', '%s%s' % (cfg.pmp_db, r))
                if s == 200:
                    logging.info('%s Deleted record indexed at %s' %
                                 (get_time(), r))
                else:
                    logging.warning('%s Request indexed at %s was not deleted'
                                    % (get_time(), r))
            else:
                url = str(cfg.url_requests + r)
                data, status = utl.curl('GET', url, cookie=cfg.cookie)

                if status == 200:
                    _, s = utl.curl('PUT', '%s%s' % (cfg.pmp_db, r), data)
                    if s in [200, 201]:
                        logging.info('%s New record at %s' % (get_time(), r))
                    else:
                        logging.error('%s Failed to update record at %s Status: %s, %s' %
                                      (get_time(), r, s, _))
                else:
                    logging.error('%s Failed to receive information about %s' %
                                  (get_time(), r))

    logging.info('%s Removing SSO Cookie' % get_time())
    utl.rm(cfg.cookie)
