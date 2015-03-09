'use strict';

var pmpApp = angular.module('pmpApp', ['ngAnimate', 'ngRoute', 'ui.bootstrap', 'mcm.charts'])
    .config(['$routeProvider', '$locationProvider',
	 function($routeProvider, $locationProvider) {
            $routeProvider
                .when('/', {
                    templateUrl: 'partials/index.html',
                    controller: 'IndexController'
                })
                .when('/campaign', {
                    templateUrl: 'partials/campaign.html',
                    controller: 'CampaignsController'
                })
                .when('/chain', {
                    templateUrl: 'partials/campaign.html',
                    controller: 'CampaignsController'
		})
	        .when('/lifetime', {
		    templateUrl: 'partials/lifetime.html',
                    controller: 'LifetimeController'
		});
            $locationProvider.html5Mode(true);
        }
    ]);