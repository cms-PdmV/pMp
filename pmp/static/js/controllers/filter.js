angular.module('pmpApp').controller('FilterController', ['$scope', 'Data', function($scope, Data) {

    $scope.applyFilterChanges = function() {
        Data.setPriorityFilter($scope.priorityFilter);
        Data.setStatusFilter($scope.statusFilter);
        Data.setPWGFilter($scope.pwgFilter);
        $scope.updateFilteredData();
        $scope.setURL();
    }

    $scope.initFilter = function() {
        $scope.priorityFilter = Data.getPriorityFilter();
        $scope.statusFilter = Data.getStatusFilter();
        $scope.pwgFilter = Data.getPWGFilter();
    }

    $scope.priorityPerBlock = {1: 110000, 2: 90000, 3: 85000, 4: 80000, 5: 70000, 6: 63000};

    $scope.updateFilteredData = function() {
        var tmp = Data.getLoadedData();
        var max = $scope.priorityFilter[1];
        var min = $scope.priorityFilter[0];
        if (isNaN(max) || max == '') {
            max = Number.MAX_VALUE;
        }

        setTimeout(function() {
            var data = [];
            for (var i = 0; i < tmp.length; i++) {
                if (tmp[i].priority >= min && tmp[i].priority <= max && Data.getStatusFilter()[tmp[i].status] && Data.getPWGFilter()[tmp[i].pwg]) {
                    data.push(tmp[i]);
                }
            }
            $scope.$apply(function() {
                Data.setFilteredData(data);
            });
        }, 0);
    }

    $scope.$on('onChangeNotification:LoadedData', function() {
        $scope.priorityFilter = Data.getPriorityFilter();
        $scope.pwgFilter = Data.getPWGFilter();
        $scope.statusFilter = Data.getStatusFilter();
        $scope.updateFilteredData();
    });
}]);