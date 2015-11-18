"""fetchd.py Fetch deamon. Update database with changes in McM/stats DB"""
import simplejson as json
import logging
import time
import utils
import sys
from datetime import datetime

def setlog():
    """Set loggging level"""
    logging.basicConfig(level=logging.INFO)


def parse(details, fields):
    """Remove all indexes that are not in fields array"""
    parsed = {}
    for field in fields:
        try:
            parsed[field] = details[field]
        except KeyError:
            continue
    return parsed


def parse_efficiency(details):
    """Calculate efficiency for pMp"""
    if len(details):
        if not type(details[0]) is dict:
            return 1
        last = len(details)-1
        return (float(details[last]['match_efficiency'])*
                float(details[last]['filter_efficiency']))
    return 1


def parse_reqmgr(details):
    """Parse reqmgr_name"""
    res = []
    for detail in details:
        try:
            res.append(detail['name'])
        except KeyError:
            res.append(detail['pdmv_request_name'])
    return res


def parse_history(details):
    """Parse history field"""
    res = []
    for index, detail in enumerate(details):
        monitor = {}
        if not index:
            monitor['action'] = 'created'
            monitor['time'] = detail['updater']['submission_date']
        elif (detail['action'] == 'set status' and
              detail['step'] in ['approved', 'submitted',
                                 'validation', 'done']):
            monitor['action'] = detail['step']
            monitor['time'] = detail['updater']['submission_date']
        if len(monitor.keys()):
            res.append(monitor)
    return res


def parse_datasets(details):
    """Parse multiple dataset field"""
    ret = []
    try:
        for dataset in details[0]['pdmv_dataset_statuses'].keys():
            field = {}
            field['dataset'] = dataset
            field['monitor'] = []
            for detail in details:
                try:
                    monitor = detail['pdmv_dataset_statuses'][dataset]
                    mon = {}
                    mon['pdmv_evts_in_DAS'] = monitor['pdmv_evts_in_DAS']
                    mon['pdmv_open_evts_in_DAS'] = \
                        monitor['pdmv_open_evts_in_DAS']
                    mon['pdmv_monitor_time'] = detail['pdmv_monitor_time']
                    field['monitor'].append(mon)
                except KeyError:
                    continue
            ret.append(field)
    except KeyError:
        pass
    return ret


def create_index(utl, cfg):
    """Create index"""
    _, code = utl.curl('PUT', cfg.pmp_db_index)
    if code == 200:
        logging.info(utl.get_time() + " Index created")
    else:
        logging.warning(utl.get_time() + " Index not created. Reason " +
                        str(code))


def create_mapping(utl, cfg):
    """Create mapping"""
    _, code = utl.curl('PUT', (cfg.pmp_db + '_mapping'), \
                           json.loads(cfg.mapping))
    if code == 200:
        logging.info(utl.get_time() + " Pushed mapping")
    else:
        logging.warning(utl.get_time() + " Mapping not implemented. Reason " +
                        str(code))


def get_changes(utl, cfg):
    """Changes since last update Generator"""

    # get pointer to last change
    res, code = utl.curl('GET', cfg.last_seq)
    if code == 200:
        last_seq = res['_source']['val']
        logging.info(utl.get_time() + " Updating since " + str(last_seq))
    else:
        last_seq = 0
        logging.warning(utl.get_time() + " Cannot get last sequence. Reason " +
                        str(code))
        create_index(utl, cfg)
        # create mapping
        if cfg.mapping != '':
            create_mapping(utl, cfg)

    # get list of documents to fetch
    if last_seq:
        res, code = utl.curl('GET', '%s=%s' % (cfg.url_db_changes, last_seq), \
                                 cookie=cfg.cookie)
        last_seq = res['last_seq']
        string = 'results'
    else:
        # operate on all filds rather than updated (compressed)
        res, code = utl.curl('GET', '%s' % cfg.url_db_all, cookie=cfg.cookie)
        last_seq, _ = utl.curl('GET', cfg.url_db_first, cookie=cfg.cookie)
        last_seq = last_seq['last_seq']
        string = 'rows'

    if code == 200:
        if len(res[string]):
            for record in res[string]:
                yield record['id'], ('deleted' in record)
        else:
            logging.info(utl.get_time() + " No changes since last update")

        _, code = utl.curl('PUT', cfg.last_seq, json.loads( \
                '{"val":%s, "time":%s}' % (last_seq,
                                           int(round(time.time() * 1000)))))

        if code not in [200, 201]:
            logging.error(utl.get_time() + " Cannot update last sequence")
    else:
        logging.error(utl.get_time() + " Status " + status +
                      " while getting list of documents")


if __name__ == "__main__":

    setlog()
    UTL = utils.Utils()

    index = sys.argv[1]
    CFG = utils.Config(index)

    logging.info(UTL.get_time() + " Getting SSO Cookie")
    UTL.get_cookie(CFG.url_mcm, CFG.cookie)

    for r, deleted in get_changes(UTL, CFG):

        if r not in CFG.exclude_list:
            if deleted:
                _, s = UTL.curl('DELETE', '%s%s' % (CFG.pmp_db, r))
                if s == 200:
                    logging.info(UTL.get_time() + " Deleted record indexed at "
                                 + r)
                else:
                    logging.warning(UTL.get_time() + " Request indexed at " +
                                    r + " was not deleted")
            else:
                url = str(CFG.url_db + r)
                data, status = UTL.curl('GET', url, cookie=CFG.cookie)

                # parsing stats documents
                if index == "stats":
                    if 'pdmv_monitor_history' not in data\
                            and 'pdvm_monitor_history' not in data:
                        current_time = datetime.now().strftime('%c') # FIXME: Locale-dependent
                        #data['pdmv_monitor_history'] = ['{"pdmv_evts_in_DAS":0, ' +
                        #        '"pdmv_monitor_time":"' + current_time +
                        #        '", "pdmv_open_evts_in_DAS":0}']
                        data['pdmv_monitor_history'] = [{"pdmv_evts_in_DAS": 0,
                                "pdmv_monitor_time": current_time,
                                "pdmv_open_evts_in_DAS": 0}]
                    else:
                        for misspelled in ['pdmv_monitor_history',
                                           'pdvm_monitor_history']:
                            try:
                                if len(data['pdmv_dataset_list']) > 0:
                                    tc = parse_datasets(data[misspelled])
                                    if len(tc):
                                        data['pdmv_monitor_datasets'] = tc
                                if len(data[misspelled]):
                                    for i, _ in enumerate(data[misspelled]):
                                        data[misspelled][i] = \
                                            parse(data[misspelled][i],
                                                  ['pdmv_evts_in_DAS',
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

                data = parse(data, CFG.fetch_fields)

                if status == 200:
                    re, s = UTL.curl('PUT', '%s%s' % (CFG.pmp_db, r), data)
                    if s in [200, 201]:
                        logging.info(UTL.get_time() + " New record " + r)
                    else:
                        error_json = json.dumps(re)
                        logging.error(UTL.get_time() +
                                      " Failed to update record at " + r +
                                      ". Reason: " + error_json)

                        # TODO: Remove debugging code
                        with open("errors.txt", "a") as myfile:
                            myfile.write(r + ': ' + error_json + "\n")
                            myfile.close()
                else:
                    logging.error(UTL.get_time() +
                                  " Failed to receive information about " + r)

    logging.info(UTL.get_time() + " Removing SSO Cookie")
    UTL.rm_file(CFG.cookie)
