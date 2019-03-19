# Production Monitoring Platform (pMp)

## pMp
pMp stands for Production Monitoring Platform. pMp provides monitoring of the Monte Carlo requests production, ReReco production.

## Contributors
The original code is based on Igor Jurkowski and Jean-Roch Vlimant contributions. Further developed by Adrian Alan Pol, Antanas Norkus, Giovanni Franzoni and Jacob Walker. Second Edition is done by Justinas Rumsevicius.

## Database structure
All data is taken from McM and Stats service and stored in pMp's Elasticsearch index.
Below is structure of objects kept in Elasticsearch. 

### Campaigns
Index - `campaigns`.
Document type - `campaign`.
Source - campaigns are fetched from McM.

##### Attributes:

* prepid - prepid of campaign

### Chained Campaigns
Index - `chained_campaigns`.
Document type - `chained_campaign`.
Source - chained campaigns are fetched from McM.

##### Attributes:

* campaigns - list of lists which contain two elements: first element shows campaign and second one shows flow
* prepid - prepid of chained campaign

### Chained Requests
Index - `chained_requests`.
Document type - `chained_request`.
Source - chained requests are fetched from McM.

##### Attributes:

* chain - list of request prepids that form the chain
* member_of_campaign - name of chained campaign that this chained request is member of
* prepid - prepid of a chained request

### Dataset Names
Index - `mcm_dataset_names`.
Document type - `mcm_dataset_name`.
Source - dataset names are extracted from requests (attribute `dataset_name`) when pMp is fetching McM requests.

##### Attributes:

* prepid - dataset name

### Flows
Index - `flows`.
Document type - `flow`.
Source - flows are fetched from McM.

##### Attributes:

* prepid - prepid of flow

### PPD Tags
Index - `ppd_tags`.
Document type - `ppd_tag`.
Source - PPDtags are extracted from requests (attribute `ppd_tags`) when pMp is fetching McM requests.

##### Attributes:

* prepid - tag itself

### Processing strings
Index - `processing_strings`.
Document type - `processing_string`.
Source - processing strings are extracted from ReReco requests (attribute `processing_string`).

##### Attributes:

* prepid - processing string itself

### RelVal Campaigns
Index - `relval_campaigns`.
Document type - `relval_campaign`.
Source - RelVal campaigns are extracted from RelVal requests (attribute `member_of_campaign`).

##### Attributes:

* prepid - prepid of RelVal campaign

### RelVal CMSSW Versions
Index - `relval_cmssw_versions`.
Document type - `relval_cmssw_version`.
Source - RelVal CMSSW versions are extracted from RelVal requests (attribute `cmssw_version`).

##### Attributes:

* prepid - CMSSW version itself

### RelVal Requests
Index - `relval_requests`.
Document type - `relval_request`.
Source - RelVal requests are created when pMp is fetching workflows. If attribute `request_name` in workflow contains `_RVCMSSW_` and `prepid` contains `CMSSW_` then in addition to workflow, a RelVal request is created. They are created using information in workflow and they appear and have structure of a normal McM request with a few exceptions such as tags replaced by processing strings, no flow, no tags, no time per event and no member of chain.

##### Attributes:

* cmssw_version - CMSSW version from workflow
* history - list of dictionaries that have keys 'action' (value is string) and 'time' (value is int - unix timestamp) that represent actions as they *would* appear in McM ('submitted', 'done'). This is taken from 'reqmgr_status_history' and 'new' in ReqMgr2 will be 'submitted', 'announced' will be 'done'.
* member_of_campaign - first campaign from ReqMgr2 workflow's list of campaigns
* output_dataset - list of datasets that this request will produce. Only last one is used
* prepid - prepid of rereco request
* priority - priority of request's workflow in ReqMgr2
* pwg - constant value 'RelVal'
* reqmgr_name - list of one element which is workflow name that was used to create this request
* reqmgr_status_history - list of dictionaries that have keys 'history' (value is list) and 'name' (value is string). 'history' contain list of workflow statuses from ReqMgr2 ('new', 'assignment-approved', 'announced', etc). 'name' is workflow name.
* status - 'action' of last record in 'history' of request ('submitted', 'done', etc.)
* total_events - number of total events of request

### ReReco Campaigns
Index - `rereco_campaigns`.
Document type - `rereco_campaign`.
Source - ReReco campaigns are extracted from ReReco requests (attribute `member_of_campaign`).

##### Attributes:

* prepid - prepid of ReReco campaign

### ReReco Requests
Index - `rereco_requests`.
Document type - `rereco_request`.
Source - ReReco requests are created when pMp is fetching workflows. If attribute `request_type` in workflow is `ReReco` then in addition to workflow, a ReReco request is created. They are created using information in workflow and they appear and have structure of a normal McM request with a few exceptions such as tags replaced by processing strings, no flow, no tags, no time per event and no member of chain.

##### Attributes:

* history - list of dictionaries that have keys 'action' (value is string) and 'time' (value is int - unix timestamp) that represent actions as they *would* appear in McM ('submitted', 'done'). This is taken from 'reqmgr_status_history' and 'new' in ReqMgr2 will be 'submitted', 'announced' will be 'done'.
* member_of_campaign - first campaign from ReqMgr2 workflow's list of campaigns
* output_dataset - list of datasets that this request will produce. Only last one is used
* prepid - prepid of rereco request
* priority - priority of request's workflow in ReqMgr2
* processing_string - processing string of a request
* pwg - constant value 'ReReco'
* reqmgr_name - list of one element which is workflow name that was used to create this request
* reqmgr_status_history - list of dictionaries that have keys 'history' (value is list) and 'name' (value is string). 'history' contain list of workflow statuses from ReqMgr2 ('new', 'assignment-approved', 'announced', etc). 'name' is workflow name.
* status - 'action' of last record in 'history' of request ('submitted', 'done', etc.)
* total_events - number of total events of request

