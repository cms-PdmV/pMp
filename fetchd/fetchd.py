"""fetchd.py Fetch deamon. Update database with changes in McM/stats DB"""
import simplejson as json
import logging
import time
import sys
from datetime import datetime
from utils import *
from request_manager_provider import *

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

            if 'updater' in detail:
                monitor['time'] = detail['updater']['submission_date']
            else:
                monitor['time'] = detail['time']
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

def create_index(cfg):
    """Create index"""
    _, code = Utils.curl('PUT', cfg.pmp_db_index)
    if code == 200:
        logging.info(Utils.get_time() + " Index created")
    else:
        logging.warning(Utils.get_time() + " Index not created. Reason " +
                        str(code))

def create_mapping(cfg):
    """Create mapping"""
    _, code = Utils.curl('PUT', (cfg.pmp_db + '_mapping'), \
                           json.loads(cfg.mapping))
    if code == 200:
        logging.info(Utils.get_time() + " Pushed mapping")
    else:
        logging.warning(Utils.get_time() + " Mapping not implemented. Reason " +
                        str(code))

def get_last_change(cfg):
    last_seq = 0

    res, code = Utils.curl('GET', cfg.last_seq)
    if code == 200:
        last_seq = res['_source']['val']
        logging.info(Utils.get_time() + " Updating since " + str(last_seq))
    else:
        logging.warning(Utils.get_time() + " Cannot get last sequence. Reason " +
                        str(code))
        create_index(cfg)
        # create mapping
        if cfg.mapping != '':
            create_mapping(cfg)

    return last_seq

def get_rereco_configs():
    """Get "fake" rereco index configs and try to ensure they exist"""
    proc_string_cfg = Config('processing_strings')
    rereco_request_cfg = Config('rereco_requests')

    # ensure that they exist - we don't actually need the last change
    get_last_change(proc_string_cfg)
    get_last_change(rereco_request_cfg)

    return proc_string_cfg, rereco_request_cfg

def get_changes(cfg):
    """Changes since last update Generator"""

    # get pointer to last change
    last_seq = get_last_change(cfg)

    # get list of documents to fetch
    if last_seq:
        res, code = Utils.curl('GET', '%s=%s' % (cfg.url_db_changes, last_seq), \
                                 cookie=cfg.cookie)
        last_seq = res['last_seq']
        string = 'results'
    else:
        # operate on all filds rather than updated (compressed)
        res, code = Utils.curl('GET', '%s' % cfg.url_db_all, cookie=cfg.cookie)
        last_seq, _ = Utils.curl('GET', cfg.url_db_first, cookie=cfg.cookie)
        last_seq = last_seq['last_seq']
        string = 'rows'

    if code == 200:
        if len(res[string]):
            for record in res[string]:
                yield record['id'], ('deleted' in record)
        else:
            logging.info(Utils.get_time() + " No changes since last update")

        _, code = Utils.curl('PUT', cfg.last_seq, json.loads( \
                '{"val":%s, "time":%s}' % (last_seq,
                                           int(round(time.time() * 1000)))))

        if code not in [200, 201]:
            logging.error(Utils.get_time() + " Cannot update last sequence")
    else:
        logging.error(Utils.get_time() + " Status " + status +
                      " while getting list of documents")

def save(r, data, cfg):
    re, s = Utils.curl('PUT', '%s%s' % (cfg.pmp_db, r), data)
    if s in [200, 201]:
        logging.info(Utils.get_time() + " New record " + r)
    else:
        logging.error(Utils.get_time() +
                      " Failed to update record at " + r +
                      ". Reason: " + json.dumps(re))

def convert_reqmgr_timestamp(timestamp):
    """Get a YYYY-mm-DD-HH-MM timestamp from a unix one"""
    return datetime.utcfromtimestamp(timestamp).strftime('%Y-%m-%d-%H-%M')

def parse_rereco_history(transitions):
    statuses = {
        'running-open': 'submitted',
        'announced': 'done'
    }
    history = []

    for transition in transitions:
        if transition['Status'] in statuses:
            history.append({
                'action': statuses[transition['Status']],
                'time': 
                    datetime.utcfromtimestamp(transition['UpdateTime']).strftime('%Y-%m-%d-%H-%M')
            })

    return history
            
def get_reqmgr_info(reqmgr_name, reqmgr_provider, proc_string_cfg):
    """Get relevant info from Request Manager and prepare it for use"""
    info = {}

    try:
        reqmgr_info = reqmgr_provider.get(reqmgr_name, ['ProcessingString', 'RequestTransition'])

        if 'ProcessingString' in reqmgr_info:
            processing_string = reqmgr_info['ProcessingString']
            info['member_of_campaign'] = processing_string
            logging.info(Utils.get_time() + ' Saving processing string ' + processing_string)
            save(processing_string, {'prepid': processing_string}, proc_string_cfg)

        if 'RequestTransition' in reqmgr_info:
            info['history'] = parse_rereco_history(reqmgr_info['RequestTransition'])
    except NoDataFromRequestManager as err:
        logging.error(Utils.get_time() + ' ' + str(err))

    return info

