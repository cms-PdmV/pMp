'use strict';

pmpApp.controller('MainController', function($location, $route, $rootScope,
                                             $interval, $scope, $timeout) {

    $rootScope.showView = false;

    $scope.nav = function(where) {
        if (where == '') {
            $scope.showView = true;
        } else {
            $scope.showView = false;
        }

        if (!$scope.showView) {
            $timeout(function() {
                $location.search({});
                $location.path(where);
                $timeout(function() {
                    $scope.showView = !$scope.showView;
                    $scope.nav('');
                }, 100);
            }, 1100);
        }
    };

    var original = $location.path;
    $location.path = function(path, reload) {
        if (reload === false) {
            var lastRoute = $route.current;
            var un = $rootScope.$on('$locationChangeSuccess', function() {
                $route.current = lastRoute;
                un();
            });
        }
        return original.apply($location, [path]);
    };

    $scope.showPopUp = function(type, text) {
        switch (type) {
            case 'error':
                $scope.popUp = {
                    show: true,
                    title: 'Error',
                    message: text,
                    style: 'panel-danger',
                    icon: 'fa-frown-o'
                };
                $timeout(function() {
                    $scope.showPopUp('', '');
                }, 2000);
                break;
            case 'warning':
                $scope.popUp = {
                    show: true,
                    title: 'Warning',
                    message: text,
                    style: 'panel-warning',
                    icon: 'fa-exclamation-triangle'
                };
                $timeout(function() {
                    $scope.showPopUp('', '');
                }, 2000);
                break;
            case 'success':
                $scope.popUp = {
                    show: true,
                    title: 'Success',
                    message: text,
                    style: 'panel-success',
                    icon: 'fa-check'
                };
                $timeout(function() {
                    $scope.showPopUp('', '');
                }, 2000);
                break;
            default:
                $scope.popUp.show = false;
                break;
        }
    }

    $scope.isEmpty = function (obj) {
        return angular.equals({},obj); 
    };

    $scope.updateDate = function() {
        $scope.dt = new Date();
    }

    $timeout(function() { $scope.nav('');}, 100);
    $interval($scope.updateDate, 1000);
});

