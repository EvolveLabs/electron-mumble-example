

module.exports = function ($scope, $rootScope, $state) {

    $scope.go = function (route) {
        $state.go(route)
    }

    $scope.active = function (route) {
        return $state.is(route)
    }

    $scope.tabs = [
        { heading: 'Connect',  route: 'main.connection', active: false },
        { heading: 'Basic',    route: 'main.basic',      active: false },
        { heading: 'Advanced', route: 'main.advanced',   active: false },
    ]

    $scope.$on('$stateChangeSuccess', function () {
        $scope.tabs.forEach(function (tab) {
            tab.active = $scope.active(tab.route)
        })
    })
}