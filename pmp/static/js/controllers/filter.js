/**
 * @name filter.controller
 * @type controller
 * @description Handles filtering loaded data.
 */
angular.module('pmpApp').controller('FilterController', ['$scope', 'Data',
    function ($scope, Data) {
        'use strict';

        /**
         * @description Invoked when filter data is changed
         * @param {Boolean} isServerSide the mark if to process the data or requery API.
         */
        $scope.applyFilterChanges = function (isServerSide) {
            Data.setPriorityFilter($scope.priorityFilter);
            Data.setStatusFilter($scope.statusFilter);
            if (isServerSide) {
                $scope.query(true);
            } else {
                Data.setPWGFilter($scope.pwgFilter);
                $scope.updateFilteredData();
                $scope.setURL();
            }
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
            Data.reset(true);
            $scope.priorityFilter = Data.getPriorityFilter();
            $scope.statusFilter = Data.getStatusFilter();
            $scope.pwgFilter = Data.getPWGFilter();
        };

        /**
         * @description Updates filtered data after filter change.
         */
        $scope.updateFilteredData = function () {
            $scope.loadingData = true;
            var tmp = Data.getLoadedData();
            var max = $scope.priorityFilter[1];
            var min = $scope.priorityFilter[0];
            // max could be any number big enough, but let's use maximum to be sure
            if (isNaN(max) || max === '') {
                max = Number.MAX_VALUE;
            }

            setTimeout(function () {
                var data = [];
                for (var i = 0; i < tmp.length; i++) {
                    if (tmp[i].priority >= min && tmp[i].priority <=
                        max && Data.getStatusFilter()[tmp[i]
                            .status] && Data.getPWGFilter()[
                            tmp[i].pwg]) {
                        data.push(tmp[i]);
                    }
                }
                Data.setFilteredData(data);
                $scope.loadingData = false;
            }, 1000);
        };

        // Broadcast receiver, change filtered data on loaded data change
        $scope.$on('onChangeNotification:LoadedData', function (event,
            data) {
            $scope.priorityFilter = Data.getPriorityFilter();
            $scope.pwgFilter = Data.getPWGFilter();
            $scope.statusFilter = Data.getStatusFilter();
            if (data === undefined) {
                $scope.updateFilteredData();
            }
        });
    }
]);