/**
 * @name browser.service
 * @type service
 * @description Checks current browser against supported browser list.
 * @returns {boolean} If a browser is supported.
 */
angular.module('pmpApp').factory('browser', ['$window', function ($window) {
    'use strict';
    var userAgent = $window.navigator.userAgent;
    // IE and Edge are currently not supported
    var supportedBrowsers = {
        Chrome: /chrome/i,
        Safari: /safari/i,
        Firefox: /firefox/i,
        Opera: /Opera/i
    };
    for (var s in supportedBrowsers) {
        if (supportedBrowsers[s].test(userAgent)) return true;
    }
    return false;
}]);