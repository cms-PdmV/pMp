angular.module('pmpApp').service('Data', function() {
        var priorityFilter = ['', ''];
        var statusFilter = {};
        var pwgFilter = {};
        return {
            getPriorityFilter: function() {
                return priorityFilter;
            },
            setPriorityFilter: function(i) {
                priorityFilter = i;
            },
            getPWGFilter: function() {
                return pwgFilter;
            },
            setPWGFilter: function(i) {
                pwgFilter = i;
            },
            getStatusFilter: function() {
                return statusFilter;
            },
            setStatusFilter: function(i) {
                statusFilter = i;
            },
            initializeFilter: function(data, isStatusFilter) {
                for (var i = 0; i < data.length; i++) {
                    if (data[i] != '') {
                        if (isStatusFilter) { 
                            statusFilter[data[i]] = true;
                        } else {
                            pwgFilter[data[i]] = true;
                        }
                    }
                }
            },
            changeFilter: function(data, reset, value, isStatusFilter) {
                if (reset) {
                    if(isStatusFilter) {
                        statusFilter = {};
                    } else {
                        pwgFilter = {};
                    }
                }
                var key;
                for (var i = 0; i < data.length; i++) {
                    if (isStatusFilter) {
                        key = data[i].status; 
                        if (statusFilter[key] === undefined) statusFilter[key] = value;
                    } else {
                        key = data[i].pwg;
                        if (pwgFilter[key] === undefined) pwgFilter[key] = value;
                    }
                }
            }
        }
    });