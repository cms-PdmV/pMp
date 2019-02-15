# Production Monitoring Platform (pMp)

## pMp
pMp stands for Production Monitoring Platform. pMp provides monitoring of the Monte Carlo requests production, ReReco production.

## Contributors
The original code is based on Igor Jurkowski and Jean-Roch Vlimant contributions. Further developed by Adrian Alan Pol, Antanas Norkus, Giovanni Franzoni and Jacob Walker. Second Edition is done by Justinas Rumsevicius.

## Database structure
All data is taken from McM and Stats service and stored in pMp's Elasticsearch index.

### Dataset Names
Index - `mcm_dataset_names`, document type - `mcm_dataset_name`

### Requests
Index - `requests`, document type - `request`

* dataset_name - name of dataset from McM
* flown_with - name of flow that request is associated with
* history - list of dictionaries that have keys 'action' (value is string) and 'time' (value is int - unix timestamp) that represent actions as they appear in McM ('created', 'approved', 'submitted', 'done', etc.)
* member_of_campaign - name of campaign that this request is member of
* member_of_chain - list of chained requests that this request is member of
* output_dataset - list of datasets that this request will produce. Only last one is used
* prepid - prepid of request
* priority - priority of request as it appears in McM. Note that workflow priority of resubmissions may be higher
* pwg - physics working group of request
* reqmgr_name - list of workflow names associated with this request
* reqmgr_status_history - list of dictionaries that have keys 'history' (value is list) and 'name' (value is string). 'history' contain list of workflow statuses from ReqMgr2 ('new', 'assignment-approved', 'announced', etc). 'name' is workflow name.
* status - 'action' of last record in 'history' of request ('submitted', 'done', etc.)
* tags - list of tags that request has. They must be added as separate records to `tags/tag` 
* time_event - list of numbers that represent time per event for request sequences
* total_events - number of total events of request

### Campaigns
Index - `campaigns`, document type - `campaign`

* prepid - prepid of campaign

### Chained campaigns
Index - `chained_campaigns`, document type - `chained_campaign`

* campaigns - list of lists of two elements in which first element shows campaign and second one shows flow
* prepid - prepid of chained campaign

### Flows
Index - `flows`, document type - `flow`

* prepid - prepid of flow

### Tags
Index - `tags`, document type - `tag`
Tags come only from McM requests

* prepid - tag itself

### PPD Tags

### Processing strings
Index - `processing_strings`, document type - `processing_strings`
Processing strings come only from ReReco requests

* prepid - processing string itself

### RelVal Requests

### ReReco Requests
Index - `rereco_requests`, document type - `rereco_request`

ReReco requests are a special case as they do not appear in McM as normal requests. Information about them is pulled only from Stats2. They are created from Stats2 workflows so they would appear and have structure of a normal request with a few exceptions such as tags replaced by processing strings, no flow, no tags, no time per event and no member of chain.

* history - list of dictionaries that have keys 'action' (value is string) and 'time' (value is int - unix timestamp) that represent actions as they *would* appear in McM ('submitted', 'done'). This is taken from 'reqmgr_status_hisotory' and 'new' in ReqMgr2 will be 'submitted', 'announced' will be 'done'.
* member_of_campaign - name of campaign that this request is member of
* output_dataset - list of datasets that this request will produce. Only last one is used
* prepid - prepid of rereco request
* priority - priority of request's workflow in ReqMgr2
* processing_string - processing string of a request
* pwg - constant value 'ReReco'
* reqmgr_name - list of workflow names associated with this request
* reqmgr_status_history - list of dictionaries that have keys 'history' (value is list) and 'name' (value is string). 'history' contain list of workflow statuses from ReqMgr2 ('new', 'assignment-approved', 'announced', etc). 'name' is workflow name.
* status - 'action' of last record in 'history' of request ('submitted', 'done', etc.)
* total_events - number of total events of request

### Workflows
Index - `workflows`, document type - `workflow`

* event_number_history - list of dictionaries. Each dictionary has 'dataset' (value is string) and 'history' (value is list). Each history list entry is a dictionary that has 'events' (value is int), 'time' (value is int - unix timestamp) and 'type' (value is string). 'events' show number of events at 'time' time and 'type' shows dataset status at given 'time' ('NONE', 'PRODUCTION', 'VALID')
* output_datasets - list of output datasets
* prepid - workflow prepid
* processing_string - processing string. It must be added as a separate record to `processing_strings/processing_string`
* request_name - workflow name
* request_transition - list of dictionaries that have keys 'status' (value is string) and 'time' (value is int - unix timestamp). Status changes from ReqMgr2 ('new', 'assignment-approved', 'announced', etc).
* request_type - request type ('TaskChain', 'Resubmission', 'ReReco', etc.)
* total_events - number of expected events

## Search in pMp

## Present Statistics

### Announced Mode

### Growing Mode

### Display Chains

## Historical Statistics

## Performance Statistics