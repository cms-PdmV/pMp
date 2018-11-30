/**
 * @name index.controller
 * @type controller
 * @description Index Controller
 */
angular.module('pmpApp').controller('IndexController', ['$location', '$http', '$scope', '$interval', function (
    $location, $http, $scope, $interval) {
    $location.search({}); // ensure no params in URL
    $scope.updateLastUpdate = function () {
        promise = $http.get("api/requests,campaigns,workflows,rereco_requests/overall/_");
            promise.then(function (data) {
            $scope.data = data.data.results;
        });
    };

    $scope.updateLastUpdate();
    $interval(function () {
        $scope.updateLastUpdate();
    }, 60 * 1000);
}]);