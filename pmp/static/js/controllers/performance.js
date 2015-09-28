/**
 * @name performance.controller
 * @type controller
 * @description Performance Graph Controller
 */
angular.module('pmpApp').controller('PerformanceController', ['$http',
    '$interval', '$location', '$rootScope', '$scope', 'PageDetailsProvider', 'Data',
    function ($http, $interval, $location, $rootScope, $scope, PageDetailsProvider,
        Data) {
        'use strict';

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.performance;

            // reset data and filters
            Data.reset(true);

            // define graph difference
            $scope.difference = {
                minuend: 'done',
                subtrahend: 'created'
            };
            $scope.selections = ['validation', 'approved',
                'submitted'
            ];

            var inx;
            if ($location.search().min !== undefined) {
                inx = $scope.selections.indexOf($location.search().min);
                if (inx != -1) {
                    $scope.difference.minuend = $location.search().min;
                    $scope.selections.splice(inx, 1);
                }
            }

            if ($location.search().sub !== undefined) {
                inx = $scope.selections.indexOf($location.search().sub);
                if (inx != -1) {
                    $scope.difference.subtrahend = $location.search()
                        .sub;
                    $scope.selections.splice(inx, 1);
                }
            }

            // if show time label
            $scope.showDate = $location.search().t === 'true';

            // if linear scale
            $scope.linearScale = $location.search().l === 'true';

            // set number of bins
            if ($location.search.b !== '' && !isNaN($location.search()
                    .b)) {
                $scope.bins = parseInt($location.search().b, 10);
            } else {
                $scope.bins = 10;
            }

            // initiate filters
            if ($location.search().x !== undefined && $location.search()
                .x !== '') Data.setPriorityFilter($location.search()
                .x.split(','));
            if ($location.search().s !== undefined && $location.search()
                .s !== '') Data.initializeFilter($location.search()
                .s.split(','), true);
            if ($location.search().w !== undefined && $location.search()
                .w !== '') Data.initializeFilter($location.search()
                .w.split(','), false);

            // load graph data
            if ($location.search().r !== undefined && $location.search()
                .r !== '') {
                $rootScope.loadingData = true;
                var tmp = $location.search().r.split(',');
                // if filter is empty, assume all true
                var empty = [$scope.isEmpty(Data.getPWGFilter()),
                    $scope.isEmpty(Data.getStatusFilter())
                ];
                for (var i = 0; i < tmp.length; i++) {
                    $scope.load(tmp[i], true, tmp.length, empty[0],
                        empty[1]);
                }
            } else {
                // if this is empty just change URL as some filters
                // could have been initiated
                $scope.setURL();
            }
        };

        /**
         * @description Core: Query API
         * @param {String} request User input.
         * @param {Boolean} add Append results if true
         * @param {Boolean} more Are there more requests in a queue
         * @param {Boolean} defaultPWG When new PWG shows up what should be default filter value
         * @param {Boolean} defaultStatus When new status shows up what should be default filter value
         */
        $scope.load = function (input, add, more, defaultPWG,
            defaultStatus) {
            if (!input) {
                $scope.showPopUp(PageDetailsProvider.messages.W0.type,
                    PageDetailsProvider.messages.W0.message);
            } else if (add && Data.getInputTags().indexOf(input) !==
                -1) {
                $scope.showPopUp(PageDetailsProvider.messages.W1.type,
                    PageDetailsProvider.messages.W1.message);
            } else {
                $rootScope.loadingData = true;
                var promise = $http.get("api/" + input +
                    "/performance/_");
                promise.then(function (data) {
                    if (!data.data.results.length) {
                        $scope.showPopUp(
                            PageDetailsProvider.messages
                            .W2.type,
                            PageDetailsProvider.messages
                            .W2.message);
                        $rootScope.loadingData = false;
                    } else {
                        if (add) {
                            Data.changeFilter(data.data.results,
                                false, defaultStatus,
                                true);
                            Data.changeFilter(data.data.results,
                                false, defaultPWG,
                                false);
                            Data.setLoadedData(data.data.results,
                                true);
                            $scope.showPopUp(
                                PageDetailsProvider.messages
                                .S1.type,
                                PageDetailsProvider.messages
                                .S1.message);
                        } else {
                            Data.reset(false);
                            Data.changeFilter(data.data.results,
                                true, true, true);
                            Data.changeFilter(data.data.results,
                                true, true, false);
                            Data.setLoadedData(data.data.results,
                                false);
                            $scope.showPopUp(
                                PageDetailsProvider.messages
                                .S0.type,
                                PageDetailsProvider.messages
                                .S0.message);
                        }
                        Data.setInputTags(input, true,
                            false);
                        $scope.setURL();
                    }
                }, function () {
                    $scope.showPopUp(PageDetailsProvider.messages
                        .E0.type, PageDetailsProvider.messages
                        .E1.message);
                    $rootScope.loadingData = false;
                });
            }
        };

        /**
         * @description Core: Change URL when data or filter changes
         */
        $scope.setURL = function () {
            $location.path($location.path(), false);
            var params = {};

            // collect user inputs
            var r = Data.getInputTags();
            if (r.length) params.r = r.join(',');

            // number of bins
            if ($scope.bins !== '') params.b = $scope.bins;

            // setting minuend
            if ($scope.difference.minuend !== '') params.min =
                $scope.difference.minuend;

            // setting subtrahend
            if ($scope.difference.subtrahend !== '') params.sub =
                $scope.difference.subtrahend;

            // set scale
            params.l = $scope.linearScale + '';

            // if show the time block
            params.t = $scope.showDate + '';

            // set priority filter
            params.x = Data.getPriorityFilter().join(',');

            // init loads differently for no param (all true) and empty param (all false)
            // hence the isEmpty check

            // set pwg filter
            if (!$scope.isEmpty(Data.getPWGFilter())) {
                params.w = $scope.getCSVPerFilter(Data.getPWGFilter());
            }

            // set status filter
            if (!$scope.isEmpty(Data.getStatusFilter())) {
                params.s = $scope.getCSVPerFilter(Data.getStatusFilter());
            }

            // reload url
            $location.search(params);
            // broadcast change notification
            $scope.$broadcast('onChangeNotification:URL');
        };

        /**
         * @description Core: Query server for a report of current view
         * @param {String} format which will be requested (pdf/png/svg)
         */
        $scope.takeScreenshot = function (format) {
            $rootScope.loadingData = true;
            if (format === undefined) format = 'svg';
            var xml = (new XMLSerializer()).serializeToString(
                    document.getElementById("ctn").getElementsByTagName(
                        "svg")[0])
                .replace('viewBox="0 -20 1170 300"',
                    'viewBox="0 -20 1170 400" font-family="sans-serif"'
                ).replace('</svg>',
                    '<text transform="translate(0, 300)">Generated: ' +
                    $scope.dt + '. For input: ' + Data.getInputTags()
                    .join(', ') + '. Time difference between ' +
                    $scope.difference.minuend + ' and ' + $scope.difference
                    .subtrahend + '</text></svg>').replace(/#/g,
                    'U+0023').replace(/\n/g, ' ').replace(/\//g,
                    '\\\\');
            $http.get('ts/' + format + '/' + encodeURIComponent(xml))
                .then(function (data) {
                    window.open(data.data);
                    $rootScope.loadingData = false;
                });
        };

        /**
         * @description Change histogram
         */
        $scope.applyHistogram = function (d, e) {
            $scope.histogramData = d;
            $scope.histogramDataExtended = e;
        };

        /**
         * @description When differences are recalculated in derective
         */
        $scope.applyDifference = function (d) {
            $scope.difference = d;
            $scope.setURL();
        };

        /**
         * @description On scale change 
         */
        $scope.changeScale = function (a) {
            $scope.linearScale = a;
            $scope.setURL();
        };

        // Broadcast receiver, change filtered data on loaded data change
        $scope.$on('onChangeNotification:FilteredData', function () {
            $rootScope.loadingData = false;
            $scope.setURL();
            $scope.data = Data.getFilteredData();
        });

        // Set interval update of time variables
        $interval($scope.updateCurrentDate, 1000);
        $interval(function () {
            $scope.updateLastUpdate('requests');
        }, 2 * 60 * 1000);
        $scope.updateLastUpdate('requests');
    }
]);