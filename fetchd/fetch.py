"""
Fetch script. Update database with changes in McM and Stats
"""
import json
import logging
import time
import sys
from utils import Config, Utils
from search_engine import search_engine


changed_during_update = []

# Use persistent HTTP connections
http: Utils = Utils()


def rename_attributes(index, data, config):
    """
    Rename given attributes of dictionary
    """
    if index == "workflows":
        replacements = {
            "EventNumberHistory": "event_number_history",
            "OutputDatasets": "output_datasets",
            "PrepID": "prepid",
            "ProcessingString": "processing_string",
            "RequestName": "request_name",
            "RequestTransition": "request_transition",
            "RequestType": "request_type",
            "TotalEvents": "total_events",
        }
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
        entry_time = history_entry["Time"]
        datasets = history_entry["Datasets"]
        for dataset_name, dataset_events in datasets.items():
            dataset_events["time"] = entry_time
            dataset_events["events"] = dataset_events["Events"]
            dataset_events["type"] = dataset_events["Type"]
            del dataset_events["Events"]
            del dataset_events["Type"]
            if dataset_name not in parsed:
                parsed[dataset_name] = []

            parsed[dataset_name].append(dataset_events)

    res = []
    for dataset_name, dataset_events in parsed.items():
        res.append({"dataset": dataset_name, "history": dataset_events})

    return res


def parse_request_status_history(details):
    """Parse status history of reqmgr"""
    res = []
    for detail in details:
        try:
            pair = {}
            pair["name"] = detail["name"]
            pair["history"] = detail["content"]["pdmv_status_history_from_reqmngr"]
            res.append(pair)
        except KeyError:
            continue

    return res


def parse_request_reqmgr_list(details):
    """Parse reqmgr_name"""
    res = []
    for detail in details:
        try:
            res.append(detail["name"])
        except KeyError:
            continue

    res = sorted(res, key=lambda k: "_".join(k.split("_")[-3:]))
    return res


def parse_request_history(details):
    """Parse history field"""
    res = []
    for index, detail in enumerate(details):
        monitor = {}
        if not index:
            monitor["action"] = "created"
            if "updater" in detail:
                monitor["time"] = detail["updater"]["submission_date"]
            else:
                monitor["time"] = detail["time"]

        elif detail["action"] == "set status" and detail["step"] in [
            "approved",
            "submitted",
            "validation",
            "done",
        ]:
            monitor["action"] = detail["step"]
            monitor["time"] = detail["updater"]["submission_date"]

        if len(monitor):
            monitor["time"] = int(
                time.mktime(time.strptime(monitor["time"], "%Y-%m-%d-%H-%M"))
            )
            res.append(monitor)

    return res


def parse_datatiers_from_sequences(sequences):
    """
    Get list of all datatiers of a request sequence list
    """
    datatiers = []
    if not sequences:
        return datatiers

    for sequence in sequences:
        datatier = sequence.get("datatier", [])
        if isinstance(datatier, str):
            datatier = [datatier]

        for one_datatier in datatier:
            for split_datatier in one_datatier.split(","):
                if split_datatier.strip():
                    datatiers.append(split_datatier.strip())

    return list(set(datatiers))


def create_index(cfg):
    """Create index"""
    index_url = cfg.pmp_index
    # Remove last / if it exists as the last character
    if index_url[-1:] == "/":
        index_url = index_url[:-1]

    _, code = http.curl("PUT", index_url, {}, return_error=True)
    if code == 200:
        logging.info("Index created %s" % (index_url))
    else:
        logging.error("Index not created for %s. Code %s" % (index_url, code))

    _, code = http.curl(
        "PUT",
        index_url + "/_settings",
        {"index": {"max_result_window": 1000000}},
        return_error=True,
    )
    if code == 200:
        logging.info("Result window increased for %s" % (index_url + "/_settings"))
    else:
        logging.error(
            "Failed to increase result window for %s. Code %s"
            % (index_url + "/_settings", code)
        )


def create_index_and_mapping_if_needed(cfg):
    index_url = cfg.pmp_index
    # Remove last / if it exists as the last character
    if index_url[-1:] == "/":
        index_url = index_url[:-1]

    _, code = http.curl("GET", index_url, return_error=True)
    if code != 200:
        create_index(cfg)
        create_mapping(cfg)


