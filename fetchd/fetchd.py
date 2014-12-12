#! /usr/bin/python

import json
import logging
import time
import utils
import sys

# logging.basicConfig(filename='info.log', level=logging.INFO)
logging.basicConfig(level=logging.INFO)


def parse(data, rlist):
    for remove in rlist:
        try:
            del data[remove]
        except KeyError:
            continue
    return data


def get_changes(utl, cfg):
    res, status = utl.curl('GET', cfg.last_seq)
    if status == 200:
        last_seq = res['_source']['val']
        logging.info('%s Updating since %s' % (utl.get_time(), last_seq))
    else:
        last_seq = 0
        logging.warning('%s Cannot get last sequence. Stauts %s' %
                        (utl.get_time(), status))
        # create index
        r, s = utl.curl('PUT', cfg.pmp_db_index)

        if s == 200:
            logging.info('%s Index created' % (utl.get_time()))
        else:
            logging.warning('%s Index not created %s' %
                            (utl.get_time(), r))
        # mapping
        r, s = utl.curl('PUT', (cfg.pmp_db + '_mapping'),
                        json.loads(cfg.mapping))
        if s == 200:
            logging.info('%s Pushed mapping' % (utl.get_time()))
        else:
            logging.warning('%s Mapping not implemented %s' %
                            (utl.get_time(), r))
    res, status = utl.curl('GET',
                           '%s=%s' % (cfg.url_db_changes, last_seq),
                           cookie=cfg.cookie)
    if status == 200:
        if len(res['results']):
            for r in res['results']:
                if r['seq'] == res['last_seq']:
                    _, s = utl.curl('PUT', cfg.last_seq,
                                    json.loads({"val": res['last_seq']}))
                    if s not in [200, 201]:
                        logging.error('%s Cannot update last_seq' %
                                      utl.get_time())
                yield r['id'], ('deleted' in r)
        else:
            logging.info('%s Nothing to do. No changes since last update.' %
                         utl.get_time())
    else:
        logging.error('%s Status %s while getting list of changes' %
                      (utl.get_time(), status))


if __name__ == "__main__":

    utl = utils.Utils()
    logging.info('%s Getting configuration' % utl.get_time())
    cfg = utils.Config(sys.argv[1])

    if not utl.is_file(cfg.cookie):
        logging.info('%s Getting SSO Cookie' % utl.get_time())
        utl.get_cookie(cfg.url_mcm, cfg.cookie)

    for r, deleted in get_changes(utl, cfg):
        if r not in cfg.exclude_list:
            if deleted:
                _, s = utl.curl('DELETE', '%s%s' % (cfg.pmp_db, r))
                if s == 200:
                    logging.info('%s Deleted record indexed at %s' %
                                 (utl.get_time(), r))
                else:
                    logging.warning('%s Request indexed at %s was not deleted'
                                    % (utl.get_time(), r))
            else:
                url = str(cfg.url_db + r)
                data, status = utl.curl('GET', url, cookie=cfg.cookie)
                data = parse(data, cfg.remove_list)
                if status == 200:
                    reason, s = utl.curl('PUT', '%s%s' % (cfg.pmp_db, r), data)
                    if s in [200, 201]:
                        logging.info('%s New record at %s' %
                                     (utl.get_time(), r))
                    else:
                        logging.error(('%s Failed to update record at %s. ' +
                                       'Status: %s. Reason: %s') %
                                      (utl.get_time(), r,
                                       json.dumps(s), reason))
                else:
                    logging.error('%s Failed to receive information about %s' %
                                  (utl.get_time(), r))
    logging.info('%s Removing SSO Cookie' % utl.get_time())
    utl.rm(cfg.cookie)
