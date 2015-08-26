/**
 * @name millisecondsToTimeString.filter
 * @type filter
 * @description Parse time in milliseconds to the human readable format
 * @param {Integer} ms the time in milliseconds
 * @return {String} time in a form "9D 23h"
 */
angular.module('customFilters', []).filter('millSecondsToTimeString', function () {
    'use strict';
    return function (ms) {
        var seconds = Math.floor(ms / 1000);
        var days = Math.floor(seconds / 86400);
        var hours = Math.floor((seconds % 86400) / 3600);
        return days + "D " + hours + "h ";
    };
});