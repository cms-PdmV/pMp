/**
 * @name dropSelections.directive
 * @type directive
 * @description Using jquery sortable to have interactive drag&drop option adjustment
 */
.directive('dropSelections', ['$compile', '$http', function ($compile, $http) {
    return {
        restrict: 'E',
        scope: {
            scale: '=', // type of scale in use
            mode: '=', // type of mode in use
            options: '=', // dictionary with all the options for selections (value can be a string (single value) or list (multiple values possible))
            selections: '=', // specifies list of unassigned selections
            showScale: '@', // show scale radio
            showMode: '@' // show mode radio
        },
        link: function (scope, element) {

            // init values
            scope.optionsHelper = angular.copy(scope.options || {});
            scope.selectionsHelper = angular.copy(scope.selections || []);

            // working on optionsHelper changes bindings
            var tmp = angular.copy(scope.optionsHelper);
            scope.applyChange = function (optionName, optionValue, optionIndex) {
                for (var key in tmp) {
                    if (tmp[key] === optionValue) {
                        tmp[key] = "";
                    } else if (tmp[key].indexOf(optionValue) !== -1) {
                        tmp[key].splice(tmp[key].indexOf(optionValue), 1);
                    }
                }
                if (optionName !== "possible-selections") {

                    if (tmp[optionName] instanceof Array) {
                        tmp[optionName].splice(optionIndex - 1, 0, optionValue);
                    } else {
                        tmp[optionName] = optionValue;
                    }
                }
                scope.$parent.applyDifference(tmp, optionName, optionValue);
            };

            // set radio buttons and functions

            scope.radio = {};

            scope.radio.scale = scope.scale;
            scope.changeScale = function () {
                if (!scope.showScale) return null;
                scope.$parent.changeScale(scope.radio.scale);
            };

            scope.radio.mode = scope.mode;
            scope.changeMode = function () {
                if (!scope.showMode) return null;
                scope.$parent.changeMode(scope.radio.mode);
            };

            $http.get('build/drop-selections.min.html').then(function (html) {

                // compile
                element.append($compile(html.data)(scope));

                // hack to add sortable options after ng-repeat
                setTimeout(function () {
                    $("ul.nav.dnd", element).sortable({
                        // creates a new "group" for each box, allowing dragging between them
                        group: Math.random(),
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
                                $item[0].textContent, $(
                                    container.el[0].children)
                                .index($item[0]));
                            _super($item, container);
                        },
                    });
                }, 0);
            });

            scope.$watch('showScale', function (d) {
                scope.showScale = (d + "") === "true";
            });
            scope.$watch('showMode', function (d) {
                scope.showMode = (d + "") === "true";
            });
        }
    };
}])

