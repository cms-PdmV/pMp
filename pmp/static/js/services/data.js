angular.module('pmpApp').service('Data', ['$rootScope', function($rootScope) {
        var filteredData, // currently displayed data (after filtering)
            loadedData, // currently loaded data (before filtering)
            priorityFilter, statusFilter, pwgFilter; // filter details
        return {
            getFilteredData: function() {
                return this.filteredData;
            },
            setFilteredData: function(i) {
                this.filteredData = i;
                $rootScope.$broadcast('onChangeNotification:FilteredData')
            },
            getLoadedData: function() {
                return this.loadedData;
            },
            setLoadedData: function(i, append) {
                if (append) Array.prototype.push.apply(i, this.loadedData);
                this.loadedData = i;
                $rootScope.$broadcast('onChangeNotification:LoadedData')
            },
            getPriorityFilter: function() {
                return this.priorityFilter;
            },
            setPriorityFilter: function(i) {
                this.priorityFilter = i;
            },
            getPWGFilter: function() {
                return this.pwgFilter;
            },
            setPWGFilter: function(i) {
                this.pwgFilter = i;
            },
            getStatusFilter: function() {
                return this.statusFilter;
            },
            setStatusFilter: function(i) {
                this.statusFilter = i;
            },
            changeFilter: function(data, reset, value, isStatusFilter) {
                if (reset) {
                    if(isStatusFilter) {
                        this.statusFilter = {};
                    } else {
                        this.pwgFilter = {};
                    }
                }
                var key;
                for (var i = 0; i < data.length; i++) {
                    if (isStatusFilter) {
                        key = data[i].status; 
                        if (this.statusFilter[key] === undefined) this.statusFilter[key] = value;
                    } else {
                        key = data[i].pwg;
                        if (this.pwgFilter[key] === undefined) this.pwgFilter[key] = value;
                    }
                }
            },
            initializeFilter: function(data, isStatusFilter) {
                for (var i = 0; i < data.length; i++) {
                    if (data[i] != '') {
                        if (isStatusFilter) { 
                            this.statusFilter[data[i]] = true;
                        } else {
                            this.pwgFilter[data[i]] = true;
                        }
                    }
                }
            },
            resetEverything: function() {
                this.filteredData = [];
                this.loadedData = [];
                this.priorityFilter = ['', ''];
                this.statusFilter = {};
                this.pwgFilter = {};
            }
        }
}]);