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
            toolName: 'mcm',
            priority: undefined, // priority filter
            status: undefined, // status filter
            pwg: undefined, // PWG filter
            interested_pwg: undefined, // Interested PWG filter
        };

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.performance;
            $scope.selectedBin = [];

            $scope.loadingData = false;
            Data.reset(true);
            $scope.data = undefined;
            $scope.firstLoad = true;
            $scope.changeActiveIndex(3);
            // collect URL parameters together
            var urlParameters = $scope.fillDefaults($location.search(), $scope.defaults)
            // define graph difference
            $scope.minuend = urlParameters.minuend;
            $scope.subtrahend = urlParameters.subtrahend;
            $scope.availableStatuses = [];
            $scope.availableScales = ['linear', 'log'];
            $scope.availableToolNames = ['mcm', 'reqmgr2'];
            // if linear scale
            $scope.scale = urlParameters.scale;
            $scope.toolName = urlParameters.toolName;

            // set number of bins
            $scope.bins = parseInt(urlParameters.bins, 10);

            $scope.sortSelectedOn = 'prepid';
            $scope.sortSelectedOrder = 1;

            // initialise filters
            if (urlParameters.priority !== undefined) {
                Data.setPriorityFilter(urlParameters.priority.split(','));
            }

            if (urlParameters.status !== undefined) {
                var s = {}
                var tmp = urlParameters.status.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    s[tmp[i]] = true;
                }
                Data.setStatusFilter(s);
            }

            if (urlParameters.pwg !== undefined) {
                var w = {}
                var tmp = urlParameters.pwg.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    w[tmp[i]] = true;
                }
                Data.setPWGFilter(w);
            }

            if (urlParameters.interested_pwg !== undefined) {
                var w = {}
                var tmp = urlParameters.interested_pwg.split(',');
                for (var i = 0; i < tmp.length; i++) {
                    w[tmp[i]] = true;
                }
                Data.setInterestedPWGFilter(w);
            }

             // load graph data
            if (urlParameters.r !== '') {
                Data.setInputTags(urlParameters.r.split(','));
            } else {
                Data.setInputTags([]);
            }
        };

        /**
         * @description Core: Query API
         * @param {String} request User input.
         * @param {Boolean} add Append results if true
         */
        $scope.load = function (request, add) {
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
                if (!add) {
                    // Reset data and filters
                    Data.reset(true);
                }
                Data.addInputTag(request);
            }
        };

        /**
         * @description Core: Parse filters to query API
         * @param {Boolean} filter If filter data is present.
         */
        $scope.query = function () {
            $scope.messages = [];
            var inputTags = Data.getInputTags();
            if (inputTags.length === 0) {
                Data.setLoadedData([]);
                Data.setStatusFilter({});
                Data.setPWGFilter({});
                Data.setInterestedPWGFilter({});
                $scope.data = Data.getLoadedData();
                $scope.setURL($scope, Data);
                $scope.$broadcast('onChangeNotification:LoadedData');
                $timeout(function(){
                    $scope.$apply();
                });
                return null;
            }
            $scope.loadingData = true;
            var priorityQuery = Data.getPriorityQuery();
            var statusQuery = Data.getStatusQuery($scope.firstLoad);
            var pwgQuery = Data.getPWGQuery($scope.firstLoad);
            var interestedPWGQuery = Data.getInterestedPWGQuery($scope.firstLoad);
            var toolName = $scope.toolName;
            $scope.firstLoad = false;
            var queryUrl = 'api/performance?r=' + inputTags.slice().sort().join(',');
            if (priorityQuery !== undefined) {
                queryUrl += '&priority=' + priorityQuery;
            }
            if (statusQuery !== undefined) {
                queryUrl += '&status=' + statusQuery;
            }
            if (pwgQuery !== undefined) {
                queryUrl += '&pwg=' + pwgQuery;
            }
            if (interestedPWGQuery !== undefined) {
                queryUrl += '&interested_pwg=' + interestedPWGQuery;
            }
            if (toolName !== undefined) {
                queryUrl += '&tool_name=' + toolName;
            }
            var promise = $http.get(queryUrl);
            promise.then(function (data) {
                $scope.showPopUp('success', 'Downloaded data. Drawing plot...');
                setTimeout(function() {
                    data.data.results.data.forEach(function(entry) {
                        entry.url = $scope.getUrlForPrepid(entry.prepid, entry.workflow);
                    });
                    data.data.results.data = data.data.results.data.filter(x => x.history && Object.keys(x.history).length);
                    Data.setLoadedData(data.data.results.data, false);
                    Data.setStatusFilter(data.data.results.status);
                    Data.setPWGFilter(data.data.results.pwg);
                    Data.setInterestedPWGFilter(data.data.results.interested_pwg);
                    Data.setValidTags(data.data.results.valid_tags);
                    $scope.allAvailableStatuses = data.data.results.all_statuses_in_history;
                    $scope.availableStatuses = $scope.allAvailableStatuses[$scope.toolName];
                    let statuses = $scope.availableStatuses;
                    if (statuses.length == 0) {
                        $scope.subtrahend = undefined
                        $scope.minuend = undefined
                    } else {
                        if (statuses.indexOf($scope.subtrahend) == -1) {
                            $scope.subtrahend = statuses[0];
                        }
                        if (statuses.indexOf($scope.minuend) == -1) {
                            $scope.minuend = statuses[statuses.length - 1];
                        }
                    }
                    $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
                    $scope.setURL($scope, Data);
                    $scope.$broadcast('onChangeNotification:LoadedData');
                    $scope.messages = data.data.results.messages;
                    $scope.loadingData = false;
                    if (data.data.results.invalid_tags.length > 0) {
                        $scope.showPopUp('warning', 'Nothing was found for ' + data.data.results.invalid_tags.join(', '));
                    }
                }, 100)
            }, function () {
                Data.setLoadedData([]);
                Data.setStatusFilter({});
                Data.setPWGFilter({});
                Data.setInterestedPWGFilter({});
                $scope.data = Data.getLoadedData();
                $scope.showPopUp('error', 'Error loading requests');
                $scope.loadingData = false;
            });
        };

        $scope.binSelected = function(selectedBin) {
            $scope.selectedBin = selectedBin.slice().sort($scope.compareSelected);
            $timeout(function(){
                $scope.$apply();
            });
        }

        $scope.minuendChange = function(minuend) {
            $scope.minuend = minuend;
            $scope.setURL($scope, Data);
            $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
            $scope.binSelected([])
        }

        $scope.subtrahendChange = function(subtrahend) {
            $scope.subtrahend = subtrahend;
            $scope.setURL($scope, Data);
            $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
            $scope.binSelected([])
        }

        $scope.scaleChange = function(scale) {
            $scope.scale = scale;
            $scope.setURL($scope, Data);
            $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
            $scope.binSelected([])
        }

        $scope.toolNameChange = function(toolName) {
            $scope.toolName = toolName;
            $scope.availableStatuses = $scope.allAvailableStatuses[toolName];
            $scope.subtrahend = $scope.availableStatuses[0];
            $scope.minuend = $scope.availableStatuses[$scope.availableStatuses.length - 1];
            $scope.setURL($scope, Data);
            $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
            $scope.binSelected([])
        }

        $scope.changeBins = function() {
            $scope.setURL($scope, Data);
            $scope.data = $scope.filterByMinuendSubtrahend(Data.getLoadedData(), $scope.subtrahend, $scope.minuend);
            $scope.binSelected([])
        }

        $scope.filterByMinuendSubtrahend = function(data, min, max) {
            let toolName = $scope.toolName;
            let statuses = $scope.availableStatuses;
            if (!min || !max || statuses.indexOf(min) > statuses.indexOf(max)) {
                return [undefined]
            }
            var newData = []
            let maxIsNow = statuses.indexOf(min) == statuses.indexOf(max);
            let now = Date.now() / 1000;
            for (let item of data) {
                let history = item.history[toolName];
                if (!Object.keys(history).length) {
                    continue
                }
                let historyMin = history[min];
                let historyMax = history[max];
                if (maxIsNow) {
                    let lastStatus = Object.keys(history).reduce((a, b) => history[a] > history[b] ? a : b);
                    if (lastStatus != min) {
                        continue
                    }
                    historyMax = now;
                }
                if (historyMin && historyMax) {
                    if (historyMax - historyMin < 0) {
                        continue
                    }
                    item.diff = historyMax - historyMin;
                    item.min = historyMin;
                    item.max = historyMax;
                    newData.push(item);
                }
            }
            if (newData.length == 0) {
                return [undefined];
            }
            return newData
        }

        $scope.compareSelected = function(a, b) {
            if (a[$scope.sortSelectedOn] < b[$scope.sortSelectedOn]) {
                return -$scope.sortSelectedOrder;
            } else if (a[$scope.sortSelectedOn] > b[$scope.sortSelectedOn]) {
                return $scope.sortSelectedOrder;
            } else {
                return 0;
            }
        }

        $scope.changeSelectedSort = function(column) {
            if (column == $scope.sortSelectedOn) {
                $scope.sortSelectedOrder *= -1;
            } else {
                $scope.sortSelectedOn = column;
                $scope.sortSelectedOrder = 1;
            }
            $scope.selectedBin = $scope.selectedBin.sort($scope.compareSelected);
            $timeout(function(){
                $scope.$apply();
            });
        }

        $scope.$on('onChangeNotification:InputTags', function () {
            $scope.query()
        })

        $scope.$on('onChangeNotification:ReInit', function () {
            $location.url('/performance')
            $scope.init()
        })

        $scope.takeScreenshot = function (format) {
            var date = new Date()

            if (format === undefined) {
                format = 'svg';
            }

            var plot = (new XMLSerializer()).serializeToString(document.getElementById("plot"))
            plot += '<text transform="translate(10, 620)">Generated: ' + (dateFormat(date, "dddd, mmmm dS, yyyy, HH:MM")) + '</text>'
            plot += '<text transform="translate(10, 640)">Last update: ' + (dateFormat($scope.lastUpdateTimestamp * 1000, "dddd, mmmm dS, yyyy, HH:MM")) + '</text>'
            plot += '<text transform="translate(10, 660)">For input: ' + Data.getInputTags().join(', ') + '</text>';

            // viewBox is needed for rsvg convert
            var xml = '<svg viewBox="0 -20 1160 700" font-family="sans-serif" xmlns="http://www.w3.org/2000/svg">' + 
                      plot +
                      '</svg>';
            $http({
                url: 'api/screenshot',
                method: "POST",
                data: {data: xml, ext: format}
            }).then(function (data) {
                window.open(data.data);
                $rootScope.loadingData = false;
            });
        };
    }
]);
