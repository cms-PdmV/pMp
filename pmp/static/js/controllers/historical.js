angular.module('pmpApp').controller('HistoricalController', ['$http', '$location', '$scope', '$interval', 'PageDetailsProvider', function($http, $location, $scope, $interval, PageDetailsProvider) {

    $scope.allPWG = {};

    $scope.allRequestData = [];

    $scope.allStatus = {};

    $scope.inputTags = [];

    $scope.init = function() {
        $scope.page = PageDetailsProvider.historical;
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

        if ($location.search().x != undefined && $location.search().x != '') {
            var tmp = $location.search().x.split(',');
            $scope.filterPriority = {'0': tmp[0], '1': tmp[1]};
            $scope.showDate = $location.search().t;
        } else {
            $scope.filterPriority = {'0': '', '1': ''};
        }

        if ($location.search().w != undefined && $location.search().w != '') {
            var tmp = $location.search().w.split(',');
            for (var i = 0; i < tmp.length; i++) {
                $scope.allPWG[tmp[i]] = true;
            }
        }

        if ($location.search().s != undefined) {
            var tmp = $location.search().s.split(',');
            for (var i = 0; i < tmp.length; i++) {
                $scope.allStatus[tmp[i]] = true;
            }
        }

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
                for (var i = 0; i < Object.keys($scope.allStatus).length; i++) {
                    if (!$scope.allStatus[Object.keys($scope.allStatus)[i]]) {
                        filter = true;
                        break;
                    }
                }
                if (!filter) {
                    for (var i = 0; i < Object.keys($scope.allPWG).length; i++) {
                        if (!$scope.allPWG[Object.keys($scope.allPWG)[i]]) {
                            filter = true;
                            break;
                        }
                    }
                }
            }
            $scope.query(filter);
        }
    };


    $scope.priorityPerBlock = {
        1: 110000,
        2: 90000,
        3: 85000,
        4: 80000,
        5: 70000,
        6: 63000
    };

    $scope.query = function(filter) {
        if (!$scope.inputTags.length) {
            return null;
        }

        $scope.loadingData = true;
        
        // Add priority filter
        var x = '';
        if(filter && $scope.filterPriority != undefined) {
            if($scope.filterPriority[0] != undefined) {
                x += $scope.filterPriority[0];
            }
            x += ',';
            if($scope.filterPriority[1] != undefined) {
                x += $scope.filterPriority[1];
            }
        } else {
            x = ','
        }
        
        // Add status filter
        var s = '';
        if (filter && Object.keys($scope.allStatus).length) {
            for (var i = 0; i < Object.keys($scope.allStatus).length; i++) {
                if ($scope.allStatus[Object.keys($scope.allStatus)[i]]) {
                    s += Object.keys($scope.allStatus)[i] + ',';
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

        // Add pwg filter
        var w = '';
        if (filter && Object.keys($scope.allPWG).length) {
            for (var i = 0; i < Object.keys($scope.allPWG).length; i++) {
                if ($scope.allPWG[Object.keys($scope.allPWG)[i]]) {
                    w += Object.keys($scope.allPWG)[i] + ',';
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
                    $scope.allStatus = data.data.results.status;
                    $scope.allPWG = data.data.results.pwg;
                    $scope.loadTaskChain = data.data.results.taskchain;
                }
                $scope.loadingData = false;
                $scope.setURL();
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
        if ($scope.filterPriority['0'] != '' || $scope.filterPriority['1'] != '') {
            params.x = $scope.filterPriority['0'] + ',' + $scope.filterPriority['1'];
        }

        var w = [];
        for (var i in $scope.allPWG) {
            if ($scope.allPWG[i]) {
                w.push(i);
            }
        }
        params.w = w.join(',');

        var s = [];
        for (var i in $scope.allStatus) {
            if ($scope.allStatus[i]) {
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
        $scope.allStatus = {};
        $scope.allPWG = {};
        $scope.setURL();
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

    $interval($scope.updateLastUpdate('stats'), 2*60*1000);
    $interval($scope.updateCurrentDate, 1000);
}]);