angular.module('pmpApp').controller('TypeaheadController', ['$scope', '$http', 'PageDetailsProvider', function($scope, $http, PageDetailsProvider) {
    $scope.suggestions = [];
    $scope.getSuggestions = function(query, type) {
        if (query === '') return null;
        $http.get('api/suggest/' + query + type).then(function(response) {
                $scope.suggestions = response.data.results;
            });
    };
}]);