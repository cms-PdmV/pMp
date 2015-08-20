angular.module('pmpApp').service('Data', function() {
        var filterPriority = ['', ''];
        return {
            setFilterPriority: function(i) {
                filterPriority = i;
            },
            getFilterPriority: function(i) {
                return filterPriority;
            }
        }
    });