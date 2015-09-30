angular.module('pmpCharts', [])
    .directive('dropSelections', ['$compile', '$http', function ($compile, $http) {
        return {
            restrict: 'E',
            scope: {
                difference: '=?',
                linearScale: '=?',
                selections: '=?'
            },
            link: function (scope, element) {

                // init values
                scope.options = scope.difference || {};
                scope.selections = scope.selections || [];
                scope.linearScale = scope.linearScale || true;
                scope.logScale = !scope.linearScale;

                var optionsHelper = angular.copy(scope.options);
                scope.applyChange = function (optionName, optionValue) {
                    if (optionName === "possible-selections") {
                        for (var key in optionsHelper) {
                            if (optionsHelper[key] === optionValue) {
                                optionsHelper[key] = "";
                            }
                        }
                    } else {
                        optionsHelper[optionName] = optionValue;
                    }
                    console.log(optionsHelper);
                    scope.$parent.applyDifference(optionsHelper);
                    scope.$apply();
                };

                scope.changeScale = function (s) {
                    if (scope.linearScale != s) {
                        scope.linearScale = s;
                        scope.logScale = !s;
                        scope.$parent.changeScale(s);
                    }
                };

                $http.get('build/drop-selections.min.html').success(function (html) {

                    // compile
                    element.append($compile(html)(scope));

                    // hack to add sortable options after ng-repeat
                    setTimeout(function () {
                        $("ul.nav.dnd", element).sortable({
                            group: Math.random(), // so it's not possible to move to other groups
                            nested: false,
                            vertical: false,
                            exclude: 'nav-header',
                            title: 'nav-header',
                            pullPlaceholder: false,
                            isValidTarget: function ($item, container) {
                                return !($(container.el[0]).hasClass(
                                        "single") && container.items
                                    .length > 0);
                            },
                            onDrop: function ($item, container, _super) {
                                scope.applyChange(container.el[0].id,
                                    $item[0].textContent);
                                _super($item, container);
                            },
                        });
                    }, 0);
                });
            }
        };
    }])