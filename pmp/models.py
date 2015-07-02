class APICall():
    """
    List of API function calls
    """

    def chain_landscape(self):
        from api import landscape as call
        return call.ChainAPI().get()

    def historical_complex(self, query, probe=100, priority=",", status=None,
                           pwg=None):
        from api import historical as call
        filters = dict()
        filters['status'] = status
        filters['pwg'] = pwg
        return call.HistoricalAPI().get(query, int(probe), priority, filters)

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

    def submitted_stats(self, query, priority, pwg):
        from api import historical as call
        return call.SubmittedStatusAPI().get(query, priority, pwg)

    def shorten_url(self, url, params):
        from api import shorten as call
        return call.ShortenAPI().get(url, params)

    def suggestions(self, block, query):
        from api import suggestions as call
        return call.SuggestionsAPI(block).get(query)

    def take_screenshot(self, svg, format):
        from api import screenshot as call
        return call.TakeScreenshotAPI().get(svg, format)
