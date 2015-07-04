
var app = angular
    .module('main', ['ui.router', 'ui.bootstrap'])
    .service('mumbleService', require('./services/mumble'))
    .service('storageService', require('./services/storage'))
    .controller('NavigationController', require('./controllers/navigation'))
    .controller('ConnectionController', require('./controllers/connection'))
    .controller('BasicController', require('./controllers/basic'))
    .controller('AdvancedController', require('./controllers/advanced'))
    .config(function ($stateProvider, $urlRouterProvider) {

        $urlRouterProvider.otherwise('main/connection')
        $stateProvider
            .state('main', { abstract: true, url: '/main', templateUrl: 'templates/main.html' })
            .state('main.connection', { url: '/connection', templateUrl: 'templates/connection.html' })
            .state('main.basic', { url: '/basic', templateUrl: 'templates/basic.html' })
            .state('main.advanced', { url: '/advanced', templateUrl: 'templates/advanced.html' })
    })