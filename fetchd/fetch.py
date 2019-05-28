"""
Fetch script. Update database with changes in McM and Stats
"""
import json
import logging
import time
import sys
from utils import Config, Utils


def rename_attributes(index, data, config):
    """
    Rename given attributes of dictionary
    """
    if index == 'workflows':
        replacements = {'EventNumberHistory': 'event_number_history',
                        'OutputDatasets': 'output_datasets',
                        'PrepID': 'prepid',
                        'ProcessingString': 'processing_string',
                        'RequestName': 'request_name',
                        'RequestTransition': 'request_transition',
                        'RequestType': 'request_type',
                        'TotalEvents': 'total_events'}
    else:
        return data

    new_data = {}
    for key, value in data.items():
        new_data[replacements.get(key, key)] = value

    return new_data


def pick_attributes(dictionary, fields):
    """
    Remove all attributes that are not in fields array
    """
    parsed = {}
    for field in fields:
        if field in dictionary:
            parsed[field] = dictionary[field]

    return parsed


def parse_workflows_history(history):
    """Parse status history of reqmgr"""
    parsed = {}
    for history_entry in history:
        entry_time = history_entry['Time']
        datasets = history_entry['Datasets']
        for dataset_name, dataset_events in datasets.items():
            dataset_events['time'] = entry_time
            dataset_events['events'] = dataset_events['Events']
            dataset_events['type'] = dataset_events['Type']
            del dataset_events['Events']
            del dataset_events['Type']
            if dataset_name not in parsed:
                parsed[dataset_name] = []

            parsed[dataset_name].append(dataset_events)

    res = []
    for dataset_name, dataset_events in parsed.items():
        res.append({'dataset': dataset_name, 'history': dataset_events})

    return res


def parse_request_status_history(details):
    """Parse status history of reqmgr"""
    res = []
    for detail in details:
        try:
            pair = {}
            pair['name'] = detail['name']
            pair['history'] = detail['content']['pdmv_status_history_from_reqmngr']
            res.append(pair)
        except KeyError:
            continue

    return res


def parse_request_reqmgr_list(details):
    """Parse reqmgr_name"""
    res = []
    for detail in details:
        try:
            res.append(detail['name'])
        except KeyError:
            continue

    return res


def parse_request_history(details):
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

        if len(monitor):
            monitor['time'] = int(time.mktime(time.strptime(monitor['time'], '%Y-%m-%d-%H-%M')))
            res.append(monitor)

    return res


def create_index(cfg):
    """Create index"""
    index_url = cfg.pmp_index
    # Remove last / if it exists as the last character
    if index_url[-1:] == '/':
        index_url = index_url[:-1]

    _, code = Utils.curl('PUT', index_url, {})
    if code == 200:
        logging.info('Index created %s' % (index_url))
    else:
        logging.error('Index not created for %s. Code %s' % (index_url, code))

    _, code = Utils.curl('PUT', index_url + '/_settings', {'index' : {'max_result_window': 1000000}})
    if code == 200:
        logging.info('Result window increased for %s' % (index_url + '/_settings'))
    else:
        logging.error('Failed to increase result window for %s. Code %s' % (index_url + '/_settings', code))



def create_mapping(cfg):
    """Create mapping"""
    response, code = Utils.curl('PUT',
                                cfg.pmp_type + '_mapping',
                                json.loads(cfg.mapping))
    if code == 200:
        logging.info('Pushed mapping for %s' % (cfg.pmp_type))
    else:
        logging.error('Mapping not pushed. Reason (%s) %s' % (code, response))


def create_last_change_index():
    """Create mapping for last sequences"""
    last_seq_config = Config('last_seq')
    create_mapping(last_seq_config)


def get_last_sequence(cfg):
    last_seq = 0
    res, code = Utils.curl('GET', cfg.last_seq)
    if code == 200:
        last_seq = res['_source']['val']
        logging.info('Found last sequence: %s for %s' % (last_seq, cfg.last_seq))
    else:
        logging.warning('Cannot get last sequence for %s. Code: %s' % (cfg.last_seq, code))

    return last_seq


