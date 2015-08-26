/**
 * @name share.controller
 * @type controller
 * @description Handles share functions.
 */
angular.module('pmpApp').controller('ShareController', ['$http', '$location',
    '$scope',
    function ($http, $location, $scope) {
        'use strict';

        /**
         * @description Init method of the controller.
         */
        $scope.initShare = function () {
            $scope.url = $location.absUrl();
            new ZeroClipboard(document.getElementById('copy'), {
                moviePath: 'bower_components/zeroclipboard/dist/ZeroClipboard.swf'
            });
        };

        /**
         * @description Issue API call for shortening the URL.
         */
        $scope.shortenURL = function () {
            $http.get("shorten/" + $scope.url).then(function (data) {
                $scope.url = data.data;
            });
        };

        // Broadcast receiver, change url in scope
        $scope.$on('updateURL', function () {
            $scope.url = $location.absUrl();
        });
    }
]);