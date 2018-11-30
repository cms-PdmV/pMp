/**
 * @name historical.controller
 * @type controller
 * @description Historical Graph Controller
 */
angular.module('pmpApp').controller('HistoricalController', ['$http',
                                                             '$location',
                                                             '$rootScope',
                                                             '$scope',
                                                             '$interval',
                                                             'PageDetailsProvider',
                                                             'Data',
    function ($http, $location, $rootScope, $scope, $interval, PageDetailsProvider, Data) {
        'use strict';

        /**
         * @description Holds information about parameter defaults
         */
        $scope.defaults = {
            r: '', // search term
            t: 'false', // last update date
            y: 'false', // zoom on Y axis
            p: 100, // probing value
            h: 'true', // human-readable numbers
            x: undefined, // priority filter
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

            ['r', 't', 'y', 'p', 'h', 'x', 's', 'w'].forEach(function (param, index, array) {
                var urlValue = $location.search()[param];

                // if the default is a number, expect a numerical parameter
                if (urlValue === undefined || (angular.isNumber($scope.defaults[param]) && !angular.isNumber(urlValue))) {
                    urlParameters[param] = $scope.defaults[param];
                }
                else {
                    urlParameters[param] = urlValue;
                }
            });

            // if show time label
            $scope.showDate = urlParameters.t === 'true';

            // if zoom on y label
            $scope.zoomOnY = urlParameters.y === 'true';

            // probing
            $scope.probing = parseInt(urlParameters.p, 10);

            $scope.humanReadableNumbers = urlParameters.h === 'true';

            // initialise filters
            if (urlParameters.x !== undefined) {
                Data.setPriorityFilter(urlParameters.x.split(','));
            }

            if (urlParameters.s !== undefined) {
                Data.setStatusFilter(urlParameters.s.split(','));
            }

            if (urlParameters.w !== undefined) {
                Data.setPWGFilter(urlParameters.w.split(','));
            }

            // load graph data
            if (urlParameters.r !== '') {
                var tmp = urlParameters.r.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    Data.addInputTag(tmp[i]);
                }
                $scope.query();
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
        $scope.load = function (request, add, more, defaultPWG, defaultStatus) {
            console.log('request ' + request + ' | add ' + add + ' | more ' + more + ' | defaultPWG ' + defaultPWG + ' | defaultStatus ' + defaultStatus)
            if (!request) {
                $scope.showPopUp('warning', 'Empty search field');
                return;
            }
            if (request.constructor == Object) {
                request = request.label;
            }
            if (add && Data.getInputTags().indexOf(request) !== -1) {
                $scope.showPopUp('warning', 'Object is already loaded');
            } else {
                $rootScope.loadingData = true;
                if (!add) {
                    // Reset data and filters
                    Data.reset(true);
                }
                Data.addInputTag(request);
                $scope.query(filter);
            }
        };

        /**
         * @description Core: Parse filters to query API
         * @param {Boolean} filter If filter data is present.
         */
        $scope.query = function () {
            var inputTags = Data.getInputTags();
            if (inputTags.length === 0) {
                Data.setLoadedData([]);
                Data.setStatusFilter({});
                Data.setPWGFilter({});
                $scope.$broadcast('onChangeNotification:LoadedData', {
                    update: false
                });
                return null;
            }

            $rootScope.loadingData = true;

            // add priority filter
            var x = [];
            var dataPriorityFilter = Data.getPriorityFilter();
            if (dataPriorityFilter !== undefined && dataPriorityFilter.length == 2) {
                if (dataPriorityFilter[0] !== undefined) {
                    x.push(dataPriorityFilter[0]);
                }
                if (dataPriorityFilter[1] !== undefined) {
                    x.push(dataPriorityFilter[1]);
                }
            }
            // add status filter
            var s = [];
            if (!Data.allStatusesEnabled()) {
                var dataStatusFilter = Data.getStatusFilter();
                for (var status in dataStatusFilter) {
                    if (dataStatusFilter[status]) {
                        s.push(status);
                    }
                }
            }

            // add pwg filter
            var w = [];
            if (!Data.allPWGsEnabled()) {
                var dataPWGFilter = Data.getPWGFilter();
                for (var pwg in dataPWGFilter) {
                    if (dataPWGFilter[pwg]) {
                        w.push(pwg)
                    }
                }
            }

            var p = $scope.probing;

            var queryUrl = 'api/historical?r=' + inputTags.join(',') + '&granularity=' + p;
            if (x.length > 0) {
                queryUrl += '&priority=' + x.join(',');
            }
            if (s.length > 0) {
                queryUrl += '&status=' + s.join(',');
            }
            if (w.length > 0) {
                queryUrl += '&pwg=' + w.join(',');
            }
            // query for linear chart data
            console.log('Query ' + queryUrl);
            var promise = $http.get(queryUrl);
            promise.then(function (data) {
                Data.setLoadedData(data.data.results.data, false);
                Data.setStatusFilter(data.data.results.status);
                Data.setPWGFilter(data.data.results.pwg);
                $scope.loadTaskChain = false;
                $scope.listSubmitted = data.data.results.submitted_requests;
                $scope.listDone = data.data.results.done_requests
                $scope.$broadcast('onChangeNotification:LoadedData', {
                    update: false
                });
                $rootScope.loadingData = false;
                $scope.data = Data.getLoadedData();
                $scope.setURL();
            }, function () {
                $scope.showPopUp(PageDetailsProvider.messages
                    .E1.type, PageDetailsProvider.messages
                    .E1.message);
                $rootScope.loadingData = false;
            });
        };

        /**
         * @description Core: Change URL when data or filter changes
         */
        $scope.setURL = function () {
            $location.path($location.path(), false);
            var params = {}, r, p, t, y, h, x, w, s;

            // collect user inputs
            r = Data.getInputTags();
            if (r.length) {
                params.r = r.join(',');
            }

            // set probing
            p = $scope.probing;
            if (p !== $scope.defaults.p) {
                params.p = p;
            }

            // show time label
            t = $scope.showDate + "";
            if (t !== $scope.defaults.t) {
                params.t = t;
            }

            // set zoom
            y = $scope.zoomOnY + "";
            if (y !== $scope.defaults.y) {
                params.y = y;
            }

            // show human-readable numbers
            h = $scope.humanReadableNumbers + '';
            if (h !== $scope.defaults.h) {
                params.h = h;
            }

            // set priority filter
            x = Data.getPriorityFilter();
            if (x !== $scope.defaults.x) {
                params.x = x.join(',');
            }

            // set pwg filter
            if (!Data.allPWGsEnabled()) {
                params.w = Data.getPWGFilter().join(',');
            }

            // set status filter
            if (!Data.allStatusesEnabled()) {
                params.s = Data.getStatusFilter().join(',');
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
            // lets get the labels text
            var __time_line = '<tspan x="1" y="15">' +
                    document.getElementById("historical-drilldown").getElementsByTagName("div")[0].textContent +
                '</tspan>';

            var __expected_evts = '<tspan style="fill: #263238;">' +
                    document.getElementById("historical-drilldown").getElementsByTagName("div")[1].textContent +
                '</tspan>';

            var __evts_in_DAS = '<tspan style="fill: #ff6f00;">' +
                    document.getElementById("historical-drilldown").getElementsByTagName("div")[2].textContent +
                '</tspan>';

            var __done_evts_in_DAS = '<tspan style="fill: #01579b;">' +
                    document.getElementById("historical-drilldown").getElementsByTagName("div")[3].textContent +
                '</tspan>';

            if (format === undefined) format = 'svg';
            var obj = (new XMLSerializer()).serializeToString(document.
                getElementById("ctn").getElementsByTagName("svg")[0].getElementsByTagName("g")[0])
            obj += '<text transform="translate(1, 500)">Generated: ' + $scope.dt +
                    '. For input: ' + Data.getInputTags().join(', ') + '</text>';

            // viewBox is needed for rsvg convert
            var xml = '<svg viewBox="0 -20 1160 600" font-family="sans-serif" xmlns="http://www.w3.org/2000/svg">' +
                '<text>'+
                __time_line + __expected_evts +__evts_in_DAS + __done_evts_in_DAS+
                '</text>'+
                (obj
                .replace('<g xmlns="http://www.w3.org/2000/svg" transform="translate(50,40)" style="fill: none">',
                    '<g transform="translate(60,50)" style="fill: none">') + '</svg>');

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
    }
]);
