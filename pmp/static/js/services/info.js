angular.module('pmpApp').factory('PageDetailsProvider', function() {
    return {
        index: {id: 0},
        present: {id: 1, title: 'Present Statistics', template: 'build/present.min.html', typeahead: '/present'},
        historical: {id: 2, title: 'Historical Statistics', template: 'build/historical.min.html', typeahead: '/historical'},
        performance: {id: 3, title: 'Performance Statistics', template: 'build/performance.min.html', typeahead: '/performance'}
    };
});