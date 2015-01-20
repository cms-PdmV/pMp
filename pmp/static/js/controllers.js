'use strict';

pmpApp.controller('MainController', function($location, $route, $rootScope, $scope, $timeout) {

    $scope.nav = function(where) {
        $scope.showview = !$scope.showview;
        if (!$scope.showview) {
            $timeout(function() {$location.path(where);}, 1100);
        }
    };

    var original = $location.path;
    $location.path = function (path, reload) {
        if (reload === false) {
            var lastRoute = $route.current;
            var un = $rootScope.$on('$locationChangeSuccess', function () {
                $route.current = lastRoute;
                un();
            });
        }
        return original.apply($location, [path]);
    };

    $scope.showPopUp = function(type, text) {
        switch (type) {
        case 'error':
            $scope.popUp = {show: true, title: 'Error', message: text,
                            style: 'panel-danger', icon: 'fa-frown-o'};
            $timeout(function() {$scope.showPopUp('', '');}, 2000);
        break;
        case 'warning':
            $scope.popUp = {show: true, title: 'Warning', message: text,
                            style: 'panel-warning', icon: 'fa-exclamation-triangle'};
            $timeout(function() {$scope.showPopUp('', '');}, 2000);
        break;
        case 'success':
            $scope.popUp = {show: true, title: 'Success', message: text,
                            style: 'panel-success', icon: 'fa-check'};
            $timeout(function() {$scope.showPopUp('', '');}, 2000);
        break;
        default:
            $scope.popUp.show = false;
            break;
        }
    }

    $rootScope.showview = false;
    $timeout(function() {$scope.nav('');}, 100);
});


