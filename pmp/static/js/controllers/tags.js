/**
 * @name tags.controller
 * @type controller
 * @description Handles input management: tags.
 */
angular.module('pmpApp').controller('TagsController', ['$scope', 'Data',
    function ($scope, Data) {
        'use strict';

        /**
         * @description Init method of the controller
         */
        $scope.initTags = function () {
            $scope.inputTags = [];
        };

        /**
         * @description Remove tag form input array.
         * @param {String} tagToREmove the input to be removed.
         * @param {Boolean} isServerSide the mark if to process the data or requery API.
         */
        $scope.tagRemove = function (tagToRemove, isServerSide) {
            if (isServerSide) {
                Data.setInputTags(tagToRemove, false, true);
                $scope.query(true);
                return null;
            }
            $scope.loadingData = true;
            var tmp = Data.getLoadedData();
            var data = [];
            setTimeout(function () {
                for (var i = 0; i < tmp.length; i++) {
                    if (tmp[i].input !== tagToRemove) {
                        data.push(tmp[i]);
                    }
                }
                Data.reloadFilters(data);
                Data.setInputTags(tagToRemove, false, true);
            }, 1000);
        };

        // Broadcast receiver, change input tags array
        $scope.$on('onChangeNotification:InputTags', function () {
            $scope.inputTags = Data.getInputTags();
        });
    }
]);