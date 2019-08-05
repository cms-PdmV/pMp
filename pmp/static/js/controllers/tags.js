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
        $scope.tagRemove = function (tagToRemove) {
            Data.removeInputTag(tagToRemove);
        };

        // Broadcast receiver, change input tags array
        $scope.$on('onChangeNotification:InputTags', function () {
            $scope.inputTags = Data.getInputTags();
        });

        $scope.$on('onChangeNotification:UpdateInputTags', function () {
            $scope.inputTags = Data.getInputTags();
        });
    }
]);
