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
                                                              '$timeout',
                                                              'PageDetailsProvider',
                                                              'Data',
    function ($http, $interval, $location, $rootScope, $scope, $timeout, PageDetailsProvider, Data) {
        'use strict';

        /**
         * @description Holds information about parameter defaults
         */
        $scope.defaults = {
            r: '', // search term
            bins: 20, // histogram bins
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
            $scope.selectedBin = [];
            // reset data and filters
            Data.reset(true);

            // collect URL parameters together
            var urlParameters = $scope.fillDefaults($location.search(), $scope.defaults)
            console.log(urlParameters);
            // define graph difference
            $scope.minuend = urlParameters.minuend;
            $scope.subtrahend = urlParameters.subtrahend;
            $scope.availableStatuses = [];

            // if linear scale
            $scope.scale = urlParameters.scale;

            // set number of bins
            $scope.bins = parseInt(urlParameters.bins, 10);

            // initialise filters
            if (urlParameters.priority !== undefined) {
                Data.setPriorityFilter(urlParameters.priority.split(','));
            }

            if (urlParameters.status !== undefined) {
                var s = {}
                var tmp = urlParameters.status.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    s[tmp] = true;
                }
                Data.setStatusFilter(s);
            }

            if (urlParameters.pwg !== undefined) {
                var w = {}
                var tmp = urlParameters.pwg.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    w[tmp] = true;
                }
                Data.setPWGFilter(w);
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
                $scope.query(true);
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
                queryUrl += '&priority=' + priorityQuery;
            }
            if (statusQuery) {
                queryUrl += '&status=' + statusQuery;
            }
            if (pwgQuery) {
                queryUrl += '&pwg=' + pwgQuery;
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
                $scope.availableStatuses = data.data.results.all_statuses_in_history.slice()
                console.log($scope.availableStatuses)
                if ($scope.availableStatuses.length == 0) {
                    $scope.subtrahend = undefined
                    $scope.minuend = undefined
                } else {
                    if ($scope.availableStatuses.indexOf($scope.subtrahend) == -1) {
                        $scope.subtrahend = $scope.availableStatuses[0];
                    }
                    if ($scope.availableStatuses.indexOf($scope.minuend) == -1) {
                        $scope.minuend = $scope.availableStatuses[$scope.availableStatuses.length - 1];
                    }
                }
                $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
                $scope.setURL();
            }, function () {
                $scope.showPopUp(PageDetailsProvider.messages
                    .E1.type, PageDetailsProvider.messages
                    .E1.message);
                $rootScope.loadingData = false;
            });
        };

        $scope.binSelected = function(selectedBin) {
            $scope.selectedBin = selectedBin.slice();
            $timeout(function(){
                $scope.$apply();
            });
        }

        $scope.minuendChange = function(minuend) {
            $scope.minuend = minuend;
            console.log('minuend ' + minuend)
            $scope.setURL();
            $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
            $scope.binSelected([])
        }

        $scope.subtrahendChange = function(subtrahend) {
            $scope.subtrahend = subtrahend;
            console.log('subtrahend ' + subtrahend)
            $scope.setURL();
            $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
            $scope.binSelected([])
        }

        $scope.filterByMinuendSubtrahend = function(data, min, max) {
            if (min === undefined || max === undefined || $scope.availableStatuses.indexOf(min) >= $scope.availableStatuses.indexOf(max)) {
                return []
            }
            var newData = []
            for (var i = 0; i < data.length; i++) {
                if (data[i].history !== undefined && data[i].history[min] !== undefined && data[i].history[max] !== undefined) {
                    data[i].diff = data[i].history[max] - data[i].history[min]
                    data[i].min = data[i].history[min]
                    data[i].max = data[i].history[max]
                    newData.push(data[i])
                }
            }
            return newData
        }
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
    }
]);
