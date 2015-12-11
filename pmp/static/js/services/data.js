/**
 * @name data.service
 * @type service
 * @description Service to share data between controllers.
 */
angular.module('pmpApp').service('Data', ['$rootScope', function ($rootScope) {
    'use strict';
    var filteredData = [], // currently displayed data (after filtering)
        loadedData = [], // currently loaded data (before filtering)
        inputTags = [], // input tags management
        priorityFilter, statusFilter, pwgFilter; // filter details
    return {
        /**
         * @description Filtered data getter.
         * @return {Array} Array of filtered data objects.
         */
        getFilteredData: function () {
            return this.filteredData;
        },
        /**
         * @description Filtered data setter. Emits onChangeNotification.
         * @params {Array} i the array of filtered data objects.
         */
        setFilteredData: function (i) {
            this.filteredData = i;
            $rootScope.$broadcast(
                'onChangeNotification:FilteredData');
        },
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
        setInputTags: function (i, append, remove) {
            if (i === 'all') {
                for (var j = 0; j < this.loadedData.length; j++) {
                    var input = this.loadedData[j].input;
                    if (this.inputTags.indexOf(input) === -1)
                        this.inputTags.push(input);
                }
            } else if (append) {
                this.inputTags.push(i);
            } else if (remove) {
                this.inputTags.splice(this.inputTags.indexOf(i),
                    1);
            } else {
                this.inputTags = i;
            }
            $rootScope.$broadcast(
                'onChangeNotification:InputTags');
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
            setLoadedData: function (i, append, sort, more) {
            if (append) Array.prototype.push.apply(i, this.loadedData);
            this.loadedData = i;
            if (sort) this.sortDataByStatus();
            if (more === undefined || more -1 <= this.inputTags.length) {
                $rootScope.$broadcast('onChangeNotification:LoadedData');
            }
        },
        /**
         * @description Priority filter getter.
         * @return {Array} String array in a form [minimum, maximum].
         */
        getPriorityFilter: function () {
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
         * @description Change filter object, status or pwg.
         * @params {Array} data the loaded data array.
         * @params {Boolean} reset the cleaning filter switch.
         * @params {Boolean} value the default boolean assigned to new keys.
         * @params {Boolean} isStatusFilter if true change status filter, otherwise change pwg.
         */
        changeFilter: function (data, reset, value, isStatusFilter) {
            if (reset) {
                if (isStatusFilter) {
                    this.statusFilter = {};
                } else {
                    this.pwgFilter = {};
                }
            }
            var key;
            for (var i = 0; i < data.length; i++) {
                if (isStatusFilter) {
                    key = data[i].status;
                    if (this.statusFilter[key] === undefined)
                        this.statusFilter[key] = value;
                } else {
                    key = data[i].pwg;
                    if (this.pwgFilter[key] === undefined) this
                        .pwgFilter[key] = value;
                }
            }
        },
        /**
         * @description Initialize filter.
         * @params {Array} data the array of keys to be set as true.
         * @params {Boolean} isStatusFilter if true initialize status filter, otherwise change pwg.
         */
        initializeFilter: function (data, isStatusFilter) {
            for (var i = 0; i < data.length; i++) {
                if (data[i] !== '') {
                    if (isStatusFilter) {
                        this.statusFilter[data[i]] = true;
                    } else {
                        this.pwgFilter[data[i]] = true;
                    }
                }
            }
        },
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
         * @params {Boolean} ifFilter the reset filters marker.
         */
        reset: function (ifFilter) {
            this.loadedData = [];
            this.setInputTags([], false, false);
            if (ifFilter) {
                this.priorityFilter = ['', ''];
                this.statusFilter = {};
                this.pwgFilter = {};
            }
        },
        statusOrder: {
            'upcoming': 0,
            'new': 1,
            'validation': 2,
            'defined': 3,
            'approved': 4,
            'submitted': 5,
            'done': 6
        },
        merge: function (left, right) {
            var result = [], leftIndex = 0, rightIndex = 0;

            while (leftIndex < left.length && rightIndex < right.length){
                if (this.statusOrder[left[leftIndex].status] <
                        this.statusOrder[right[rightIndex].status]){
                    result.push(left[leftIndex++]);
                } else {
                    result.push(right[rightIndex++]);
                }
            }

            return result.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
        },
        mergeSort: function (items) {
            if (items.length < 2) {
                return items;
            }

            var middle = Math.floor(items.length / 2);

            return this.merge(this.mergeSort(items.slice(0, middle)),
                    this.mergeSort(items.slice(middle)));
        },
        /**
         * @description Merge sort the loaded data. Incurs a performance penalty in
         *     sensible browsers, but it hugely faster (by orders of magnitude) in
         *     Chrome, and so is a somewhat-necessary evil
         */
        sortDataByStatus: function() {
            this.loadedData = this.mergeSort(this.loadedData);
        }
    };
}]);

