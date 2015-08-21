angular.module('pmpApp').controller('FilterController', ['$scope', 'Data', function($scope, Data) {

    $scope.priorityPerBlock = {1: 110000, 2: 90000, 3: 85000, 4: 80000, 5: 70000, 6: 63000};

    $scope.initFilter = function() {
        $scope.priorityFilter = Data.getPriorityFilter();
        $scope.statusFilter = Data.getStatusFilter();
        $scope.pwgFilter = Data.getPWGFilter();
    }

    $scope.applyFilterChanges = function() {
        Data.setPriorityFilter($scope.priorityFilter);
        Data.setStatusFilter($scope.statusFilter);
        Data.setPWGFilter($scope.pwgFilter);
        $scope.updateRequestData();
        $scope.setURL();
    }

    $scope.$on('updateFilterTag', function(){
        $scope.statusFilter = Data.getStatusFilter();
        $scope.pwgFilter = Data.getPWGFilter();
    });
}]);