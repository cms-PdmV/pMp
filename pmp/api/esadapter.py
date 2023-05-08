"""Module crating ElasticSearch object"""
import config
from fetchd.search_engine import search_engine, SearchEngine


class InitConnection(object):
    """
    This class initiates connection to the ElasticSearch and results overflow
    """

    __PAGE_SIZE = 25000

    def __init__(self):
        """Initiate connection
        Default cropping is 20, set overflow that will not crop results
        """
        self.search_engine = search_engine
        self.es = self.search_engine.client

    def search(self, query, index, page_size=__PAGE_SIZE, max_results=-1):
        results = []
        fetched_objects = [{}]
        page = 0
        while len(fetched_objects) > 0:
            # logging.info('Will try to fetch page %s for %s of index %s' % (page, query, index))
            fetched_objects = self.es.search(
                q=query,
                index=index,
                size=page_size,
                from_=page * page_size,
                request_timeout=config.QUERY_TIMEOUT,
            )["hits"]["hits"]
            # logging.info('Found %s results in page %s for %s of index %s' % (len(fetched_objects), page, query, index))
            page += 1
            for fetched_object in fetched_objects:
                fetched_object["_source"]["_id"] = fetched_object["_id"]
                results.append(fetched_object["_source"])
                if max_results > 0 and len(results) >= max_results:
                    break

            if max_results > 0 and len(results) >= max_results:
                break

        return results

    def get_source(self, index: str, id: str, doc_type: str = None):
        if self.search_engine.engine_instance_of(SearchEngine.OPENSEARCH):
            # This client does not support the legacy doc_type option
            return self.es.get_source(index=index, id=id)
        elif self.search_engine.engine_instance_of(SearchEngine.ELASTICSEARCH):
            # Elasticsearch 6.x supports it
            return self.es.get_source(index=index, id=id, doc_type=doc_type)

        raise NotImplementedError(
            "Operation not implemented for the current search engine"
        )

    def mget(self, index: str, body: dict, doc_type: str = None):
        if self.search_engine.engine_instance_of(SearchEngine.OPENSEARCH):
            # This client does not support the legacy doc_type option
            return self.es.mget(index=index, body=body)
        elif self.search_engine.engine_instance_of(SearchEngine.ELASTICSEARCH):
            # Elasticsearch 6.x supports it
            return self.es.mget(index=index, body=body, doc_type=doc_type)

        raise NotImplementedError(
            "Operation not implemented for the current search engine"
        )
