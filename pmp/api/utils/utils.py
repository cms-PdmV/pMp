

class APIUtils():

    @staticmethod
    def parse_csv(parsable):
        """
        Generate array from csv
        """
        if parsable == 'all':
            return None
        else:
            return parsable.split(',')

    @staticmethod
    def parse_priority_csv(arr):
        '''
        Generate array from priority csv
        '''
        for p, _ in enumerate(arr):
            if arr[p] == '':
                arr[p] = int(-p)
            else:
                arr[p] = int(arr[p])
        return arr

