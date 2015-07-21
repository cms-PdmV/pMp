pmpApp.factory('browser', ['$window', function($window) {
    var userAgent = $window.navigator.userAgent;
    var supportedBrowsers = {Chrome: /chrome/i, Safari: /safari/i, Firefox: /firefox/i, Opera: /Opera/i};
    for(var s in supportedBrowsers) {
        if (supportedBrowsers[s].test(userAgent)) return true;
    }
    return false;
}]);