angular.module('pmpApp').controller('TagsController', ['$scope', 'Data', function($scope, Data) {

    $scope.initTags = function() {
        $scope.inputTags = [];
    }

    $scope.tagRemove = function(tagToRemove) {
        var tmp = Data.getLoadedData();
        var data = [];
        setTimeout(function() {
            for (var i = 0; i < tmp.length; i++) {
                if (tmp[i].input !== tagToRemove) {
                    data.push(tmp[i]);
                }
            }
            Data.reloadFilters(data);
            Data.setInputTags(tagToRemove, false, true);
        }, 1000);
    };

    $scope.$on('onChangeNotification:InputTags', function() {
        $scope.inputTags = Data.getInputTags();
    });
}]);