def create_mapping(cfg):
    """Create mapping"""
    response, code = http.curl(
        "PUT", cfg.pmp_type + "_mapping", json.loads(cfg.mapping), return_error=True
    )
    if code == 200:
        logging.info("Pushed mapping for %s" % (cfg.pmp_type))
    else:
        logging.error("Mapping not pushed. Reason (%s) %s" % (code, response))


def create_last_change_index():
    """Create mapping for last sequences"""
    last_seq_config = Config("last_seq")
    create_mapping(last_seq_config)


def get_last_sequence(cfg):
    last_seq = 0
    res, code = http.curl("GET", cfg.last_seq, return_error=True)
    if code == 200:
        last_seq = res["_source"]["val"]
        logging.info("Found last sequence: %s for %s" % (last_seq, cfg.last_seq))
    else:
        logging.warning(
            "Cannot get last sequence for %s. Code: %s" % (cfg.last_seq, code)
        )

    return last_seq


def get_changed_object_ids(cfg):
    """
    Changes since last update
    """
    last_seq = get_last_sequence(cfg)

    # get list of documents to fetch
    if last_seq is None:
        last_seq = 0

    results, code = http.curl(
        "GET", "%s=%s" % (cfg.source_db_changes, last_seq), return_error=True
    )
    # logging.info('%s %s' % (results, code))
    last_seq = results["last_seq"]
    results = results["results"]

    _, index_http_code = http.curl("GET", cfg.pmp_index, return_error=True)
    if index_http_code != 200:
        logging.info("Index %s returned %s" % (cfg.pmp_index, index_http_code))
        create_index(cfg)
        # create mapping
        if cfg.mapping != "":
            create_mapping(cfg)

    if code == 200:
        if len(results):
            for record in results:
                yield record["id"], ("deleted" in record)

            for object_id in changed_during_update:
                yield object_id, False

        else:
            logging.info("No changes since last update")

        r, code = http.curl(
            "PUT",
            cfg.last_seq,
            {"val": str(last_seq), "time": int(round(time.time() * 1000))},
            return_error=True,
        )

        if code not in [200, 201]:
            logging.error(
                "Cannot update last sequence. Code: %s Reason: %s" % (code, r)
            )
        else:
            logging.info("Updated last sequence to %s" % (last_seq))

    else:
        logging.error("Status code %d while getting list of documents" % (code))


def save(object_id, data, cfg):
    try:
        response, status = http.curl(
            "POST", "%s%s" % (cfg.pmp_type, object_id), data, return_error=True
        )
        if status in [200, 201]:
            logging.info("Saved %s (%s)" % (object_id, cfg.pmp_type.split("/")[-2]))
        else:
            logging.error("Failed to update %s. Reason %s." % (object_id, response))
    except Exception as ex:
        logging.error("Error saving %s. Error: %s" % (object_id, ex))


