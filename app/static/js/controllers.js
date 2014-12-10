'use strict';

function MainController($scope, $http) {

    $scope.allRequestData = [];

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

    $scope.get_stats = function (query, add) {
        $scope.loadingData = true;
        var promise = $http.get("api/" + query);
        promise.then(function (data) {
            if (query !== '' && add) {
                data.data.results.push.apply(data.data.results, $scope.allRequestData);
            }
            $scope.loadingData = false;
            $scope.allRequestData = data.data.results;
        }, function () {
            alert("Error getting requests");
            $scope.loadingData = false;
        });
    };
}