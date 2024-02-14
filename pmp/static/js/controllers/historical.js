/**
 * @name historical.controller
 * @type controller
 * @description Historical Graph Controller
 */
angular.module('pmpApp').controller('HistoricalController', ['$http',
                                                             '$location',
                                                             '$rootScope',
                                                             '$scope',
                                                             '$timeout',
                                                             '$interval',
                                                             'PageDetailsProvider',
                                                             'Data',
    function ($http, $location, $rootScope, $scope, $timeout, $interval, PageDetailsProvider, Data) {
        'use strict';

        /**
         * @description Holds information about parameter defaults
         */
        $scope.defaults = {
            r: '', // search term
            zoomY: false, // zoom on Y axis
            granularity: 250, // granularity value
            humanReadable: true, // human-readable numbers
            showDoneRequestsList: false,
            estimateCompleted: false,
            priority: undefined, // priority filter
            status: undefined, // status filter
            pwg: undefined, // PWG filter
            interested_pwg: undefined, // Interested PWG filter
            sortSubmittedOn: 'prepid', // Field to sort submitted list on
            sortSubmittedOrder: 1, // Sort ascending (1) or descending (-1)
            sortDoneOn: 'prepid', // Field to sort done list on
            sortDoneOrder: 1, // Sort ascending (1) or descending (-1)
        };

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.historical;

            // reset data and filters
            $scope.loadingData = false;
            Data.reset(true);
            $scope.data = undefined;
            $scope.firstLoad = true;
            $scope.changeActiveIndex(2);

            // collect URL parameters together
            var urlParameters = $scope.fillDefaults($location.search(), $scope.defaults)
            // if zoom on y label
            $scope.zoomY = urlParameters.zoomY === 'true';

            // granularity
            $scope.granularity = parseInt(urlParameters.granularity, 10);

            $scope.humanReadable = urlParameters.humanReadable === 'true';

            $scope.showDoneRequestsList = urlParameters.showDoneRequestsList === 'true';

            $scope.estimateCompleted = urlParameters.estimateCompleted === 'true';

            $scope.sortSubmittedOn = urlParameters.sortSubmittedOn;

            $scope.sortSubmittedOrder = parseInt(urlParameters.sortSubmittedOrder, 10) === -1 ? -1 : 1;

            $scope.sortDoneOn = urlParameters.sortDoneOn;

            $scope.sortDoneOrder = parseInt(urlParameters.sortDoneOrder, 10) === -1 ? -1 : 1;

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

        $scope.secondsToDiff = function (s) {
            var days = Math.floor(s / 86400)
            var hours = Math.floor((s - (days * 86400)) / 3600)
            var minutes = Math.round((s - (days * 86400 + hours * 3600)) / 60)
            if (days == 0 && hours == 0 && minutes == 0) {
                return parseInt(s) + 's'
            }
            var result = ''
            if (days > 0) {
                result += days + 'd '
            }
            if (hours > 0) {
                result += hours + 'h '
            }
            if (minutes > 0) {
                result += minutes + 'min'
            }
            return result
        }

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
            var granularity = $scope.granularity;
            $scope.firstLoad = false;
            var queryUrl = 'api/historical?r=' + inputTags.slice().sort().join(',');
            if (granularity) {
                queryUrl += '&granularity=' + granularity;
            }
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
                $scope.showPopUp('success', 'Downloaded data. Drawing plot...');
                setTimeout(function() {
                    Data.setLoadedData(data.data.results.data, false);
                    Data.setStatusFilter(data.data.results.status);
                    Data.setPWGFilter(data.data.results.pwg);
                    Data.setInterestedPWGFilter(data.data.results.interested_pwg);
                    Data.setValidTags(data.data.results.valid_tags);
                    $scope.loadTaskChain = false;
                    let now = parseInt(Date.now() / 1000);
                    let includeDisplayPercentage = function(entry) {
                        // Set lumis
                        // The following value exists and it is not zero
                        if (entry.expected_lumis) {
                            entry.displayDone = entry.done_lumis;
                            entry.displayExpected = entry.expected_lumis;
                            entry.display = 'Lumisections';
                        }
                        else {
                            // Use events
                            entry.displayDone = entry.done;
                            entry.displayExpected = entry.expected;
                            entry.display = 'Events';
                        }
                        
                        // Set the progress percentage
                        entry.displayPercentage = (entry.displayDone / Math.max(entry.displayExpected, 1)) * 100;
                    };
                    data.data.results.submitted_requests.forEach(function(entry) {
                        entry.url = $scope.getUrlForPrepid(entry.prepid, entry.workflow);
                        entry.statusTimestamp = now - entry.status_timestamp;
                        entry.statusTimestampDate = dateFormat(entry.status_timestamp, "yyyy-mm-dd HH:MM");
                        entry.statusTimestampDiff = $scope.secondsToDiff(now - entry.status_timestamp);
                        entry.workflowStatus = entry.workflow_status;
                        entry.workflowTimestamp = now - entry.workflow_status_timestamp;
                        entry.workflowTimestampDiff = $scope.secondsToDiff(entry.workflow_timestamp <= 0 ? 0 : entry.workflowTimestamp);
                        includeDisplayPercentage(entry);
                    });
                    $scope.listSubmitted = data.data.results.submitted_requests.sort($scope.compareSubmitted);
                    data.data.results.done_requests.forEach(function(entry) {
                        entry.url = $scope.getUrlForPrepid(entry.prepid, entry.workflow);
                        entry.statusTimestamp = now - entry.status_timestamp;
                        entry.statusTimestampDate = dateFormat(entry.status_timestamp, "yyyy-mm-dd HH:MM");
                        entry.statusTimestampDiff = $scope.secondsToDiff(now - entry.status_timestamp);
                        entry.workflowStatus = entry.workflow_status;
                        entry.workflowTimestamp = now - entry.workflow_status_timestamp;
                        entry.workflowTimestampDiff = $scope.secondsToDiff(entry.workflow_timestamp <= 0 ? 0 : entry.workflowTimestamp);
                        includeDisplayPercentage(entry);
                    });
                    $scope.listDone = data.data.results.done_requests.sort($scope.compareDone);
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

        $scope.changeGranularity = function() {
            $scope.query()
        }

        $scope.changeHumanReadable = function() {
            $scope.setURL($scope, Data);
            if ($scope.data) {
                $scope.data = $scope.data.slice();
            }
        }

        $scope.changeZoomY = function() {
            $scope.setURL($scope, Data);
        }

        $scope.changeShowDoneRequestsList = function() {
            $scope.setURL($scope, Data);
        }

        $scope.changeEstimateCompleted = function() {
            $scope.query();
        }

        $scope.compareSubmitted = function(a, b) {
            if (a[$scope.sortSubmittedOn] < b[$scope.sortSubmittedOn]) {
                return -$scope.sortSubmittedOrder;
            } else if (a[$scope.sortSubmittedOn] > b[$scope.sortSubmittedOn]) {
                return $scope.sortSubmittedOrder;
            } else {
                return 0;
            }
        }

        $scope.compareDone = function(a, b) {
            if (a[$scope.sortDoneOn] < b[$scope.sortDoneOn]) {
                return -$scope.sortDoneOrder;
            } else if (a[$scope.sortDoneOn] > b[$scope.sortDoneOn]) {
                return $scope.sortDoneOrder;
            } else {
                return 0;
            }
        }

        $scope.changeSubmittedSort = function(column) {
            if (column == $scope.sortSubmittedOn) {
                $scope.sortSubmittedOrder *= -1;
            } else {
                $scope.sortSubmittedOn = column;
                $scope.sortSubmittedOrder = 1;
            }
            $scope.listSubmitted = $scope.listSubmitted.sort($scope.compareSubmitted);
            $scope.setURL($scope, Data);
        }

        $scope.changeDoneSort = function(column) {
            if (column == $scope.sortDoneOn) {
                $scope.sortDoneOrder *= -1;
            } else {
                $scope.sortDoneOn = column;
                $scope.sortDoneOrder = 1;
            }
            $scope.listDone = $scope.listDone.sort($scope.compareDone);
            $scope.setURL($scope, Data);
        }

        $scope.$on('onChangeNotification:InputTags', function () {
            $scope.query()
        })

        $scope.$on('onChangeNotification:ReInit', function () {
            $location.url('/historical')
            $scope.init()
        })

        /**
         * @description Core: Query server for a report of current view
         * @param {String} format which will be requested (pdf/png/svg)
         */
        $scope.takeScreenshot = function (format) {
            $rootScope.loading = true;
            var dataLabel = document.getElementById("historical-drilldown").getElementsByTagName("div")
            // lets get the labels text
            var date = new Date()
            var dataLabelWidth = (1160 - 20)  / dataLabel.length;
            var time_line = '<text x="10" y="15">' + dataLabel[0].textContent + '</text>';
            var expected_evts = ''
            var evts_in_DAS = ''
            var done_evts_in_DAS = ''
            var invalid_evts = '';
                        
            if (dataLabel.length === 3) {
                evts_in_DAS = '<text x="' + (dataLabelWidth * 2 + 10) + '" y="15" style="fill: #ff6f00;">' + dataLabel[1].textContent + '</text>';
                done_evts_in_DAS = '<text x="' + (dataLabelWidth * 3 + 10) + '" y="15" style="fill: #01579b;">' + dataLabel[2].textContent + '</text>';    
            }
            if (dataLabel.length === 4) {
                expected_evts = '<text x="' + (dataLabelWidth + 10) + '" y="15" style="fill: #263238;">' + dataLabel[1].textContent + '</text>';
                evts_in_DAS = '<text x="' + (dataLabelWidth * 2 + 10) + '" y="15" style="fill: #ff6f00;">' + dataLabel[2].textContent + '</text>';
                done_evts_in_DAS = '<text x="' + (dataLabelWidth * 3 + 10) + '" y="15" style="fill: #01579b;">' + dataLabel[3].textContent + '</text>';    
            }
            if (dataLabel.length === 5) {
                invalid_evts = '<text x="' + (dataLabelWidth * 4 + 10) + '" y="15" style="fill: red;">' + dataLabel[4].textContent + '</text>';
            }

            if (format === undefined) {
                format = 'svg';
            }

            var plot = (new XMLSerializer()).serializeToString(document.getElementById("plot"))
            plot += '<text transform="translate(10, 520)">Generated: ' + (dateFormat(date, "dddd, mmmm dS, yyyy, HH:MM")) + '</text>'
            plot += '<text transform="translate(10, 540)">Last update: ' + (dateFormat($scope.lastUpdateTimestamp * 1000, "dddd, mmmm dS, yyyy, HH:MM")) + '</text>'
            plot += '<text transform="translate(10, 560)">For input: ' + Data.getInputTags().join(', ') + '</text>';

            // viewBox is needed for rsvg convert
            var xml = '<svg viewBox="0 -20 1160 600" font-family="sans-serif" xmlns="http://www.w3.org/2000/svg">' + 
                      time_line +
                      expected_evts +
                      evts_in_DAS +
                      done_evts_in_DAS +
                      invalid_evts +
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

        $scope.makeCSV = function(inputData) {
            let header = ['PrepID', 'Total Events', 'Done Events', 'Current status for', 'Current status since', 'Priority', 'Output dataset', 'Output dataset status', 'Link', 'Stats2'];
            header = header.map(e => '"' + e + '"');
            let lineMaker = function(line) {
                let l = [line['prepid'],
                         line['expected'],
                         line['done'],
                         line['statusTimestampNice'],
                         line['statusTimestampNiceDate'],
                         line['priority'],
                         line['output_dataset'],
                         line['output_dataset_status'],
                         line['url']]
                if (line['workflow'].length) {
                    l.push('https://cms-pdmv.cern.ch/stats?workflow_name=' + line['workflow']);
                } else {
                    l.push('');
                }
                l = l.map(e => '"' + e + '"');
                return l.join(',');
            }
            let csvContent = "data:text/csv;charset=utf-8," + header.join(',') + '\n' + inputData.map(e => lineMaker(e)).join("\n");
            let encodedUri = encodeURI(csvContent);
            let link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', 'HistoricalStatistics.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    }
]);