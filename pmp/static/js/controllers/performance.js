angular.module('pmpApp').controller('PerformanceController', ['$http', '$interval', '$location', '$scope', 'PageDetailsProvider', 'Data', function($http, $interval, $location, $scope, PageDetailsProvider, Data) {
        $scope.cachedRequestData = [];
        $scope.allRequestData = [];
        $scope.inputTags = [];
        $scope.load = function(input, add, more, defaultPWG, defaultStatus) {
        if (!input) {
            $scope.showPopUp('warning', 'Your request parameters are empty');
        } else if (add & $scope.inputTags.indexOf(input) !== -1) {
            $scope.showPopUp('warning', 'Your request is already loaded');
        } else {
            $scope.loadingData = true;
            var promise = $http.get("api/" + input + "/performance/_");
            promise.then(function(data) {
                if (!data.data.results.length) {
                    $scope.showPopUp('error', 'No results for this request parameters');
                    $scope.loadingData = false;
                } else {
                    $scope.allRequestData = [];
                    if (add) {
                        data.data.results.push.apply(data.data.results, $scope.cachedRequestData);
                    } else {
                        $scope.inputTags = [];
                        $scope.updateOnRemoval([], {}, {});
                    }

                    $scope.cachedRequestData = data.data.results;

                    if (input == 'all') {
                        for (var i = 0; i < data.data.results.length; i++) {
                            if ($scope.inputTags.indexOf(data.data.results[i].member_of_campaign) === -1) {
                                $scope.inputTags.push(data.data.results[i].member_of_campaign);
                            }
                        }
                    } else {
                        $scope.inputTags.push(input);
                    }
                    Data.changeFilter(data.data.results, false, defaultStatus, true);
                    Data.changeFilter(data.data.results, false, defaultPWG, false);
                }

                if (!more || more == $scope.inputTags.length) {
                    $scope.updateRequestData();
                    $scope.setURL();
                    $scope.loadingData == false;
                }
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
                $scope.loadingData = false;
            });
        }
    }

    $scope.tagRemove = function(tagToRemove) {
        $scope.loadingData = true;
        setTimeout(function() {
            var tmp = $scope.cachedRequestData;
            var data1 = [];
            var newPWGObjectTmp = {};
            var newStatusObjectTmp = {}
            if (tagToRemove !== '*') {
                for (var i = 0; i < tmp.length; i++) {
                    if (tmp[i].member_of_campaign !== tagToRemove) {
                        data1.push(tmp[i]);
                        if (newStatusObjectTmp[tmp[i].status] === undefined) {
                            newStatusObjectTmp[tmp[i].status] = Data.getStatusFilter()[tmp[i].status]
                        }

                        if (newPWGObjectTmp[tmp[i].pwg] === undefined) {
                            newPWGObjectTmp[tmp[i].pwg] = Data.getPWGFilter()[tmp[i].pwg]
                        }
                    }
                }
                $scope.inputTags.splice($scope.inputTags.indexOf(tagToRemove), 1);
            }
            $scope.updateOnRemoval(data1, newPWGObjectTmp, newStatusObjectTmp);
        }, 1000);
    }

    $scope.updateOnRemoval = function(requestData, newPWGObject, newStatusObject) {
        $scope.cachedRequestData = requestData;
        Data.setStatusFilter(newStatusObject);
        Data.setPWGFilter(newPWGObject);
        $scope.allRequestData = requestData;
        $scope.$broadcast('updateFilterTag');
        $scope.loadingData = false;
    }

    $scope.applyHistogram = function(d, e) {
        $scope.histogramData = d;
        $scope.histogramDataExtended = e;
    }

    $scope.applyDifference = function(d) {x
        $scope.difference = d;
        $scope.setURL();
    }

    $scope.changeScale = function (a) {
        $scope.linearScale = a;
        $scope.setURL();
    }

    $scope.updateRequestData = function() {
        $scope.loadingData = true;

        var max = Data.getPriorityFilter()[1];
        var min = Data.getPriorityFilter()[0];
        if (isNaN(max) || max == '') {
            max = Number.MAX_VALUE;
        }
        if (isNaN(min) || min == '') {
            min = 0;
        }

        var tmp = $scope.cachedRequestData;
        var data = [];
        for (var i = 0; i < tmp.length; i++) {
            if (tmp[i].priority >= min &&
                tmp[i].priority <= max &&
                Data.getStatusFilter()[tmp[i].status] && Data.getPWGFilter()[tmp[i].pwg]) {
                data.push(tmp[i]);
            }
        }
        $scope.allRequestData = data;
        $scope.loadingData = false;
    }

    $scope.takeScreenshot = function() {
        var tmp = document.getElementById("ctn");
        var svg = tmp.getElementsByTagName("svg")[0];
        var svg_xml = (new XMLSerializer).serializeToString(svg);
        var blob = new Blob([svg_xml], {type: "text/plain;charset=utf-8"});
        saveAs(blob, "screenshot.html");
    }

    $scope.setURL = function() {
        $location.path($location.path(), false);
        var params = {}

        // number of bins
        if ($scope.bins != undefined || $scope.bins != '') {
            params.b = $scope.bins;
        }
        // list of requests separated by comma
        if ($scope.inputTags.length) {
            params.r = $scope.inputTags.join(',')
        }
        // if show the time block
        if ($scope.showDate != undefined) {
            params.t = $scope.showDate + ''
        }
        // set filter priority
        params.x = Data.getPriorityFilter().join(',');
        // set filter pwgs
        if (!$scope.isEmpty(Data.getPWGFilter())) {
            var w = [];
            for (var i in Data.getPWGFilter()) {
                if (Data.getPWGFilter()[i]) w.push(i);
            }
            params.w = w.join(',');
        }

        // set filter status
        if (!$scope.isEmpty(Data.getStatusFilter())) {
            var s = [];
            for (var i in Data.getStatusFilter()) {
                if (Data.getStatusFilter()[i]) s.push(i);
            }
            params.s = s.join(',');
        }

        // setting minuend
        if ($scope.difference.minuend != '') {
            params.min = $scope.difference.minuend;
        }
        // setting subtrahend
        if ($scope.difference.subtrahend != '') {
            params.sub = $scope.difference.subtrahend;
        }
        // set scale
        if ($scope.linearScale != undefined) {
            params.l = $scope.linearScale + '';
        }

        $location.search(params);
        $scope.$broadcast('updateURL');
    }

    $scope.init = function() {
        $scope.page = PageDetailsProvider.performance;
        $scope.difference = {minuend: 'done', subtrahend: 'created'}        
        $scope.selections = ['validation', 'approved', 'submitted'];

        if ($location.search().min != undefined) {
            var inx = $scope.selections.indexOf($location.search().min);
            if (inx != -1) {
                $scope.difference.minuend = $location.search().min;
                $scope.selections.splice(inx, 1);
            }
        }

        if ($location.search().sub != undefined) {
            var inx = $scope.selections.indexOf($location.search().sub);
            if (inx != -1) {
                $scope.difference.subtrahend = $location.search().sub;
                $scope.selections.splice(inx, 1);
            }
        }

        $scope.showDate = ($location.search().t === 'true');
        $scope.linearScale = ($location.search().l === 'true');
        if ($location.search.b != '' && !isNaN($location.search().b)) {
            $scope.bins = parseInt($location.search().b, 10);
        } else {
            $scope.bins = 10;
        }
        if ($location.search().x !== undefined && $location.search().x != '') Data.setPriorityFilter($location.search().x.split(','));
        if ($location.search().s !== undefined && $location.search().s != '') Data.initializeFilter($location.search().s.split(','), true); 
        if ($location.search().w !== undefined && $location.search().w != '') Data.initializeFilter($location.search().w.split(','), false); 
        if ($location.search().r != undefined) {
            $scope.loadingData = true;
            var tmp = $location.search().r.split(',');
            var arg = false;
            if (Object.keys(Data.getPWGFilter()).length) {
                var arg = tmp.length;
            }
            for (var i = 0; i < tmp.length; i++) {
                $scope.load(tmp[i], true, arg);
            }
        } else {
            $scope.url = $location.absUrl();
        }
    }
    $interval($scope.updateCurrentDate, 1000);
    $interval(function(){$scope.updateLastUpdate('requests')}, 2*60*1000);
    $scope.updateLastUpdate('requests');
}]);