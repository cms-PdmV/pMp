#!/usr/bin/env bash

campaigns() {
    curl -XPUT '127.0.0.1:9200/campaigns/_mapping/campaign?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "prepid": {
                "type": "string"
            }
        }
    }'

    curl -XPUT '127.0.0.1:9200/campaigns/_mapping/seq?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "time": {
                "type": "long"
            },
            "val": {
                "type": "long"
            }
        }
    }'
}

chained_campaigns() {
    curl -XPUT '127.0.0.1:9200/chained_campaigns/_mapping/chained_campaign?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "campaigns": {
                "type": "string",
                "index": "not_analyzed"
            },
            "prepid": {
                "type": "string"
            }
        }
    }'

    curl -XPUT '127.0.0.1:9200/chained_campaigns/_mapping/seq?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "time": {
                "type": "long"
            }
        }
    }'
}

chained_requests() {
    curl -XPUT '127.0.0.1:9200/chained_requests/_mapping/chained_request?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "chain": {
                "type": "string"
            },
            "member_of_campaign": {
                "type": "string",
                "index": "not_analyzed"
            },
            "prepid": {
                "type": "string"
            },
            "step": {
                "type": "long"
            }
        }
    }'

    curl -XPUT '127.0.0.1:9200/chained_requests/_mapping/seq?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "time": {
                "type": "long"
            },
            "val": {
                "type": "long"
            }
        }
    }'
}

flows() {
    curl -XPUT '127.0.0.1:9200/flows/_mapping/flow?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "prepid": {
                "type": "string"
            }
        }
    }'

    curl -XPUT '127.0.0.1:9200/flows/_mapping/seq?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "time": {
                "type": "long"
            },
            "val": {
                "type": "long"
            }
        }
    }'
}

processing_strings() {
    curl -XPUT '127.0.0.1:9200/processing_strings/_mapping/processing_string?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "prepid": {
                "type": "string"
            }
        }
    }'
}

requests() {
    curl -XPUT '127.0.0.1:9200/requests/_mapping/request?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "completed_events": {
                "type": "long"
            },
            "efficiency": {
                "type": "double"
            },
            "flown_with": {
                "type": "string",
                "index": "not_analyzed"
            },
            "history": {
                "properties": {
                    "action": {
                        "type": "string"
                    },
                    "time": {
                        "type": "string"
                    }
                }
            },
            "member_of_campaign": {
                "type": "string",
                "index": "not_analyzed"
            },
            "member_of_chain": {
                "type": "string"
            },
            "output_dataset": {
                "type": "string"
            },
            "prepid": {
                "type": "string"
            },
            "priority": {
                "type": "long"
            },
            "pwg": {
                "type": "string"
            },
            "reqmgr_name": {
                "type": "string"
            },
            "status": {
                "type": "string"
            },
            "time_event": {
                "type": "double"
            },
            "total_events": {
                "type": "long"
            }
        }
    }'

    curl -XPUT '127.0.0.1:9200/requests/_mapping/seq?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "time": {
                "type": "long"
            },
            "val": {
                "type": "long"
            }
        }
    }'
}

rereco_requests() {
    curl -XPUT '127.0.0.1:9200/rereco_requests/_mapping/rereco_request?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "completed_events": {
                "type": "long"
            },
            "history": {
                "properties": {
                    "action": {
                        "type": "string"
                    },
                    "time": {
                        "type": "string"
                    }
                }
            },
            "member_of_campaign": {
                "type": "string",
                "index": "not_analyzed"
            },
            "output_dataset": {
                "type": "string"
            },
            "pdmv_status": {
                "type": "string"
            },
            "prepid": {
                "type": "string"
            },
            "priority": {
                "type": "long"
            },
            "reqmgr_name": {
                "type": "string"
            },
            "status": {
                "type": "string"
            },
            "status_from_reqmngr": {
                "type": "string"
            },
            "status_in_DAS": {
                "type": "string"
            },
            "total_events": {
                "type": "long"
            }
        }
    }'
}

stats() {
    curl -XPUT '127.0.0.1:9200/stats/_mapping/seq?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "time": {
                "type": "long"
            },
            "val": {
                "type": "long"
            }
        }
    }'

    curl -XPUT '127.0.0.1:9200/stats/_mapping/stats?pretty' -H 'Content-Type: application/json' -d'
    {
        "properties": {
            "pdmv_dataset_name": {
                "type": "string"
            },
            "pdmv_expected_events": {
                "type": "long"
            },
            "pdmv_monitor_datasets": {
                "properties": {
                    "dataset": {
                        "type": "string"
                    },
                    "monitor": {
                        "properties": {
                            "pdmv_evts_in_DAS": {
                                "type": "long"
                            },
                            "pdmv_monitor_time": {
                                "type": "string"
                            },
                            "pdmv_open_evts_in_DAS": {
                                "type": "long"
                            }
                        }
                    }
                }
            },
            "pdmv_monitor_history": {
                "properties": {
                    "pdmv_evts_in_DAS": {
                        "type": "long"
                    },
                    "pdmv_monitor_time": {
                        "type": "string"
                    },
                    "pdmv_open_evts_in_DAS": {
                        "type": "long"
                    }
                }
            },
            "pdmv_prep_id": {
                "type": "string",
                "index": "not_analyzed"
            },
            "pdmv_request_name": {
                "type": "string"
            },
            "pdmv_type": {
                "type": "string"
            },
            "rereco_preferred_dataset": {
                "type": "string"
            }
        }
    }'
}

# curl -X PUT 127.0.0.1:9200/campaigns
# curl -X PUT 127.0.0.1:9200/chained_campaigns
# curl -X PUT 127.0.0.1:9200/chained_requests
# curl -X PUT 127.0.0.1:9200/flows
# curl -X PUT 127.0.0.1:9200/processing_strings
# curl -X PUT 127.0.0.1:9200/requests
# curl -X PUT 127.0.0.1:9200/rereco_requests
# curl -X PUT 127.0.0.1:9200/stats

campaigns
chained_campaigns
chained_requests
flows
processing_strings
requests
rereco_requests
stats