def create_fake_request(stats_doc, cfg):
    """
    Creates or updates a request-like object from a given stats object
    """
    prepid = stats_doc["PrepID"]
    workflow_name = stats_doc["RequestName"]
    fake_request, _ = http.curl("GET", cfg.pmp_type + prepid)
    fake_request = fake_request.get("_source")
    if not fake_request:
        logging.info("Creating new request %s" % (prepid))
        fake_request = {}
        fake_request["prepid"] = stats_doc["PrepID"]
        fake_request["reqmgr_name"] = []
        fake_request["reqmgr_status_history"] = []
        fake_request["history"] = []
    else:
        logging.info("Editing existing request %s" % (prepid))

    if workflow_name not in fake_request["reqmgr_name"]:
        fake_request["reqmgr_name"].append(workflow_name)
        fake_request["reqmgr_name"] = sorted(
            fake_request["reqmgr_name"], key=lambda wf: "_".join(wf.split("_")[-3:])
        )

    if workflow_name == fake_request["reqmgr_name"][-1]:
        # If this is the newest workflow, update things
        fake_request["total_events"] = stats_doc["TotalEvents"]
        fake_request["priority"] = stats_doc["RequestPriority"]
        if len(stats_doc["Campaigns"]) > 0:
            campaign = stats_doc["Campaigns"][0]
            if campaign:
                logging.info(
                    "Found campaign %s in %s" % (campaign, fake_request["prepid"])
                )
                fake_request["member_of_campaign"] = campaign

        fake_request["output_dataset"] = stats_doc["OutputDatasets"]
        # Translate ReqMgr2 statuses to McM-like statuses
        workflow_to_mcm_statuses = {"new": "submitted", "announced": "done"}
        fake_request["history"] = []
        # Fake requests history from transitions
        for transition in stats_doc.get("RequestTransition", []):
            if transition["status"] in workflow_to_mcm_statuses:
                mcm_status = workflow_to_mcm_statuses[transition["status"]]
                update_time = transition["update_time"]
                fake_request["history"].append(
                    {"action": mcm_status, "time": update_time}
                )

        fake_request["history"] = sorted(
            fake_request["history"], key=lambda e: e["time"]
        )
        if len(fake_request.get("history", [])) > 0:
            fake_request["status"] = fake_request["history"][-1]["action"]
        else:
            fake_request["status"] = "unknown"

    # Make transition history for the stats document
    new_transition_history = []
    for transition in stats_doc.get("RequestTransition", []):
        new_transition_history.append(transition["status"])

    # Delete existing transition history for current stats document
    fake_request["reqmgr_status_history"] = [
        entry
        for entry in fake_request["reqmgr_status_history"]
        if entry["name"] != workflow_name
    ]
    fake_request["reqmgr_status_history"].append(
        {"name": stats_doc["_id"], "history": new_transition_history}
    )

    return fake_request


def create_rereco_request(
    stats_doc, rereco_cfg, process_string_cfg, rereco_campaigns_cfg
):
    """
    Creates or updates a request-like ReReco object from a given stats object
    """
    fake_request = create_fake_request(stats_doc, rereco_cfg)
    fake_request["pwg"] = "ReReco"
    fake_request["interested_pwg"] = ["ReReco"]
    campaign = fake_request.get("member_of_campaign", None)
    if campaign:
        save(campaign, {"prepid": campaign}, rereco_campaigns_cfg)

    processing_string = stats_doc.get("ProcessingString", None)
    if processing_string is not None:
        logging.info(
            "Found processing string %s in %s"
            % (processing_string, fake_request["prepid"])
        )
        fake_request["processing_string"] = processing_string
        save(processing_string, {"prepid": processing_string}, process_string_cfg)

    save(fake_request["prepid"], fake_request, rereco_cfg)


def create_relval_request(
    stats_doc, relval_cfg, relval_cmssw_cfg, relval_campaigns_cfg
):
    """
    Creates or updates a request-like RelVal object from a given stats object
    """
    fake_request = create_fake_request(stats_doc, relval_cfg)
    fake_request["pwg"] = "RelVal"
    fake_request["interested_pwg"] = ["RelVal"]
    campaign = fake_request.get("member_of_campaign", None)
    if campaign:
        save(campaign, {"prepid": campaign}, relval_campaigns_cfg)

    cmssw_version = stats_doc.get("CMSSWVersion", None)
    if cmssw_version is not None:
        logging.info(
            "Found CMSSW version %s in %s" % (cmssw_version, fake_request["prepid"])
        )
        fake_request["cmssw_version"] = cmssw_version
        save(cmssw_version, {"prepid": cmssw_version}, relval_cmssw_cfg)

    save(fake_request["prepid"], fake_request, relval_cfg)


