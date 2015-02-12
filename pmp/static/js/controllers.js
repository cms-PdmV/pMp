'use strict';

pmpApp.controller('MainController', function($location, $route, $rootScope, $scope, $timeout) {

    $scope.nav = function(where) {
        $scope.showView = !$scope.showView;
        if (!$scope.showView) {
            $location.search({});
            $timeout(function() {
                $location.path(where);
                $timeout(function() {
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
    $rootScope.showView = false;
    $timeout(function() {
        $scope.nav('');
    }, 100);
});

pmpApp.controller('CampaignsController', function($http, $location, $interval, $q,
    $rootScope, $scope, $timeout) {

    // currently displayed data (after filtering)
    $scope.allRequestData = [];

    // all gathered data (before filtering)
    $scope.cachedRequestData = [];


    $scope.graphParam = ['selections', 'grouping', 'stacking', 'coloring'];

    $scope.graphTabs = ['member_of_campaign', 'total_events',
        'status', 'prepid', 'priority', 'pwg'
    ];

    $scope.init = function() {
        $scope.isChainUrl = ($location.path() === '/chain');
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
        $scope.chainMode = ($location.search().m === 'true') || $scope.isChainUrl;
        $scope.filterPriority = ['', ''];
        if ($location.search().x != undefined) {
            var tmp = $location.search().x.split(',');
            $scope.filterPriority = tmp;
        }
        $scope.initStatus();
        $scope.modeUpdate();
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
            for (var i = 0; i < tmp.length; i++) {
                $scope.load(tmp[i], true, tmp.length);
            }
        } else {
            $location.search({});
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
        } else if (add & $scope.tags.hasTag(campaign)) {
            $scope.showPopUp('warning', 'Your request is already loaded');
        } else {
            $scope.loadingData = true;
            if ($scope.chainMode) {
                var promise = $http.get("api/" + campaign + "/chain");
            } else {
                var promise = $http.get("api/" + campaign + "/simple");
            }
            promise.then(function(data) {
                if (!data.data.results.length) {
                    $scope.showPopUp('error', 'No results for this request parameters');
                    $scope.loadingData = false;
                } else {
                    if (add) {
                        data.data.results.push.apply(data.data.results, $scope.cachedRequestData);
                    } else {
                        $scope.cachedRequestData = [];
                        $scope.tagsRemoveAll([campaign]);
                    }
                    if (campaign == 'all') {
                        for (var i = 0; i < data.data.results.length; i++) {
                            if (!$scope.tags.hasTag(data.data.results[i].member_of_campaign)) {
                                $scope.tags.addTag(data.data.results[i].member_of_campaign);
                            }
                        }
                    } else {
                        $scope.tags.addTag(campaign);
                    }
                    $scope.updatePwg(data.data.results, !more);
                    $scope.cachedRequestData = data.data.results;
                    $scope.setURL();
                }
                if (!more || more == $scope.tags.getTags().length) {
                    $scope.updateRequestData();
                    $scope.loadingData == false;
                }
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
                $scope.loadingData = false;
            });
        }
    };

    $scope.modeUpdate = function() {
        $scope.title = 'Chains and Flows';
        if (!$scope.isChainUrl) {
            $scope.title = 'Campaign: Dashboard';
            if ($scope.chainMode) {
                $scope.title = 'Campaign: Get_Stats';
            }
        }
        $scope.cachedRequestData = [];
        $scope.allRequestData = [];
        $scope.tagsRemoveAll([]);
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
        if ($scope.tags.getTags().length) {
            params.r = $scope.tags.getTags().join(',')
        }
        params.p = $scope.aOptionsValues.join(',') + ',' + $scope.aRadioValues.join(',');
        params.t = $scope.showDate + "";
        params.m = $scope.chainMode + "";
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

    $scope.tags = angular.element('#campaignList').tags({
        tagClass: 'btn btn-sm btn-primary',
        afterDeletingTag: function(tag) {
            $scope.loadingData = true;
            setTimeout(function() {
                var tmp = $scope.cachedRequestData;
                var data1 = [];
                var data2 = {};
                for (var i = 0; i < tmp.length; i++) {
                    if (tmp[i].member_of_campaign !== tag) {
                        data1.push(tmp[i]);
                    }
                    if (data2[tmp[i].pwg] == undefined) {
                        data2[tmp[i].pwg] = {
                            name: tmp[i].pwg,
                            selected: $scope.pwg[tmp[i].pwg].selected
                        };
                    }
                }
                $scope.cachedRequestData = data1;
                $scope.pwg = data2;
                $scope.setURL();
                $scope.updateRequestData();
            }, 500);
        }
    });

    $scope.tagsRemoveAll = function(arr) {
        var tmp = angular.copy($scope.tags.getTags());
        for (var i = 0; i < tmp.length; i++) {
            if (arr.indexOf(tmp[i]) == -1) {
                $scope.tags.removeTag(tmp[i]);
            }
        }
    }

    $scope.takeScreenshot = function() {
        var tmp = document.getElementById("ctn");
        var svg = tmp.getElementsByTagName("svg")[0];
        var svg_xml = (new XMLSerializer).serializeToString(svg);
        svg_xml = svg_xml.split('<path class="domain"').join('<path style="fill: none;shape-rendering: crispedges;stroke: black;stroke-width: 1;"');
        svg_xml = svg_xml.split('<g class="tick" style="opacity: 1;"').join('<g style="opacity: 1;stroke: grey;stroke-dasharray: 2, 2;stroke-width: 0.6;"');
        svg_xml = svg_xml.split('<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMin meet" viewBox="0 0 1500 500" width="100%" style="height: 100%;">').join('<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMin meet" viewBox="0 0 1500 500" width="100%" style="font-size:12px;">');
        var blob = new Blob([svg_xml], {type: "text/plain;charset=utf-8"});
        saveAs(blob, "screenshot.html");
    }

    $scope.updateDate = function() {
        $scope.dt = new Date();
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
        }, 500);
    }

    $interval($scope.updateDate, 1000);

    new ZeroClipboard(document.getElementById('copy'), {
        moviePath: '/lib/zeroclipboard/ZeroClipboard.swf'
    });
});

pmpApp.controller('IndexController', function($location) {
    $location.search({});
});

pmpApp.controller('TypeaheadCtrl', function($scope, $http) {
    $scope.suggestions = [];
    $scope.getSuggestions = function() {
        if ($scope.campaign) {
            $http.get('http://cms-pdmv-pmpdev.cern.ch/api/suggest/'
                      + $scope.campaign + '/' + $scope.isChainUrl).then(function(response) {
                $scope.suggestions = response.data.results;
            });
        }
        if ($scope.lifetime) {
            $http.get('http://cms-pdmv-pmpdev.cern.ch/api/suggest/'
                      + $scope.lifetime + '/lifetime').then(function(response) {
                $scope.suggestions = response.data.results;
            });
        }
    };
});

pmpApp.controller('LifetimeController', function($http, $scope) {

    $scope.allRequestData = [];

    $scope.load = function(request, add) {
        if (!request) {
            $scope.showPopUp('warning', 'Your request parameters are empty');
        } else {
            $scope.loadingData = true;
            var promise = $http.get("api/" + request + "/lifetime");
            promise.then(function(data) {
                if (!data.data.results.length) {
                    $scope.showPopUp('error', 'No results for this request parameters');
                } else {
                    if (add) {
                        data.data.results.push.apply(data.data.results, $scope.allRequestData);
                    } else {
                        $scope.allRequestData = [];
                    }
                }
                $scope.allRequestData = data.data.results;
                $scope.loadingData = false;
            }, function() {
                $scope.showPopUp('error', 'Error getting requests');
                $scope.loadingData = false;
            });
        }
    };

    $scope.title = 'Life-Time Representation of Requests';
});