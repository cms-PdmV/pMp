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
    # get pointer to last change
    res, status = utl.curl('GET', cfg.last_seq)
    if status == 200:
        last_seq = res['_source']['val']
        logging.info('%s Updating since %s' % (utl.get_time(), last_seq))
    else:
        last_seq = 0
        logging.warning('%s Cannot get last sequence. Reason %s' %
                        (utl.get_time(), status))

        # create index
        r, s = utl.curl('PUT', cfg.pmp_db_index)
        if s == 200:
            logging.info('%s Index created' % (utl.get_time()))
        else:
            logging.warning('%s Index not created. Reason %s' %
                            (utl.get_time(), s))
        # create mapping
        if cfg.mapping != '':
            r, s = utl.curl('PUT', (cfg.pmp_db + '_mapping'),
                            json.loads(cfg.mapping))
            if s == 200:
                logging.info('%s Pushed mapping' % (utl.get_time()))
            else:
                logging.warning('%s Mapping not implemented. Reason %s' %
                                (utl.get_time()))

    if last_seq:
        res, status = utl.curl('GET', '%s=%s' % (cfg.url_db_changes, last_seq),
                               cookie=cfg.cookie)
        if status == 200:
            if len(res['results']):
                for r in res['results']:
                    if r['seq'] == res['last_seq']:
                        _, s = utl.curl('PUT', cfg.last_seq,
                                        json.loads('{"val": %s}' %
                                                   res['last_seq']))
                        if s not in [200, 201]:
                            logging.error('%s Cannot update last_seq' %
                                          utl.get_time())
                    #!!! if r['id'].startswith('jbadillo_ACDC_B2G-Fall13'):
                    yield r['id'], ('deleted' in r)
            else:
                logging.info('%s Nothing to do. No changes since last update' %
                             utl.get_time())
        else:
            logging.error('%s Status %s while getting list of changes' %
                          (utl.get_time(), status))
    else:
        res, status = utl.curl('GET', '%s' % cfg.url_db_all, cookie=cfg.cookie)
        if status == 200:
            if len(res['rows']):
                for r in res['rows']:
                    yield r['id'], ('deleted' in r)

                r, status = utl.curl('GET', cfg.url_db_first,
                                     cookie=cfg.cookie)
                _, s = utl.curl('PUT', cfg.last_seq, json.loads('{"val": %s}' %
                                                                r['last_seq']))
                if s not in [200, 201]:
                    logging.error('%s Cannot update last_seq' %
                                  utl.get_time())
            else:
                logging.info('%s Nothing to do. Empty index.' % utl.get_time())
        else:
            logging.error('%s Status %s while getting list of documents' %
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
                try:
                    i = 0
                    for _ in data['pdmv_monitor_history']:
                        data['pdmv_monitor_history'][i] = parse(
                            data['pdmv_monitor_history'][i], cfg.remove_list)
                        i += 1
                except KeyError:
                    pass
                try:
                    i = 0
                    for _ in data['reqmgr_name']:
                        data['reqmgr_name'][i] = parse(
                            data['reqmgr_name'][i], cfg.remove_list)
                        i += 1
                except KeyError:
                    pass

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
