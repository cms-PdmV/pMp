angular.module('customTags', [])
    .directive('inputTags', function() {
        return {
            restrict: 'E',
            templateUrl: 'static/partials/tags.html'
        };
    });