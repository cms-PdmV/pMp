/**
 * @name tags.controller
 * @type controller
 * @description Handles input management: tags.
 */
angular.module('pmpApp').controller('TagsController', ['$rootScope', '$scope', 'Data',
                                                       function ($rootScope, $scope, Data) {
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
            $rootScope.loadingData = true;
            if (isServerSide) {
                Data.removeInputTag(tagToRemove);
                $scope.query(true);
                return null;
            }
            var tmp = Data.getLoadedData();
            var data = [];
            setTimeout(function () {
                for (var i = 0; i < tmp.length; i++) {
                    if (tmp[i].input !== tagToRemove) {
                        data.push(tmp[i]);
                    }
                }
                Data.reloadFilters(data);
                Data.removeInputTag(tagToRemove);
                $scope.inputTags = Data.getInputTags();
            }, 100);
        };

        // Broadcast receiver, change input tags array
        $scope.$on('onChangeNotification:InputTags', function () {
            $scope.inputTags = Data.getInputTags();
        });
    }
]);