"""Module crating ElasticSearch object"""
import config
import logging
from elasticsearch import Elasticsearch
from opensearchpy import OpenSearch


class InitConnection(object):
    """
    This class initiates connection to the ElasticSearch and results overflow
    """

    __PAGE_SIZE = 5000

    def __init__(self):
        """Initiate connection
        Default cropping is 20, set overflow that will not crop results
        """
        if config.OPENSEARCH:
            credentials = config.search_engine_credentials()
            self.es = OpenSearch(
                hosts=[config.DATABASE_URL],
                use_ssl=True,
                verify_cert=True,
                ca_certs=credentials["ca_cert"],
            )
        else:
            self.es = Elasticsearch(config.DATABASE_URL)

    def search(self, query, index, page_size=__PAGE_SIZE, max_results=-1):
        results = []
        batch = 0
        scroll_default = "5m"

        # Get first batch of results
        query_results = self.es.search(
            q=query,
            index=index,
            size=page_size,
            scroll=scroll_default,
            request_timeout=config.QUERY_TIMEOUT,
        )
        scroll_id = query_results["_scroll_id"]
        docs = query_results["hits"]["hits"]

        while len(docs) > 0:
            logging.info(
                "Found %s results in batch %s for %s of index %s"
                % (len(docs), batch, query, index)
            )
            for fetched_object in docs:
                fetched_object["_source"]["_id"] = fetched_object["_id"]
                results.append(fetched_object["_source"])
                if max_results > 0 and len(results) >= max_results:
                    break

            if max_results > 0 and len(results) >= max_results:
                break

            # Continue to next batch of results
            batch += 1
            query_results = self.es.scroll(scroll_id=scroll_id, scroll=scroll_default)
            scroll_id = query_results["_scroll_id"]
            docs = query_results["hits"]["hits"]

        # Delete the scroll
        self.es.clear_scroll(scroll_id=scroll_id)
        return results

    def get_source(self, index: str, id: str, doc_type: str = None):
        if config.OPENSEARCH:
            # This client does not support the legacy doc_type option
            return self.es.get_source(index=index, id=id)
        else:
            # Elasticsearch 6.x supports it
            return self.es.get_source(index=index, id=id, doc_type=doc_type)

    def mget(self, index: str, body: dict, doc_type: str = None):
        if config.OPENSEARCH:
            # This client does not support the legacy doc_type option
            return self.es.mget(index=index, body=body)
        else:
            # Elasticsearch 6.x supports it
            return self.es.mget(index=index, body=body, doc_type=doc_type)
