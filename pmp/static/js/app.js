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
                    templateUrl: 'static/build/index.min.html',
                    controller: 'IndexController',
                    reloadOnSearch: false
                })
                .when('/index', {
                    templateUrl: 'static/build/index.min.html',
                    controller: 'IndexController',
                    reloadOnSearch: false
                })
                .when('/historical', {
                    templateUrl: 'static/build/plot.min.html',
                    controller: 'HistoricalController',
                    reloadOnSearch: false
                })
                .when('/performance', {
                    templateUrl: 'static/build/plot.min.html',
                    controller: 'PerformanceController',
                    reloadOnSearch: false
                })
                .when('/present', {
                    templateUrl: 'static/build/plot.min.html',
                    controller: 'PresentController',
                    reloadOnSearch: false
                });
            $locationProvider.html5Mode(true);
        }
    ]);