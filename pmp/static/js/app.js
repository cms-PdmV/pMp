'use strict';

var pmpApp = angular.module('pmpApp', ['ngAnimate', 'ngRoute', 'ui.bootstrap', 'mcm.charts'])
    .config(['$routeProvider', '$locationProvider',
        function($routeProvider, $locationProvider) {
            $routeProvider
                .when('/campaign', {
                    templateUrl: '/partials/campaign.html',
                    controller: 'CampaignsController'
                })
                .when('/', {
                    templateUrl: '/partials/index.html',
                    controller: 'IndexController'
                })
                .when('/chain', {
                    templateUrl: '/partials/campaign.html',
                    controller: 'CampaignsController'
                });
            $locationProvider.html5Mode(true);
            $locationProvider.hashPrefix('!');
        }
    ]);