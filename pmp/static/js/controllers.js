'use strict';

pmpApp.controller('MainController', function($location, $route, $rootScope, $scope, $timeout) {

    $scope.nav = function(where) {
        $scope.showview = !$scope.showview;
        if (!$scope.showview) { $location.search({}); $timeout(function() {
                    $location.path(where);
                    $timeout(function() {$scope.nav('');}, 100);
                }, 1100);}
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


pmpApp.controller('CampaignsController', function($http, $location, $interval, $q,
                                                  $rootScope, $scope, $timeout) {

    // currently displayed data (after filtering)
    $scope.allRequestData = [];

    // all gathered data (before filtering)
    $scope.cachedRequestData = [];

    $scope.graphParam = ['selections', 'grouping', 'value', 'stacking', 'coloring'];

    $scope.graphTabs = ['member_of_campaign', 'total_events',
                        'status', 'prepid', 'priority', 'pwg'];

    $scope.init = function(data) {

        $scope.isChainUrl = ($location.path() === '/chain');
        $scope.pwg = {};

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
        $scope.chainMode = ($location.search()['m'] === 'true') || $scope.isChainUrl;
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
        $scope.modeUpdate();

        $scope.pwg = {};
        if($location.search()['w'] != undefined) {
            var toLoad = $location.search()['w'].split(',');
            for (var i = 0; i < toLoad.length; i++) {            
                $scope.pwg[toLoad[i]] = {name: toLoad[i], selected: true};
            }
        } 

        //initiate allRequestData from URL
        if($location.search()['r'] != undefined) {
            var toLoad = $location.search()['r'].split(',');
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
                    $scope.updatePwg(data.data.results, !more);
                    if (add) {
                        data.data.results.push.apply(data.data.results, $scope.cachedRequestData);
                    } else {
                        $scope.cachedRequestData = [];
                        $scope.tagsRemoveAll();
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
                    $scope.cachedRequestData = data.data.results;
                    $scope.updateRequestData();
                    $scope.setURL();
                }
                if (more) {
                    $scope.loadingData = !(more === $scope.tags.getTags().length);
                }
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
                $scope.loadingData = false;
            });
        }
    };

    $scope.modeUpdate = function() {
        if ($scope.isChainUrl) {
            $scope.title = 'Chained campaign';
        } else {
            if ($scope.chainMode) {
                $scope.title = 'Campaign: Get_Stats';
            } else {
                $scope.title = 'Campaign: Dashboard';
            }
            $scope.cachedRequestData = [];
            $scope.allRequestData = [];
            //$scope.updateRequestData();
            $scope.tagsRemoveAll();
        }
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
        $location.path($location.path(), false);
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

        var tmp = $scope.pwg;
        var w = [];
        for (var i = 0; i < Object.keys(tmp).length; i++) {
            if (tmp[Object.keys(tmp)[i]].selected) {
                w.push(tmp[Object.keys(tmp)[i]].name);
            }            
        }
        params['w'] = w.join(',');

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
            beforeDeletingTag: function(tag) {
                $scope.loadingData = true;
                return true;
            },
            afterDeletingTag: function(tag) {
                $scope.loadingData = true;
                var promise = $scope.tagsChanged(tag);
                promise.then(function() {
                        $scope.resetPwg();
                        $scope.setURL();
                        $scope.loadingData = false;
                    }, function(reason) {
                        $scope.resetPwg();
                        $scope.loadingData = false;
                    });
            }
        });

    $scope.tagsChanged = function(tag){
        var deferred = $q.defer();
        if (tag == 'NULL') {
            tag = '';
        }
        var data = [];
        for (var i = 0; i < $scope.cachedRequestData.length; i++) {
            if ($scope.cachedRequestData[i]['member_of_campaign'] !== tag) {
                data.push($scope.cachedRequestData[i]);
            }            
        }
        $scope.cachedRequestData = data;
        if ($scope.updateRequestData()) {
            deferred.resolve();
        } else {
            deferred.reject();
        };
        return deferred.promise;
    }

    $scope.tagsRemoveAll = function() {
        var tmp = angular.copy($scope.tags.getTags());
        for (var i = 0; i < tmp.length; i++) {
            $scope.tags.removeTag(tmp[i]);
        }
    }

    $scope.takeScreenshot = function() {
        console.log("Not yet implemented");
    }

    $scope.updateDate = function() {
        $scope.dt = new Date();
    }

    $scope.resetPwg = function() {
        var tmp = $scope.cachedRequestData;
        var data = {};
        for (var i = 0; i < tmp.length; i++) {
            if (data[tmp[i].pwg] == undefined) {
                data[tmp[i].pwg] = {name: tmp[i].pwg, selected: $scope.pwg[tmp[i].pwg].selected};;
            }
        }
        $scope.pwg = data;
        $scope.showPwg = Object.keys($scope.pwg).length;
    }

    $scope.updatePwg = function(x, vDefault) {
        var data = $scope.pwg;
        for (var i = 0; i < x.length; i++) {
            if (data[x[i].pwg] == undefined) {
                data[x[i].pwg] = {name: x[i].pwg, selected: vDefault};;
            }
        }
        $scope.pwg = data;
        $scope.showPwg = Object.keys($scope.pwg).length;
    }

    $scope.updateRequestData = function() {
        $scope.loadingData = true;

        var max = $scope.maxPriority;
        if (isNaN(max) || max == '') {
            max = Number.MAX_VALUE;
        }

        setTimeout(function () {
            var tmp = $scope.cachedRequestData;
            var data = [];
            for (var i = 0; i < tmp.length; i++) {
                if (tmp[i].priority >= $scope.minPriority &&
                    tmp[i].priority <= max &&
                    $scope.status[tmp[i].status].selected &&
                    $scope.pwg[ tmp[i].pwg ].selected) {
                    data.push(tmp[i]);
                }
            }
            $scope.$apply(function () {
                $scope.allRequestData = data;
                $scope.loadingData = false;
            });
            }, 100);
        return true;
    }

    $interval($scope.updateDate, 1000);

    new ZeroClipboard(document.getElementById('copy'), {
        moviePath: '/lib/zeroclipboard/ZeroClipboard.swf'
    });
});

pmpApp.controller('IndexController', function() {

});