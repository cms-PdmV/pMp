angular.module('pmpApp').service('Data', ['$rootScope', function($rootScope) {
        var filteredData, // currently displayed data (after filtering)
            loadedData, // currently loaded data (before filtering)
            inputTags, // input tags management
            priorityFilter, statusFilter, pwgFilter; // filter details
        return {
            getFilteredData: function() {
                return this.filteredData;
            },
            setFilteredData: function(i) {
                this.filteredData = i;
                $rootScope.$broadcast('onChangeNotification:FilteredData')
            },
            getInputTags: function() {
                return this.inputTags;
            },
            setInputTags: function(i, append, remove) {
                if (i === 'all') {
                    for (var j = 0; j < this.loadedData.length; j++) {
                        var input = this.loadedData[j].input;
                        if (this.inputTags.indexOf(input) === -1) this.inputTags.push(input);
                    }
                } else if (append) {
                    this.inputTags.push(i);
                } else if (remove) {
                    this.inputTags.splice(this.inputTags.indexOf(i), 1);
                } else {
                    this.inputTags = i;
                }
                $rootScope.$broadcast('onChangeNotification:InputTags')
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
            reloadFilters: function(data) {
                var iter, newStatus = {}, newPWG = {};
                for (var i = 0; i < data.length; i++) {
                    iter = data[i].status;
                    if (newStatus[iter] === undefined) {
                        newStatus[iter] = this.statusFilter[iter]
                    }
                    iter = data[i].pwg;
                    if (newPWG[iter] === undefined) {
                        newPWG[iter] = this.pwgFilter[iter]
                    }
                }
                this.setStatusFilter(newStatus);
                this.setPWGFilter(newPWG);
                this.setLoadedData(data);
            },
            resetEverything: function() {
                this.filteredData = [];
                this.inputTags = [];
                this.loadedData = [];
                this.priorityFilter = ['', ''];
                this.statusFilter = {};
                this.pwgFilter = {};
            }
        }
}]);