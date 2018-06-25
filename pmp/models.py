"""pMp models"""

class APICall(object):
    """List of API function calls"""

    @staticmethod
    def chain_landscape():
        """Chain landscape call"""
        from pmp.api import landscape as call
        return call.ChainAPI().get()

    @staticmethod
    def historical_complex(query, granularity=100, priority=',', filters=None):
        """Complex historical call"""
        from pmp.api import historical as call
        return call.HistoricalAPI().get(query, int(granularity), priority, filters)

    @staticmethod
    def historical_simple(query):
        """Simple historical call"""
        from pmp.api import historical as call
        return call.HistoricalAPI().get(query)

    @staticmethod
    def last_update(collections):
        """Last successful DB update call"""
        from pmp.api import common as call
        return call.LastUpdateAPI().get(collections)

    @staticmethod
    def overall(collections):
        """Performance of campaign call"""
        from pmp.api import common as call
        return call.OverallAPI().get(collections.split(','))

    @staticmethod
    def performance(campaign):
        """Performance of campaign call"""
        from pmp.api import performance as call
        return call.PerformanceAPI().get(campaign)

    @staticmethod
    def present_announced_mode(query, extra):
        """Announced mode call"""
        from pmp.api import present as call
        if extra:
            return call.GrowingAPI().get(query, False)
        else:
            return call.AnnouncedAPI().get(query, False)

    @staticmethod
    def present_growing_mode(query, extra):
        """Growing mode call"""
        from pmp.api import present as call
        if extra:
            return call.GrowingAPI().get(query, True)
        else:
            return call.AnnouncedAPI().get(query, True)

    @staticmethod
    def priority(campaign):
        """Average time/event in different priority blocks"""
        from pmp.api import performance as call
        return call.PriorityAPI().get(campaign)

    @staticmethod
    def submitted_stats(query, priority, pwg):
        """List submitted call"""
        from pmp.api import historical as call
        return call.SubmittedStatusAPI().get(query, priority, pwg)

    @staticmethod
    def shorten_url(url, params):
        """Shorten url call"""
        from pmp.api import common as call
        return call.ShortenAPI().get(url, params)

    @staticmethod
    def suggestions(block, query):
        """Get suggestions call"""
        from pmp.api import common as call
        return call.SuggestionsAPI(block).get(query)

    @staticmethod
    def take_screenshot(svg, extension):
        """Take screenshot call"""
        from pmp.api import common as call
        return call.TakeScreenshotAPI().get(svg, extension)
