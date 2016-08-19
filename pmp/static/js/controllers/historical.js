/**
 * @name historical.controller
 * @type controller
 * @description Historical Graph Controller
 */
angular.module('pmpApp').controller('HistoricalController', ['$http',
    '$location', '$rootScope', '$scope', '$interval', 'PageDetailsProvider', 'Data',
    function ($http, $location, $rootScope, $scope, $interval, PageDetailsProvider,
        Data) {
        'use strict';

        /**
         * @description Holds information about parameter defaults
         */
        $scope.defaults = {
            r: '', // search term
            t: 'false', // last update date
            y: 'false', // zoom on Y axis
            p: 100, // probing value
            x: ',', // priority filter
            s: undefined, // status filter
            w: undefined, // PWG filter
        };

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.historical;

            // reset data and filters
            Data.reset(true);

            // collect URL parameters together
            // TODO: investigate extracting this functionality to common scope
            var urlParameters = {};

            ['r', 't', 'y', 'p', 'x', 's', 'w'].forEach(function (param, index, array) {
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

            // if show time label
            $scope.showDate = (urlParameters.t == 'true');

            // if zoom on y label
            $scope.zoomOnY = (urlParameters.y === 'true');

            // probing
            $scope.probing = parseInt(urlParameters.p, 10);

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
                var tmp = urlParameters.r.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    Data.setInputTags(tmp[i], true, false);
                }
                $scope.query(true, true);
            }
            // if this is empty just change URL as some filters
            // could have been initiated
            $scope.setURL();
        };

        /**
         * @description Core: Query API
         * @param {String} request User input.
         * @param {Boolean} add Append results if true
         * @param {Boolean} more Are there more requests in a queue
         * @param {Boolean} defaultPWG When new PWG shows up what should be default filter value
         * @param {Boolean} defaultStatus When new status shows up what should be default filter value
         */
        $scope.load = function (request, add, more, defaultPWG,
            defaultStatus) {
            if (!request) {
                $scope.showPopUp(PageDetailsProvider.messages.W0.type,
                    PageDetailsProvider.messages.W0.message);
            } else if (add && Data.getInputTags().indexOf(request) !==
                -1) {
                $scope.showPopUp(PageDetailsProvider.messages.W1.type,
                    PageDetailsProvider.messages.W1.message);
            } else {
                $rootScope.loadingData = true;
                if (!add) {
                    // reset data but not filters
                    Data.reset(false);
                }
                Data.setInputTags(request, true, false);
                // if not appending, reset filters
                var filter = add;
                if (filter) {
                    filter = false;
                    // it's faster to query with no filter on, check if necessary
                    if ($scope.getCSVPerFilter(Data.getStatusFilter()) !==
                        '') filter = true;
                    if (!filter && $scope.getCSVPerFilter(Data.getStatusFilter()) !==
                        '') filter = true;
                }
                $scope.query(filter);
            }
        };

        /**
         * @description Core: Parse filters to query API
         * @param {Boolean} filter If filter data is present.
         */
        $scope.query = function (filter, init) {
            if (!Data.getInputTags().length) {
                Data.setFilteredData([], false);
                Data.setStatusFilter({});
                Data.setPWGFilter({});
                $scope.$broadcast('onChangeNotification:LoadedData', {
                    update: false
                });
                return null;
            }

            $rootScope.loadingData = true;

            // add priority filter
            var x = '';
            if (filter && Data.getPriorityFilter() !== undefined) {
                if (Data.getPriorityFilter()[0] !== undefined) {
                    x += Data.getPriorityFilter()[0];
                }
                x += ',';
                if (Data.getPriorityFilter()[1] !== undefined) {
                    x += Data.getPriorityFilter()[1];
                }
            } else {
                x = ',';
            }
            // add status filter
            var s = '';
            if (filter && Object.keys(Data.getStatusFilter()).length) {
                s = $scope.getCSVPerFilter(Data.getStatusFilter());
                if (s.length === 0) {
                    s = '_';
                } else if (!init && s.split(',').length ===
                    Object.keys(Data.getStatusFilter()).length) {
                    s = 'all';
                }
            } else {
                s = 'all';
            }

            // add pwg filter
            var w = '';
            if (filter && Object.keys(Data.getPWGFilter()).length) {
                w = $scope.getCSVPerFilter(Data.getPWGFilter());
                if (w.length === 0) {
                    w = '_';
                } else if (!init && w.split(',').length ===
                    Object.keys(Data.getPWGFilter()).length) {
                    w = 'all';
                }
            } else {
                w = 'all';
            }

            // add probing
            var p = 100;
            if ($scope.probing !== '') {
                p = $scope.probing;
            }

            // query for linear chart data
            var promise = $http.get("api/" + Data.getInputTags().join(
                    ',') + '/historical/' + p + '/' + x + '/' +
                s + '/' + w);
            promise.then(function (data) {
                if (!data.data.results.status) {
                    $scope.showPopUp(PageDetailsProvider.messages
                        .W2.type, PageDetailsProvider.messages
                        .W2.message);
                } else {
                    if (!data.data.results.data.length) {
                        if (data.data.results.error !== '') {
                            $scope.showPopUp('warning',
                                data.data
                                .results.error);
                        } else {
                            $scope.showPopUp(
                                PageDetailsProvider.messages
                                .W3.type,
                                PageDetailsProvider.messages
                                .W3.message);
                        }
                    }
                    Data.setFilteredData(data.data.results.data,
                        false);
                    Data.setStatusFilter(data.data.results.status);
                    Data.setPWGFilter(data.data.results.pwg);
                    $scope.loadTaskChain = data.data.results
                        .taskchain;
                }
                $scope.$broadcast(
                    'onChangeNotification:LoadedData', {
                        update: false
                    });
                $scope.setURL();
            }, function () {
                $scope.showPopUp(PageDetailsProvider.messages
                    .E1.type, PageDetailsProvider.messages
                    .E1.message);
                $rootScope.loadingData = false;
            });

            // query for submitted
            $http.get("api/" + Data.getInputTags().join(',') +
                '/submitted/' + x + '/' + w).then(function (
                data) {
                if (data.data.results) {
                    $scope.listSubmitted = data.data.results;
                } else {
                    $scope.listSubmitted = {};
                }
            }, function () {
                $scope.showPopUp(PageDetailsProvider.messages
                    .E1.type, PageDetailsProvider.messages
                    .E1.message);
            });
        };

        /**
         * @decription Get a percentage value for the submitted request progress
         */
        $scope.getSubmittedProgressWidth = function (value) {
            if (value == 'NO_EXP_EVTS' || value > 100) {
                return 100;
            } else {
                return value;
            }
        }

        /**
         * Get a label for a submitted request progress bar
         */
        $scope.getSubmittedProgressLabel = function (value) {
            if (value == 'NO_EXP_EVTS') {
                return 'No expected events for this request';
            } else {
                return $scope.getSubmittedProgressWidth(value) + '%';
            }
        }

        /**
         * Get the class for a submitted request's progress bar
         */
        $scope.getSubmittedProgressClass = function (value) {
            if (value == 'NO_EXP_EVTS') {
                return 'progress-bar progress-bar-warning';
            } else {
                return 'progress-bar';
            }
        }

        /**
         * @description Core: Change URL when data or filter changes
         */
        $scope.setURL = function () {
            $location.path($location.path(), false);
            var params = {};

            // collect user inputs
            var r = Data.getInputTags();
            if (r.length) params.r = r.join(',');

            // set probing
            params.p = $scope.probing;

            // show time label
            params.t = $scope.showDate + "";

            // set zoom
            params.y = $scope.zoomOnY + "";

            // set priority filter
            params.x = Data.getPriorityFilter().join(',');

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
            $rootScope.loading = true;
            if (format === undefined) format = 'svg';
            var xml = (new XMLSerializer()).serializeToString(
                    document.getElementById("ctn").getElementsByTagName(
                        "svg")[0])
                .replace('viewBox="0 -20 1160 500"',
                    'viewBox="0 -20 1160 600" font-family="sans-serif"'
                ).replace('</svg>',
                    '<text transform="translate(0, 500)">Generated: ' +
                    $scope.dt + '. For input: ' + Data.getInputTags()
                    .join(', ') + '</text></svg>');
            $http({
                url: 'ts',
                method: "POST",
                data: {data: xml, ext: format}
            }).then(function (data) {
                window.open(data.data);
                $rootScope.loadingData = false;
            });
        };

        // Broadcast receiver, change filtered data on loaded data change
        $scope.$on('onChangeNotification:FilteredData', function () {
            $rootScope.loadingData = false;
            $scope.setURL();
            $scope.data = Data.getFilteredData();
        });

        // Set interval update of time variables
        var intervalUpdate1 = $interval($scope.updateCurrentDate, 1000);
        var intervalUpdate2 = $interval(function () {
            $scope.updateLastUpdate('stats');
        }, 2 * 60 * 1000);
        $scope.updateLastUpdate('stats');
        $scope.$on('$destroy', function () {
            $interval.cancel(intervalUpdate1);
            $interval.cancel(intervalUpdate2);
        });
    }
]);
