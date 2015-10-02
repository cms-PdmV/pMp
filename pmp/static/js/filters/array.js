/**
 * @name isArray.filter
 * @type filter
 * @description Check if input object is instance of an array
 * @param {Object} An object to verify
 * @return {Bollean} true if input is an array
 */
angular.module('pmpApp').filter('isArray', function () {
    'use strict';
    return function (input) {
        return angular.isArray(input);
    };
});