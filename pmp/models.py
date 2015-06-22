class APICall():

    def chain_landscape(self):
        from api import chain as call
        return call.ChainAPI().get()

    def historical_complex(self, query, probe=100, priority_min=0, priority_max=-1,
                           status=None, pwg=None):
        from api import historical as call
        return call.HistoricalAPI().get(query, probe, priority_min, priority_max,
                                        status, pwg)

    def historical_simple(self, query):
        from api import historical as call
        return call.HistoricalAPI().get(query)

    def last_update(self, collections):
        from api import update as call
        return call.LastUpdateAPI().get(collections)

    def performance(self, campaign):
        from api import performance as call
        return call.PerformanceAPI().get(campaign)

    def present_announced_mode(self, campaign):
        from api import announced as call
        return call.AnnouncedAPI().get(campaign)

    def present_growing_mode(self, query):
        from api import growing as call
        return call.GrowingAPI().get(query)

    def shorten_url(self, url, params):
        from api import shorten as call
        return call.ShortenAPI().get(url, params)

    def suggestions(self, t, query):
        from api import suggestions as call
        return call.SuggestionsAPI(t).get(query)


