angular.module('pmpApp').controller('TagsController', ['$scope', 'Data', function($scope, Data) {

    $scope.initTags = function() {
        $scope.inputTags = [];
    }

    $scope.tagRemove = function(tagToRemove, isServerSide) {
        if (isServerSide) {
            Data.setInputTags(tagToRemove, false, true);
            $scope.query(true);
            return false;
        }
        $scope.loadingData = true;
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