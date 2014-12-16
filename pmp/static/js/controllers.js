'use strict';

pmpApp.controller('MainController', function($location, $scope, $timeout, $http) {
    $scope.requests = {};
    $scope.requests.options = {
        grouping: ['member_of_campaign'],
        value: "total_events",
        stacking: [],
        coloring: "status"
    };
    $scope.requests.radio = {
        'scale': ["linear", "log"],
        'operation': ["sum", "count"]
    };
    $scope.requests.selections = ['prepid', 'priority', 'pwg'];
    $scope.requests.settings = {
        duration: 1000,
        legend: true,
        sort: true
    };
    $scope.piecharts = {};
    $scope.piecharts.compactTerms = ["done", "to do"];
    $scope.piecharts.domain = ["new", "validation", "done", "approved", "submitted", "nothing", "defined", "to do"];
    $scope.piecharts.nestBy = ["member_of_campaign", "status"];
    $scope.piecharts.sum = "total_events";

    $scope.nav = function(where) {
        $scope.showview = !$scope.showview;
        if (!$scope.showview) {
            $timeout(function() {$location.path(where);}, 1100);
        }
    };
});

pmpApp.controller('CampaignsController', function($scope, $http, $timeout) {
    $scope.url = 'https://some.url'
    $scope.$parent.title = 'Statistics of Campaigns';
    $scope.$parent.allRequestData = [];
    $scope.$parent.piecharts.fullTerms = ["new", "validation", "defined", "approved", "submitted", "done"];

    $scope.load = function(campaign, add) {
        $scope.loadingData = true;
        var promise = $http.get("api/" + campaign + "/simple");
        promise.then(function(data) {
            if (campaign !== '' && add) {
                data.data.results.push.apply(data.data.results, $scope.allRequestData);
            }
            $scope.loadingData = false;
            $scope.$parent.allRequestData = data.data.results;
        }, function() {
            alert("Error getting requests");
            $scope.loadingData = false;
        });
    };
    $scope.$parent.showview = false;
    $timeout(function() {$scope.nav('');}, 100);
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