"""Utils for pMp API"""

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
    def parse_priority_csv(arr):
        """Generate array from priority csv"""
        for index, value in enumerate(arr):
            if arr[index] == "":
                arr[index] = int(-index)
            else:
                arr[index] = int(value)
        return arr
