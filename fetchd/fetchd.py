#! /usr/bin/python

import json
import logging
import time
import utils
import sys


def setlog(cfg):
    #f = cfg.dn + '/info.log'
    #logging.basicConfig(filename=f, level=logging.INFO)
    logging.basicConfig(level=logging.INFO)


def parse(data, rlist):
    for remove in rlist:
        try:
            del data[remove]
        except KeyError:
            continue
    return data


def parse_taskchain(data):
    ret = []
    try:
        dataset_list = data[0]['pdmv_dataset_statuses'].keys()
        for ds in dataset_list:
            r = {}
            r['dataset'] = ds
            r['monitor'] = []
            for d in data:
                try:
                    monit = d['pdmv_dataset_statuses'][ds]
                    m = {}
                    m['pdmv_evts_in_DAS'] = monit['pdmv_evts_in_DAS']
                    m['pdmv_open_evts_in_DAS'] = monit['pdmv_open_evts_in_DAS']
                    m['pdmv_monitor_time'] = d['pdmv_monitor_time']
                    r['monitor'].append(m)
                except KeyError:
                    continue
            ret.append(r)
    except KeyError:
        pass
    return ret


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
    cfg = utils.Config(sys.argv[1])
    setlog(cfg)

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
                # parsing stats documents
                try:
                    if data['pdmv_type'] == 'TaskChain':
                        tc = parse_taskchain(data['pdmv_monitor_history'])
                        if len(tc):
                            data['pdmv_monitor_taskchain'] = tc
                    for i, _ in enumerate(data['pdmv_monitor_history']):
                        data['pdmv_monitor_history'][i] = parse(
                            data['pdmv_monitor_history'][i], cfg.remove_list)
                except KeyError:
                    pass

                # yes... there is spelling mistake in stats db
                try:
                    if data['pdmv_type'] == 'TaskChain':
                        tc = parse_taskchain(data['pdvm_monitor_history'])
                        if len(tc):
                            data['pdmv_monitor_taskchain'] = tc

                    for i, _ in enumerate(data['pdvm_monitor_history']):
                        data['pdmv_monitor_history'][i] = parse(
                            data['pdvm_monitor_history'][i], cfg.remove_list)
                except KeyError:
                    pass
                data = parse(data, cfg.remove_list)

                try:
                    for i, _ in enumerate(data['reqmgr_name']):
                        data['reqmgr_name'][i] = parse(
                            data['reqmgr_name'][i], cfg.remove_list)
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