def get_changed_object_ids(cfg):
    """
    Changes since last update
    """
    last_seq = get_last_sequence(cfg)

    # get list of documents to fetch
    if last_seq is None:
        last_seq = 0

    results, code = Utils.curl('GET', '%s=%s' % (cfg.source_db_changes, last_seq), cookie=cfg.cookie)
    # logging.info('%s %s' % (results, code))
    last_seq = results['last_seq']
    results = results['results']

    _, index_http_code = Utils.curl('GET', cfg.pmp_index)
    if index_http_code != 200:
        logging.info('Index %s returned %s' % (cfg.pmp_index, index_http_code))
        create_index(cfg)
        # create mapping
        if cfg.mapping != '':
            create_mapping(cfg)

    if code == 200:
        if len(results):
            for record in results:
                yield record['id'], ('deleted' in record)

        else:
            logging.info('No changes since last update')

        r, code = Utils.curl('PUT',
                             cfg.last_seq, {'val': str(last_seq),
                                            'time': int(round(time.time() * 1000))})

        if code not in [200, 201]:
            logging.error('Cannot update last sequence. Code: %s Reason: %s' % (code, r))
        else:
            logging.info('Updated last sequence to %s' % (last_seq))

    else:
        logging.error('Status code %d while getting list of documents' % (code))


def save(object_id, data, cfg):
    try:
        response, status = Utils.curl('POST', '%s%s' % (cfg.pmp_type, object_id), data)
        if status in [200, 201]:
            logging.info('New record %s (%s)' % (object_id, cfg.pmp_type.split('/')[-2]))
        else:
            logging.error('Failed to update %s. Reason %s.' % (object_id, response))
    except Exception as ex:
        logging.error('Error saving %s. Error: %s' % (object_id, ex))


def create_rereco_request(stats_doc, rereco_cfg, process_string_cfg, rereco_campaigns_cfg):
    """
    Creates a request-like object from a given stats object
    """
    fake_request = {}
    fake_request['prepid'] = stats_doc['PrepID']
    fake_request['total_events'] = stats_doc['TotalEvents']
    fake_request['priority'] = stats_doc['RequestPriority']
    if len(stats_doc['Campaigns']) > 0:
        campaign = stats_doc['Campaigns'][0]
        if campaign:
            logging.info('Found campaign %s in %s' % (campaign, fake_request['prepid']))
            fake_request['member_of_campaign'] = campaign
            save(campaign, {'prepid': campaign}, rereco_campaigns_cfg)

    fake_request['output_dataset'] = stats_doc['OutputDatasets']
    fake_request['reqmgr_name'] = [stats_doc['_id']]
    fake_request['reqmgr_status_history'] = [{'name': stats_doc['_id'], 'history':[]}]
    fake_request['history'] = []

    # Translate ReqMgr2 statuses to McM-like statuses
    workflow_to_mcm_statuses = {
        'new': 'submitted',
        'announced': 'done'
    }
    for transition in stats_doc.get('RequestTransition', []):
        fake_request['reqmgr_status_history'][0]['history'].append(transition['status'])
        if transition['status'] in workflow_to_mcm_statuses:
            fake_request['history'].append({
                'action': workflow_to_mcm_statuses[transition['status']],
                'time': transition['update_time']
            })

    if len(fake_request.get('history', [])) > 0:
        fake_request['status'] = fake_request['history'][-1]['action']
    else:
        fake_request['status'] = 'unknown'

    fake_request['pwg'] = 'ReReco'
    processing_string = stats_doc.get('ProcessingString', None)
    if processing_string is not None:
        logging.info('Found processing string %s in %s' % (processing_string, fake_request['prepid']))
        fake_request['processing_string'] = processing_string
        save(processing_string, {'prepid': processing_string}, process_string_cfg)

    save(fake_request['prepid'], fake_request, rereco_cfg)


