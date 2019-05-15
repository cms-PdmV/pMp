/**
 * @name share.controller
 * @type controller
 * @description Handles share functions.
 */
angular.module('pmpApp').controller('ShareController', ['$http', '$location',
    '$scope',
    function ($http, $location, $scope) {
        'use strict';
        new ClipboardJS('.btn');
        /**
         * @description Issue API call for shortening the URL.
         */
        $scope.shortenURL = function () {
            var encodedUrl = encodeURIComponent($scope.url);
            $http.get("api/shorten?r=" + encodedUrl).then(function (data) {
                $scope.url = data.data;
            });
        };

        // Broadcast receiver, change url in scope
        $scope.$on('onChangeNotification:URL', function () {
            $scope.url = $location.absUrl();
        });
    }
]);