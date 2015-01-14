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

    $scope.popUpMessage = '';

    $scope.showPopUp = function(type, text) {
        switch (type) {
            case 'error':
                $scope.popUpMessage = text;
                $scope.showError = true;
                $scope.showWarning = false;
                $scope.showSuccess = false;
                $timeout(function() {$scope.showPopUp('', '');}, 2000);
                break;
            case "warning":
                $scope.popUpMessage = text;
                $scope.showError = false;
                $scope.showWarning = true;
                $scope.showSuccess = false;
                $timeout(function() {$scope.showPopUp('', '');}, 2000);
                break;
            case "success":
                $scope.popUpMessage = text;
                $scope.showError = false;
                $scope.showWarning = false;
                $scope.showSuccess = true;
                $timeout(function() {$scope.showPopUp('', '');}, 2000);
                break;
            default:
                $timeout(function() {$scope.popUpMessage = '';}, 1000);
                $scope.showError = false;
                $scope.showWarning = false;
                $scope.showSuccess = false;
                break;
        }
    }
});


pmpApp.controller('CampaignsController', function($http, $location, $rootScope, $scope, $timeout) {

    $scope.allRequestData = [];

    $scope.arrOptionNames = ['selections', 'grouping', 'value', 'stacking', 'coloring'];

    $scope.arrOptionValues = ['member_of_campaign', 'total_events', 'status', 'prepid', 'priority', 'pwg'];

    $scope.init = function(data) {

        if($location.search()['p'] != undefined) {
            var toLoad = $location.search()['p'].split(',');
            $scope.arrRequestOptionsValues = toLoad.slice(0,6);
            $scope.arrRequestRadioValues = toLoad.slice(6,8);
        } else {
            $scope.arrRequestOptionsValues = [1,2,4,0,0,0];
            $scope.arrRequestRadioValues = [0, 0];
        }

        $scope.requests.selections = [];
        var initGrouping = [];
        var initStacking = [];
        var initColoring = '';
        var initValue = '';
        for (var i = 0; i < $scope.arrRequestOptionsValues.length; i++) {
            if ($scope.arrRequestOptionsValues[i] == 0) {
                $scope.requests.selections.push($scope.arrOptionValues[i]);
            } else if ($scope.arrRequestOptionsValues[i] == 1) {
                initGrouping.push($scope.arrOptionValues[i]);
            } else if ($scope.arrRequestOptionsValues[i] == 2) {
                initValue = $scope.arrOptionValues[i];
            } else if ($scope.arrRequestOptionsValues[i] == 3) {
                initStacking.push($scope.arrOptionValues[i]);
            } else if ($scope.arrRequestOptionsValues[i] == 4) {
                initColoring = $scope.arrOptionValues[i];
            } 
        }
        $scope.requests.options = {
            grouping: initGrouping,
            value: initValue,
            stacking: initStacking,
            coloring: initColoring
        };

        $scope.requests.radio = {}

        if ($scope.arrRequestRadioValues[1] == 1) {
            $scope.requests.radio['scale'] = ["log", "linear"];    
        } else {
            $scope.requests.radio['scale'] = ["linear", "log"];    
        }

        if ($scope.arrRequestRadioValues[0] == 1) {
            $scope.requests.radio['mode'] = ["number of requests", "number of events"];
        } else {
            $scope.requests.radio['mode'] = ["number of events", "number of requests"];
        }

        //initiate allRequestData from URL
        if($location.search()['r'] != undefined) {
            var toLoad = $location.search()['r'].split(',');
            for (var i = 0; i < toLoad.length; i++) {
                $scope.load(toLoad[i], true, i == toLoad.length-1);
            }
        }
    }

    $scope.load = function(campaign, add) {
        if (!campaign) {
            $scope.showPopUp('warning', 'Your request parameters are empty');
        }
        else if(add & $scope.tags.hasTag(campaign)) {
            $scope.showPopUp('warning', 'Your request is already loaded');
        }
        else {
            $scope.loadingData = true;
            var promise = $http.get("api/" + campaign + "/simple");
            promise.then(function(data) {
                if (!data.data.results.length) {
                    $scope.showPopUp('warning', 'No results for this request parameters');   
                } else {

                    if (add) {
                        data.data.results.push.apply(data.data.results, $scope.allRequestData);
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

                }
                $scope.loadingData = false;
                $scope.allRequestData = data.data.results;
                $scope.setURL();
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
                $scope.loadingData = false;
            });
        }
    };

    $scope.piecharts = {};
    $scope.piecharts.compactTerms = ["done", "to do"];
    $scope.piecharts.domain = ["new", "validation", "done", "approved", "submitted", "nothing", "defined", "to do"];
    $scope.piecharts.fullTerms = ["new", "validation", "defined", "approved", "submitted", "done"];
    $scope.piecharts.nestBy = ["member_of_campaign", "status"];
    $scope.piecharts.sum = "total_events";

    $scope.requests = {};
    $scope.requests.settings = {
        duration: 1000,
        legend: true,
        sort: true
    };

    $scope.setURL = function(optionName, optionValue){
        $location.path("campaign", false);
        if (typeof optionName != undefined && typeof optionValue != undefined) {
            $scope.arrRequestOptionsValues[$scope.arrOptionValues.indexOf(optionValue)] = $scope.arrOptionNames.indexOf(optionName);
        }
        var params = {}
        if ($scope.tags.getTags().length) {
            params['r'] = $scope.tags.getTags().join(',')
        }
        params['p'] = $scope.arrRequestOptionsValues.join(',') + ',' + $scope.arrRequestRadioValues.join(',');        
        $location.search(params);
        $scope.url = $location.absUrl();
    }

    $scope.setScaleAndOperation = function(i, value) {
        if ($scope.arrRequestRadioValues[i] != value) {
            $scope.arrRequestRadioValues[i] = value;
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
        //$scope.loadingData = true;
        var data = []
        for (var i = 0; i < $scope.allRequestData.length; i++) {
            if ($scope.allRequestData[i]['member_of_campaign'] !== tag) {
                data.push($scope.allRequestData[i]);
            }
        }
        $scope.allRequestData = data;
        //$scope.loadingData = false;
        $scope.setURL();
    }

    $scope.title = 'Statistics of Campaigns';

    $rootScope.showview = false;

    $timeout(function() {$scope.nav('');}, 100);

    new ZeroClipboard(document.getElementById('copy'), {
        moviePath: '/lib/zeroclipboard/ZeroClipboard.swf'
    });
});

pmpApp.controller('ChainsController', function($scope, $http, $timeout) {
    $scope.$parent.title = 'Statistics Within Chains';
    $scope.$parent.allRequestData = [];
    $scope.$parent.piecharts.fullTerms = ["new", "validation", "defined", "approved", "submitted", "done", "upcoming"];

    $scope.load = function(campaign) {
        $scope.loadingData = true;
        var promise = $http.get("api/" + campaign + "/chain");
        promise.then(function(data) {
            $scope.loadingData = false;
            $scope.$parent.allRequestData = data.data.results;
        }, function() {
            $scope.loadingData = false;
            alert("Error getting requests");
        });
    };
    $scope.$parent.showview = false;
    $timeout(function() {$scope.nav('');}, 100);
});

pmpApp.controller('IndexController', function($scope, $timeout) {
    $scope.$parent.showview = false;
    $timeout(function() {$scope.nav('');}, 100);
});