angular.module('pmpApp').service('Data', function() {
        var filterPriority = ['', ''];
        var filterStatus = {};
        return {
            getFilterPriority: function() {
                return filterPriority;
            },
            setFilterPriority: function(i) {
                filterPriority = i;
            },
            getFilterStatus: function() {
                return filterStatus;
            },
            setFilterStatus: function(i) {
                filterStatus = i;
            },
            initializeFilter: function(data, isStatusFilter) {
                if (isStatusFilter) {
                    for (var i = 0; i < data.length; i++) {
                        if (data[i] != '') filterStatus[data[i]] = true;
                    }
                }
            },
            changeFilter: function(data, reset, value, isStatusFilter) {
                if (reset) {
                    if(isStatusFilter) filterStatus = {};
                }
                for (var i = 0; i < data.length; i++) {
                    var key = data[i].status; 
                    if (filterStatus[key] === undefined) filterStatus[key] = value;
                }
            }
        }
    });