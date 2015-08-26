/**
 * @name humanReadableNumber.filter
 * @type filter
 * @description Parse numbers to the human readable format
 * @param {Integer} d the number to parse
 * @return {String} number in a form "239M"
 */
angular.module('customFilters', []).filter('humanReadableNumbers', function () {
    'use strict';
    return function (d) {
        var significantFigures = 3;
        if (!d) {
            return 0;
        }
        var l = ['G', 'M', 'k', ''];
        var s, j = 0;
        for (var i = 1e9; i >= 1; i = i / 1e3) {
            s = (Math.round(d * 100 / i) / 100).toFixed(2);
            if (s >= 1) {
                if ((s + '').substring(0, significantFigures).indexOf(
                        '.') === -1) {
                    return (s + '').substring(0, significantFigures) +
                        l[j];
                }
                return (s + '').substring(0, significantFigures + 1) +
                    l[j];
            }
            j++;
        }
        return '';
    };
});