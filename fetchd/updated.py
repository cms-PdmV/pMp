#! /usr/bin/python

import logging
import os
import utils

'''
An update deamon ensuring the sych between McM DB and Stats DB
for "completed_events" and "pdmv_evts_in_DAS" fields
'''

## TEMP: for now we should run through -int as -prod doesn't have latest update yet

MCM_URL = 'https://cms-pdmv-int.cern.ch/mcm/'
STATS_URL = 'https://cms-pdmv.cern.ch/stats/'


def setlog():
    logging.basicConfig(level=logging.INFO)


def get_request_list(c):
    res, status = utl.curl('GET',
                           '%s%s' % (MCM_URL, 'admin/requests/_all_docs'),
                           cookie=c)
    if status == 200:
        if len(res['rows']):
            for r in res['rows']:
                yield r['id'], ('deleted' in r)
        else:
            logging.info('%s Nothing to do. Empty index.' % utl.get_time())
    else:
        logging.error('%s Status %s while getting list of documents' %
                      (utl.get_time(), status))


if __name__ == "__main__":

    setlog()
    utl = utils.Utils()
    mcm_cookie = os.environ['HOME'] + '/private/updatedmcm.txt'
    stats_cookie = os.environ['HOME'] + '/private/updatedstats.txt'
    logging.info('%s Getting MCM SSO Cookie' % utl.get_time())
    utl.get_cookie(MCM_URL, mcm_cookie)
    logging.info('%s Getting Stats SSO Cookie' % utl.get_time())
    utl.get_cookie(STATS_URL, stats_cookie)

    for request, d in get_request_list(mcm_cookie):
        if d or request in ['_design/lucene', '_design/requests',
                            '_design/unique']:
            continue

        url = str(MCM_URL + 'admin/requests/' + request)
        res, status = utl.curl('GET', url, cookie=mcm_cookie)

        if status != 200:
            logging.error('%s Getting Error while querying for %s' %
                          (utl.get_time(), request))
            continue

        # skip not done
        if res['status'] != 'done':
            continue

        dataset_list = res['output_dataset']

        if not len(dataset_list):
            continue

        request_output_type = dataset_list[0]        

        ce = 0
        for r in res['reqmgr_name']:
            url_s = str(STATS_URL + 'admin/stats/' + r['name'])
            res_s, status_s = utl.curl('GET', url_s, cookie=stats_cookie)

            if status_s != 200:
                continue

            if res_s['pdmv_dataset_name'] == request_output_type:
                ce2 = res_s['pdmv_evts_in_DAS'] + res_s['pdmv_open_evts_in_DAS']
                ce = max(ce, ce2)
            else:
                try:
                    det = res_s['pdmv_dataset_statuses'][request_output_type]
                    ce2 = det['pdmv_evts_in_DAS'] + det['pdmv_open_evts_in_DAS']
                    ce = max(ce, ce2)
                except KeyError:
                    try:
                        det = res_s['pdvm_dataset_statuses'][request_output_type]
                        ce2 = det['pdmv_evts_in_DAS'] + det['pdmv_open_evts_in_DAS']
                        ce = max(ce, ce2)
                    except:
                        pass

        if res['completed_events'] != ce:
            logging.info('%s Updating %s' % (utl.get_time(), request))
            # update field in mcm
            url = str(MCM_URL + 'restapi/requests/update_stats/%s/no_refresh/force' %(request))
            res_up, status_up = utl.curl('GET', url, cookie=mcm_cookie)
            logging.info('%s Result %s' % (utl.get_time(), res_up))
