"""
Fetch script. Update database with changes in McM and Stats
"""
import json
import logging
import time
import sys
from utils import Config, Utils


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
            dataset_events['Time'] = entry_time
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

        if len(monitor.keys()):
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


def get_changed_things(cfg):
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

        _, code = Utils.curl('PUT',
                             cfg.last_seq, json.loads('{"val":"%s", "time":%s}' % (last_seq, int(round(time.time() * 1000)))))

        if code not in [200, 201]:
            logging.error('Cannot update last sequence')
        else:
            logging.info('Updated last sequence to %s' % (last_seq))

    else:
        logging.error('Status code %d while getting list of documents' % (code))


def save(object_id, data, cfg):
    response, status = Utils.curl('POST', '%s%s' % (cfg.pmp_type, object_id), data)
    if status in [200, 201]:
        logging.info('New record %s (%s)' % (object_id, cfg.pmp_type.replace('/', '')))
    else:
        logging.error('Failed to update %s. Reason %s.' % (object_id, response))


def create_rereco_request(stats_doc, rereco_cfg, process_string_cfg):
    """
    Creates a request-like object from a given stats object
    """
    fake_request = {}
    fake_request['prepid'] = stats_doc['PrepID']
    fake_request['total_events'] = stats_doc['TotalEvents']
    fake_request['priority'] = stats_doc['RequestPriority']
    if len(stats_doc['Campaigns']) > 0:
        fake_request['member_of_campaign'] = stats_doc['Campaigns'][0]

    fake_request['output_dataset'] = stats_doc['OutputDatasets']
    if len(stats_doc.get('RequestTransition', [])) > 0:
        fake_request['status'] = stats_doc['RequestTransition'][-1]['Status']
    else:
        fake_request['status'] = 'unknown'

    fake_request['reqmgr_name'] = [stats_doc['_id']]
    processing_string = stats_doc.get('ProcessingString', None)
    if processing_string is not None and type(processing_string) is str:
        fake_request['processing_string'] = processing_string
        save(processing_string, {'prepid': processing_string}, process_string_cfg)

    save(fake_request['prepid'], fake_request, rereco_cfg)


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

    if index == 'requests':
        tags_cfg = Config('tags')

    done = 0
    for thing_name, deleted in get_changed_things(cfg):
        done += 1
        logging.info('(%s) Processing %s. Deleted %s' % (done, thing_name, 'YES' if deleted else 'NO'))
        if thing_name not in cfg.exclude_list:
            if deleted:
                if index == 'workflows':
                    # Try to delete it from ReReco index (maybe it's ReReco request?)
                    _, status = Utils.curl('DELETE', rereco_cfg.pmp_type + thing_name)
                    if status == 200:
                        logging.info('Deleted ReReco request %s' % (thing_name))
                    elif status != 404:  # 404 just means it's not a ReReco request
                        logging.warning('Code %s while deleting %s from ReReco index' % (status, thing_name))

                # Delete it normally
                _, status = Utils.curl('DELETE', '%s%s' % (cfg.pmp_type, thing_name))
                if status == 200:
                    logging.info('Deleted %s (%s)' % (thing_name, index))
                elif status != 404:
                    logging.error('Record %s (%s) was not deleted. Code: %s' % (thing_name, index, status))
            else:
                thing_url = str(cfg.source_db + thing_name)
                data, status = Utils.curl('GET', thing_url, cookie=cfg.cookie, return_error=True)
                if status == 200:
                    if index == 'workflows':
                        data['EventNumberHistory'] = parse_workflows_history(data['EventNumberHistory'])
                        request_type = data.get('RequestType', '')
                        # Is it a ReReco request created in Oct 2015 or later?
                        if request_type.lower() == 'rereco' and not is_excluded_rereco(data):
                            logging.info('Creating mock ReReco request for %s' % (thing_name))
                            create_rereco_request(data, rereco_cfg, process_string_cfg)

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

                    # Trim fields we don't want
                    data = pick_attributes(data, cfg.fetch_fields)

                    # Save to local stats ES index
                    re, s = Utils.curl('POST', '%s%s' % (cfg.pmp_type, thing_name), data)
                    if s in [200, 201]:
                        logging.info('New record %s (%s)' % (thing_name, index))
                    else:
                        logging.error('Failed to update record %s (%s). Reason: %s' % (thing_name, index, re))
                else:
                    logging.error('Failed to receive information about %s (%s)' % (thing_name, index))

    logging.info('Finished %s' % (index))
