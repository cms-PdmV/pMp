angular.module('pmpApp').controller('TypeaheadCtrl', ['$scope', '$http', function($scope, $http) {
    $scope.suggestions = [];
    $scope.getSuggestions = function(query) {
        if (query === '') return null;
        if ($scope.title === 'Present: Announced Mode') {
            $http.get('api/suggest/' + query + '/announced').then(function(response) {
                $scope.suggestions = response.data.results;
           });
        } else if($scope.title === 'Present: Growing Mode') {
            $http.get('api/suggest/' + query + '/growing').then(function(response) {
                $scope.suggestions = response.data.results;
            });
        } else if ($scope.title === 'Historical Statistics') {
            $http.get('api/suggest/' + query + '/historical').then(function(response) {
                $scope.suggestions = response.data.results;
            });
        } else if ($scope.title === 'Request Performance') {
            $http.get('api/suggest/' + query + '/performance').then(function(response) {
                $scope.suggestions = response.data.results;
            });
        }
    };
}]);