pmpApp.controller('PresentController', function($http, $location, $interval, $q,
    $rootScope, $scope, $timeout) {

    // currently displayed data (after filtering)
    $scope.allRequestData = [];

    // all gathered data (before filtering)
    $scope.cachedRequestData = [];

    $scope.graphParam = ['selections', 'grouping', 'stacking', 'coloring'];

    $scope.graphTabs = ['member_of_campaign', 'total_events',
        'status', 'prepid', 'priority', 'pwg'
    ];

    $scope.inputTags = [];

    $scope.initPresent = function() {
        $scope.aOptionsValues = [1, 0, 3, 0, 0, 0];
        $scope.aRadioValues = [0, 0];

        if ($location.search().p != undefined) {
            var toLoad = $location.search().p.split(',');
            $scope.aOptionsValues = toLoad.slice(0, 6);
            $scope.aRadioValues = toLoad.slice(6, 8);
        }
        $scope.requests.selections = [];
        var initGrouping = [];
        var initStacking = [];
        var initColoring = '';
        var initValue = '';
        for (var i = 0; i < $scope.aOptionsValues.length; i++) {
            if ($scope.aOptionsValues[i] == 0) {
                $scope.requests.selections.push($scope.graphTabs[i]);
            } else if ($scope.aOptionsValues[i] == 1) {
                initGrouping.push($scope.graphTabs[i]);
            } else if ($scope.aOptionsValues[i] == 2) {
                initStacking.push($scope.graphTabs[i]);
            } else if ($scope.aOptionsValues[i] == 3) {
                initColoring = $scope.graphTabs[i];
            }
        }
        $scope.requests.options = {
            grouping: initGrouping,
            stacking: initStacking,
            coloring: initColoring
        };
        $scope.requests.radio = {}
        $scope.requests.radio.scale = ["linear", "log"];
        $scope.requests.radio.mode = ['events', 'requests', 'seconds'];
        if ($scope.aRadioValues[1] == 1) {
            $scope.requests.radio.scale = ["log", "linear"];
        }
        if ($scope.aRadioValues[0] == 1) {
            $scope.requests.radio.mode = ['requests', 'events', 'seconds'];
        }
        if ($scope.aRadioValues[0] == 2) {
            $scope.requests.radio.mode = ['seconds', 'events', 'requests'];
        }

        $scope.showDate = $location.search().t === 'true';
        $scope.growingMode = ($location.search().m === 'true');
        
        $scope.filterPriority = ['', ''];
        if ($location.search().x != undefined) {
            var tmp = $location.search().x.split(',');
            $scope.filterPriority = tmp;
        }
        $scope.initStatus();
        $scope.modeUpdate(true);
        $scope.pwg = {};
        if ($location.search().w != undefined) {
            var tmp = $location.search().w.split(',');
            for (var i = 0; i < tmp.length; i++) {
                $scope.pwg[tmp[i]] = {
                    name: tmp[i],
                    selected: true
                };
            }
        }
        //initiate allRequestData from URL
        if ($location.search().r != undefined) {
            $scope.loadingData = true;
            var tmp = $location.search().r.split(',');
            if (Object.keys($scope.pwg).length) {
                var arg = tmp.length;
            } else {
                var arg = false;
            }
            for (var i = 0; i < tmp.length; i++) {
                $scope.load(tmp[i], true, arg);
            }
        } else {
            $scope.url = $location.absUrl();
        }
    }

    $scope.initStatus = function() {
        $scope.status = {}
        for (var i = 0; i < $scope.piecharts.fullTerms.length; i++) {
            var name = $scope.piecharts.fullTerms[i].slice(0, 2),
                tmp = true;
            if ($location.search()[name] != undefined) {
                tmp = ($location.search()[name] === 'true');
            }
            $scope.status[$scope.piecharts.fullTerms[i]] = {
                name: name,
                selected: tmp
            };
        }
    }

    $scope.load = function(campaign, add, more) {
        if (!campaign) {
            $scope.showPopUp('warning', 'Your request parameters are empty');
        } else if (add & $scope.inputTags.indexOf(campaign) !== -1) {
            $scope.showPopUp('warning', 'Your request is already loaded');
        } else {
            $scope.loadingData = true;
            if ($scope.growingMode) {
                var promise = $http.get("api/" + campaign + "/growing");
            } else {
                var promise = $http.get("api/" + campaign + "/announced");
            }
            promise.then(function(data) {
                if (!data.data.results.length) {
                    $scope.showPopUp('error', 'No results for this request parameters');
                    $scope.setURL();
                    $scope.loadingData = false;
                } else {
                    $scope.allRequestData = [];
                    if (add) {
                        // append
                        data.data.results.push.apply(data.data.results, $scope.cachedRequestData);
                    } else {
                        // see
                        $scope.inputTags = [];
                        $scope.updateOnRemoval([], {});
                    }
                    if (campaign == 'all') {
                        for (var i = 0; i < data.data.results.length; i++) {
                            if ($scope.inputTags.indexOf(data.data.results[i].member_of_campaign) === -1) {
                                $scope.inputTags.push(data.data.results[i].member_of_campaign);
                            }
                        }
                    } else {
                        $scope.inputTags.push(campaign);
                    }
                    $scope.updatePwg(data.data.results, !more);
                    $scope.cachedRequestData = data.data.results;
                    $scope.setURL();
                }
                if (!more || more == $scope.inputTags.length) {
                    $scope.updateRequestData();
                    $scope.loadingData == false;
                }
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
                $scope.loadingData = false;
            });
        }
    };

    $scope.modeUpdate = function(onlyTitle) {
        if ($scope.growingMode) {
            $scope.title = 'Present: Growing Mode';
        } else {
            $scope.title = 'Present: Announced Mode';
        }
        $scope.cachedRequestData = [];
        $scope.allRequestData = [];
        
        if (onlyTitle) {
            return null;
        }

        var tmp = angular.copy($scope.inputTags);
        if (tmp.length < 2) {
            for (var i = 0; i < tmp.length; i++) {
                $scope.load(tmp[i], false, false);
            }
        } else {
            $scope.inputTags = [];
            $scope.updateOnRemoval([], {});
        }
    };

    $scope.piecharts = {};
    $scope.piecharts.compactTerms = ["done", "to do"];
    $scope.piecharts.domain = ["new", "validation", "done", "approved",
        "submitted", "nothing", "defined", "to do"
    ];
    $scope.piecharts.fullTerms = ["new", "validation", "defined",
        "approved", "submitted", "done", "upcoming"
    ];
    $scope.piecharts.nestBy = ["member_of_campaign", "status"];
    $scope.piecharts.sum = "total_events";

    $scope.priorityPerBlock = {
        1: 110000,
        2: 90000,
        3: 85000,
        4: 80000,
        5: 70000,
        6: 63000
    };

    $scope.requests = {};
    $scope.requests.settings = {
        duration: 1000,
        legend: true,
        sort: true
    };

    $scope.setURL = function(name, value) {
        $location.path($location.path(), false);
        if (typeof name != undefined && typeof value != undefined) {
            $scope.aOptionsValues[$scope.graphTabs.indexOf(value)] = $scope.graphParam.indexOf(name);
        }
        var params = {}
        if ($scope.inputTags.length) {
            params.r = $scope.inputTags.join(',')
        }
        params.p = $scope.aOptionsValues.join(',') + ',' + $scope.aRadioValues.join(',');
        params.t = $scope.showDate + "";
        params.m = $scope.growingMode + "";
        params.x = $scope.filterPriority.join(',');

        var tmp = $scope.pwg;
        var w = [];
        for (var i = 0; i < Object.keys(tmp).length; i++) {
            if (tmp[Object.keys(tmp)[i]].selected) {
                w.push(tmp[Object.keys(tmp)[i]].name);
            }
        }
        params.w = w.join(',');

        for (var i in $scope.status) {
            params[$scope.status[i].name] = ($scope.status[i].selected === true) + "";
        }

        $location.search(params);
        $scope.url = $location.absUrl();
    }

    $scope.setScaleAndOperation = function(i, value) {
        if ($scope.aRadioValues[i] != value) {
            $scope.aRadioValues[i] = value;
            $scope.setURL();
        }
    }

    $scope.tagRemove = function(tagToRemove) {
        $scope.loadingData = true;
        setTimeout(function() {
            var tmp = $scope.cachedRequestData;
            var data1 = [];
            var data2 = {};
            if (tagToRemove !== '*') {
                for (var i = 0; i < tmp.length; i++) {
                    if (tmp[i].member_of_campaign !== tagToRemove) {
                        data1.push(tmp[i]);
                        if (data2[tmp[i].pwg] == undefined) {
                            data2[tmp[i].pwg] = {
                                name: tmp[i].pwg,
                                selected: $scope.pwg[tmp[i].pwg].selected
                            };
                        }
                    }
                }
                $scope.inputTags.splice($scope.inputTags.indexOf(tagToRemove), 1);
            }
            $scope.updateOnRemoval(data1, data2);
        }, 1000);
    }

    $scope.updateOnRemoval = function(requestData, oPWG) {
        $scope.cachedRequestData = requestData;
        $scope.pwg = oPWG;
        $scope.setURL();
        $scope.updateRequestData();
    }

    $scope.takeScreenshot = function(format) {
        $scope.loading = true;
        if (format === undefined) format = 'svg';
        var xml = (new XMLSerializer).serializeToString(document.getElementById("ctn").getElementsByTagName("svg")[0]).replace('#','U+0023');
        $http.get('ts/'+ format +'/' + xml).then(function(data) {
            window.open(data.data);
            $scope.loading = false;
        });
    }

    $scope.updateUpdate = function() {
        if ($scope.growingMode) {
            var promise = $http.get("api/campaigns,chained_campaigns," +
                                    "requests,chained_requests/lastupdate");
        } else {
            var promise = $http.get("api/campaigns/lastupdate");
        }
        promise.then(function(data) {
            $scope.lastUpdate = data.data.results.last_update
        });
    }

    $scope.updatePwg = function(x, vDefault) {
        var data = $scope.pwg;
        for (var i = 0; i < x.length; i++) {
            if (data[x[i].pwg] == undefined) {
                data[x[i].pwg] = {
                    name: x[i].pwg,
                    selected: vDefault
                };
            }
        }
        $scope.pwg = data;
    }

    $scope.updateRequestData = function() {
        $scope.loadingData = true;

        var max = $scope.filterPriority[1];
        var min = $scope.filterPriority[0];
        if (isNaN(max) || max == '') {
            max = Number.MAX_VALUE;
        }

        setTimeout(function() {
            var tmp = $scope.cachedRequestData;
            var data = [];
            for (var i = 0; i < tmp.length; i++) {
                if (tmp[i].priority >= min &&
                    tmp[i].priority <= max &&
                    $scope.status[tmp[i].status].selected &&
                    $scope.pwg[tmp[i].pwg].selected) {
                    data.push(tmp[i]);
                }
            }
            $scope.$apply(function() {
                $scope.allRequestData = data;
                $scope.loadingData = false;
            });
        }, 0);
    }

    $interval($scope.updateUpdate, 2*60*1000);
    $scope.updateUpdate();

    $scope.shortenURL = function() {
        var promise = $http.get("shorten/"+ $scope.url);
        promise.then(function(data) {
                $scope.url = data.data;
            });
    }

    new ZeroClipboard(document.getElementById('copy'), {
            moviePath: 'lib/zeroclipboard/ZeroClipboard.swf'
    });
});