def create_relval_request(stats_doc, relval_cfg, relval_cmssw_cfg, relval_campaigns_cfg):
    """
    Creates a request-like object from a given stats object
    """
    fake_request = {}
    fake_request['prepid'] = stats_doc['PrepID']
    fake_request['total_events'] = stats_doc['TotalEvents']
    fake_request['priority'] = stats_doc['RequestPriority']
    if len(stats_doc['Campaigns']) > 0:
        campaign = stats_doc['Campaigns'][0]
        if campaign:
            logging.info('Found campaign %s in %s' % (campaign, fake_request['prepid']))
            fake_request['member_of_campaign'] = campaign
            save(campaign, {'prepid': campaign}, relval_campaigns_cfg)

    fake_request['output_dataset'] = stats_doc['OutputDatasets']
    fake_request['reqmgr_name'] = [stats_doc['_id']]
    fake_request['reqmgr_status_history'] = [{'name': stats_doc['_id'], 'history':[]}]
    fake_request['history'] = []

    # Translate ReqMgr2 statuses to McM-like statuses
    workflow_to_mcm_statuses = {
        'new': 'submitted',
        'announced': 'done'
    }
    for transition in stats_doc.get('RequestTransition', []):
        fake_request['reqmgr_status_history'][0]['history'].append(transition['status'])
        if transition['status'] in workflow_to_mcm_statuses:
            fake_request['history'].append({
                'action': workflow_to_mcm_statuses[transition['status']],
                'time': transition['update_time']
            })

    if len(fake_request.get('history', [])) > 0:
        fake_request['status'] = fake_request['history'][-1]['action']
    else:
        fake_request['status'] = 'unknown'

    fake_request['pwg'] = 'RelVal'
    cmssw_version = stats_doc.get('CMSSWVersion', None)
    if cmssw_version is not None:
        logging.info('Found CMSSW version %s in %s' % (cmssw_version, fake_request['prepid']))
        fake_request['cmssw_version'] = cmssw_version
        save(cmssw_version, {'prepid': cmssw_version}, relval_cmssw_cfg)

    save(fake_request['prepid'], fake_request, relval_cfg)


def is_excluded_rereco(stats_doc):
    """
    Returns true if the given object is to be excluded from the ReReco requests index
    """
    if stats_doc is None:
        logging.error('Stats document is None. How?!')

    if stats_doc.get('PrepID', '') in ['', 'None']:
        return True

    # Fall through
    return False


def process_request_tags(tags, tags_cfg):
    """
    Get list of tags and save them
    """
    for tag in tags:
        save(tag, {'prepid': tag}, tags_cfg)


