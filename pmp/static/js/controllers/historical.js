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
            $scope.page = PageDetailsProvider.historical;
            Data.reset(true);
            if ($location.search().y !== undefined && $location.search()
                .y !== '') {
                $scope.zoomOnY = ($location.search().y == 'true');
            } else {
                $scope.zoomOnY = false;
            }

            if ($location.search().p !== undefined && $location.search()
                .p !== '') {
                $scope.probing = parseInt($location.search().p, 10);
            } else {
                $scope.probing = 40;
            }

            if ($location.search().t !== undefined && $location.search()
                .t !== '') {
                $scope.showDate = ($location.search().t == 'true');
            } else {
                $scope.showDate = false;
            }

            if ($location.search().x !== undefined && $location.search()
                .x !== '') Data.setPriorityFilter($location.search()
                .x.split(','));
            if ($location.search().s !== undefined && $location.search()
                .s !== '') Data.initializeFilter($location.search()
                .s.split(','), true);
            if ($location.search().w !== undefined && $location.search()
                .w !== '') Data.initializeFilter($location.search()
                .w.split(','), false);

            if ($location.search().r !== undefined && $location.search()
                .r !== '') {
                var tmp = $location.search().r.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    Data.setInputTags(tmp[i], true, false);
                }
                $scope.query(true);
            }
            $scope.$broadcast('updateURL');
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
                    Data.reset(false);
                }
                Data.setInputTags(request, true, false);
                var filter = add;
                if (filter) {
                    filter = false;
                    for (var i = 0; i < Object.keys(Data.getStatusFilter())
                        .length; i++) {
                        if (!Data.getStatusFilter()[Object.keys(
                                Data.getStatusFilter())[i]]) {
                            filter = true;
                            break;
                        }
                    }
                    if (!filter) {
                        for (i = 0; i < Object.keys(Data.getPWGFilter())
                            .length; i++) {
                            if (!Data.getPWGFilter()[Object.keys(
                                    Data.getPWGFilter())[i]]) {
                                filter = true;
                                break;
                            }
                        }
                    }
                }
                $scope.query(filter);
            }
        };

        /**
         * @description Core: Parse filters to query API
         * @param {Boolean} filter If filter data is present.
         */
        $scope.query = function (filter) {
            if (!Data.getInputTags().length) {
                Data.setFilteredData([], false);
                Data.setStatusFilter({});
                Data.setPWGFilter({});
                $scope.$broadcast('onChangeNotification:LoadedData');
                return null;
            }

            $scope.loadingData = true;

            // Add priority filter
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

            // Add status filter
            var s = '';
            if (filter && Object.keys(Data.getStatusFilter()).length) {
                for (var i = 0; i < Object.keys(Data.getStatusFilter())
                    .length; i++) {
                    if (Data.getStatusFilter()[Object.keys(Data.getStatusFilter())[
                            i]]) {
                        s += Object.keys(Data.getStatusFilter())[i] +
                            ',';
                    }
                }
                if (s.length > 1) {
                    s = s.substr(0, s.length - 1);
                } else {
                    s = '_';
                }
            } else {
                s = 'all';
            }

            // Add pwg filter
            var w = '';
            if (filter && Object.keys(Data.getPWGFilter()).length) {
                for (var j = 0; j < Object.keys(Data.getPWGFilter())
                    .length; j++) {
                    if (Data.getPWGFilter()[Object.keys(Data.getPWGFilter())[
                            j]]) {
                        w += Object.keys(Data.getPWGFilter())[j] +
                            ',';
                    }
                }
                if (w.length > 1) {
                    w = w.substr(0, w.length - 1);
                } else {
                    w = '_';
                }
            } else {
                w = 'all';
            }

            var p = 40;
            if ($scope.probing !== '') {
                p = $scope.probing;
            }

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
                        data.data.results.error !== '' ?
                            $scope.showPopUp('error', data.data
                                .results.error) : $scope.showPopUp(
                                'warning',
                                'All data is filtered');
                    }
                    Data.setFilteredData(data.data.results.data,
                        false);
                    Data.setStatusFilter(data.data.results.status);
                    Data.setPWGFilter(data.data.results.pwg);
                    $scope.loadTaskChain = data.data.results
                        .taskchain;
                    $scope.$broadcast(
                        'onChangeNotification:LoadedData'
                    );
                }
                $scope.loadingData = false;
                $scope.setURL();
                $scope.$broadcast('updateFilterTag', {
                    update: false
                });
            }, function () {
                $scope.showPopUp('error',
                    'Error getting requests');
                $scope.loadingData = false;
            });

            $http.get("api/" + Data.getInputTags().join(',') +
                '/submitted/' + x + '/' + w).then(function (
                data) {
                if (data.data.results) {
                    $scope.listSubmitted = data.data.results;
                } else {
                    $scope.listSubmitted = {};
                }
            }, function () {
                $scope.showPopUp('error',
                    'Error getting requests');
            });
        };

        /**
         * @description Core: Change URL when data or filter changes
         */
        $scope.setURL = function () {
            $location.path($location.path(), false);
            var params = {};
            params.p = $scope.probing;
            var r = Data.getInputTags();
            if (r.length) params.r = r.join(',');
            params.t = $scope.showDate + "";
            params.x = Data.getPriorityFilter().join(',');

            var w = [];
            for (var i in Data.getPWGFilter()) {
                if (Data.getPWGFilter()[i]) {
                    w.push(i);
                }
            }
            params.w = w.join(',');

            var s = [];
            for (var j in Data.getStatusFilter()) {
                if (Data.getStatusFilter()[j]) {
                    s.push(j);
                }
            }
            params.s = s.join(',');

            $scope.zoomOnY !== undefined ? params.y = $scope.zoomOnY +
                '' : params.y = 'false';
            $location.search(params);
            $scope.url = $location.absUrl();
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

        /**
         * @description Used when data is to be reloaded
         */
        $scope.updateRequestData = function () {
            $scope.query(true);
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