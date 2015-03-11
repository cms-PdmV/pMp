'use strict';

var pmpApp = angular.module('pmpApp', ['ngAnimate', 'ngRoute', 'ui.bootstrap', 'mcm.charts'])
    .config(['$routeProvider', '$locationProvider',
	 function($routeProvider, $locationProvider) {
            $routeProvider
                .when('/', {
                    templateUrl: 'partials/index.html',
                    controller: 'IndexController'
                })
                .when('/present', {
                    templateUrl: 'partials/present.html',
                    controller: 'PresentController'
		})
	        .when('/historical', {
		    templateUrl: 'partials/historical.html',
                    controller: 'HistoricalController'
		});
            $locationProvider.html5Mode(true);
        }
    ]);