def create_rereco_request(data, rereco_cfg, proc_string_cfg, processing_string_provider):
    """Creates a request-like object from a given stats object"""
    fake_request = {}

    # Copy over the 1:1 equivalents from stats to the fake request
    mc_rereco_equivalents = {
        'prepid': 'pdmv_prep_id',
        'total_events': 'pdmv_expected_events',
        'priority': 'pdmv_priority',
        'rereco_campaign': 'member_of_campaign',
        'output_dataset': 'pdmv_dataset_list',
        'efficiency': 'efficiency',
        'status_from_reqmngr': 'pdmv_status_from_reqmngr',
        'status_in_DAS': 'pdmv_status_in_DAS',
        'pdmv_status': 'pdmv_status' # Keep this in case it's useful in the future
    }

    for mc_name, rereco_name in mc_rereco_equivalents.iteritems():
        if rereco_name in data:
            fake_request[mc_name] = data[rereco_name]

    # Get a useful status (using the DAS status)
    das_status = fake_request.get('status_in_DAS', 'unknown')

    if das_status == 'VALID':
        fake_request['status'] = 'done'
    elif das_status == 'PRODUCTION':
        fake_request['status'] = 'submitted'
    else:
        fake_request['status'] = das_status

    # Format the reqmgr_name field as a list to mirror MC requests (even though there will only
    # ever be only one, because we're getting this from stats)
    fake_request['reqmgr_name'] = [data.get('pdmv_request_name', '')]

    # Find the completed events
    try:
        fake_request['completed_events'] =\
                data['pdmv_monitor_history'][0]['pdmv_evts_in_DAS']
    except KeyError:
        fake_request['completed_events'] = 0

    # Get ReReco-specific fields from Request Manager
    try:
        request_name = data['pdmv_request_name']
    except KeyError:
        logging.warning('{0} Record {1} has no request name'.format(
            Utils.get_time(), prepid))
    else:
        try:
            fake_request.update(get_reqmgr_info(request_name, reqmgr_provider, proc_string_cfg))
        except NoDataFromRequestManager as err:
            logging.error(Utils.get_time() + ' ' + str(err))

    # Aaaaand save.
    save(fake_request['prepid'], fake_request, rereco_cfg)

def is_excluded_rereco(data):
    """Returns true if the given object is to be excluded from the ReReco requests index"""
    if int(data.get('pdmv_submission_date', '0')) < 151000:
        return True

    if len(data.get('pdmv_prep_id', '')) == 0:
        return True

    # Fall through
    return False

if __name__ == "__main__":

    setlog()

    index = sys.argv[1]
    CFG = Config(index)

    logging.info(Utils.get_time() + " Getting SSO Cookie")
    Utils.get_cookie(CFG.url_mcm, CFG.cookie)

    # Ensure that the rereco wrapper indices are ready
    if index == 'stats':
        proc_string_cfg, rereco_cfg = get_rereco_configs()

        if CFG.reqmgr_backup_url == '': # config allows us to check a different reqmgr
            reqmgr_provider = RequestManagerProvider(CFG.reqmgr_url)
        else:
            reqmgr_provider = RequestManagerProvider(CFG.reqmgr_url, CFG.reqmgr_backup_url)

    for r, deleted in get_changes(CFG):

        if r not in CFG.exclude_list:
            if deleted:
                _, s = Utils.curl('DELETE', '%s%s' % (CFG.pmp_db, r))
                if s == 200:
                    logging.info(Utils.get_time() + " Deleted record indexed at "
                                 + r)
                else:
                    logging.warning(Utils.get_time() + " Request indexed at " +
                                    r + " was not deleted")
            else:
                url = str(CFG.url_db + r)

                retries = 0
                while True: # a nice and messy way of retrying for a cookie
                    data, status = Utils.curl('GET', url, cookie=CFG.cookie, return_error=True)
                    
                    if status == 302:
                        if retries < 2:
                            logging.warning(Utils.get_time() + ' Retrying for new cookie')
                            Utils.get_cookie(CFG.url_mcm, CFG.cookie)
                            retries += 1
                        else:
                            logging.error(Utils.get_time() + ' Failed to get valid cookie after two '
                                    + 'retries')
                            sys.exit(1)
                    else:
                        break

                if status == 200:
                    pdmv_type = data.get('pdmv_type', '')

                    # parsing requests
                    if 'reqmgr_name' in data:
                        data['reqmgr_name'] = parse_reqmgr(data['reqmgr_name'])

                    if 'history' in data:
                        data['history'] = parse_history(data['history'])

                    if 'generator_parameters' in data:
                        data['efficiency'] = parse_efficiency(
                            data['generator_parameters'])

                    # parsing stats documents
                    if index == "stats":
                        if 'pdmv_monitor_history' not in data\
                                and 'pdvm_monitor_history' not in data:
                            current_time = datetime.now().strftime('%c') # Locale-dependent
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

                        # Is it a ReReco request created in Oct 2015 or later?
                        if pdmv_type.lower() == 'rereco' and not is_excluded_rereco(data):
                            logging.info(Utils.get_time() + ' Creating mock ReReco request at '
                                + data['pdmv_prep_id'])
                            create_rereco_request(data, rereco_cfg, proc_string_cfg,
                                reqmgr_provider)

                    # Trim fields we don't want
                    data = parse(data, CFG.fetch_fields)

                    # Save to local stats ES index
                    re, s = Utils.curl('PUT', '%s%s' % (CFG.pmp_db, r), data)
                    if s in [200, 201]:
                        logging.info(Utils.get_time() + " New record " + r)
                    else:
                        logging.error(Utils.get_time() + " Failed to update record at " + r
                            + ". Reason: " + json.dumps(re))
                else:
                    logging.error(Utils.get_time() +
                                  " Failed to receive information about " + r)

    logging.info(Utils.get_time() + " Removing SSO Cookie")
    Utils.rm_file(CFG.cookie)
