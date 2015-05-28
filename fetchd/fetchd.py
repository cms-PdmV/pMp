#! /usr/bin/python

import json
import logging
import time
import utils
import sys


def setlog():
    logging.basicConfig(level=logging.INFO)


def parse(data, fields):
    d = {}
    for f in fields:
        try:
            d[f] = data[f]
        except KeyError:
            continue
    return d


def parse_efficiency(data):
    if len(data):
        if not type(data[0]) is dict:
            return 1
        i = len(data)-1
        return (float(data[i]['match_efficiency'])*
                float(data[i]['filter_efficiency']))
    return 1


def parse_reqmgr(data):
    res = []
    for d in data:
        try:
            res.append(d['name'])
        except KeyError:
            res.append(d['pdmv_request_name'])
    return res


def parse_history(data):
    res = []
    for (i, d) in enumerate(data):
        r = {}
        if not i:
            r['action'] = 'created'
            r['time'] = d['updater']['submission_date']
        elif (d['action'] == 'set status' and
              d['step'] in ['approved', 'submitted', 'validation', 'done']):
            r['action'] = d['step']
            r['time'] = d['updater']['submission_date']
        if len(r.keys()):
            res.append(r)
    return res


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

    # get list of documents to fetch
    if last_seq:
        res, status = utl.curl('GET', '%s=%s' % (cfg.url_db_changes, last_seq),
                               cookie=cfg.cookie)
        string = 'results'
    else:
        res, status = utl.curl('GET', '%s' % cfg.url_db_all, cookie=cfg.cookie)
        string = 'rows'


    if status == 200:
        if len(res[string]):
            for r in res[string]:
                yield r['id'], ('deleted' in r)

        else:
            logging.info('%s No changes since last update' % utl.get_time())

        if string == 'rows':
            res, status = utl.curl('GET', cfg.url_db_first, cookie=cfg.cookie)

        _, s = utl.curl('PUT', cfg.last_seq, json.loads(
                '{"val":%s, "time":%s}' % (res['last_seq'],
                                           int(round(time.time() * 1000)))))
        if s not in [200, 201]:
            logging.error('%s Cannot update last_seq' % utl.get_time())
    else:
        logging.error('%s Status %s while getting list of documents' %
                      (utl.get_time(), status))


if __name__ == "__main__":

    setlog()
    utl = utils.Utils()
    cfg = utils.Config(sys.argv[1])

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
                for misspelled in ['pdmv_monitor_history', 'pdvm_monitor_history']:
                    try:
                        if data['pdmv_type'] == 'TaskChain':
                            tc = parse_taskchain(data[misspelled])
                            if len(tc):
                                data['pdmv_monitor_taskchain'] = tc
                        if len(data[misspelled]):
                            for i, _ in enumerate(data[misspelled]):
                                data[misspelled][i] = parse(
                                    data[misspelled][i], ['pdmv_evts_in_DAS',
                                                          'pdmv_monitor_time',
                                                          'pdmv_open_evts_in_DAS'])
                            data['pdmv_monitor_history'] = data[misspelled]
                    except KeyError:
                        pass
                    
                # parsing requests
                if 'reqmgr_name' in data:
                    data['reqmgr_name'] = parse_reqmgr(data['reqmgr_name'])

                if 'history' in data:
                    data['history'] = parse_history(data['history'])

                if 'generator_parameters' in data:
                    data['efficiency'] = parse_efficiency(
                        data['generator_parameters'])

                data = parse(data, cfg.fetch_fields)

                if status == 200:
                    re, s = utl.curl('PUT', '%s%s' % (cfg.pmp_db, r), data)
                    if s in [200, 201]:
                        logging.info('%s New record %s' % (utl.get_time(), r))
                    else:
                        logging.error(('%s Failed to update record at %s. ' +
                                       'Reason: %s') % (utl.get_time(), r, re))
                else:
                    logging.error('%s Failed to receive information about %s' %
                                  (utl.get_time(), r))

    logging.info('%s Removing SSO Cookie' % utl.get_time())
    utl.rm(cfg.cookie)
