'use strict';

pmpApp.controller('MainController', function($location, $scope, $timeout, $http) {
    $scope.arrRequestOptionsValues = [1,2,4,0,0,0];
    $scope.arrRequestRadioValues = [0, 0];
    $scope.arrCampaigns = [];
    $scope.arrOptionNames = ['selections', 'grouping', 'value', 'stacking', 'coloring'];
    $scope.arrOptionValues = ['member_of_campaign', 'total_events', 'status', 'prepid', 'priority', 'pwg'];

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

pmpApp.controller('CampaignsController', function($http, $location, $scope, $timeout) {
    $scope.setURL = function(optionName, optionValue){
        if (optionName != '' && optionValue != '') {
            $scope.arrRequestOptionsValues[$scope.arrOptionValues.indexOf(optionValue)] = $scope.arrOptionNames.indexOf(optionName);
        }
        var shareDetails = ''
        if ($scope.arrCampaigns.length) {
            shareDetails = $scope.arrRequestOptionsValues.join('/') + '/' + $scope.arrRequestRadioValues.join('/') + '/' + $scope.arrCampaigns.join(',');
        }
        $scope.url = $location.$$protocol + '://' + $location.$$host + '/share/' + $scope.typeOfGraph + '/' + shareDetails;
    };
    $scope.setScaleAndOperation = function(i, value) {
        if ($scope.arrRequestRadioValues[i] != value) {
            $scope.arrRequestRadioValues[i] = value;
            $scope.setURL('', '');
        }
    }
    $scope.typeOfGraph = "cam"
    $scope.$parent.title = 'Statistics of Campaigns';
    $scope.$parent.allRequestData = [];
    $scope.$parent.piecharts.fullTerms = ["new", "validation", "defined", "approved", "submitted", "done"];
    $scope.load = function(campaign, add) {
        $scope.loadingData = true;
        var promise = $http.get("api/" + campaign + "/simple");
        promise.then(function(data) {
            if (campaign !== '' && add) {
                data.data.results.push.apply(data.data.results, $scope.allRequestData);
                $scope.arrCampaigns.push(campaign);
            } else {
                $scope.arrCampaigns = [campaign];
            }
            $scope.loadingData = false;
            $scope.$parent.allRequestData = data.data.results;
            $scope.setURL('', '');
        }, function() {
            alert("Error getting requests");
            $scope.loadingData = false;
        });
    };
    $scope.$parent.showview = false;
    $timeout(function() {$scope.nav('');}, 100);

    new ZeroClipboard(document.getElementById("copy"), {
        moviePath: '/lib/zeroclipboard/ZeroClipboard.swf'
    }).on("ready", function(readyEvent) {

        this.on("aftercopy", function(client, args) {
            
            console.log("Text copied");
        });
    });
    $scope.setURL('', '');
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