pmpApp.controller('CampaignsController', function($http, $location, $interval,
                                                  $rootScope, $scope, $timeout) {

    // currently displayed data (after filtering)
    $scope.allRequestData = [];

    // all gathered data (before filtering)
    $scope.cachedRequestData = [];

    $scope.graphParam = ['selections', 'grouping', 'value', 'stacking', 'coloring'];

    $scope.graphTabs = ['member_of_campaign', 'total_events',
                        'status', 'prepid', 'priority', 'pwg'];

    $scope.init = function(data) {
        if($location.search()['p'] != undefined) {
            var toLoad = $location.search()['p'].split(',');
            $scope.aOptionsValues = toLoad.slice(0,6);
            $scope.aRadioValues = toLoad.slice(6,8);
        } else {
            $scope.aOptionsValues = [1,2,4,0,0,0];
            $scope.aRadioValues = [0, 0];
        }

        $scope.requests.selections = [];
        var initGrouping = [];
        var initStacking = [];
        var initColoring = '';
        var initValue = '';
        for (var i = 0; i < $scope.aOptionsValues.length; i++) {
            if ($scope.aOptionsValues[i] == 0) {
                $scope.requests.selections.push($scope.graphTabs[i]);
            } else if ($scope.aOptionsValues[i] == 1) {
                initGrouping.push($scope.graphTabs[i]);
            } else if ($scope.aOptionsValues[i] == 2) {
                initValue = $scope.graphTabs[i];
            } else if ($scope.aOptionsValues[i] == 3) {
                initStacking.push($scope.graphTabs[i]);
            } else if ($scope.aOptionsValues[i] == 4) {
                initColoring = $scope.graphTabs[i];
            } 
        }
        $scope.requests.options = {
            grouping: initGrouping,
            value: initValue,
            stacking: initStacking,
            coloring: initColoring
        };

        $scope.requests.radio = {}

        if ($scope.aRadioValues[1] == 1) {
            $scope.requests.radio['scale'] = ["log", "linear"];    
        } else {
            $scope.requests.radio['scale'] = ["linear", "log"];    
        }

        if ($scope.aRadioValues[0] == 1) {
            $scope.requests.radio['mode'] = ["number of requests",
                                             "number of events"];
        } else {
            $scope.requests.radio['mode'] = ["number of events",
                                             "number of requests"];
        }

        $scope.showDate = $location.search()['t'] === 'true';
        $scope.chainMode = $location.search()['m'] === 'true';
        if($location.search()['pn'] != undefined) {
            $scope.minPriority = $location.search()['pn'] + "";
        } else {
            $scope.minPriority = "";
        }
        if($location.search()['px'] != undefined) {
            $scope.maxPriority = $location.search()['px'] + "";
        } else {
            $scope.maxPriority = "";
        }
        $scope.initStatus();

        //initiate allRequestData from URL
        if($location.search()['r'] != undefined) {
            var toLoad = $location.search()['r'].split(',');
            $scope.modeUpdate();
            for (var i = 0; i < toLoad.length; i++) {
                $scope.load(toLoad[i], true, toLoad.length);
            }
        }
    }

    $scope.initStatus = function() {
        $scope.status = {}
        for (var i = 0; i < $scope.piecharts.fullTerms.length; i++) {
            var name = $scope.piecharts.fullTerms[i].slice(0,2),
            tmp = true;
            if($location.search()[name] != undefined) {
                tmp = ($location.search()[name] === 'true');
            }
            $scope.status[$scope.piecharts.fullTerms[i]] = {name:name, selected: tmp};
        }
    }

    $scope.load = function(campaign, add, more) {
        if (!campaign) {
            $scope.showPopUp('warning', 'Your request parameters are empty');
        }
        else if(add & $scope.tags.hasTag(campaign)) {
            $scope.showPopUp('warning', 'Your request is already loaded');
        }
        else {
            $scope.loadingData = true;
            if ($scope.chainMode) {
                var promise = $http.get("api/" + campaign + "/chain");
            } else {
                var promise = $http.get("api/" + campaign + "/simple");
            }
            promise.then(function(data) {
                if (!data.data.results.length) {
                    $scope.showPopUp('error', 'No results for this request parameters');   
                } else {

                    if (add) {
                        data.data.results.push.apply(data.data.results, $scope.cachedRequestData);
                        //data.data.results.push.apply(data.data.results, $scope.allRequestData);
                    } else {
                        for (var i = 0; i < $scope.tags.getTags().length; i++) {
                            $scope.tags.removeTag($scope.tags.getTags()[i]);
                        }
                    }

                    if (campaign == 'all') {
                        for (var i = 0; i < data.data.results.length; i++) {
                            if (! $scope.tags.hasTag(data.data.results[i]['member_of_campaign'])) {
                                if (data.data.results[i]['member_of_campaign'] == ''){
                                    $scope.tags.addTag('NULL');
                                } else {
                                    $scope.tags.addTag(data.data.results[i]['member_of_campaign']);
                                }
                            }
                        }
                    } else {
                        $scope.tags.addTag(campaign);
                    }
                    
                    //$scope.allRequestData = data.data.results;
                    $scope.cachedRequestData = data.data.results;
                    $scope.updateRequestData();
                    $scope.setURL();
                }
                if (more) {
                    $scope.loadingData = !(more === $scope.tags.getTags().length);
                } else {
                    $scope.loadingData = false;
                }
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
                $scope.loadingData = false;
            });
        }
    };

    $scope.modeUpdate = function() {
        if ($scope.chainMode) {
            $scope.title = 'Get_Stats';
        } else {
            $scope.title = 'Dashboard';
        }
        $scope.allRequestData = [];
        $scope.setURL();
    };

    $scope.piecharts = {};
    $scope.piecharts.compactTerms = ["done", "to do"];
    $scope.piecharts.domain = ["new", "validation", "done", "approved",
                               "submitted", "nothing", "defined", "to do"];
    $scope.piecharts.fullTerms = ["new", "validation", "defined",
                                  "approved", "submitted", "done", "upcoming"];
    $scope.piecharts.nestBy = ["member_of_campaign", "status"];
    $scope.piecharts.sum = "total_events";

    $scope.priorityPerBlock = {1: 110000, 2: 90000, 3: 85000, 4: 80000, 5: 70000, 6: 63000};

    $scope.requests = {};
    $scope.requests.settings = {
        duration: 1000,
        legend: true,
        sort: true
    };

    $scope.setURL = function(optionName, optionValue){
        $location.path("campaign", false);
        if (typeof optionName != undefined && typeof optionValue != undefined) {
            $scope.aOptionsValues[$scope.graphTabs.indexOf(optionValue)] = $scope.graphParam.indexOf(optionName);
        }
        var params = {}
        if ($scope.tags.getTags().length) {
            params['r'] = $scope.tags.getTags().join(',')
        }
        params['p'] = $scope.aOptionsValues.join(',') + ',' + $scope.aRadioValues.join(',');        
        params['t'] = $scope.showDate + "";
        params['m'] = $scope.chainMode + "";
        params['pn'] = $scope.minPriority + "";
        params['px'] = $scope.maxPriority + "";
        for(var i in $scope.status) {
            params[$scope.status[i]['name']] = ($scope.status[i]['selected'] === true) + "";
        }

        $location.search(params);
        $scope.url = $location.absUrl();
    }

    $scope.setScaleAndOperation = function(i, value) {
        if ($scope.aRadioValues[i] != value) {
            $scope.aRadioValues[i] = value;
            $scope.setURL();
        }
    }

    $scope.tags = angular.element('#campaignList').tags({
        tagClass: "btn btn-sm btn-primary",
        beforeDeletingTag: function(tag){
            $scope.tagsChanged(tag);
        }
    });

    $scope.tagsChanged = function(tag){
        if (tag == 'NULL') {
            tag = '';
        }
        var data = []
        for (var i = 0; i < $scope.allRequestData.length; i++) {
            if ($scope.allRequestData[i]['member_of_campaign'] !== tag) {
                data.push($scope.allRequestData[i]);
            }
        }
        $scope.allRequestData = data;
        $scope.setURL();
    }

    $scope.takeScreenshot = function() {
        console.log("Not yet implemented");
    }

    $scope.updateDate = function() {
        $scope.dt = new Date();
    }

    $scope.updateRequestData = function() {
        $scope.allRequestData = $scope.cachedRequestData;
        var data = []
        for (var i = 0; i < $scope.allRequestData.length; i++) {
            if ($scope.allRequestData[i]['priority'] >= $scope.minPriority) {
                if ($scope.maxPriority != "") {
                    if ($scope.allRequestData[i]['priority'] <= $scope.maxPriority) {
                        data.push($scope.allRequestData[i]);
                    } 
                } else {
                    data.push($scope.allRequestData[i]);
                }
            }
        }
        $scope.allRequestData = data;
        var data = []
        for (var i = 0; i < $scope.allRequestData.length; i++) {
            //some objects have status 'none'
            if ($scope.status[$scope.allRequestData[i].status] != undefined) {
                    if ($scope.status[$scope.allRequestData[i]['status']].selected) {
                        data.push($scope.allRequestData[i]);
                    }
            }
        }
        $scope.allRequestData = data;
        $scope.setURL();
    }

    $interval($scope.updateDate, 1000);

    new ZeroClipboard(document.getElementById('copy'), {
        moviePath: '/lib/zeroclipboard/ZeroClipboard.swf'
    });
});

pmpApp.controller('IndexController', function() {

});