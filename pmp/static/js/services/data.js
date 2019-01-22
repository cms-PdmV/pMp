/**
 * @name data.service
 * @type service
 * @description Service to share data between controllers.
 */
angular.module('pmpApp').service('Data', ['$rootScope', function ($rootScope) {
    'use strict';
    var loadedData = [], // currently loaded data
        inputTags = [], // query elements
        priorityFilter = [undefined, undefined], // array of min and max values of priority
        statusFilter = [], // array of enabled statuses
        pwgFilter = []; // array of enabled PWGs

    /**
     * @description Tests whether all items in a {key:boolean} object are true
     * @params {Object} An object of string:boolean pairs
     * @return {Boolean} True iff all items are set to true
     */
    var allEnabled = function (filter) {
        for (var item in filter) {
            if (!filter[item]) {
                return false;
            }
        }

        return true;
    };

    var allDisabled = function (filter) {
        for (var item in filter) {
            if (filter[item]) {
                return false;
            }
        }

        return true;
    };

    return {
        /**
         * @description Input tags getter.
         * @return {Array} String array of input tags.
         */
        getInputTags: function () {
            return this.inputTags;
        },
        /**
         * @description Input tags setter. Emits onChangeNotification.
         * @params {Array} i the string array of input tags.
         * @params {Boolean} append the tag is supposed to be added.
         * @params {Boolean} remove the tag is supposed to be removed.
         */
        setInputTags: function (i) {
            this.inputTags = i;
            $rootScope.$broadcast('onChangeNotification:InputTags');
        },

        addInputTag: function (i) {
            this.inputTags.push(i);
            $rootScope.$broadcast('onChangeNotification:InputTags');
        },

        removeInputTag: function (i) {
            this.inputTags.splice(this.inputTags.indexOf(i), 1);
            $rootScope.$broadcast('onChangeNotification:InputTags');
        },
        /**
         * @description Loaded data getter.
         * @return {Array} Array of loaded data objects.
         */
        getLoadedData: function () {
            return this.loadedData;
        },
        /**
         * @description Loaded data setter. Emits onChangeNotification.
         * @params {Array} i the Array of loaded data objects.
         * @params {Boolean} append the array is supposed to be added instead of overwrite.
         */
        setLoadedData: function (i, append) {
            if (append) {
                Array.prototype.push.apply(i, this.loadedData);
            }
            this.loadedData = i;
        },
        /**
         * @description Priority filter getter.
         * @return {Array} String array in a form [minimum, maximum].
         */
        getPriorityFilter: function () {
            if (this.priorityFilter === undefined) {
                return undefined
            }
            return this.priorityFilter;
        },
        /**
         * @description Priority filter setter.
         * @params {Array} i the string array in a form [minimum, maximum].
         */
        setPriorityFilter: function (i) {
            this.priorityFilter = i;
        },
        /**
         * @description PWG filter getter.
         * @return {Object} PWG filter object in a form {pwg_name:{boolean}}.
         */
        getPWGFilter: function () {
            return this.pwgFilter;
        },
        /**
         * @description PWG filter setter.
         * @params {Object} i the PWG filter object in a form {pwg_name:{boolean}}.
         */
        setPWGFilter: function (i) {
            this.pwgFilter = i;
        },
        /**
         * @description Status filter getter.
         * @return {Object} Status filter object in a form {status_name:{boolean}}.
         */
        getStatusFilter: function () {
            return this.statusFilter;
        },
        /**
         * @description Status filter setter.
         * @params {Object} i the Status filter object in a form {status_name:{boolean}}.
         */
        setStatusFilter: function (i) {
            this.statusFilter = i;
        },
        /**
         * @description Test whether all PWGs are enabled
         * @return {Boolean} True if all PWGs are enabled, false otherwise
         */
        allPWGsEnabled: function () {
            return allEnabled(this.pwgFilter);
        },
        /**
         * @description Test whether all statuses are enabled
         * @return {Boolean} True iff all statuses are enabled
         */
        allStatusesEnabled: function () {
            return allEnabled(this.statusFilter);
        },
        allPWGsDisabled: function() {
            return allDisabled(this.pwgFilter);
        },
        allStatusesDisabled: function() {
            return allDisabled(this.statusFilter);
        },
        getPriorityQuery: function () {
            var dataPriorityFilter = this.getPriorityFilter();
            if (dataPriorityFilter[0] === undefined && dataPriorityFilter[1] === undefined) {
                return undefined;
            }
            return (dataPriorityFilter[0] || '') + ',' + (dataPriorityFilter[1] || '');
        },
        getPWGQuery: function () {
            if (this.allPWGsEnabled()) {
                return undefined;
            }
            var w = [];
            var filter = this.getPWGFilter();
            for (var pwg in filter) {
                if (filter[pwg]) {
                    w.push(pwg);
                }
            }
            return w.join(',');
        },
        getStatusQuery: function() {
            // add status filter
            if (this.allStatusesEnabled()) {
                return undefined;
            }
            var s = [];
            var filter = this.getStatusFilter();
            for (var status in filter) {
                if (filter[status]) {
                    s.push(status);
                }
            }
            return s.join(',');
        },
        /**
         * @description Change filter object, status or pwg.
         * @params {Array} data the loaded data array.
         * @params {Boolean} reset the cleaning filter switch.
         * @params {Boolean} value the default boolean assigned to new keys.
         * @params {Boolean} isStatusFilter if true change status filter, otherwise change pwg.
         */

        /**
         * @description When removing data, reload filters.
         * @params {Array} data the loaded data array.
         */
        reloadFilters: function (data) {
            var iter, newStatus = {},
                newPWG = {};
            for (var i = 0; i < data.length; i++) {
                iter = data[i].status;
                if (newStatus[iter] === undefined) {
                    newStatus[iter] = this.statusFilter[iter];
                }
                iter = data[i].pwg;
                if (newPWG[iter] === undefined) {
                    newPWG[iter] = this.pwgFilter[iter];
                }
            }
            this.setStatusFilter(newStatus);
            this.setPWGFilter(newPWG);
            this.setLoadedData(data);
        },
        /**
         * @description Resets data objects shared in this service.
         * @params {Boolean} resetFilters the reset filters marker.
         */
        reset: function (resetFilters) {
            this.loadedData = [];
            this.setInputTags([]);
            if (resetFilters) {
                this.priorityFilter = [];
                this.statusFilter = {};
                this.pwgFilter = {};
            }
        }
    };
}]);