pmpApp.controller('IndexController', function($location) {
    $location.search({});
});

pmpApp.controller('TypeaheadCtrl', function($scope, $http) {
    $scope.suggestions = [];
    $scope.getSuggestions = function() {
        if ($scope.campaign) {
            if ($scope.growingMode) {
                $http.get('api/suggest/' + $scope.campaign +
                          '/growing').then(function(response) {
                    $scope.suggestions = response.data.results;
                });
            } else {
                $http.get('api/suggest/' + $scope.campaign +
                          '/announced').then(function(response) {
                    $scope.suggestions = response.data.results;
                });
            }
        }
        if ($scope.lifetime) {
            $http.get('api/suggest/' + $scope.lifetime +
                      '/historical').then(function(response) {
                $scope.suggestions = response.data.results;
            });
        }
        if ($scope.performance) {
            $http.get('api/suggest/' + $scope.performance +
                      '/performance').then(function(response) {
                $scope.suggestions = response.data.results;
            });
        }
    };
});

pmpApp.controller('HistoricalController', function($http, $location, $scope, $rootScope, $interval) {

    $scope.allPWG = {};

    $scope.allRequestData = [];

    $scope.allStatus = {};

    $scope.inputTags = [];

    $scope.initHistorical = function() {

        if ($location.search().y != undefined && $location.search().y != '') {
            $scope.zoomOnY = ($location.search().y == 'true');
        } else {
            $scope.zoomOnY = false;
        }
        
        if ($location.search().p != undefined && $location.search().p != '') {
            $scope.probing = $location.search().p;
        } else {
            $scope.probing = 40;
        }
        
        if ($location.search().t != undefined && $location.search().t != '') {
            $scope.showDate = ($location.search().t == 'true');
        } else {
            $scope.showDate = false;
        }

        if ($location.search().x != undefined && $location.search().x != '') {
            var tmp = $location.search().x.split(',');
            $scope.filterPriority = {'0': tmp[0], '1': tmp[1]};
            $scope.showDate = $location.search().t;
        } else {
            $scope.filterPriority = {'0': '', '1': ''};
        }

        if ($location.search().w != undefined && $location.search().w != '') {
            var tmp = $location.search().w.split(',');
            for (var i = 0; i < tmp.length; i++) {
                $scope.allPWG[tmp[i]] = true;
            }
        }

        if ($location.search().s != undefined) {
            var tmp = $location.search().s.split(',');
            for (var i = 0; i < tmp.length; i++) {
                $scope.allStatus[tmp[i]] = true;
            }
        }

        if ($location.search().r != undefined && $location.search().r != '') {
            var tmp = $location.search().r.split(',');
            for (var i = 0; i < tmp.length; i++) {
                $scope.inputTags.push(tmp[i]);
            }
            $scope.query(true);
        }
        
        $scope.url = $location.absUrl();
    }

    $scope.load = function(request, add) {
        if (!request) {
            $scope.showPopUp('warning', 'Your request parameters are empty');
        } else if (add & $scope.inputTags.indexOf(request) !== -1) {
            $scope.showPopUp('warning', 'Your request is already loaded');
        } else {
            $scope.allRequestData = [];
            $scope.loadingData = true;
            if (!add) {
                $scope.tagsRemoveAll();
            }
            $scope.inputTags.push(request);
            var filter = add
            if (filter) {
                filter = false;
                for (var i = 0; i < Object.keys($scope.allStatus).length; i++) {
                    if (!$scope.allStatus[Object.keys($scope.allStatus)[i]]) {
                        filter = true;
                        break;
                    }
                }
                if (!filter) {
                    for (var i = 0; i < Object.keys($scope.allPWG).length; i++) {
                        if (!$scope.allPWG[Object.keys($scope.allPWG)[i]]) {
                            filter = true;
                            break;
                        }
                    }
                }
            }
            $scope.query(filter, !add);
        }
    };


    $scope.priorityPerBlock = {
        1: 110000,
        2: 90000,
        3: 85000,
        4: 80000,
        5: 70000,
        6: 63000
    };

    $scope.query = function(filter, see) {
        if (!$scope.inputTags.length) {
            return null;
        }

        $scope.loadingData = true;
        
        // Add priority filter
        var x = '';
        if(filter && $scope.filterPriority != undefined) {
            if($scope.filterPriority[0] != undefined) {
                x += $scope.filterPriority[0];
            }
            x += ',';
            if($scope.filterPriority[1] != undefined) {
                x += $scope.filterPriority[1];
            }
        } else {
            x = ','
        }
        
        // Add status filter
        var s = '';
        if (filter && Object.keys($scope.allStatus).length) {
            for (var i = 0; i < Object.keys($scope.allStatus).length; i++) {
                if ($scope.allStatus[Object.keys($scope.allStatus)[i]]) {
                    s += Object.keys($scope.allStatus)[i] + ',';
                }
            }
            if (s.length > 1) {
                s = s.substr(0, s.length-1);
            } else {
                s = '_';
            }
        } else {
            s = 'all'
        }

        // Add pwg filter
        var w = '';
        if (filter && Object.keys($scope.allPWG).length) {
            for (var i = 0; i < Object.keys($scope.allPWG).length; i++) {
                if ($scope.allPWG[Object.keys($scope.allPWG)[i]]) {
                    w += Object.keys($scope.allPWG)[i] + ',';
                }
            }
            if (w.length > 1) {
                w = w.substr(0, w.length-1);
            } else {
                w = '_';
            }
        } else {
            w = 'all'
        }
        
        var p = 40;
        if ($scope.probing != '') {
            p = $scope.probing;
        }

        var promise = $http.get("api/" + $scope.inputTags.join(',')
                                + '/historical/' + p + '/' + x + '/' + s + '/' + w);
        promise.then(function(data) {
                if (!data.data.results.status) {
                    $scope.showPopUp('error', 'No results for this request parameters');
                } else {
                    if (!data.data.results.data.length) {
                        $scope.showPopUp('warning', 'All data is filtered');
                    }
                    $scope.listSubmitted = data.data.results.submitted;
                    $scope.allRequestData = data.data.results.data;
                    $scope.allStatus = data.data.results.status;
                    $scope.allPWG = data.data.results.pwg;
                    $scope.loadTaskChain = data.data.results.taskchain;
                }
                $scope.loadingData = false;
                $scope.setURL();
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
                $scope.loadingData = false;
            });
    }

    $scope.setURL = function() {
        $location.path($location.path(), false);
        var params = {}
        params.p = $scope.probing;
        if ($scope.inputTags.length) {
            params.r = $scope.inputTags.join(',');
        }
        params.t = $scope.showDate + "";
        if ($scope.filterPriority['0'] != '' || $scope.filterPriority['1'] != '') {
            params.x = $scope.filterPriority['0'] + ',' + $scope.filterPriority['1'];
        }

        var w = [];
        for (var i in $scope.allPWG) {
            if ($scope.allPWG[i]) {
                w.push(i);
            }
        }
        params.w = w.join(',');

        var s = [];
        for (var i in $scope.allStatus) {
            if ($scope.allStatus[i]) {
                s.push(i);
            }
        }
        params.s = s.join(',');

        $scope.zoomOnY != undefined ? params.y = $scope.zoomOnY + '': params.y = 'false';
        $location.search(params);
        $scope.url = $location.absUrl();
    }

    $scope.tagRemove = function(tagToRemove) {
        $scope.inputTags.splice($scope.inputTags.indexOf(tagToRemove), 1);
        if ($scope.inputTags.length) {
            $scope.query(true);
        } else {
            $scope.tagsRemoveAll();
        }
    }

    $scope.tagsRemoveAll = function() {
        $scope.inputTags = [];
        $scope.allRequestData = [];
        $scope.allStatus = {};
        $scope.allPWG = {};
        $scope.setURL();
    }

    $scope.takeScreenshot = function() {
        var tmp = document.getElementById("ctn");
        var svg = tmp.getElementsByTagName("svg")[0];
        var svg_xml = (new XMLSerializer).serializeToString(svg);
        var blob = new Blob([svg_xml], {type: "text/plain;charset=utf-8"});
        saveAs(blob, "screenshot.html");
    }

    $scope.title = 'Historical Statistics of Requests';

    $scope.updateRequestData = function() {
        $scope.query(true);
    }

    $scope.updateUpdate = function() {
        var promise = $http.get("api/stats/lastupdate");
        promise.then(function(data) {
            $scope.lastUpdate = data.data.results.last_update
        });
    }

    $interval($scope.updateUpdate, 2*60*1000);
    $scope.updateUpdate();

    $scope.shortenURL = function() {
        var promise = $http.get("shorten/"+ $scope.url);
        promise.then(function(data) {
                $scope.url = data.data;
            });
    }

    new ZeroClipboard(document.getElementById('copy'), {
        moviePath: 'lib/zeroclipboard/ZeroClipboard.swf'
    });
});

