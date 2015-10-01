/**
 * @name dropSelections.directive
 * @type directive
 * @description Using jquery sortable to have interactive drag&drop option adjustment
 */
.directive('dropSelections', ['$compile', '$http', function ($compile, $http) {
    return {
        restrict: 'E',
        scope: {
            linearScale: '=?', // boolean, determines if the scale is linear or log
            options: '=?', // specifies list of assigned selections
            selections: '=?' // specifies list of unassigned selections
        },
        link: function (scope, element) {

            // init values
            scope.linearScale = scope.linearScale || true;
            scope.optionsHelper = angular.copy(scope.options || {});
            scope.selectionsHelper = angular.copy(scope.selections || []);

            var tmp = angular.copy(scope.optionsHelper);
            scope.applyChange = function (optionName, optionValue) {
                if (optionName === "possible-selections") {
                    for (var key in tmp) {
                        if (tmp[key] === optionValue) {
                            tmp[key] = "";
                        }
                    }
                } else {
                    tmp[optionName] = optionValue;
                }
                scope.$parent.applyDifference(tmp);
            };

            scope.changeScale = function (s) {
                if (scope.linearScale != s) {
                    scope.linearScale = s;
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