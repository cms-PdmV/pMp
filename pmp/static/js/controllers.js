'use strict';

pmpApp.controller('MainController', function($location, $scope, $timeout) {

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

    $scope.requests = {};
    $scope.arrOptionNames = ['selections', 'grouping', 'value', 'stacking', 'coloring'];
    $scope.arrOptionValues = ['member_of_campaign', 'total_events', 'status', 'prepid', 'priority', 'pwg'];

    $scope.ginit = function(data) {
        console.log(data);
        $scope.arrRequestOptionsValues = [1,2,4,0,0,0];
        $scope.arrRequestRadioValues = [0, 0];
        if (data != undefined) {
            if (data.length) {
                $scope.arrRequestOptionsValues = data.slice(0,6);
                $scope.arrRequestRadioValues = data.slice(6,2);
            }
        }
        $scope.initiate_graph();
        console.log($scope.arrRequestOptionsValues);
    }

    $scope.initiate_graph = function () {
        $scope.requests.selections = [];
        var init_grouping = [];
        var init_stacking = [];
        var init_coloring = ''; // 1 slot 
        var init_value = ''; // 1 slot
        for (var i = 0; i < $scope.arrRequestOptionsValues.length; i++) {
            if ($scope.arrRequestOptionsValues[i] == 0) {
                $scope.requests.selections.push($scope.arrOptionValues[i]);
            } else if ($scope.arrRequestOptionsValues[i] == 1) {
                init_grouping.push($scope.arrOptionValues[i]);
            } else if ($scope.arrRequestOptionsValues[i] == 2) {
                init_value = $scope.arrOptionValues[i];
            } else if ($scope.arrRequestOptionsValues[i] == 3) {
                init_stacking.push($scope.arrOptionValues[i]);
            } else if ($scope.arrRequestOptionsValues[i] == 4) {
                init_coloring = $scope.arrOptionValues[i];
            } 
        }
        $scope.requests.options = {
            grouping: init_grouping,
            value: init_value,
            stacking: init_stacking,
            coloring: init_coloring
        };
    }
    

    /*$scope.requests.options = {
        grouping: ['member_of_campaign'],
        value: "total_events",
        stacking: [],
        coloring: "status"
        };*/
    $scope.requests.radio = {
        'scale': ["linear", "log"],
        'mode': ["number of events", "number of requests"]
    };
    //$scope.requests.selections = ['prepid', 'priority', 'pwg'];
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
        $scope.loadingData = true;
        var data = []
        for (var i = 0; i < $scope.$parent.allRequestData.length; i++) {
            if ($scope.$parent.allRequestData[i]['member_of_campaign'] !== tag) {
                data.push($scope.$parent.allRequestData[i]);
            }
        }
        $scope.$parent.allRequestData = data;
        $scope.loadingData = false;
        $scope.setURL();
    }

    $scope.setURL = function(optionName, optionValue){
        if (typeof optionName != undefined && typeof optionValue != undefined) {
            $scope.arrRequestOptionsValues[$scope.arrOptionValues.indexOf(optionValue)] = $scope.arrOptionNames.indexOf(optionName);
        }
        var shareDetails = ''
        if ($scope.tags.getTags().length) {
            shareDetails = $scope.arrRequestOptionsValues.join('/') + '/' + $scope.arrRequestRadioValues.join('/') + '/' + $scope.tags.getTags().join(',');
        }
        $scope.url = $location.$$protocol + '://' + $location.$$host + '/share/' + $scope.typeOfGraph + '/' + shareDetails;
    }

    $scope.setScaleAndOperation = function(i, value) {
        if ($scope.arrRequestRadioValues[i] != value) {
            $scope.arrRequestRadioValues[i] = value;
            $scope.setURL();
        }
    }

    $scope.typeOfGraph = "cam"
    $scope.$parent.title = 'Statistics of Campaigns';
    $scope.$parent.allRequestData = [];
    $scope.$parent.piecharts.fullTerms = ["new", "validation", "defined", "approved", "submitted", "done"];

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
                $scope.$parent.allRequestData = data.data.results;
                $scope.setURL();
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
                $scope.loadingData = false;
            });
        }
    };
    $scope.$parent.showview = false;
    $timeout(function() {$scope.nav('');}, 100);

    new ZeroClipboard(document.getElementById("copy"), {
        moviePath: '/lib/zeroclipboard/ZeroClipboard.swf'
    });
    $scope.setURL();
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