pmpApp.controller('PerformanceController', function($http, $interval, $location, $scope) {

        $scope.cachedRequestData = [];
        $scope.allRequestData = [];
        $scope.inputTags = [];

        $scope.load = function(input, add, more) {
        if (!input) {
            $scope.showPopUp('warning', 'Your request parameters are empty');
        } else if (add & $scope.inputTags.indexOf(input) !== -1) {
            $scope.showPopUp('warning', 'Your request is already loaded');
        } else {
            $scope.loadingData = true;
            var promise = $http.get("api/" + input + "/performance");
            promise.then(function(data) {
                if (!data.data.results.length) {
                    $scope.showPopUp('error', 'No results for this request parameters');
                    $scope.loadingData = false;
                } else {
                    $scope.allRequestData = [];
                    if (add) {
                        data.data.results.push.apply(data.data.results, $scope.cachedRequestData);
                    } else {
                        $scope.inputTags = [];
                        $scope.updateOnRemoval([]);
                    }

                    $scope.cachedRequestData = data.data.results;

                    if (input == 'all') {
                        for (var i = 0; i < data.data.results.length; i++) {
                            if ($scope.inputTags.indexOf(data.data.results[i].member_of_campaign) === -1) {
                                $scope.inputTags.push(data.data.results[i].member_of_campaign);
                            }
                        }
                    } else {
                        $scope.inputTags.push(input);
                    }
                    $scope.update(data.data.results, !more, 'pwg');
                    $scope.update(data.data.results, !more, 'status');
                }

                if (!more || more == $scope.inputTags.length) {
                    $scope.updateRequestData();
                    $scope.setURL();
                    $scope.loadingData == false;
                }
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
                $scope.loadingData = false;
            });
        }
    }

    $scope.tagRemove = function(tagToRemove) {
        $scope.loadingData = true;
        setTimeout(function() {
            var tmp = $scope.cachedRequestData;
            var data = [];
            if (tagToRemove !== '*') {
                for (var i = 0; i < tmp.length; i++) {
                    if (tmp[i].member_of_campaign !== tagToRemove) {
                        data.push(tmp[i]);
                    }
                }
                $scope.inputTags.splice($scope.inputTags.indexOf(tagToRemove), 1);
            }
            $scope.updateOnRemoval(data);
        }, 1000);
    }

    $scope.updateOnRemoval = function(data) {
        $scope.cachedRequestData = data;
        $scope.allRequestData = data;
        $scope.loadingData = false;
    }

    $scope.update = function(x, def, update) {
        var data = $scope[update];
        for (var i = 0; i < x.length; i++) {
            if (data[x[i][update]] == undefined) {
                data[x[i][update]] = def;
            }
        }
        $scope[update] = data;
    }

    $scope.pwg = {};
    $scope.status = {};
    $scope.title = 'Request Performance';

    $scope.applyHistogram = function(d, e) {
        $scope.histogramData = d;
        $scope.histogramDataExtended = e;
    }

    $scope.applyDifference = function(d) {
        $scope.difference = d;
        $scope.setURL();
    }

    $scope.changeScale = function (a) {
        $scope.linearScale = a;
        $scope.setURL();
    }

    $scope.priorityPerBlock = {
        1: 110000,
        2: 90000,
        3: 85000,
        4: 80000,
        5: 70000,
        6: 63000
    };

    $scope.updateRequestData = function() {
        $scope.loadingData = true;

        var max = $scope.priority.max;
        var min = $scope.priority.min;
        if (isNaN(max) || max == '') {
            max = Number.MAX_VALUE;
        }
        if (isNaN(min) || min == '') {
            min = 0;
        }

        var tmp = $scope.cachedRequestData;
        var data = [];
        for (var i = 0; i < tmp.length; i++) {
            if (tmp[i].priority >= min &&
                tmp[i].priority <= max &&
                $scope.status[tmp[i].status] &&
                $scope.pwg[tmp[i].pwg]) {
                data.push(tmp[i]);
            }
        }
        $scope.allRequestData = data;
        $scope.loadingData = false;
    }

    $scope.updateUpdate = function() {
        var promise = $http.get("api/requests/lastupdate");
        promise.then(function(data) {
            $scope.lastUpdate = data.data.results.last_update
        });
    }

    $interval($scope.updateUpdate, 2*60*1000);
    $scope.updateUpdate();

    $scope.takeScreenshot = function() {
        var tmp = document.getElementById("ctn");
        var svg = tmp.getElementsByTagName("svg")[0];
        var svg_xml = (new XMLSerializer).serializeToString(svg);
        var blob = new Blob([svg_xml], {type: "text/plain;charset=utf-8"});
        saveAs(blob, "screenshot.html");
    }

    $scope.setURL = function() {
        $location.path($location.path(), false);
        var params = {}

        // number of bins
        if ($scope.bins != undefined || $scope.bins != '') {
            params.b = $scope.bins;
        }
        // list of requests separated by comma
        if ($scope.inputTags.length) {
            params.r = $scope.inputTags.join(',')
        }
        // if show the time block
        if ($scope.showDate != undefined) {
            params.t = $scope.showDate + ''
        }
        // set filter priority
        if ($scope.priority.max != '' || $scope.priority.min != '') {
            params.x = $scope.priority.min + ',' + $scope.priority.max;
        }
        // set filter pwgs
        var w = [];
        for (var i in $scope.pwg) {
            if ($scope.pwg[i]) {
                w.push(i);
            }
        }
        params.w = w.join(',');

        // set filter status
        var s = [];
        for (var i in $scope.status) {
            if ($scope.status[i]) {
                s.push(i);
            }
        }
        params.s = s.join(',');

        // setting minuend
        if ($scope.difference.minuend != '') {
            params.min = $scope.difference.minuend;
        }
        // setting subtrahend
        if ($scope.difference.subtrahend != '') {
            params.sub = $scope.difference.subtrahend;
        }
        // set scale
        if ($scope.linearScale != undefined) {
            params.l = $scope.linearScale + '';
        }

        $location.search(params);
        $scope.url = $location.absUrl();
    }

    $scope.shortenURL = function() {
        var promise = $http.get("shorten/"+ $scope.url);
        promise.then(function(data) {
                $scope.url = data.data;
            });
    }

    new ZeroClipboard(document.getElementById('copy'), {
        moviePath: 'lib/zeroclipboard/ZeroClipboard.swf'
    });

    $scope.initPerformance = function() {

        $scope.difference = {minuend: '', subtrahend: ''}        
        $scope.selections = ['created', 'validation', 'approved', 'submitted', 'done'];

        if ($location.search().min != undefined) {
            var inx = $scope.selections.indexOf($location.search().min);
            if (inx != -1) {
                $scope.difference.minuend = $location.search().min;
                $scope.selections.splice(inx, 1);
            }
        }

        if ($location.search().sub != undefined) {
            var inx = $scope.selections.indexOf($location.search().sub);
            if (inx != -1) {
                $scope.difference.subtrahend = $location.search().sub;
                $scope.selections.splice(inx, 1);
            }
        }



        $scope.showDate = ($location.search().t === 'true');
        $scope.linearScale = ($location.search().l === 'true');
        if ($location.search.b != '' && !isNaN($location.search().b)) {
            $scope.bins = parseInt($location.search().b, 10);
        } else {
            $scope.bins = 10;
        }

        $scope.priority = {min: '', max: ''};
        if ($location.search().x != undefined) {
            var tmp = $location.search().x.split(',');
            $scope.priority.min = tmp[0];
            $scope.priority.max = tmp[1];
        }

        $scope.pwg = {};
        if ($location.search().w != undefined) {
            var tmp = $location.search().w.split(',');
            for (var i = 0; i < tmp.length; i++) {
                $scope.pwg[tmp[i]] = true;
            }
        }

        $scope.status = {};
        if ($location.search().s != undefined) {
            var tmp = $location.search().s.split(',');
            for (var i = 0; i < tmp.length; i++) {
                $scope.status[tmp[i]] = true;
            }
        }
        
        if ($location.search().r != undefined) {
            $scope.loadingData = true;
            var tmp = $location.search().r.split(',');
            var arg = false;
            if (Object.keys($scope.pwg).length) {
                var arg = tmp.length;
            }
            for (var i = 0; i < tmp.length; i++) {
                $scope.load(tmp[i], true, arg);
            }
        } else {
            $scope.url = $scope.setURL();
        }
    }
});

