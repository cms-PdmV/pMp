"""A list of classes supporting performance statistics API"""
from pmp.api.models import esadapter
import simplejson as json
import time


class PerformanceAPI(esadapter.InitConnection):
    """Return list of requests with history points"""

    def es_search(self, campaign, index):
        return self.es.search('member_of_campaign:{0}'.format(campaign), index=index,
            size=self.overflow)['hits']

    def get(self, campaign):
        """Retruning historical points for each request in given campaign"""
        # change 'all' to wildcard
        if campaign == 'all':
            search = self.es_search('*', 'requests') + self.es_search('*', 'rereco_requests')
        else:
            # get the list of requests
            search = self.es_search(campaign, 'requests')

            if search['total'] == 0:
                # Try ReReco index
                search = self.es_search(campaign, 'rereco_requests')

        # Enum provides ordering for comparison between statuses (in history, hence 'created')
        status_order = {
            'created': 0,
            'validation': 1,
            'approved': 2,
            'submitted': 3,
            'done': 4
        }
        earliest_status = 'done'

        response = [s['_source'] for s in search['hits']]

        # loop over and remove documents' fields
        remove = []
        for request in response:
            # Remove new and unchained to clean up output plots
            if request['status'] == 'new' and not request.get('member_of_chain', []):
                remove.append(request)
                continue

            for field in ['time_event', 'total_events', 'completed_events',
                          'reqmgr_name', 'efficiency', 'output_dataset',
                          'flown_with', 'member_of_chain']:
                if field in request:
                    del request[field]

            # duplicates fix ie. when request was reset
            patch_history = {}
            for history in request['history']:
                patch_history[history['action']] = history['time']

                # Keep a log of the "earliest" status found. Fixes ReReco request display
                # given that they start directly at "submitted"
                if status_order[history['action']] < status_order[earliest_status]:
                    earliest_status = history['action']

            request['history'] = patch_history
            request['input'] = request['member_of_campaign']


        for to_remove in remove:
            response.remove(to_remove)

        return json.dumps({'results': {"data": response, 'first_status': earliest_status}})


class PriorityAPI(esadapter.InitConnection):
    """Return list of time/event statistics for different priority blocks"""

    @staticmethod
    def parse_time(string_time):
        """Parse time in a "2013-1-01-01-01-01" format to integer"""
        return time.mktime(time.strptime(string_time , "%Y-%m-%d-%H-%M"))*1000

    @staticmethod
    def fixed_priority_blocks(with_block):
        for block, priority in enumerate([110000, 90000, 85000, 80000, 70000,
                                          63000]):
            if with_block:
                yield str(block + 1), str(priority)
            else:
                yield str(priority)

    def es_search(self, campaign, index):
        return self.es.search('member_of_campaign:{0}'.format(campaign), index=index,
            size=self.overflow)['hits']

    def get(self, campaign):
        """Execute"""
        # change 'all' to wildcard
        if campaign == 'all':
            search = self.es_search('*', 'requests') + self.es_search('*', 'rereco_requests')
        else:
            # get the list of requests
            search = self.es_search(campaign, 'requests')

            if search['total'] == 0:
                # Try ReReco index
                search = self.es_search(campaign, 'rereco_requests')

        response = [s['_source'] for s in search['hits']]

        com = {}
        for request in response:
            # Remove new and unchained to clean up output plots (just don't add them)
            if request['status'] == 'new' and not request.get('member_of_chain', []):
                continue

            history = request['history']
            last = len(history)-1
            if (history[last]['action'] == 'done' and 
                history[last-1]['action'] == 'submitted'):
                request['stats'] = (self.parse_time(history[last]['time']) -
                                    self.parse_time(history[last-1]['time']))

            if not 'stats' in request:
                continue

            req_prio = str(request['priority'])

            if req_prio in self.fixed_priority_blocks(False):
                try:
                    com[req_prio]['stats'] += request['stats']
                    com[req_prio]['completed'] += request['completed_events']
                except:
                    com[req_prio] = dict()
                    com[req_prio]['stats'] = request['stats']
                    com[req_prio]['completed'] = request['completed_events']

        response = dict()
        for block, prio in self.fixed_priority_blocks(True):
            try:
                response["B" + block] = int(com[prio]['stats']/
                                            com[prio]['completed'])
            except:
                pass
            

        return json.dumps({"results": response})
