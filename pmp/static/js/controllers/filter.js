/**
 * @name filter.controller
 * @type controller
 * @description Handles filtering loaded data.
 */
angular.module('pmpApp').controller('FilterController', ['$rootScope', '$scope', 'Data',
    function ($rootScope, $scope, Data) {
        'use strict';

        /**
         * @description Invoked when filter data is changed
         * @param {Boolean} isServerSide the mark if to process the data or requery API.
         */
        $scope.applyFilterChanges = function () {
            Data.setPriorityFilter($scope.priorityFilter);
            Data.setStatusFilter($scope.statusFilter);
            $scope.query();
        };

        /**
         * @description Init method of the controller.
         */
        $scope.initFilter = function () {
            $scope.priorityPerBlock = {
                1: 110000,
                2: 90000,
                3: 85000,
                4: 80000,
                5: 70000,
                6: 63000
            };
            $scope.priorityFilter = Data.getPriorityFilter();
            $scope.statusFilter = Data.getStatusFilter();
            $scope.interestedPWGFilter = Data.getInterestedPWGFilter();
            $scope.pwgFilter = Data.getPWGFilter();
            $scope.interestedPWGFilterKeys = Object.keys($scope.interestedPWGFilter || {}).sort();
            $scope.pwgFilterKeys = Object.keys($scope.pwgFilter || {}).sort();
        };

        /**
         * @description Sets all PWG filters to the same value
         * @param {string} filter object to set all values of
         * @param {Boolean} what to set each filter to
         * @param {Boolean} this is passed to the applyFilterChanges method
         */
        $scope.setAllFilterValues = function (filter, value) {
            for (var key in filter) {
                filter[key] = value;
            }

            $scope.applyFilterChanges();
        };

        // Broadcast receiver, change filtered data on loaded data change
        $scope.$on('onChangeNotification:LoadedData', function (event, data) {
            $scope.priorityFilter = Data.getPriorityFilter();
            $scope.pwgFilter = Data.getPWGFilter();
            $scope.interestedPWGFilter = Data.getInterestedPWGFilter();
            $scope.statusFilter = Data.getStatusFilter();
            $scope.interestedPWGFilterKeys = Object.keys($scope.interestedPWGFilter || {}).sort();
            $scope.pwgFilterKeys = Object.keys($scope.pwgFilter || {}).sort();
        });
    }
]);
