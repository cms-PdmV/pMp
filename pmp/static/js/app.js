/**
 * @name pmpApp
 * @license (c) cms-PdmV Licensed under the MIT license
 * @version 1.0.0
 * @description
 * While Flask is handling mostly API calls routing, this part of configuration 
 * provides routing for web application loading partial and controller in 
 * ng-view container in valid.html template.
 * @style jshint.com, jsbeautifier.org
 * Four spaces indent, two newlines between tokens, 
 * 80 characters lines, braces with control statement
 */
angular.module('pmpApp', ['ngAnimate', 'ngRoute', 'ui.bootstrap', 'pmpCharts',
        'customTags'
    ])
    .config(['$routeProvider', '$locationProvider',
        function($routeProvider, $locationProvider) {
            'use strict';
            $routeProvider
                .when('/', {
                    templateUrl: 'build/index.min.html',
                    controller: 'IndexController'
                })
                .when('/index', {
                    templateUrl: 'build/index.min.html',
                    controller: 'IndexController'
                })
                // chains plot is not used
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