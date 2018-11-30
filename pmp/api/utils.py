"""Utils for pMp API"""
import time


class APIUtils(object):
    """Utils for pMp API"""

    @staticmethod
    def parse_csv(parsable):
        """Generate array from csv"""
        if parsable == "all":
            return None
        else:
            return parsable.split(',')

    @staticmethod
    def parse_priority(arr):
        """Generate array from priority csv"""
        arr = arr.split(',')
        for index, value in enumerate(arr):
            if arr[index] == '':
                arr[index] = int(-index)
            else:
                arr[index] = int(value)

        return arr


class Timer(object):
    """Context manager for timing stuff - from huyng.com"""
    def __init__(self, description, verbose=True):
        self.description = description
        self.verbose = verbose

    def __enter__(self):
        self.start = time.time()
        return self

    def __exit__(self, *args):
        self.end = time.time()
        self.secs = self.end - self.start
        self.msecs = self.secs * 1000
        print('[Timer] => "' + self.description + '" took ' + str(self.secs) + ' seconds')
