/**
 * @name readableNumber.filter
 * @type filter
 * @description Parse numbers to the human readable format
 * @param {Integer} d the number to parse
 * @return {String} number in a form "239M"
 */
angular.module('pmpApp').filter('readableNumbers', function () {
    'use strict';
    return function (number) {
        var result = ''
        if (number >= 1e9) {
            result = (Math.round(number / 10000000.0) / 100.0).toFixed(2) + "G"
        } else if (number >= 1e6) {
            result = (Math.round(number / 10000.0) / 100.0).toFixed(2) + "M"
        } else if (number >= 1e3) {
            result = (Math.round(number / 10.0) / 100.0).toFixed(2) + "k"
        } else {
            result = (Math.round(number * 100.0).toFixed(2) / 100.0).toString()
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
    };
});