def delete_workflow_from_request(cfg, workflow_name):
    index = cfg.pmp_index.strip("/").split("/")[-1]
    es = search_engine.client
    search_results = es.search(q="reqmgr_name:%s" % (workflow_name), index=index)[
        "hits"
    ]["hits"]
    prepids = [s["_source"]["prepid"] for s in search_results]
    for prepid in prepids:
        request, _ = http.curl("GET", cfg.pmp_type + prepid)
        request = request.get("_source")
        if request:
            request["reqmgr_name"] = [
                name for name in request["reqmgr_name"] if name != workflow_name
            ]
            request["reqmgr_status_history"] = [
                entry
                for entry in request["reqmgr_status_history"]
                if entry["name"] != workflow_name
            ]
            if len(request["reqmgr_name"]) == 0:
                logging.info("Deleting %s" % (prepid))
                # Delete it normally
                _, status = http.curl(
                    "DELETE", "%s%s" % (cfg.pmp_type, prepid), return_error=True
                )
                if status == 200:
                    logging.info("Deleted %s (%s)" % (prepid, index))
                elif status != 404:
                    logging.error(
                        "Record %s (%s) was not deleted. Code: %s"
                        % (prepid, index, status)
                    )
            else:
                new_reqmgr_name = request["reqmgr_name"][-1]
                changed_during_update.append(new_reqmgr_name)
                if workflow_name in changed_during_update:
                    changed_during_update.remove(workflow_name)

                save(prepid, request, cfg)


def is_excluded_rereco(stats_doc):
    """
    Returns true if the given object is to be excluded from the ReReco requests index
    """
    if stats_doc is None:
        logging.error("Stats document is None. How?!")

    if stats_doc.get("PrepID", "") in ["", "None"]:
        logging.info(
            '%s will not be added to ReRecos because it\'s prepid is "%s"'
            % (stats_doc.get("_id"), stats_doc.get("PrepID"))
        )
        return True

    if stats_doc.get("RequestType", "").lower() == "resubmission":
        logging.info(
            "%s is Resubmission so it will not be added to ReRecos"
            % (stats_doc.get("RequestName"))
        )
        return True

    # Fall through
    return False


def process_request_tags(tags, tags_cfg):
    """
    Get list of tags and save them
    """
    for tag in tags:
        save(tag, {"prepid": tag}, tags_cfg)


def process_request_datatiers(datatiers, datatiers_cfg):
    """
    Get list of datatiers and save them
    """
    for datatier in datatiers:
        save(datatier, {"prepid": datatier}, datatiers_cfg)


