"""Module crating ElasticSearch object"""
from elasticsearch import Elasticsearch
import config


class InitConnection(object):
    """
    This class initiates connection to the ElasticSearch and results overflow
    """
    def __init__(self):
        """Initiate connection
        Default cropping is 20, set overflow that will not crop results
        """
        self.es = Elasticsearch(config.DATABASE_URL)
        self.results_window_size = 1000000
