/**
 * @name present.controller
 * @type controller
 * @description Present Graph Controller
 */
angular.module('pmpApp').controller('PresentController', ['$http',
                                                          '$location',
                                                          '$interval',
                                                          '$rootScope',
                                                          '$scope',
                                                          '$timeout',
                                                          'PageDetailsProvider',
                                                          'Data',
    function ($http, $location, $interval, $rootScope, $scope, $timeout, PageDetailsProvider,
        Data) {
        'use strict';

        /**
         * @description stores defaults for URL parameters
         */
        $scope.defaults = {
            r: '', // query value (from search box)
            growingMode: false, // growing mode (boolean)
            humanReadable: true, // show human-readable numbers (boolean)
            estimateCompleted: false,
            priority: undefined, // priority filter
            pwg: undefined, // PWG filter
            interested_pwg: undefined, // interested PWG filter
            status: undefined, // status filter
            scale: 'linear',
            mode: 'requests',
            groupBy: 'member_of_campaign',
            colorBy: 'status',
            stackBy: '',
            showUnchainedTable: false
        };

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.present;

            // reset data and filters
            $scope.loadingData = false;
            Data.reset(true);
            $scope.data = undefined;
            $scope.firstLoad = true;
            $scope.changeActiveIndex(1);
            // collect URL parameters and fill in defaults where necessary
            var urlParameters = $scope.fillDefaults($location.search(), $scope.defaults)

            // enable growing mode?
            $scope.growingMode = urlParameters.growingMode === 'true';

            // show human-readable numbers?
            $scope.humanReadable = urlParameters.humanReadable === 'true';

            $scope.estimateCompleted = urlParameters.estimateCompleted === 'true';

            $scope.showUnchainedTable = urlParameters.showUnchainedTable === 'true';

            $scope.availableScales = ['linear', 'log']

            $scope.availableModes = ['events', 'requests', 'seconds']

            urlParameters.scale = urlParameters.scale.toLowerCase().trim();
            urlParameters.mode = urlParameters.mode.toLowerCase().trim();

            if ($scope.availableScales.includes(urlParameters.scale)) {
                $scope.scale = urlParameters.scale;
            } else {
                $scope.scale = $scope.defaults.scale;
            }

            if ($scope.availableModes.includes(urlParameters.mode)) {
                $scope.mode = urlParameters.mode;
            } else {
                $scope.mode = $scope.defaults.mode;
            }

            $scope.sortSelectedOn = 'prepid';
            $scope.sortSelectedOrder = 1;

            $scope.availableSelections = {'member_of_campaign': 'Campaign',
                                          'total_events': 'Total Events',
                                          'prepid': 'Prepid',
                                          'status': 'Status',
                                          'priority': 'Priority',
                                          'priority_block': 'Priority Block',
                                          'is_member_of_chain': 'In chain',
                                          'pwg': 'PWG',
                                          'workflow_status': 'Workflow Status'}

            let availableSelectionsKeys = Object.keys($scope.availableSelections);
            $scope.groupBy = urlParameters.groupBy.split(',').filter(e => e.length > 0 && availableSelectionsKeys.includes(e))
            $scope.colorBy = urlParameters.colorBy.split(',').filter(e => e.length > 0 && availableSelectionsKeys.includes(e))
            $scope.stackBy = urlParameters.stackBy.split(',').filter(e => e.length > 0 && availableSelectionsKeys.includes(e))

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
            var interestedPWGQuery = Data.getInterestedPWGQuery($scope.firstLoad);
            $scope.firstLoad = false;
            var queryUrl = 'api/present?r=' + inputTags.slice().sort().join(',');
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
            if ($scope.estimateCompleted) {
                queryUrl += '&estimateCompleted=true';
            }

            // query for linear chart data
            var promise = $http.get(queryUrl);
            promise.then(function (data) {
                $scope.showPopUp('success', 'Downloaded data. Drawing plots...');
                setTimeout(function() {
                    data.data.results.data.forEach(function(entry) {
                        entry.url = $scope.getUrlForPrepid(entry.prepid, entry.workflow);
                        if (entry.priority >= 130000) {
                            entry.priority_block = 'Block 0';
                        } else if (entry.priority >= 110000) {
                            entry.priority_block = 'Block 1';
                        } else if (entry.priority >= 90000) {
                            entry.priority_block = 'Block 2';
                        } else if (entry.priority >= 85000) {
                            entry.priority_block = 'Block 3';
                        } else if (entry.priority >= 80000) {
                            entry.priority_block = 'Block 4';
                        } else if (entry.priority >= 70000) {
                            entry.priority_block = 'Block 5';
                        } else if (entry.priority >= 63000) {
                            entry.priority_block = 'Block 6';
                        } else {
                            entry.priority_block = 'Block 7';
                        }
                    });
                    Data.setLoadedData(data.data.results.data, false);
                    Data.setStatusFilter(data.data.results.status);
                    Data.setPWGFilter(data.data.results.pwg);
                    Data.setInterestedPWGFilter(data.data.results.interested_pwg);
                    Data.setValidTags(data.data.results.valid_tags);
                    $scope.data = Data.getLoadedData();
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


        /**
         * @description Core: Query server for a report of current view
         * @param {String} format which will be requested (pdf/png/svg)
         */
        $scope.takeScreenshot = function (format) {
            var date = new Date()
            var lastUpdateDate = new Date($scope.lastUpdate)

            if (format === undefined) {
                format = 'svg';
            }

            var viewBox = document.getElementById("plot-parent").getAttribute("viewBox").split(' ')
            var plot = (new XMLSerializer()).serializeToString(document.getElementById("plot"))
            plot += '<text transform="translate(10, ' + (parseInt(viewBox[3]) + 0) + ')">Generated: ' + (dateFormat(date, "dddd, mmmm dS, yyyy, HH:MM")) + '</text>'
            plot += '<text transform="translate(10, ' + (parseInt(viewBox[3]) + 20 ) + ')">Last update: ' + (dateFormat($scope.lastUpdateTimestamp * 1000, "dddd, mmmm dS, yyyy, HH:MM")) + '</text>'
            plot += '<text transform="translate(10, ' + (parseInt(viewBox[3]) + 40 ) + ')">For input: ' + Data.getInputTags().join(', ') + '</text>';
            // viewBox is needed for rsvg convert
            var xml = '<svg viewBox="' + viewBox[0] + ' ' + viewBox[1] + ' ' + viewBox[2] + ' ' + (parseInt(viewBox[3]) + 80) + '" font-family="sans-serif" xmlns="http://www.w3.org/2000/svg">' +
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

        $scope.modeChange = function(mode) {
            $scope.mode = mode;
            $scope.setURL($scope, Data);
            $scope.data = $scope.data.slice()
        }

        $scope.scaleChange = function(scale) {
            $scope.scale = scale;
            $scope.setURL($scope, Data);
            $scope.data = $scope.data.slice()
        }

        $scope.groupByChange = function(groupBy) {
            $scope.colorBy = $scope.colorBy.filter(e => e !== groupBy && e.length > 0);
            $scope.stackBy = $scope.stackBy.filter(e => e !== groupBy && e.length > 0);
            if ($scope.groupBy.includes(groupBy)) {
                $scope.groupBy = $scope.groupBy.filter(e => e !== groupBy && e.length > 0);
            } else {
                $scope.groupBy.push(groupBy);
            }
            $scope.groupBy = $scope.groupBy.slice()
            $scope.setURL($scope, Data);
            $scope.data = $scope.data.slice()
        }

        $scope.colorByChange = function(colorBy) {
            $scope.groupBy = $scope.groupBy.filter(e => e !== colorBy && e.length > 0);
            $scope.stackBy = $scope.stackBy.filter(e => e !== colorBy && e.length > 0);
            if ($scope.colorBy.includes(colorBy)) {
                $scope.colorBy = [];
            } else {
                $scope.colorBy = [colorBy];
            }
            $scope.colorBy = $scope.colorBy.slice()
            $scope.setURL($scope, Data);
            $scope.data = $scope.data.slice()
        }

        $scope.stackByChange = function(stackBy) {
            $scope.groupBy = $scope.groupBy.filter(e => e !== stackBy && e.length > 0);
            $scope.colorBy = $scope.colorBy.filter(e => e !== stackBy && e.length > 0);
            if ($scope.stackBy.includes(stackBy)) {
                $scope.stackBy = $scope.stackBy.filter(e => e !== stackBy && e.length > 0);
            } else {
                $scope.stackBy.push(stackBy);
            }
            $scope.stackBy = $scope.stackBy.slice()
            $scope.setURL($scope, Data);
            $scope.data = $scope.data.slice()
        }

        $scope.binSelected = function(selectedBin) {
            $scope.selectedBin = selectedBin.slice().sort($scope.compareSelected);
            $timeout(function(){
                $scope.$apply();
            });
        }

        $scope.changeGrowingMode = function() {
            $scope.setURL($scope, Data);
            if ($scope.data) {
                $scope.data = $scope.data.slice();
            }
        }

        $scope.changeHumanReadable = function() {
            $scope.setURL($scope, Data);
            if ($scope.data) {
                $scope.data = $scope.data.slice();
            }
        }

        $scope.changeEstimateCompleted = function() {
            $scope.query();
        }

        $scope.changeShowUnchainedTable = function(show) {
            $scope.setURL($scope, Data);
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
            $location.url('/present')
            $scope.init()
        })
    }
]);
