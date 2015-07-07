

module.exports = function ($scope, $location, mumbleService) {

    $scope.status = mumbleService.status
    $scope.error = mumbleService.error
    $scope.server = mumbleService.server
    $scope.username = mumbleService.username

    $scope.connect = function () {
        $scope.connecting = true
        $scope.status = 'connecting'
        var server = $scope.server
        var username = $scope.username
        var password = $scope.password
        mumbleService
            .connect(server, username, password)
            .then(function () {
                $scope.status = 'connected'
                $scope.error = null
            }, function (err) {
                $scope.status = null
                $scope.error = err.message
            })
    }

    $scope.disconnect = function () {
        $scope.status = null
        $scope.error = null
        mumbleService.disconnect()
    }

}