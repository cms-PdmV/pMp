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
            zoomY: 'false', // zoom on Y axis
            granularity: 100, // granularity value
            humanReadable: 'true', // human-readable numbers
            priority: undefined, // priority filter
            status: undefined, // status filter
            pwg: undefined, // PWG filter
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
            var urlParameters = $scope.fillDefaults($location.search(), $scope.defaults)

            // if zoom on y label
            $scope.zoomY = urlParameters.zoomY === 'true';

            // granularity
            $scope.granularity = parseInt(urlParameters.granularity, 10);

            $scope.humanReadable = urlParameters.humanReadable === 'true';

            // initialise filters
            if (urlParameters.priority !== undefined) {
                Data.setPriorityFilter(urlParameters.priority.split(','));
            }

            if (urlParameters.status !== undefined) {
                Data.setStatusFilter(urlParameters.status.split(','));
            }

            if (urlParameters.pwg !== undefined) {
                Data.setPWGFilter(urlParameters.pwg.split(','));
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
            var priorityQuery = Data.getPriorityQuery();
            var statusQuery = Data.getStatusQuery();
            var pwgQuery = Data.getPWGQuery();
            var granularity = $scope.granularity;
            var queryUrl = 'api/historical?r=' + inputTags.join(',');
            if (granularity) {
                queryUrl += '&granularity=' + granularity;
            }
            if (priorityQuery) {
                queryUrl += '&priority=' + x.join(',');
            }
            if (statusQuery) {
                queryUrl += '&status=' + s.join(',');
            }
            if (pwgQuery) {
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
            var params = $scope.constructURLQuery($scope, Data)
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
