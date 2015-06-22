from cStringIO import StringIO
import pycurl

class ShortenAPI():

    def get(self, url, params):
        c = ("http://tinyurl.com/api-create.php?url=" + url
             + "?" + params)
        out = StringIO()
        curl = pycurl.Curl()
        curl.setopt(pycurl.URL, str(c))
        curl.setopt(pycurl.WRITEFUNCTION, out.write)
        curl.perform()
        return out.getvalue()
