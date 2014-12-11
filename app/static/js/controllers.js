'use strict';

pmpApp.controller('MainController', function($scope, $http) {

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
    $scope.piecharts.fullTerms = ["new", "validation", "defined", "approved", "submitted", "done"];
    $scope.piecharts.nestBy = ["member_of_campaign", "status"];
    $scope.piecharts.sum = "total_events";
});

pmpApp.controller('CampaignsController', function($scope, $http) {
    $scope.$parent.title = 'Statistics of Campaigns';
    $scope.$parent.allRequestData = [];

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
});

pmpApp.controller('ChainsController', function($scope, $http) {
    $scope.$parent.title = 'Statistics Within Chains';
    $scope.$parent.allRequestData = [];

    $scope.load = function(campaign) {
        $scope.loadingData = true;
        var promise = $http.get("api/" + campaign + "/chain");
        promise.then(function(data) {
            $scope.loadingData = false;
            $scope.$parent.allRequestData = data.data.results;
            console.log(data.data.TODO);
        }, function() {
            $scope.loadingData = false;
            alert("Error getting requests");
        });
    };
});