pmpApp.controller('ChainsController', function($http, $scope) {

        $scope.parseResponse = function(data) {
            var tempNodeArray = [], nodes = [], links = [];
            for (var i = 0; i < data.length; i++) {
                for (var j = 0; j < data[i].campaigns.length; j++) {
                    //add node if it doesn't already exist
                    if ($.inArray(data[i].campaigns[j][0], tempNodeArray) === -1) {
                        tempNodeArray.push(data[i].campaigns[j][0]);
                        nodes.push({"id": data[i].campaigns[j][0]});
                    }
                    if (j !== 0) {  
                        links.push({"source": data[i].campaigns[j - 1][0],
                                    "target": data[i].campaigns[j][0],
                                    "name": data[i].campaigns[j][1]
                                    });
                    }
                }
            }
            return {nodes: nodes, links: links};

        }

        $scope.setListeners = function () {
            var $svg = $('svg');
            
            $svg
            /*.on('dblclick', '.node', function () {
                    var thisData = this.__data__;
                    
                    if (thisData.isExpanded) {
                        graph.reduceNodes(thisData);
                    } else {
                        graph.expandNodes(thisData);
                    }
                    
                    graph.draw();
                    })*/
            .on('mouseover', '.node',function () {
                    $(this).find('.node-text').show();
                })
            .on('mouseleave', '.node',function () {
                    $(this).find('.node-text').hide();
                });
        };
        
        $scope.initChains = function() {
            $scope.title = "Chains Landscape";
            $scope.allRequestData = [];
            $scope.loadingData = true;

            var promise = $http.get("api/_/chain");
            promise.then(function(data) {
                $scope.allRequestData = $scope.parseResponse(data.data.results);
                $scope.setListeners();
                $scope.loadingData = false;
            });
        }
    });