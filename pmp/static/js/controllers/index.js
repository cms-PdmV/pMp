/**
 * @name index.controller
 * @type controller
 * @description Index Controller
 */
angular.module('pmpApp').controller('IndexController', ['$location', '$http', '$scope', '$interval', function (
    $location, $http, $scope, $interval) {
    $location.search({}); // ensure no params in URL
    $scope.updateLastUpdate = function () {
        $http.get("api/overall?r=requests,campaigns,workflows,rereco_requests,relval_requests,tags").then(function (data) {
            $scope.data = data.data.results;
        });
        $http.get("api/lastupdate").then(function (data) {
            $scope.lastUpdateAgo = data.data.results.ago;
        });
    };
    $scope.changeActiveIndex(0);

    $scope.updateLastUpdate();
    $interval(function () {
        $scope.updateLastUpdate();
    }, 60 * 1000);
}]);
