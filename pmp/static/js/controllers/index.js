/**
 * @name index.controller
 * @type controller
 * @description Index Controller
 */
angular.module('pmpApp').controller('IndexController', ['$location', '$http', '$scope', function (
    $location, $http, $scope) {
    $location.search({}); // ensure no params in URL
    promise = $http.get("api/requests,flows,campaigns,workflows/overall/_");
    promise.then(function (data) {
        $scope.data = data.data.results;
    });
}]);