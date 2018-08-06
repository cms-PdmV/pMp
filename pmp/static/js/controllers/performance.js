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

        // Information about default URL parameters
        $scope.defaults = {
            r: '', // search term
            b: 10, // histogram bins
            min: 'done', // minuend
            sub: 'created', // subtrahend
            l: 'true', // linear scale? false = log
            t: 'false', // show last updated time?
            x: ',', // priority filter
            w: undefined, // pwg filter
            s: undefined, // status filter
        };

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.performance;

            // reset data and filters
            Data.reset(true);

            // collect URL parameters together
            var urlParameters = {};

            ['r', 'b', 'min', 'sub', 'l', 't', 'x', 'w', 's'].forEach(
                function (param, index, array) {
                var urlValue = $location.search()[param];

                // if the default is a number, expect a numerical parameter
                if (urlValue === undefined
                    || (angular.isNumber($scope.defaults[param]) && !angular.isNumber(urlValue))) {
                    urlParameters[param] = $scope.defaults[param];
                }
                else {
                    urlParameters[param] = urlValue;
                }
            });

            // define graph difference
            $scope.difference = {
                minuend: 'done',
                subtrahend: 'created'
            };
            $scope.selections = ['validation', 'approved',
                'submitted'
            ];

            var inx;
            inx = $scope.selections.indexOf(urlParameters.min);
            if (inx != -1) {
                $scope.difference.minuend = urlParameters.min;
                $scope.selections.splice(inx, 1);
                $scope.selections.push('done');
            }

            inx = $scope.selections.indexOf(urlParameters.sub);
            if (inx != -1) {
                $scope.difference.subtrahend = urlParameters.sub;
                $scope.selections.splice(inx, 1);
                $scope.selections.push('created');
            }

            // if show time label
            $scope.showDate = urlParameters.t === 'true';

            // if linear scale
            if (urlParameters.l === 'false') {
                $scope.scaleType = 'log';
            } else {
                $scope.scaleType = 'linear';
            }

            // set number of bins
            $scope.bins = parseInt(urlParameters.b, 10);

            // initialise filters
            if (urlParameters.x !== undefined) {
                Data.setPriorityFilter(urlParameters.x.split(','));
            }

            if (urlParameters.s !== undefined) {
                Data.initializeFilter(urlParameters.s.split(','), true);
            }

            if (urlParameters.w !== undefined) {
                Data.initializeFilter(urlParameters.w.split(','), false);
            }

            // load graph data
            if (urlParameters.r !== '') {
                $rootScope.loadingData = true;
                var tmp = urlParameters.r.split(',');
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
                return;
            }
            if (input.constructor == Object) {
                input = input.label;
            }
            if (add && Data.getInputTags().indexOf(input) !== -1) {
                $scope.showPopUp(PageDetailsProvider.messages.W1.type,
                    PageDetailsProvider.messages.W1.message);
            } else {
                $rootScope.loadingData = true;
                var promise = $http.get("api/" + input +
                    "/performance/_");
                promise.then(function (data) {
                    if (!data.data.results.data.length) {
                        $scope.showPopUp(
                            PageDetailsProvider.messages
                            .W2.type,
                            PageDetailsProvider.messages
                            .W2.message);
                        $rootScope.loadingData = false;
                    } else {
                        if (add) {
                            Data.changeFilter(data.data.results.data,
                                false, defaultStatus,
                                true);
                            Data.changeFilter(data.data.results.data,
                                false, defaultPWG,
                                false);
                            Data.setLoadedData(data.data.results.data,
                                true);
                            $scope.showPopUp(
                                PageDetailsProvider.messages
                                .S1.type,
                                PageDetailsProvider.messages
                                .S1.message);
                        } else {
                            Data.reset(false);
                            Data.changeFilter(data.data.results.data,
                                true, true, true);
                            Data.changeFilter(data.data.results.data,
                                true, true, false);
                            Data.setLoadedData(data.data.results.data,
                                false);
                            $scope.showPopUp(
                                PageDetailsProvider.messages
                                .S0.type,
                                PageDetailsProvider.messages
                                .S0.message);
                        }
                        $scope.first_status = data.data.results.first_status;
                        Data.setInputTags(input, true,
                            false);
                        $scope.setURL();
                    }
                }, function () {
                    $scope.showPopUp(PageDetailsProvider.messages
                        .E1.type, PageDetailsProvider.messages
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
            var params = {}, r, b, min, sub, l, t, x, w, s;

            // collect user inputs
            r = Data.getInputTags();
            if (r.length) params.r = r.join(',');

            // number of bins
            b = $scope.bins

            if (b !== $scope.defaults.b) {
                params.b = b;
            }

            // setting minuend
            min = $scope.difference.minuend;

            if (min !== $scope.defaults.min) {
                params.min = min;
            }

            // setting subtrahend
            sub = $scope.difference.subtrahend;

            if (sub !== $scope.defaults.sub) {
                params.sub = sub;
            }

            // set scale
            l = ($scope.scaleType === "linear") + "";

            if (l !== $scope.defaults.l) {
                params.l = l;
            }

            // if show the time block
            t = $scope.showDate + '';

            if (t !== $scope.defaults.t) {
                params.t = t;
            }

            // set priority filter
            x = Data.getPriorityFilter().join(',');

            if (x !== $scope.defaults.x) {
                params.x = x;
            }

            // set pwg filter
            if (!Data.allPWGsEnabled()) {
                params.w = $scope.getCSVPerFilter(Data.getPWGFilter());
            }

            // set status filter
            if (!Data.allStatusesEnabled()) {
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
                    .subtrahend + '</text></svg>').replace(/\n/g, ' ');
            $http({
                url: 'ts',
                method: "POST",
                data: {data: xml, ext: format}
            }).then(function (data) {
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
        $scope.changeScale = function (type) {
            $scope.scaleType = type;
            $scope.setURL();
        };

        // Broadcast receiver, change filtered data on loaded data change
        $scope.$on('onChangeNotification:FilteredData', function () {
            $rootScope.loadingData = false;
            $scope.setURL();
            $scope.data = Data.getFilteredData();

            $scope.applyDifference({
                minuend: $scope.difference.minuend,
                subtrahend: $scope.first_status,
            });
        });

        // Set interval update of time variables
        var intervalUpdate1 = $interval($scope.updateCurrentDate, 1000);
        var intervalUpdate2 = $interval(function () {
            $scope.updateLastUpdate('requests');
        }, 2 * 60 * 1000);
        $scope.updateLastUpdate('requests');
        $scope.$on('$destroy', function () {
            $interval.cancel(intervalUpdate1);
            $interval.cancel(intervalUpdate2);
        });
    }
]);
