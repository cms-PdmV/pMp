/**
 * @name main.controller
 * @type controller
 * @description Common methods for all pages
 */
angular.module('pmpApp').controller('MainController', ['$http', '$location',
    '$route', '$rootScope', '$scope', '$timeout', 'browser', 'Data',
    function ($http, $location, $route, $rootScope, $scope, $timeout,
        isSupportedBrowser, Data) {
        'use strict';

        $scope.showView = true; // controls visibility of page main container
        if (!isSupportedBrowser) $('#unsupportedModal').modal('show'); // show unsupported modal if the page is not supported

        $scope.nav = function(link) {
            var previousIndex = $scope.activeIndex
            if (link === '/present/') {
                $scope.changeActiveIndex(1)
            } else if (link === '/historical/') {
                $scope.changeActiveIndex(2)
            } else if (link === '/performance/') {
                $scope.changeActiveIndex(3)
            } else {
                $scope.urlQuery = ''
                $scope.changeActiveIndex(0)
            }
            if (previousIndex === $scope.activeIndex) {
                $scope.$broadcast('onChangeNotification:ReInit')
            }
        }

        $scope.changeActiveIndex = function(index) {
            $scope.activeIndex = index;
        }

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

        $scope.fillDefaults = function(values, defaults) {
            var filledValues = {};
            // Old pMp links support
            if ('w' in values && !('pwg' in values)) {
                values['pwg'] = values['w'];
            }
            if ('s' in values && !('status' in values)) {
                values['status'] = values['s']
            }
            if ('c' in values && !('chainedMode' in values)) {
                values['chainedMode'] = values['c']
            }
            if ('m' in values && !('growingMode' in values)) {
                values['growingMode'] = values['m']
            }
            if ('h' in values && !('humanReadable' in values)) {
                values['humanReadable'] = values['h']
            }
            if ('x' in values && !('priority' in values)) {
                values['priority'] = values['x']
            }
            if ('y' in values && !('zoomY' in values)) {
                values['zoomY'] = values['y']
            }
            if ('p' in values && !('granularity' in values)) {
                values['granularity'] = values['p']
            }
            if ('b' in values && !('bins' in values)) {
                values['bins'] = values['b']
            }
            Object.keys(defaults).forEach(function (param, index, array) {
                var urlValue = values[param];
                // if the default is a number, expect a numerical parameter
                if (urlValue === undefined || (angular.isNumber(defaults[param]) && !angular.isNumber(parseInt(urlValue, 10)))) {
                    filledValues[param] = defaults[param];
                } else {
                    filledValues[param] = urlValue;
                }
                if (filledValues[param] && !angular.isNumber(defaults[param])) {
                    filledValues[param] = filledValues[param].toString()
                }
            });
            return filledValues;
        };

        $scope.constructURLQuery = function(scope, data) {
            var params = {};
            Object.keys(scope.defaults).forEach(function (param, index, array) {
                if (param === 'r') {
                    var r = data.getInputTags();
                    if (r.length) {
                        params.r = r.join(',');
                    }
                } else if (param === 'priority') {
                    var priorityQuery = data.getPriorityQuery();
                    if (priorityQuery !== undefined) {
                        params.priority = priorityQuery;
                    }
                } else if (param === 'pwg') {
                    var pwgQuery = data.getPWGQuery();
                    if (pwgQuery !== undefined) {
                        params.pwg = pwgQuery;
                    }
                } else if ( param === 'status') {
                    var statusQuery = data.getStatusQuery();
                    if (statusQuery !== undefined) {
                        params.status = statusQuery;
                    }
                } else {
                    if (scope[param] != scope.defaults[param] && scope[param] !== undefined) {
                        params[param] = scope[param].toString()
                    }
                }
            });
            return params
        };

        $scope.setURL = function (scope, data) {
            var params = $scope.constructURLQuery(scope, data)
            $location.search(params).replace();
            $scope.$broadcast('onChangeNotification:URL');
            var urlQuery = ''
            var keys = ['r', 'pwg', 'status', 'priority']
            keys.forEach(function (param) {
                if (param in params) {
                    if (urlQuery.length == 0) {
                        urlQuery += '?'
                    } else {
                        urlQuery += '&'
                    }
                    urlQuery += param + '=' + params[param]
                }
            });
            $scope.urlQuery = urlQuery;
        };

        $scope.formatBigNumber = function (number) {
            if (number < 1 || number % 1 !== 0) {
                return ''
            }
            var result = ''
            if (number >= 1e9) {
                result = (Math.round(number / 10000000.0) / 100.0).toFixed(2) + "G"
            } else if (number >= 1e6) {
                result = (Math.round(number / 10000.0) / 100.0).toFixed(2) + "M"
            } else if (number >= 1e3) {
                result = (Math.round(number / 10.0) / 100.0).toFixed(2) + "k"
            } else {
                result = number.toString()
            }
            return result.replace('.00', '')
                         .replace('.10', '.1')
                         .replace('.20', '.2')
                         .replace('.30', '.3')
                         .replace('.40', '.4')
                         .replace('.50', '.5')
                         .replace('.60', '.6')
                         .replace('.70', '.7')
                         .replace('.80', '.8')
                         .replace('.90', '.9')
        }

        $scope.formatBigNumberLog = function (number) {
            if (Math.log10(number) % 1 !== 0) {
                return ''
            }
            return $scope.formatBigNumber(number);
        }
    }
]);
