/**
 * @name typeahead.controller
 * @type controller
 * @description Handles typeahead in search.
 */
angular.module('pmpApp').controller('TypeaheadController', ['$scope', '$http',
    function ($scope, $http) {
        'use strict';

        /**
         * @description Init method of the controller
         */
        $scope.initTags = function () {
            $scope.suggestions = [];
        };

        /**
         * @description Issue API call for suggestion and load results into suggestion array.
         * @param {String} query the user input.
         * @param {String} type the type of the query.
         */
        $scope.getSuggestions = function (query, type) {
            if (query === '') {
                return null;
            }
            $http.get('api/suggest/' + type + '/' + query).then(function (response) {
                $scope.suggestions = response.data.results;
            });
        };
    }
]);