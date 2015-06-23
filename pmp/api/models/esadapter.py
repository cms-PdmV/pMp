from pyelasticsearch import ElasticSearch
import config

class InitConnection():

    def __init__(self):
        self.es = ElasticSearch(config.DATABASE_URL)
        self.overflow = 1000000
