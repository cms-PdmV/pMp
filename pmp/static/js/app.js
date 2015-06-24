'use strict';

var pmpApp = angular.module('pmpApp', ['ngAnimate', 'ngRoute', 'ui.bootstrap',
                                       'pmpCharts', 'customFilters', 'customTags'])
    .config(['$routeProvider', '$locationProvider',
	 function($routeProvider, $locationProvider) {
            $routeProvider
                .when('/', {
                    templateUrl: 'partials/index.html',
                    controller: 'IndexController'
                })
                .when('/chains', {
                    templateUrl: 'partials/chains.html',
                    controller: 'ChainsController'
                })
	        .when('/historical', {
		    templateUrl: 'partials/historical.html',
                    controller: 'HistoricalController'
		})
	        .when('/performance', {
		    templateUrl: 'partials/performance.html',
                    controller: 'PerformanceController'
		})
                .when('/present', {
                    templateUrl: 'partials/present.html',
                    controller: 'PresentController'
		});
            $locationProvider.html5Mode(true);
        }
    ]);