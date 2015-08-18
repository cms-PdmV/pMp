'use strict';

angular.module('pmpApp', ['ngAnimate', 'ngRoute', 'ui.bootstrap', 'pmpCharts', 'customFilters', 'customTags'])
    .config(['$routeProvider', '$locationProvider',
	 function($routeProvider, $locationProvider) {
            $routeProvider
                .when('/', {
                    templateUrl: 'build/index.min.html',
                    controller: 'IndexController'
                })
                .when('/chains', {
                    templateUrl: 'build/plot.min.html',
                    controller: 'ChainsController'
                })
	        .when('/historical', {
		    templateUrl: 'build/plot.min.html',
                    controller: 'HistoricalController'
		})
	        .when('/performance', {
		    templateUrl: 'build/plot.min.html',
                    controller: 'PerformanceController'
		})
                .when('/present', {
                    templateUrl: 'build/plot.min.html',
                    controller: 'PresentController'
		});
            $locationProvider.html5Mode(true);
        }
    ]);