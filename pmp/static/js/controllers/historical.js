angular.module('pmpApp').controller('HistoricalController', ['$http', '$location', '$scope', '$interval', 'PageDetailsProvider', 'Data', function($http, $location, $scope, $interval, PageDetailsProvider, Data) {

    $scope.allRequestData = [];

    $scope.inputTags = [];

    $scope.init = function() {
        $scope.page = PageDetailsProvider.historical;
        Data.resetEverything();
        if ($location.search().y != undefined && $location.search().y != '') {
            $scope.zoomOnY = ($location.search().y == 'true');
        } else {
            $scope.zoomOnY = false;
        }
        
        if ($location.search().p != undefined && $location.search().p != '') {
            $scope.probing = parseInt($location.search().p, 10);
        } else {
            $scope.probing = 40;
        }
        
        if ($location.search().t != undefined && $location.search().t != '') {
            $scope.showDate = ($location.search().t == 'true');
        } else {
            $scope.showDate = false;
        }

        if ($location.search().x !== undefined && $location.search().x != '') Data.setPriorityFilter($location.search().x.split(','));
        if ($location.search().s !== undefined && $location.search().s != '') Data.initializeFilter($location.search().s.split(','), true); 
        if ($location.search().w !== undefined && $location.search().w != '') Data.initializeFilter($location.search().w.split(','), false);

        if ($location.search().r != undefined && $location.search().r != '') {
            var tmp = $location.search().r.split(',');
            for (var i = 0; i < tmp.length; i++) {
                $scope.inputTags.push(tmp[i]);
            }
            $scope.query(true);
        }
        $scope.$broadcast('updateURL');
    }

    $scope.load = function(request, add, more, defaultPWG, defaultStatus) {
        if (!request) {
            $scope.showPopUp('warning', 'Your request parameters are empty');
        } else if (add & $scope.inputTags.indexOf(request) !== -1) {
            $scope.showPopUp('warning', 'Your request is already loaded');
        } else {
            $scope.allRequestData = [];
            $scope.loadingData = true;
            if (!add) {
                $scope.tagsRemoveAll();
            }
            $scope.inputTags.push(request);
            var filter = add
            if (filter) {
                filter = false;
                for (var i = 0; i < Object.keys(Data.getStatusFilter()).length; i++) {
                    if (!Data.getStatusFilter()[Object.keys(Data.getStatusFilter())[i]]) {
                        filter = true;
                        break;
                    }
                }
                if (!filter) {
                    for (var i = 0; i < Object.keys(Data.getPWGFilter()).length; i++) {
                        if (!Data.getPWGFilter()[Object.keys(Data.getPWGFilter())[i]]) {
                            filter = true;
                            break;
                        }
                    }
                }
            }
            $scope.query(filter);
        }
    };

    $scope.query = function(filter) {
        if (!$scope.inputTags.length) {
            return null;
        }

        $scope.loadingData = true;
        
        // Add priority filter
        var x = '';
        if(filter && Data.getPriorityFilter() != undefined) {
            if(Data.getPriorityFilter()[0] != undefined) {
                x += Data.getPriorityFilter()[0];
            }
            x += ',';
            if(Data.getPriorityFilter()[1] != undefined) {
                x += Data.getPriorityFilter()[1];
            }
        } else {
            x = ','
        }

        // Add status filter
        var s = '';
        if (filter && Object.keys(Data.getStatusFilter()).length) {
            for (var i = 0; i < Object.keys(Data.getStatusFilter()).length; i++) {
                if (Data.getStatusFilter()[Object.keys(Data.getStatusFilter())[i]]) {
                    s += Object.keys(Data.getStatusFilter())[i] + ',';
                }
            }
            if (s.length > 1) {
                s = s.substr(0, s.length-1);
            } else {
                s = '_';
            }
        } else {
            s = 'all'
        }
        console.log(s);

        // Add pwg filter
        var w = '';
        if (filter && Object.keys(Data.getPWGFilter()).length) {
            for (var i = 0; i < Object.keys(Data.getPWGFilter()).length; i++) {
                if (Data.getPWGFilter()[Object.keys(Data.getPWGFilter())[i]]) {
                    w += Object.keys(Data.getPWGFilter())[i] + ',';
                }
            }
            if (w.length > 1) {
                w = w.substr(0, w.length-1);
            } else {
                w = '_';
            }
        } else {
            w = 'all'
        }
        
        var p = 40;
        if ($scope.probing != '') {
            p = $scope.probing;
        }

        var promise = $http.get("api/" + $scope.inputTags.join(',')
                                + '/historical/' + p + '/' + x + '/' + s + '/' + w);
        promise.then(function(data) {
                if (!data.data.results.status) {
                    $scope.showPopUp('error', 'No results for this request parameters');
                } else {
                    if (!data.data.results.data.length) {
                        data.data.results.error != '' ? $scope.showPopUp('error', data.data.results.error) : $scope.showPopUp('warning', 'All data is filtered');
                    }
                    $scope.allRequestData = data.data.results.data;
                    Data.setStatusFilter(data.data.results.status);
                    Data.setPWGFilter(data.data.results.pwg);
                    $scope.loadTaskChain = data.data.results.taskchain;
                }
                $scope.loadingData = false;
                $scope.setURL();
                $scope.$broadcast('updateFilterTag');
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
                $scope.loadingData = false;
            });

        $http.get("api/" + $scope.inputTags.join(',') + '/submitted/' + x + '/' + w).then(function(data) {
                if (data.data.results) {
                    $scope.listSubmitted = data.data.results;
                } else {
                    $scope.listSubmitted = {};
                }
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
            });
    }

    $scope.setURL = function() {
        $location.path($location.path(), false);
        var params = {}
        params.p = $scope.probing;
        if ($scope.inputTags.length) {
            params.r = $scope.inputTags.join(',');
        }
        params.t = $scope.showDate + "";
        params.x = Data.getPriorityFilter().join(',');

        var w = [];
        for (var i in Data.getPWGFilter()) {
            if (Data.getPWGFilter()[i]) {
                w.push(i);
            }
        }
        params.w = w.join(',');

        var s = [];
        for (var i in Data.getStatusFilter()) {
            if (Data.getStatusFilter()[i]) {
                s.push(i);
            }
        }
        params.s = s.join(',');

        $scope.zoomOnY != undefined ? params.y = $scope.zoomOnY + '': params.y = 'false';
        $location.search(params);
        $scope.url = $location.absUrl();
    }

    $scope.tagRemove = function(tagToRemove) {
        $scope.inputTags.splice($scope.inputTags.indexOf(tagToRemove), 1);
        if ($scope.inputTags.length) {
            $scope.query(true);
        } else {
            $scope.tagsRemoveAll();
        }
    }

    $scope.tagsRemoveAll = function() {
        $scope.inputTags = [];
        $scope.allRequestData = [];
        Data.setStatusFilter({});
        Data.setPWGFilter({});
        $scope.setURL();
        $scope.$broadcast('updateFilterTag');
    }

    $scope.takeScreenshot = function(format) {
        $scope.loading = true;
        if (format === undefined) format = 'svg';
        var xml = (new XMLSerializer).serializeToString(document.getElementById("ctn").getElementsByTagName("svg")[0]).replace(/#/g,'U+0023');
        $http.get('ts/'+ format +'/' + xml).then(function(data) {
            window.open(data.data);
            $scope.loading = false;
        });
    }

    $scope.updateRequestData = function() {
        $scope.query(true);
    }
    $interval($scope.updateCurrentDate, 1000);
    $interval(function(){$scope.updateLastUpdate('stats')}, 2*60*1000);
    $scope.updateLastUpdate('stats');
}]);