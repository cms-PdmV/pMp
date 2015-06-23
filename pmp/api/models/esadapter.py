from pyelasticsearch import ElasticSearch
import config


class InitConnection():
    """
    This class initiates connection to the elasticsearch and results overflow
    """
    def __init__(self):
        # initiate connection
        self.es = ElasticSearch(config.DATABASE_URL)
        # default cropping to 20, set overflow that will not crop results
        self.overflow = 1000000
