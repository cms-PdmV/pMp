"""Module crating ElasticSearch object"""
from elasticsearch import Elasticsearch
import config
import logging


class InitConnection(object):
    """
    This class initiates connection to the ElasticSearch and results overflow
    """
    __PAGE_SIZE = 25000

    def __init__(self):
        """Initiate connection
        Default cropping is 20, set overflow that will not crop results
        """
        self.es = Elasticsearch(config.DATABASE_URL)

    def search(self, query, index, page_size=__PAGE_SIZE, max_results=-1):
        results = []
        fetched_objects = [{}]
        page = 0
        while len(fetched_objects) > 0:
            # logging.info('Will try to fetch page %s for %s of index %s' % (page, query, index))
            fetched_objects = self.es.search(q=query,
                                             index=index,
                                             size=page_size,
                                             from_=page * page_size,
                                             request_timeout=60)['hits']['hits']
            # logging.info('Found %s results in page %s for %s of index %s' % (len(fetched_objects), page, query, index))
            page += 1
            for fetched_object in fetched_objects:
                fetched_object['_source']['_id'] = fetched_object['_id']
                results.append(fetched_object['_source'])
                if max_results > 0 and len(results) >= max_results:
                    break

            if max_results > 0 and len(results) >= max_results:
                break

        return results
