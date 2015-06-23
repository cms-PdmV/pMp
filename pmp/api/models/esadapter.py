"""Module crating ElasticSearch object"""
from pyelasticsearch import ElasticSearch
import config


class InitConnection(object):
    """
    This class initiates connection to the ElasticSearch and results overflow
    """
    def __init__(self):
        """Initiate connection
        Default cropping is 20, set overflow that will not crop results
        """
        self.es = self.elastic_connect()
        self.overflow = 1000000

    @staticmethod
    def elastic_connect():
        """Initiate ElasticSearch"""
        return ElasticSearch(config.DATABASE_URL)

    def set_overflow(self, overflow):
        """Set number of returned results"""
        self.overflow = overflow
