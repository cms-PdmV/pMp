angular.module('pmpApp').factory('PageDetailsProvider', function() {
    var pages = {
        index: {id: 0},
        present: {id: 1, title: 'Present Statistics', template: 'build/present.min.html'},
        historical: {id: 2, title: 'Historical Statistics', template: 'build/historical.min.html'},
        performance: {id: 3, title: 'Performance Statistics', template: 'build/performance.min.html'}
    };
    return pages
});