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
            var newSuggestions = [];
            if (query === '') {
                $scope.suggestions = newSuggestions;
                $scope.suggestions_query = null;
                return;
            }
            query = query.split(',').pop().trim();
            if (query === '') {
                $scope.suggestions = newSuggestions;
                $scope.suggestions_query = null;
                return;
            }
            $http.get('api/suggest/' + query + type).then(function (
                response) {
                var suggestions = response.data.results;
                var lowercaseQuery = query.toLowerCase();
                for (var i = 0; i < suggestions.length; i++) {
                    if (suggestions[i].label.toLowerCase().indexOf(lowercaseQuery) != -1) {
                        newSuggestions.push(suggestions[i]);
                    }
                }
                $scope.suggestions = newSuggestions;
                $scope.suggestions_query = query;
            });
        };
    }
]);