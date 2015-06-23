from cStringIO import StringIO
import pycurl


class ShortenAPI():
    """
    Shorten URL with tinyurl api
    """
    def __init__(self):
        # api url
        self.base_url = "http://tinyurl.com/api-create.php?url="

    def get(self, url, params):
        # curl response and return it
        c = str(self.base_url + url + "?" + params)
        out = StringIO()
        curl = pycurl.Curl()
        curl.setopt(pycurl.URL, c)
        curl.setopt(pycurl.WRITEFUNCTION, out.write)
        curl.perform()
        return out.getvalue()
