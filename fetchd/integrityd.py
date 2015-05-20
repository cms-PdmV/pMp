from pyelasticsearch import ElasticSearch

DATABASE_URL = 'http://127.0.0.1:9200/'

class CheckRequestManagerName():

    def __init__(self):
        self.es = ElasticSearch(DATABASE_URL)
        self.overflow = 100000

    def check(self):
        res = [s['_source'] for s in
               self.es.search('prepid:*', index='requests',
                              size=self.overflow)['hits']['hits']]
        for r in res:
            try:
                if r['status'] == 'submitted':
                    if not len(r['reqmgr_name']):
                        print 'Faulty request manager name: ', r['prepid']
            except:
                continue


ci = CheckRequestManagerName()
ci.check()
