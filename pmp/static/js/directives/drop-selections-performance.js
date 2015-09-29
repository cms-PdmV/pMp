angular.module('pmpCharts', []).directive('dropSelections', ['$compile', function($compile) {
        return {
            restrict: 'E',
            scope: {
                difference: '=?',
                linearScale: '=?',
                selections: '=?'
            },
            link: function(scope, element, attrs) {
                scope.difference =  scope.difference || {};
                scope.selections = scope.selections || [];
                scope.linearScale = scope.linearScale || true;
                scope.logScale = !scope.linearScale;

                scope.applyChange = function(optionName, optionValue) {
                    scope.difference[optionName] = optionValue;
                    scope.$parent.applyDifference(scope.difference);
                    scope.$apply();
                };

                var innerHtml = "<style>.nav.dnd {margin-bottom: 0;}</style><div class='row'><div class='col-lg-9 col-md-12 col-sm-12 col-xs-12' style='margin-bottom: 3px'><span class='col-lg-2 col-md-2 col-sm-3 col-xs-5 nav-header text-muted'>selections</span><ul id='possible-selections' class='nav nav-pills dnd col-lg-10 col-md-10 col-sm-9 col-xs-7 inline' style='min-height:22px'><li class='btn btn-default btn-xs text-uppercase' ng-repeat='value in selections'>{{value}}</li></ul></div>";

                for(var key in scope.difference) {
                    innerHtml += "<div class='col-lg-6 col-md-6 col-sm-12 col-xs-12'><span class='col-lg-3 col-md-4 col-sm-3 col-xs-5 nav-header' style='margin-bottom: 3px'>" + key + "</span><ul id='" + key + "' class='nav nav-pills dnd single col-lg-9 col-md-8 col-sm-9 col-xs-7 inline alert-info' style='min-height:23px; margin-top:1px'>";
                    if(scope.difference[key] !="") {
                        innerHtml+="<li class='btn btn-default btn-xs text-uppercase'>" + scope.difference[key] + "</li>";
                    }
                    innerHtml+="</ul></div>";
                }

                innerHtml += "<div class='col-lg-6 col-md-6 col-sm-12 col-xs-12 spacing-sm' style='margin-top:3px;'><span class='col-lg-3 col-md-4 col-sm-3 col-xs-5 nav-header'>scale</span><ul class='nav nav-pills inline col-lg-9 col-md-8 col-sm-9 col-xs-7'><li><div class='btn-group'><button type='button' class='btn btn-primary btn-xs text-uppercase' ng-model='linearScale' ng-click='changeScale(true)' btn-radio='true'>linear</button><button type='button' class='btn btn-primary btn-xs text-uppercase' ng-model='logScale' ng-click='changeScale(false)' btn-radio='true'>log</button></div></li></ul></div></div>";

                scope.changeScale = function(s) {
                    if (scope.linearScale != s) {
                        scope.linearScale = s;
                        scope.logScale = !s;
                        scope.$parent.changeScale(s);
                    }
                }

                var chart = $compile(innerHtml)(scope);
                element.append(chart);

                $("ul.nav.dnd", element).sortable({
                    group: Math.random(),
                    nested: false,
                    vertical: false,
                    exclude: 'nav-header',
                    title: 'nav-header',
                    pullPlaceholder: false,
                    isValidTarget: function($item, container) {
                        return !($(container.el[0]).hasClass('single') && container.items.length > 0);
                    },
                    onDrop: function($item, container, _super) {
                        if(container.el[0].id!='possible-selections') {
                            scope.applyChange(container.el[0].id, $item[0].textContent);
                        }
                        _super($item, container);
                    },
                    onDragStart: function($item, container, _super) {
                        if(container.el[0].id!='possible-selections') {
                            scope.applyChange(container.el[0].id, '');
                        }
                        _super($item, container);
                    }
                });
            }
        }
            }])