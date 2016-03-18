"""Add processing strings to existing ReReco requests"""
import pyelasticsearch
import json
import sys
import os
import httplib
import StringIO
import utils

def get_processing_string(reqmgr_name, utl, conn):
    response = json.loads(utl.httpget(conn, "/couchdb/reqmgr_workload_cache/{0}"
        .format(reqmgr_name)))
    return response['ProcessingString']

def ensure_pstring_index(es):
    try:
        es.create_index('processing_strings')
    except pyelasticsearch.exceptions.IndexAlreadyExistsError:
        pass

if __name__ == "__main__":
    utl = utils.Utils()
    conn = utl.init_connection('cmsweb.cern.ch')
    es = pyelasticsearch.ElasticSearch('http://localhost:9200/')
    ensure_pstring_index(es)

    es_query = {
        'query': {
            'bool': {
                'must_not': {
                    'exists': {
                        'field': 'rereco_campaign'
                    }
                }
            }
        }
    }

    all_rereco = es.search(es_query, index='rereco_requests', size=100000)

    for record in all_rereco['hits']['hits']:
        request = record['_source']
        id = record['_id']

        try:
            pstring = get_processing_string(request['reqmgr_name'], utl, conn)
        except KeyError:
            print("Could not find processing string for {0}".format(id))
            continue

        # Assume we have a processing string now - last-minute check for rereco_campaign
        if 'member_of_campaign' in request and 'rereco_campaign' not in request:
            request['rereco_campaign'] = request['member_of_campaign']

        request['member_of_campaign'] = pstring
        es.index('processing_strings', 'processing_string', { 'prepid': pstring },
                id=pstring)
        es.index('rereco_requests', 'rereco_request', request, id=id)

