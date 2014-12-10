'use strict';

var pmpApp = angular.module('pmpApp', ['ngRoute', 'mcm.charts'])
    .config(['$routeProvider', '$locationProvider',
        function($routeProvider, $locationProvider) {
            $routeProvider
                .when('/dashboard', {
                    templateUrl: 'partials/dashboard.html'
                })
                .when('/get_stats', {
                    templateUrl: 'partials/get_stats.html'
                });
            $locationProvider.html5Mode(true);
        }
    ]);