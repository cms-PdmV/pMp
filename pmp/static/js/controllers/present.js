/**
 * @name present.controller
 * @type controller
 * @description Present Graph Controller
 */
angular.module('pmpApp').controller('PresentController', ['$http', '$location',
    '$interval', '$rootScope', '$scope', 'PageDetailsProvider', 'Data',
    function ($http, $location, $interval, $rootScope, $scope, PageDetailsProvider,
        Data) {
        'use strict';

        /**
         * @description stores defaults for URL parameters
         */
        $scope.defaults = {
            r: undefined, // query value (from search box)
            p: '1,0,3,0,0,0,0,0', // the options above the graph affecting the plot
            m: 'false', // growing mode (boolean)
            c: 'false', // chained mode (boolean)
            t: 'false', // show last update time (boolean)
            h: 'true', // show human-readable numbers (boolean)
            x: ',', // priority filter
            w: undefined, // PWG filter
            s: undefined, // status filter
        };

        /**
         * @description Core: Init method for the page. Init scope variables from url.
         */
        $scope.init = function () {
            // get information about page
            $scope.page = PageDetailsProvider.present;
            $scope.loadingAll = false; // updated when $scope.load is called

            // reset data and filters
            Data.reset(true);

            // collect URL parameters and fill in defaults where necessary
            var urlParameters = {};

            ['r', 'p', 'm', 'c', 't', 'h', 'x', 'w', 's'].forEach(function (param, index, array) {
                var urlValue = $location.search()[param];

                if (urlValue === undefined) {
                    urlParameters[param] = $scope.defaults[param];
                }
                else {
                    urlParameters[param] = urlValue;
                }
            });

            // define piecharts options
            $scope.piecharts = {
                compactTerms: ["done", "to do"],
                domain: ["new", "validation", "done",
                    "approved", "submitted", "nothing",
                    "defined", "to do"
                ],
                fullTerms: ["new", "validation", "defined",
                    "approved", "submitted", "done",
                    "upcoming"
                ],
                nestBy: ["member_of_campaign", "status"],
                sum: "total_events"
            };

            // Plot parameters - defining how the plot is displayed
            var plotParams = urlParameters.p.split(',');
            $scope.parameters = plotParams.slice(0, 6);
            $scope.radio = plotParams.slice(6, 8);

            // set requests globals
            $scope.requests = {
                options: {
                    grouping: [],
                    stacking: [],
                    coloring: ""
                },
                selections: [],
                settings: {
                    duration: 1000,
                    legend: true,
                    sort: true
                }
            };

            // assign selections to options
            $scope.options = ['selections', 'grouping', 'stacking',
                'coloring'
            ];
            $scope.selections = ['member_of_campaign',
                'total_events', 'status', 'prepid', 'priority',
                'pwg'
            ];
            for (var i = 0; i < $scope.parameters.length; i++) {
                if ($scope.parameters[i] === '0') {
                    $scope.requests.selections.push($scope.selections[i]);
                } else if ($scope.parameters[i] === '1') {
                    $scope.requests.options.grouping.push($scope.selections[i]);
                } else if ($scope.parameters[i] === '2') {
                    $scope.requests.options.stacking.push($scope.selections[i]);
                } else if ($scope.parameters[i] === '3') {
                    $scope.requests.options.coloring = $scope.selections[i];
                }
            }

            // assign radio values, scale and mode
            if ($scope.radio[1] === "1") {
                $scope.scaleType = "log";
            } else {
                $scope.scaleType = "linear";
            }

            if ($scope.radio[0] === "1") {
                $scope.modeType = "requests";
            } else if ($scope.radio[0] === "2") {
                $scope.modeType = "seconds";
            } else {
                $scope.modeType = "events";
            }

            // show "last updated" time?
            $scope.showDate = urlParameters.t === 'true';

            // enable growing mode?
            $scope.growingMode = urlParameters.m === 'true';

            // enable chained mode?
            $scope.displayChains = urlParameters.c === 'true';

            // show human-readable numbers?
            $scope.humanReadableNumbers = urlParameters.h === 'true';

            // update mode
            $scope.modeUpdate(true);

            // initiate filters
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
            if (urlParameters.r !== undefined && urlParameters.r !== '') {
                var tmp = $location.search().r.split(',');
                // if filter is empty, assume all true
                var empty = [$scope.isEmpty(Data.getPWGFilter()),
                    $scope.isEmpty(Data.getStatusFilter())
                ];
                for (var j = 0; j < tmp.length; j++) {
                    $scope.load(tmp[j], true, tmp.length, empty[0],
                        empty[1]);
                }
            } else {
                // if this is empty just change URL as some filters
                // could have been initiated
                $scope.setURL();
            }
        };

        /**
         * @description Core: Query API
         * @param {String} request User input.
         * @param {Boolean} add Append results if true
         * @param {Boolean} more Are there more requests in a queue
         * @param {Boolean} defaultPWG When new PWG shows up what should be default filter value
         * @param {Boolean} defaultStatus When new status shows up what should be default filter value
         */
        $scope.load = function (campaign, add, more, defaultPWG,
            defaultStatus) {
            if (!campaign) {
                $scope.showPopUp(PageDetailsProvider.messages.W0.type,
                    PageDetailsProvider.messages.W0.message);
            } else if (add && Data.getInputTags().indexOf(campaign) !==
                -1) {
                $scope.showPopUp(PageDetailsProvider.messages.W1.type,
                    PageDetailsProvider.messages.W1.message);
            } else {
                $rootScope.loadingData = true;
                var promise;
                if ($scope.growingMode) {
                    promise = $http.get("api/" + campaign +
                        "/growing/" + $scope.displayChains);
                } else {
                    promise = $http.get("api/" + campaign +
                        "/announced/" + $scope.displayChains);
                }
                promise.then(function (data) {
                    if (!data.data.results.length) {
                        // if API response is empty 
                        $scope.showPopUp(
                            PageDetailsProvider.messages
                            .W2.type,
                            PageDetailsProvider.messages
                            .W2.message);
                        $scope.setURL();
                        $rootScope.loadingData = false;
                    } else {
                        if (add) {
                            // apply appending campaign
                            Data.changeFilter(data.data.results,
                                false, defaultStatus,
                                true);
                            Data.changeFilter(data.data.results,
                                false, defaultPWG,
                                false);
                            Data.setLoadedData(data.data.results,
                                               true, true, more);
                            $scope.showPopUp(
                                PageDetailsProvider.messages
                                .S1.type,
                                PageDetailsProvider.messages
                                .S1.message);
                        } else {
                            // apply loading all or single campaign
                            Data.reset(false);
                            Data.changeFilter(data.data.results,
                                true, true, true);
                            Data.changeFilter(data.data.results,
                                true, true, false);
                            Data.setLoadedData(data.data.results,
                                false, true);
                            $scope.showPopUp(
                                PageDetailsProvider.messages
                                .S0.type,
                                PageDetailsProvider.messages
                                .S0.message);
                        }

                        $scope.loadingAll = (campaign === 'all');
                        Data.setInputTags(campaign, true, false);
                        $scope.setURL();
                    }
                }, function () {
                    $scope.showPopUp(PageDetailsProvider.messages
                        .E1.type, PageDetailsProvider.messages
                        .E1.message);
                    $rootScope.loadingData = false;
                });
            }
        };

        /**
         * @description Core: Change URL when data or filter changes
         * @param {String} name the name of parameter that has changed
         * @param {Integer} value the position of parameter that has changed
         */
        $scope.setURL = function () {
            $location.path($location.path(), false);
            var params = {}, r, p, m, c, t, h, x, w, s;

            // collect user inputs
            if ($scope.loadingAll) {
                params.r = 'all';
            } else {
                r = Data.getInputTags();
                if (r.length) params.r = r.join(',');
            }

            // graph parameters
            p = $scope.parameters.join(',') + ',' + $scope.radio.join(',');

            if (p !== $scope.defaults.p) {
                params.p = p;
            }

            // is in growing mode
            m = $scope.growingMode + '';

            if (m !== $scope.defaults.m) {
                params.m = m;
            }

            // is in chain mode
            c = $scope.displayChains + '';

            if (c !== $scope.defaults.c) {
                params.c = c;
            }

            // show time label
            t = $scope.showDate + '';

            if (t !== $scope.defaults.t) {
                params.t = t;
            }

            // show human-readable numbers
            h = $scope.humanReadableNumbers + '';

            if (h !== $scope.defaults.h) {
                params.h = h;
            }

            // set priority filter
            x = Data.getPriorityFilter().join(',');

            if (x !== $scope.defaults.x) {
                params.x = x;
            }

            // set pwg filter
            if (!Data.allPWGsEnabled()) {
                params.w = $scope.getCSVPerFilter(Data.getPWGFilter());
            }

            // set status filter
            if (!Data.allStatusesEnabled()) {
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
            $rootScope.loadingData = true;
            if (format === undefined) format = 'svg';
            var xml = (new XMLSerializer()).serializeToString(
                document.getElementById("ctn").getElementsByTagName(
                    "svg")[0]).replace('viewBox="0 0 1125 434"',
                'viewBox="0 0 1125 534" font-family="sans-serif"'
            ).replace('</svg>',
                '<text transform="translate(0, 434)">Generated: ' +
                $scope.dt + '. For input: ' + Data.getInputTags()
                .join(', ') + '</text></svg>').replace(/\n/g, ' ');
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
         * @description Update mode
         * @param {Boolean} onlyTitle if false, perform API query as well
         */
        $scope.modeUpdate = function (onlyTitle) {
            if ($scope.growingMode) {
                $scope.mode = ': Growing Mode';
            } else {
                $scope.mode = ': Announced Mode';
            }

            if (onlyTitle) {
                return null;
            }

            var tmp = Data.getInputTags();
            Data.setInputTags([], false, false);
            if (tmp.length < 2 || !$scope.displayChains) {
                for (var i = 0; i < tmp.length; i++) {
                    $scope.load(tmp[i], true, tmp.length, Data.getPWGFilter(),
                        Data.getStatusFilter());
                }
            } else {
                Data.reset(false);
            }
        };

        /**
         * @description When scale has been changed.
         */
        $scope.changeScale = function (type) {
            $scope.scaleType = type;
            $scope.setScaleAndOperation(1, (type === "log") + 0)
        };

        /**
         * @description When scale has been changed.
         */
        $scope.changeMode = function (type) {
            $scope.modeType = type;
            $scope.setScaleAndOperation(0, ['events', 'requests', 'seconds'].indexOf(type));
        };

        $scope.applyDifference = function(values, optionName, optionValue) {
            $scope.requests.options = values;
            $scope.setURL(optionName, optionValue);
        };

        $scope.setScaleAndOperation = function (i, value) {
            if ($scope.radio[i] != value) {
                $scope.radio[i] = value;
                $scope.setURL();
            }
        };

        // Broadcast receiver, change filtered data on loaded data change
        $scope.$on('onChangeNotification:FilteredData', function () {
            $scope.setURL();
            $scope.data = Data.getFilteredData();
            $rootScope.loadingData = false;
        });

        // Set interval update of time variables
        var intervalUpdate1 = $interval($scope.updateCurrentDate, 1000);
        var intervalUpdate2 = $interval(function () {
            $scope.updateLastUpdate(
                'campaigns,chained_campaigns,requests,chained_requests'
            );
        }, 2 * 60 * 1000);
        $scope.updateLastUpdate(
            'campaigns,chained_campaigns,requests,chained_requests'
        );
        $scope.$on('$destroy', function () {
            $interval.cancel(intervalUpdate1);
            $interval.cancel(intervalUpdate2);
        });
    }
]);
