/**
 * @name index.controller
 * @type controller
 * @description Index Controller
 */
angular.module('pmpApp').controller('IndexController', ['$location', function (
    $location) {
    $location.search({}); // ensure no params in URL
}]);