if __name__ == "__main__":
    Utils.setup_console_logging()
    index = sys.argv[1]
    logging.info("Starting %s" % (index))
    cfg = Config(index)

    if index == "workflows":
        rereco_cfg = Config("rereco_requests")
        process_string_cfg = Config("processing_strings")
        rereco_campaigns_cfg = Config("rereco_campaigns")
        relval_cfg = Config("relval_requests")
        relval_cmssw_cfg = Config("relval_cmssw_versions")
        relval_campaigns_cfg = Config("relval_campaigns")
        for related_cfg in [
            rereco_cfg,
            process_string_cfg,
            rereco_campaigns_cfg,
            relval_cfg,
            relval_cmssw_cfg,
            relval_campaigns_cfg,
        ]:
            create_index_and_mapping_if_needed(related_cfg)

        skippable_status = set(
            [
                "rejected",
                "aborted",
                "failed",
                "rejected-archived",
                "aborted-archived",
                "failed-archived",
                "aborted-completed",
            ]
        )
    elif index == "requests":
        tags_cfg = Config("tags")
        ppd_tags_cfg = Config("ppd_tags")
        dataset_cfg = Config("mcm_dataset_name")
        datatiers_cfg = Config("mcm_datatiers")
        for related_cfg in [tags_cfg, ppd_tags_cfg, dataset_cfg, datatiers_cfg]:
            create_index_and_mapping_if_needed(related_cfg)

    done = 0
    for object_id, deleted in get_changed_object_ids(cfg):
        # Sleep for 1 milisecond
        time.sleep(0.001)
        done += 1
        if index == "workflows" and object_id.startswith("_design/"):
            continue

        logging.info(
            "(%s) Processing %s. Deleted %s"
            % (done, object_id, "YES" if deleted else "NO")
        )
        if object_id not in cfg.exclude_list:
            if not deleted:
                # If it's not deleted, fetch it
                thing_url = str(cfg.source_db + object_id)
                data, status = http.curl("GET", thing_url, return_error=True)

            if not deleted and index == "workflows":
                # Check maybe it was rejected or aborted. If yes, delete it
                for transition in data.get("RequestTransition", []):
                    if transition.get("Status") in skippable_status:
                        logging.info(
                            "%s will be deleted because it has %s in it's history"
                            % (object_id, transition.get("Status"))
                        )
                        deleted = True
                        break

            if deleted:
                if index == "workflows":
                    # Try to delete it from ReReco and RelVal index
                    delete_workflow_from_request(rereco_cfg, object_id)
                    delete_workflow_from_request(relval_cfg, object_id)

                # Delete it normally
                _, status = http.curl(
                    "DELETE", "%s%s" % (cfg.pmp_type, object_id), return_error=True
                )
                if status == 200:
                    logging.info("Deleted %s (%s)" % (object_id, index))
                elif status != 404:
                    logging.error(
                        "Record %s (%s) was not deleted. Code: %s"
                        % (object_id, index, status)
                    )
            else:
                # It was not deleted, so it was added or modified
                if status == 200:
                    if index == "workflows":
                        # Make transition keys lowercase
                        data["RequestTransition"] = [
                            {"status": x["Status"], "update_time": x["UpdateTime"]}
                            for x in data["RequestTransition"]
                        ]
                        request_type = data.get("RequestType", "")
                        request_name = data.get("RequestName", "")
                        request_prepid = data.get("PrepID", "")
                        if (
                            (request_type and request_type.lower() == "rereco")
                            or (
                                request_prepid
                                and request_prepid.lower().startswith("rereco-")
                            )
                        ) and not is_excluded_rereco(data):
                            logging.info(
                                "Creating mock ReReco request for %s" % (object_id)
                            )
                            create_rereco_request(
                                data,
                                rereco_cfg,
                                process_string_cfg,
                                rereco_campaigns_cfg,
                            )
                        elif (
                            request_name
                            and "_rvcmssw_" in request_name.lower()
                            and request_prepid
                            and "cmssw_" in request_prepid.lower()
                        ):
                            logging.info(
                                "Creating mock RelVal request for %s" % (object_id)
                            )
                            create_relval_request(
                                data, relval_cfg, relval_cmssw_cfg, relval_campaigns_cfg
                            )

                        data["EventNumberHistory"] = parse_workflows_history(
                            data["EventNumberHistory"]
                        )
                    elif index == "requests":
                        if "reqmgr_name" in data:
                            data[
                                "reqmgr_status_history"
                            ] = parse_request_status_history(data["reqmgr_name"])
                            data["reqmgr_name"] = parse_request_reqmgr_list(
                                data["reqmgr_name"]
                            )
                        else:
                            data["reqmgr_status_history"] = []
                            data["reqmgr_name"] = []

                        if "history" in data:
                            data["history"] = parse_request_history(data["history"])
                        else:
                            data["history"] = []

                        if "tags" in data:
                            process_request_tags(data["tags"], tags_cfg)
                        else:
                            data["tags"] = []

                        if "ppd_tags" in data:
                            process_request_tags(data["ppd_tags"], ppd_tags_cfg)
                        else:
                            data["ppd_tags"] = []

                        if "interested_pwg" in data:
                            interested_pwg = [
                                x.strip().upper()
                                for x in data.get("interested_pwg", [])
                                if x.strip()
                            ]
                            interested_pwg = sorted(list(set(interested_pwg)))
                            data["interested_pwg"] = interested_pwg
                        else:
                            data["interested_pwg"] = [data["prepid"].split("-")[0]]

                        if data.get("dataset_name"):
                            save(
                                data["dataset_name"],
                                {"prepid": data["dataset_name"]},
                                dataset_cfg,
                            )
                        else:
                            data["dataset_name"] = None

                        if "sequences" in data:
                            datatiers = parse_datatiers_from_sequences(
                                data["sequences"]
                            )
                            data["datatiers"] = datatiers
                            process_request_datatiers(datatiers, datatiers_cfg)
                        else:
                            data["datatiers"] = []

                    # Trim fields we don't want
                    data = pick_attributes(data, cfg.fetch_fields)
                    data = rename_attributes(index, data, cfg)
                    # Save to local index
                    save(object_id, data, cfg)
                else:
                    logging.error(
                        "Failed to receive information about %s (%s)"
                        % (object_id, index)
                    )

    logging.info("Finished %s" % (index))
