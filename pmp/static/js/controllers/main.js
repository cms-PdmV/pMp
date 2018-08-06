/**
 * @name main.controller
 * @type controller
 * @description Common methods for all pages
 */
angular.module('pmpApp').controller('MainController', ['$http', '$location',
    '$route', '$rootScope', '$scope', '$timeout', 'browser',
    function ($http, $location, $route, $rootScope, $scope, $timeout,
        isSupportedBrowser) {
        'use strict';

        $scope.showView = false; // controls visibility of page main container
        if (!isSupportedBrowser) $('#unsupportedModal').modal('show'); // show unsupported modal if the page is not supported

        /**
         * @description Wait until animation fade out finishes and navigate to differnet page
         * @param {String} where to navigate to
         */
        $scope.nav = function (where) {
            $scope.showView = (where === '');
            if (!$scope.showView) {
                $timeout(function () {
                    $location.search({});
                    $location.path(where);
                    $timeout(function () {
                        $scope.showView = !$scope.showView;
                        $scope.nav('');
                    }, 100);
                }, 250);
            }
        };
        $timeout(function () {
            $scope.nav('');
        }, 100);

        /**
         * @description
         * Prevent default operation of $loaction.path
         * This way only URL will be updated on path change and page will not be refreshed
         */
        var original = $location.path;
        $location.path = function (path, reload) {
            if (reload === false) {
                var lastRoute = $route.current;
                var un = $rootScope.$on('$locationChangeSuccess',
                    function () {
                        $route.current = lastRoute;
                        un();
                    });
            }
            return original.apply($location, [path]);
        };

        /**
         * @description Pops up message
         * @param {String} type of message
         * @param {String} text to show
         */
        $scope.showPopUp = function (type, text) {
            switch (type) {
            case 'error':
                $scope.popUp = {
                    show: true,
                    title: 'Error',
                    message: text,
                    style: 'panel-danger',
                    icon: 'fa-frown-o'
                };
                $timeout(function () {
                    $scope.popUp.show = false;
                }, 2000);
                break;
            case 'warning':
                $scope.popUp = {
                    show: true,
                    title: 'Warning',
                    message: text,
                    style: 'panel-warning',
                    icon: 'fa-exclamation-triangle'
                };
                $timeout(function () {
                    $scope.popUp.show = false;
                }, 2000);
                break;
            case 'success':
                $scope.popUp = {
                    show: true,
                    title: 'Success',
                    message: text,
                    style: 'panel-success',
                    icon: 'fa-check'
                };
                $timeout(function () {
                    $scope.popUp.show = false;
                }, 2000);
                break;
            default:
                break;
            }
        };

        /**
         * @description Check if object is empty
         * @param {Object} obj to check
         * @return {Boolean} if object is empty
         */
        $scope.isEmpty = function (obj) {
            return angular.equals({}, obj);
        };

        /**
         * @description Generates CSV for all keys having true value
         * @param {Object} obj to check
         * @return {String} CSV string
         */
        $scope.getCSVPerFilter = function (obj) {
            var a = [];
            for (var i in obj) {
                if (obj[i]) a.push(i);
            }
            return a.join(',');
        };

        /**
         * @description Update current time variable
         */
        $scope.updateCurrentDate = function () {
            $scope.dt = new Date();
        };

        /**
         * @description Query API for last successful update timestamp. Pass indexes as input as csv
         */
        $scope.updateLastUpdate = function (fieldsCSV) {
            $http.get("api/" + fieldsCSV + "/lastupdate/_").then(
                function (data) {
                    $scope.lastUpdate = data.data.results.last_update;
                });
        };
    }
]);