angular.module('customTags', [])
    .directive('inputTags', function() {
        return {
            restrict: 'E',
            templateUrl: 'partials/tags.html'
        };
    });