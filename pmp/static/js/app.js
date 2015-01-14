'use strict';

var pmpApp = angular.module('pmpApp', ['ngAnimate', 'ngRoute', 'mcm.charts'])
    .config(['$routeProvider', '$locationProvider',
        function($routeProvider, $locationProvider) {
            $routeProvider
                .when('/campaign', {
                    templateUrl: '/partials/campaign.html',
                    controller: 'CampaignsController'
                })
                .when('/chain', {
                    templateUrl: '/partials/chain.html',
                    controller: 'ChainsController'
                })
                .when('/', {
                    templateUrl: '/partials/index.html',
                    controller: 'IndexController'
                });
            $locationProvider.html5Mode(true);
            $locationProvider.hashPrefix('!');
        }
    ]);