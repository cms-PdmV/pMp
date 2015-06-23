from models import esadapter
import json


class LastUpdateAPI(esadapter.InitConnection):
    """
    Get time of last successful update to the database
    """
    def get(self, query):
        """
        Returning time since the epoch
        query - csv of collections to check
        """
        last_update = 0
        for q in query.split(','):
            # loop and select lowest
            l = self.es.get(q, 'seq', 'last_seq')['_source']
            if last_update == 0 or l['time'] < last_update:
                last_update = l['time']
        lu = dict()
        lu['last_update'] = last_update
        return json.dumps({"results": lu})
