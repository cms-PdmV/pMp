angular.module('pmpApp').controller('MainController', ['$http', '$location', '$route', '$rootScope', '$scope', '$timeout', 'browser', function($http, $location, $route, $rootScope, $scope, $timeout, isSupportedBrowser) {
    // controls visibility of page main container
    $scope.showView = false;
    // show unsupported modal if the page is not supported
    if (!isSupportedBrowser) $('#unsupportedModal').modal('show');
    
    /*
     * Wait until animation fade out finishes and navigate to differnet page
     */
    $scope.nav = function(where) {
        $scope.showView = (where == '');
        if (!$scope.showView) {
            $timeout(function() {
                $location.search({});
                $location.path(where);
                $timeout(function() {
                    $scope.showView = !$scope.showView;
                    $scope.nav('');
                }, 100);
            }, 1100);
        }
    };
    $timeout(function() { $scope.nav('');}, 100);

    /*
     * Prevent default operation of $loaction.path
     * This way only URL will be updated on path change and page will not be refreshed
     */
    var original = $location.path;
    $location.path = function(path, reload) {
        if (reload === false) {
            var lastRoute = $route.current;
            var un = $rootScope.$on('$locationChangeSuccess', function() {
                $route.current = lastRoute;
                un();
            });
        }
        return original.apply($location, [path]);
    };

    /*
     * Pop up different information types
     */
    $scope.showPopUp = function(type, text) {
        switch (type) {
            case 'error':
                $scope.popUp = {
                    show: true,
                    title: 'Error',
                    message: text,
                    style: 'panel-danger',
                    icon: 'fa-frown-o'
                };
                $timeout(function() {
                    $scope.showPopUp('', '');
                }, 2000);
                break;
            case 'warning':
                $scope.popUp = {
                    show: true,
                    title: 'Warning',
                    message: text,
                    style: 'panel-warning',
                    icon: 'fa-exclamation-triangle'
                };
                $timeout(function() {
                    $scope.showPopUp('', '');
                }, 2000);
                break;
            case 'success':
                $scope.popUp = {
                    show: true,
                    title: 'Success',
                    message: text,
                    style: 'panel-success',
                    icon: 'fa-check'
                };
                $timeout(function() {
                    $scope.showPopUp('', '');
                }, 2000);
                break;
            default:
                $scope.popUp.show = false;
                break;
        }
    }

    /*
     * Check if object is empty
     */
    $scope.isEmpty = function (obj) {
        return angular.equals({},obj); 
    };
    
    /*
     * Update current time variable
     */
    $scope.updateCurrentDate = function() {
        $scope.dt = new Date();
    }

    /*
     * Query API for last successful update timestamp. Pass indexes as input as csv
     */
    $scope.updateLastUpdate = function(fieldsCSV) {
        $http.get("api/" + fieldsCSV +"/lastupdate/_").then(function(data) {
            $scope.lastUpdate = data.data.results.last_update
        });
    }
}]);