### Requests
Index - `requests`.
Document type - `request`.
Source - requests are fetched from McM.

##### Attributes:

* dataset_name - name of dataset from McM
* flown_with - name of flow that request is associated with
* history - list of dictionaries that have keys 'action' (value is string) and 'time' (value is int - unix timestamp) that represent actions as they appear in McM ('created', 'approved', 'submitted', 'done', etc.)
* member_of_campaign - name of campaign that this request is member of
* member_of_chain - list of chained requests that this request is member of
* output_dataset - list of datasets that this request will produce. Only last one is used
* ppd_tags - list of PPD tags
* prepid - prepid of request
* priority - priority of request as it appears in McM. Note that workflow priority of resubmissions may be higher
* pwg - physics working group of request
* reqmgr_name - list of workflow names associated with this request
* reqmgr_status_history - list of dictionaries that have keys 'history' (value is list) and 'name' (value is string). 'history' contain list of workflow statuses from ReqMgr2 ('new', 'assignment-approved', 'announced', etc). 'name' is workflow name.
* status - 'action' of last record in 'history' of request ('submitted', 'done', etc.)
* tags - list of tags that request has 
* time_event - list of numbers that represent time per event for request sequences
* total_events - number of total events of request

### Tags
Index - `tags`.
Document type - `tag`.
Source - tags are extracted from requests (attribute `tags`) when pMp is fetching McM requests.

##### Attributes:

* prepid - tag itself

### Workflows
Index - `workflows`.
Document type - `workflow`.
Source - workflows are fetched from Stats.

##### Attributes:

* event_number_history - list of dictionaries. Each dictionary has 'dataset' (value is string) and 'history' (value is list). Each history list entry is a dictionary that has 'events' (value is int), 'time' (value is int - unix timestamp) and 'type' (value is string). 'events' show number of events at 'time' time and 'type' shows dataset status at given 'time' ('NONE', 'PRODUCTION', 'VALID')
* output_datasets - list of output datasets
* prepid - workflow prepid
* processing_string - processing string
* request_name - workflow name
* request_transition - list of dictionaries that have keys 'status' (value is string) and 'time' (value is int - unix timestamp). Status changes from ReqMgr2 ('new', 'assignment-approved', 'announced', etc).
* request_type - request type ('TaskChain', 'Resubmission', 'ReReco', etc.)
* total_events - number of expected events

## Search in pMp

pMp allows users to search for data by:

* Campaigns (McM)
* Request prepids (McM)
* PPD tags (McM)
* Request tags (McM)
* Flows (McM)
* Dataset names (McM)
* ReReco request prepids
* ReReco processing strings
* ReReco campaigns
* RelVal request prepids
* RelVal CMSSW versions
* RelVal campaigns

Suggestions in search are shown as prepids of objects in the list above. pMp does not have wildcard (asterisk - *) search, so queries must contain complete tags, campaigns, prepids, etc. If multiple objects in different indexes have the same identifier, i.e. there is a PPD tag `TAG1` and a request tag `TAG1` then pMp fill treat `TAG1` as PPD tag and fetch only requests that have `TAG1` as a PPD tag because PPD tags are higher in the list above. List above shows order in which object type (whether it's a campaign, PPD tag, tag, CMSSW version or etc.) of given search term (user input) will be determined. Search is done like this because pMp first needs to decide which type of object is user searching for and then look into appropriate index in Elasticsearch. Search in pMp is case-sensitive. 

If new terms are appended to already existing search terms then requests that fit any of these terms are shown, i.e. terms in search are joined with OR. For example if user searches by `TAG1` and `TAG2` then requests that have `TAG1` or `TAG2` (or both) are shown. If a request fits multiple terms in the search, it is still added to results only once.

## Statistics in pMp

If number is changed so it would be shown with SI suffix, then exact value can be seen by hovering mouse cursor over shortened number.

### Filtering

### Estimation of completed events

## Present Statistics

Present statistics in pMp displays current status of requests. Users can choose histogram scale - Linear or Logarithmic. Histogram Y values can show either number of requests, number of total events* or seconds which is calculated by multiplying time per event and number of total events*. Bars in histogram can be grouped, colored and stacked by different attributes of requests. More information about any histogram bar can be seen by hovering mouse cursor over bars in histogram. User can see which requests are in the bar by clicking on it in the histogram.

At the bottom there are three tables. First one shows requests that are at least in one chained request (attribute `member_of_chains`). Second table shows requests that are not members of any chained request. Third table shows all requests - chained and unchained. It is possible to switch table mode between number of requests, total events* and seconds by changing Mode of the histogram.

\* except if request is `done`, then number of completed events is used

### Announced Mode

### Growing Mode

### Display Chains

## Historical Statistics

## Performance Statistics

## Screenshots

pMp2 allows to download graphs as PDF, PNG or SVG files. In order for this function to work, these two things need to be installed:
```
sudo yum install librsvg2.x86_64
sudo yum install librsvg2-tools.x86_64
```