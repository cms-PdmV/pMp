angular.module('pmpApp').controller('ShareController', ['$http', '$location', '$scope', function($http, $location, $scope) {
    $scope.initZeroClipboard = function() {
        new ZeroClipboard(document.getElementById('copy'), {
            moviePath: 'bower_components/zeroclipboard/dist/ZeroClipboard.swf'
        });
    }
    $scope.shortenURL = function() {
        $http.get("shorten/"+ $scope.url).then(function(data) {
            $scope.url = data.data;
        });
    }
    $scope.$on('updateURL', function(){
        $scope.url = $location.absUrl();
    });
    $scope.url = $location.absUrl();
}]);