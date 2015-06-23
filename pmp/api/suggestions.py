from models import esadapter
import json

class SuggestionsAPI(esadapter.InitConnection):
    """
    Used to search in elastic for simmilar prepid as given
    """
    def __init__(self, typeof):
        esadapter.InitConnection.__init__(self)
        self.overflow = 10
        self.announced = (typeof == 'announced')
        self.growing = (typeof == 'growing')
        self.historical = (typeof == 'historical')
        self.performance = (typeof == 'performance')

    def get(self, query):
        searchable = query.replace('-', '\-')
        if '-' in query:
            search = ('prepid:%s' % searchable)
            search_stats = ('pdmv_request_name:%s' % searchable)
        else:
            search = ('prepid:*%s*' % searchable)
            search_stats = ('pdmv_request_name:*%s*' % searchable)

        results = []

        if (self.historical or self.growing or self.announced
            or self.performance):
            # campaigns are expected in all modes
            results += [s['_id'] for s in
                        self.es.search(search, index='campaigns',
                                       size=self.overflow)['hits']['hits']]

            # extended search for historical
            if self.historical:
                results += [s['_id'] for s in
                            self.es.search(search, index='requests',
                                           size=self.overflow)['hits']['hits']]

                results += [s['_id'] for s in
                            self.es.search(search_stats, index='stats',
                                           size=self.overflow)['hits']['hits']]

            # extended search fo growing
            if self.growing:
                results += [s['_id'] for s in
                            self.es.search(search, index="chained_campaigns",
                                           size=self.overflow)['hits']['hits']]

        # order of ext does matter because of the typeahead in bootstrap
        return json.dumps({"results": results})
