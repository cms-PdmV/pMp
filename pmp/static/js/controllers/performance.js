/**
 * @name performance.controller
 * @type controller
 * @description Performance Graph Controller
 */
angular.module('pmpApp').controller('PerformanceController', ['$http',
                                                              '$interval',
                                                              '$location',
                                                              '$rootScope',
                                                              '$scope',
                                                              'PageDetailsProvider',
                                                              'Data',
    function ($http, $interval, $location, $rootScope, $scope, PageDetailsProvider, Data) {
        'use strict';

        /**
         * @description Holds information about parameter defaults
         */
        $scope.defaults = {
            r: '', // search term
            bins: 10, // histogram bins
            subtrahend: 'created', // subtrahend
            minuend: 'done', // minuend
            scale: 'linear', // linear scale? false = log
            priority: undefined, // priority filter
            status: undefined, // status filter
            pwg: undefined, // PWG filter
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
            var urlParameters = $scope.fillDefaults($location.search(), $scope.defaults)
            console.log(urlParameters);
            // define graph difference
            $scope.difference = {
                minuend: 'done',
                subtrahend: 'created'
            };
            $scope.selections = ['validation', 'approved', 'submitted'];

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

            // if linear scale
            $scope.scale = urlParameters.scale;

            // set number of bins
            $scope.bins = parseInt(urlParameters.bins, 10);

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
            var queryUrl = 'api/performance?r=' + inputTags.join(',');
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
                $scope.$broadcast('onChangeNotification:LoadedData', {
                    update: false
                });
                $rootScope.loadingData = false;
                $scope.data = Data.getLoadedData(); 
                $scope.first_status = data.data.results.first_status;
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
            $scope.scale = type;
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
    }
]);
