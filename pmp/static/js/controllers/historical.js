/**
 * @name historical.controller
 * @type controller
 * @description Historical Graph Controller
 */
angular.module('pmpApp').controller('HistoricalController', ['$http',
    '$location', '$scope', '$interval', 'PageDetailsProvider', 'Data',
    function ($http, $location, $scope, $interval, PageDetailsProvider,
        Data) {
        'use strict';

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.historical;

            // reset data and filters
            Data.reset(true);

            // if show time label
            $scope.showDate = ($location.search().t == 'true');

            // if zoom on y label
            $scope.zoomOnY = ($location.search().y === 'true');

            // set default probing
            if ($location.search().p !== '' && !isNaN($location.search()
                    .p)) {
                $scope.probing = parseInt($location.search().p, 10);
            } else {
                $scope.probing = 100;
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
                var tmp = $location.search().r.split(',');
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
                $scope.loadingData = true;
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

            $scope.loadingData = true;

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
                } else if(!init && s.split(',').length ===
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
                } else if(!init && w.split(',').length ===
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
                            $scope.showPopUp('warning', data.data
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
                    .E0.type, PageDetailsProvider.messages
                    .E1.message);
                $scope.loadingData = false;
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
                    .E0.type, PageDetailsProvider.messages
                    .E1.message);
            });
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
            $scope.loading = true;
            if (format === undefined) format = 'svg';
            var xml = (new XMLSerializer()).serializeToString(
                document.getElementById("ctn").getElementsByTagName(
                    "svg")[0]).replace(/#/g, 'U+0023');
            $http.get('ts/' + format + '/' + xml).then(function (
                data) {
                window.open(data.data);
                $scope.loading = false;
            });
        };

        // Broadcast receiver, change filtered data on loaded data change
        $scope.$on('onChangeNotification:FilteredData', function () {
            $scope.loadingData = false;
            $scope.setURL();
            $scope.data = Data.getFilteredData();
        });

        // Set interval update of time variables
        $interval($scope.updateCurrentDate, 1000);
        $interval(function () {
            $scope.updateLastUpdate('stats');
        }, 2 * 60 * 1000);
        $scope.updateLastUpdate('stats');
    }
]);