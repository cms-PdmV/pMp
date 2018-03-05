"""finished_update.py Run after an update to update the last_successful_update time"""
import logging
import datetime
import utils
import elasticsearch
from elasticsearch import Elasticsearch


if __name__ == "__main__":
    utils.setlog()
    utils = utils.Utils()
    # by default we connect to localhost:9200
    es = Elasticsearch()
    # ensure the document exists
    try:
        es.get('meta', 'meta', 'last_completed_update')
    except elasticsearch.NotFoundError:
        # could not find last_completed_update. Will create index and add mapping just to be sure
        logging.warning('meta/meta/last_completed_update document not found. Will create index just to be sure')
        # could be that there's no index
        mapping = {
            "properties": {
                "datetime": {
                    "type": "date"
                }
            }
        }
        # create an index in elasticsearch, ignore status code 400 (index already exists)
        es.indices.create(index='meta', ignore=400)
        logging.info('Pushing mapping to for meta/meta doc type')
        es.indices.put_mapping(index='meta', doc_type='meta', body=mapping)

    new_value = int(datetime.datetime.now().strftime('%s')) * 1000
    document = {'datetime': new_value}
    logging.info('Updating meta/meta/last_completed_update with %d' % (new_value))
    es.index(index='meta', doc_type='meta', body=document, id='last_completed_update')
