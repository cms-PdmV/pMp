# Production Monitoring Platform (pMp)

## pMp
pMp stands for Production Monitoring Platform. pMp provides monitoring of the Monte Carlo, ReReco and RelVal production.

## Contributors
The original code is based on Igor Jurkowski and Jean-Roch Vlimant contributions. Further developed by Adrian Alan Pol, Antanas Norkus, Giovanni Franzoni and Jacob Walker. Second Edition is done by Justinas Rumsevicius.

## Data in pMp

pMp collects data from McM (Monte Carlo Management service) and Stats (Stats service, PdmV's cache of RequestManager2) and displays it in graphs, histograms and tables. pMp enables users to search for information about event production based on request ids, campaigns, datasets, tags, etc. Returned results can be additionally filtered by priority, physics working group and status. Data is periodically updated from McM and Stats service using Jenkins job. Responses in pMp is cached for a short period of time, initially - 10 minutes, but this is easily configurable and may be changed at any time. 

## Search in pMp

Search bar in pMp can be found in all statistics pages. Next to it, there are two buttons: Show and Append. Start typing in search bar to see suggestions. For the sake of easier explanation, words entered in search bar will be called search terms. Show button clears all existing search terms (if any) and adds search term that is currently in search bar. Append button appends search term that is in search bar to existing search terms (if any). pMp allows users to search for information by:

* Campaigns (McM)
* Request prepids (McM)
* Chained campaigns (McM)
* Chained requests (McM)
* PPD tags (McM)
* Request tags (McM)
* Flows (McM)
* Dataset names (McM)
* Datatiers (McM)
* ReReco request prepids
* ReReco processing strings
* ReReco campaigns
* RelVal request prepids
* RelVal CMSSW versions
* RelVal campaigns

Suggestions in search are shown as prepids of objects in the list above. pMp does not have wildcard (asterisk - *) search, so queries must contain complete tags, campaigns, prepids, etc, i.e. search terms must be full identifiers of objects. If multiple objects in different indexes (of different types) have the same identifier, i.e. there is a PPD tag `TAG1` and a request tag `TAG1` then pMp fill treat `TAG1` as PPD tag and fetch only requests that have `TAG1` as a PPD tag because PPD tags are higher in the list above. Objects in pMp are stored in indexes - databases for each type. Once user enters a search term, pMp first needs to figure out which type of object is user searching for and then look into appropriate index in Elasticsearch. List above shows order in which indexes are checked for an object with given id to determine object type (whether it's a campaign, PPD tag, tag, CMSSW version or etc.). Search in pMp is case-sensitive. 

If multiple search terms are given then requests that fit any of these terms are shown, in other words, terms in search are joined with OR. For example if user searches by `TAG1` and `TAG2` then requests that have `TAG1` or `TAG2` (or both) are shown. If a request fits multiple terms in the search, it is still added to results only once.

## Present Statistics

Present statistics in pMp shows current status of requests. Users can choose histogram scale - Linear or Logarithmic. Histogram Y values can show either number of requests, number of total events\* or seconds which is calculated by multiplying time per event and number of total events\*. Bars in histogram can be grouped, colored and stacked by different attributes of requests. More information about any histogram bar can be seen by hovering mouse cursor over bars in histogram. User can see which requests are in the bar by clicking on it in the histogram.

At the bottom there are three tables. First one shows requests that are at least in one chained request (attribute `member_of_chains`). Second table shows requests that are not members of any chained request. Third table shows all requests - chained and unchained. It is possible to switch table mode between number of requests, total events* and seconds by changing Mode of the histogram. Last column in table shows sum of all numbers in that row. If there is more than one campaign in a table, last row, called _All_ will show sum of all numbers in that column.

\* _except if request is `done`, then number of completed events is used_

## Historical Statistics

Historical statistics in pMp show how number of events grew over time. Only requests with status `submitted` or `done` are shown in this plot. There are three colors in graph - gray, orange and blue. Gray area represent requested (expected) events. Orange area represent events that are produced, but the dataset is not yet in 'VALID' state (not completed). Blue area represent events that are produced and dataset is 'VALID'. Usually gray area is a bit higher than orange and blue area. In the end, blue area should be the same height as orange area. If request is force completed (it's workflow has `force-complete` in request transitions) then number of expected events for that request is set to done events (blue value). User can use mouse wheel to zoom in and out and drag graph to move it.

Below the main plot there are two tables\* that show all requests that were used to produce said plot. Requests that were force completed will have '(FC)' next to done events in table of done requests.

\* _second table can be turned on by checking 'Show list of done requests' option_

## Performance Statistics

Performance statistics in pMp show how much time it took for requests to get from one status to another. All data is grouped in equal width (number of seconds) bins. Lowest value in x axis is the smallest amount of time of all requests to change status while highest value is the largest amount of time. User can see which requests are in the bar by clicking on it in the histogram. Users can choose histogram scale - Linear or Logarithmic. If there are less requests than bins (bars), then number of bins (bars) is reduced to number of requests.

## Options in pMp

### Display chains (only in Present Statistics)

Fetch all campaigns from all chained campaigns that contain campaigns of all requests for user given search query. In other words: fetch all requests for user given search term. Take all campaigns from there requests. Find all chained campaigns for these campaigns. Take all campaigns from these chained campaigns. Fetch results for all these campaigns from chained campaigns. This may return more results than expected and can be very slow. Results may conatain up to tens of thousands of requests. 

Default value: `false`  
URL parameter: `chainedMode`

### Growing mode (only in Present Statistics)

For each `submitted` request create a corresponding "fake" request with same prepid that would have status `done` and number of done events would be number of produced events in `submitted` request. For example there is a `submitted` request that has 1000 expected events of which 200 are already produced. Then this request would have 800 total events (this is show as "Left" in table) and there would be another request with same prepid and status `done` that would have 1000 expected events and 200 done events. This option works only if plot mode is set to "Events".

Default value: `false`  
URL parameter: `growingMode`

### Using SI suffix for large numbers

This option changes large numbers to smaller numbers with SI suffix. 1 000 becomes 1k, 1 000 000 becomes 1M, 1 000 000 000 becomes 1G. Up to two digits are shown after decimal point, for example 1234 is 1.23k, 123456 is 1.23M, 123456789 is 1.23G. If this option is enabled, actual value of number can be seen by hovering mouse cursor over shortened number.

Default value: `true`  
URL parameter: `humanReadable`

### Estimate completed events (only in Present and Historical Statistics)

If request does not have output dataset, then try to guess how many events are produced based on subsequent requests in chain. pMp finds all chains where this request is present and finds another request down the chain which has the biggest number of completed events and uses dataset of that request as source of information.

Default value: `false`  
URL parameter: `estimateCompleted`

### Show table for unchained requests (only in Present Statistics)

Additionally show tables of unchained and both chained and unchained requests at the bottom of the page.

Default value: `false`  
URL parameter: `showUnchainedTable`

### Zoom both axes (only in Historical Statistics)

If this option is enabled, zoom happens not only in x axis, but in y axis as well.

Default value: `false`  
URL parameter: `zoomY`

### Show list of done requests (only in Historical Statistics)

If this option is enabled, a second list is shown in Historical statistics that contains all requests that are in `done` status.

Default value: `false`  
URL parameter: `showDoneRequestsList`

### Granularity (only in Historical Statistics)

This option controls how many data points are in the graph, that is, how many different x values are there.

Default value: `100`  
URL parameter: `granularity`

### Bins (only in Performance Statistics)

This option controls how many bins (bars) are in histogram. If number of requests is lower than number of bins, then number of requests is used rather the number of bins.

Default value: `20`  
URL parameter: `bins`

## Filtering in pMp

### Priority filter

### Status filter

### PWG filter

## Sharing in pMp

### Share a link

### Download an image

## Database structure (for advanced users)

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

### Datatiers
Index - `mcm_datatiers`.
Document type - `mcm_datatier`.
Source - datatiers are extracted from requests' sequences when pMp is fetching McM requests.

##### Attributes:

* prepid - datatier name

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
* datatiers - list of datatiers from McM's sequences
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

## Screenshots (for advanced users)

pMp2 allows to download graphs as PDF, PNG or SVG files. In order for this function to work, these two things need to be installed:
```
yum install librsvg2.x86_64
yum install librsvg2-tools.x86_64
```