if __name__ == "__main__":
    Utils.setup_console_logging()
    index = sys.argv[1]
    logging.info('Starting %s' % (index))
    cfg = Config(index)

    if index == 'workflows':
        rereco_cfg = Config('rereco_requests')
        process_string_cfg = Config('processing_strings')
        rereco_campaigns_cfg = Config('rereco_campaigns')
        relval_cfg = Config('relval_requests')
        relval_cmssw_cfg = Config('relval_cmssw_versions')
        relval_campaigns_cfg = Config('relval_campaigns')
        skippable_status = set(['rejected',
                                'aborted',
                                'failed',
                                'rejected-archived',
                                'aborted-archived',
                                'failed-archived',
                                'aborted-completed'])
    elif index == 'requests':
        tags_cfg = Config('tags')
        ppd_tags_cfg = Config('ppd_tags')
        dataset_cfg = Config('mcm_dataset_name')

    done = 0
    for object_id, deleted in get_changed_object_ids(cfg):
        time.sleep(0.05)
        done += 1

        logging.info('(%s) Processing %s. Deleted %s' % (done, object_id, 'YES' if deleted else 'NO'))
        if object_id not in cfg.exclude_list:
            if not deleted:
                # If it's not deleted, fetch it
                thing_url = str(cfg.source_db + object_id)
                data, status = Utils.curl('GET', thing_url, cookie=cfg.cookie, return_error=True)

            if not deleted and index == 'workflows':
                # Check maybe it was rejected or aborted. If yes, delete it
                for transition in data.get('RequestTransition', []):
                    if transition.get('Status') in skippable_status:
                        logging.info('%s will be deleted because it has %s in it\'s history' % (object_id, transition.get('Status')))
                        deleted = True
                        break

            if deleted:
                if index == 'workflows':
                    # Try to delete it from ReReco index (maybe it's ReReco request)
                    data, _ = Utils.curl('GET', cfg.pmp_type + object_id)
                    prepid = data.get('RequestPrepid')
                    if prepid:
                        logging.info('Trying to delete %s as ReReco' % (prepid))
                        _, status = Utils.curl('DELETE', rereco_cfg.pmp_type + prepid)
                        if status == 200:
                            logging.info('Deleted ReReco request %s' % (object_id))

                        logging.info('Trying to delete %s as RelVal' % (prepid))
                        _, status = Utils.curl('DELETE', relval_cfg.pmp_type + prepid)
                        if status == 200:
                            logging.info('Deleted RelVal request %s' % (object_id))

                # Delete it normally
                _, status = Utils.curl('DELETE', '%s%s' % (cfg.pmp_type, object_id))
                if status == 200:
                    logging.info('Deleted %s (%s)' % (object_id, index))
                elif status != 404:
                    logging.error('Record %s (%s) was not deleted. Code: %s' % (object_id, index, status))
            else:
                # It was not deleted, so it was added or modified
                if status == 200:
                    if index == 'workflows':
                        # Make transition keys lowercase
                        data['RequestTransition'] = [{'status': x['Status'], 'update_time': x['UpdateTime']} for x in data['RequestTransition']]
                        request_type = data.get('RequestType', '')
                        request_name = data.get('RequestName', '')
                        request_prepid = data.get('PrepID', '')
                        if request_type and request_type.lower() == 'rereco' and not is_excluded_rereco(data):
                            logging.info('Creating mock ReReco request for %s' % (object_id))
                            create_rereco_request(data, rereco_cfg, process_string_cfg, rereco_campaigns_cfg)
                        elif request_name and '_rvcmssw_' in request_name.lower() and request_prepid and 'cmssw_' in request_prepid.lower():
                            logging.info('Creating mock RelVal request for %s' % (object_id))
                            create_relval_request(data, relval_cfg, relval_cmssw_cfg, relval_campaigns_cfg)

                        data['EventNumberHistory'] = parse_workflows_history(data['EventNumberHistory'])
                    elif index == 'requests':
                        if 'reqmgr_name' in data:
                            data['reqmgr_status_history'] = parse_request_status_history(data['reqmgr_name'])
                            data['reqmgr_name'] = parse_request_reqmgr_list(data['reqmgr_name'])
                        else:
                            data['reqmgr_status_history'] = []
                            data['reqmgr_name'] = []

                        if 'history' in data:
                            data['history'] = parse_request_history(data['history'])
                        else:
                            data['history'] = []

                        if 'tags' in data:
                            process_request_tags(data['tags'], tags_cfg)
                        else:
                            data['tags'] = []

                        if 'ppd_tags' in data:
                            process_request_tags(data['ppd_tags'], ppd_tags_cfg)
                        else:
                            data['ppd_tags'] = []

                        if data.get('dataset_name'):
                            save(data['dataset_name'], {'prepid': data['dataset_name']}, dataset_cfg)
                        else:
                            data['dataset_name'] = None

                    # Trim fields we don't want
                    data = pick_attributes(data, cfg.fetch_fields)
                    data = rename_attributes(index, data, cfg)
                    # Save to local Elasticsearch index
                    save(object_id, data, cfg)
                else:
                    logging.error('Failed to receive information about %s (%s)' % (object_id, index))

    logging.info('Finished %s' % (index))
