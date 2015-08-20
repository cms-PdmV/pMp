angular.module('pmpApp').controller('FilterController', ['$scope', 'Data', function($scope, Data) {

    $scope.priorityPerBlock = {1: 110000, 2: 90000, 3: 85000, 4: 80000, 5: 70000, 6: 63000};

    $scope.initFilter = function() {
        $scope.filterPriority = Data.getFilterPriority();
    }

    $scope.applyFilterChanges = function() {
        Data.setFilterPriority($scope.filterPriority);
        $scope.updateRequestData();
        $scope.setURL();
    }
}]);