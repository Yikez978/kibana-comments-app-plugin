
import moment from 'moment-timezone';
import _ from 'lodash';

import { uiModules } from  'ui/modules';
import uiRoutes from 'ui/routes';

import 'ui/autoload/all';

import './less/main.less';
import template from './templates/index.html';
import chrome from 'ui/chrome';

// in dev mode, url path is prefixed by a 3-letter string to force cache reloading, 
// else the proxy path begins directly by /app
const apiPrefix = window.location.pathname.split('/')[1] === "app" ? 
  "" : "/" + window.location.pathname.split('/')[1]; 

uiRoutes.enable();
uiRoutes
.when('/', {
  template
});

uiModules
.get('app/kibana-comments-plugin', ['ui.bootstrap.datepicker', 'ui.bootstrap.dateparser', 'ui.bootstrap.position'])
.constant('datepickerConfig', {
  formatDay: 'dd',
  formatMonth: 'MMMM',
  formatYear: 'yyyy',
  formatDayHeader: 'EEE',
  formatDayTitle: 'MMMM yyyy',
  formatMonthTitle: 'yyyy',
  datepickerMode: 'day',
  minMode: 'day',
  maxMode: 'year',
  showWeeks: true,
  startingDay: 0,
  yearRange: 20,
  minDate: null,
  maxDate: null
})
.controller('kibanaPluginCommentForm', 
            ['$scope', '$route', '$interval', '$http', '$log', '$timeout', 'datepickerConfig', 
            function ($scope, $route, $interval, $http, $log, $timeout, datepickerConfig) {

  $scope.title = 'Comments';
  $scope.description = 'A plugin to add comments to your Kibana dashboards';

  $scope.datepickerMode = $scope.datepickerMode || datepickerConfig.datepickerMode;

  $scope.date = new Date();
  $scope.date.setHours(12,0,0,0);

  $scope.isLoadingComments = false;
  $scope.isLoadingIndices = false;

  $scope.createIndex = createIndex;

  // create default index .comments, then load the list of indices
  createDefaultIndex();

  // load the comments
  reloadComments();



  function reloadIndices(indexToSelect) {

    indexToSelect = indexToSelect ? 'comments-' + indexToSelect : 'comments';

    $scope.isLoadingIndices = true;
    $timeout(function () {

      $http
      .get(apiPrefix + '/api/kibana-comments-plugin/index')
      .success(function(data, status, headers, config) {

        var listIndices = data.map((i) => (i.index));
        $scope.listIndices = listIndices
        $scope.isLoadingIndices = false;

        $scope.selectedIndex = listIndices.find((i) => (i === indexToSelect));
      })
      .error(function(data, status, headers, config) {

        $scope.messages = 'There was a network error. Try again later.';
        $scope.isLoadingIndices = false;
      })
      .finally(finallyCallback);
       
    }, 1000);
  };



  function reloadComments() {

    $scope.isLoadingComments = true;
    $timeout(function () {
      
      $http
      .get(apiPrefix + '/api/kibana-comments-plugin/comment?size=10')
      .success(function(data, status, headers, config) {

        data = _.isArray(data) ? data : [];
        $scope.listComments = data.map((oneData) => {
          return { 
            ...oneData, 
            date: moment(oneData.date).format('YYYY/MM/DD')
          }
        }) || {};
        $scope.isLoadingComments = false;
      })
      .error(function(data, status, headers, config) {

        $scope.messages = 'There was a network error. Try again later.';
        $scope.isLoadingComments = false;
      })
      .finally(finallyCallback);
       
    }, 1000);
  };

  
  $scope.deleteComment = function(commentIndex, commentId) {

    // Perform JSONP request.
    var $promise = $http({
        method: 'DELETE',
        url: apiPrefix + '/api/kibana-comments-plugin/comment/' + commentIndex + '/' + commentId, 
        headers: {
          'Content-Type': 'application/json'
        }
    })
    .success(function(res, status, headers, config) {

      if (res.deleted) {
        $scope.messages = {
          text: 'Your comment has been deleted!', 
          type: 'success'
        };

        // Reload comment list
        reloadComments();

      } else {
        $scope.messages = {
          text: 'Oops, we received your request, but there was an error processing it.', 
          type: 'danger'
        };
        $log.error(res);
      }


    })
    .error(function(res, status, headers, config) {

      $scope.messages = {
        text: 'There was a network error. Try again later.', 
        type: 'danger'
      };

      $log.error(res);
    })
    .finally(finallyCallback);
  }

  $scope.submitComment = function(form) {

    // Trigger validation flag.
    $scope.submitted = true;

    if (!$scope.body  || !$scope.body.trim()) {
      $scope.body = "";
      return;
    }

    // If form is invalid, return and let AngularJS show validation errors.
    if (form.$invalid) {
      return;
    }

    // Default values for the request.
    var data = {
      "index": $scope.selectedIndex,
      "comment": {
        "date" : $scope.date,
        "body" : $scope.body,
      }
    };

    // Perform JSONP request.
    var $promise = $http({
        method: 'PUT',
        url: apiPrefix + '/api/kibana-comments-plugin/comment', 
        headers: {
          'Content-Type': 'application/json'
        },
        data
    })
    .success(function(res, status, headers, config) {

      if (res.created) {

        // reset submitted
        $scope.submitted = false;

        $scope.body = " ";
        $scope.messages = {
          text: 'Your comment has been saved!', 
          type: 'success'
        };

        // Reload comment list
        reloadComments();

      } else {
        $scope.messages = {
          text: 'Oops, we received your request, but there was an error processing it.', 
          type: 'danger'
        };
        $log.error(res);
      }
    })
    .error(errorCallback)
    .finally(finallyCallback);

  };

  function createDefaultIndex() {

    // Perform JSONP request.
    var $promise = $http({
        method: 'PUT',
        url: apiPrefix + '/api/kibana-comments-plugin/index', 
        headers: {
          'Content-Type': 'application/json'
        }
    })
    .finally(function() {

        // Reload indices list
        reloadIndices();
      
    })

  }

  function createIndex(newIndex, callback) {

    if (!newIndex) {
      $scope.messages = {
        text: 'Index cannot be empty', 
        type: 'danger'
      };
      finallyCallback(callback);

      return;
    }

    // Perform JSONP request.
    var $promise = $http({
        method: 'PUT',
        url: apiPrefix + '/api/kibana-comments-plugin/index/' + newIndex, 
        headers: {
          'Content-Type': 'application/json'
        }
    })
    .success(function(res, status, headers, config) {

      if (res.acknowledged) {

        var indexToSelect = $scope.newIndex;
        $scope.newIndex = null;
        $scope.messages = {
          text: 'Your index has been created!', 
          type: 'success'
        };

        // Reload indices list
        reloadIndices(indexToSelect);

      } else {

        if (res.error.type === "index_already_exists_exception") {
          $scope.messages = {
            text: 'This index already exists. Please reload the page to see it in the indices list', 
            type: 'warning'
          };
        }
        else {
          $scope.messages = {
            text: 'Oops, we received your request, but there was an error processing it. <br>Reason: ' + res.error.reason, 
            type: 'danger'
          };
        }
        $log.error(res);
      }
    })
    .error(errorCallback)
    .finally(finallyCallback);
  }



  function errorCallback(res, status, headers, config) {

    $scope.messages = {
      text: 'There was a network error. Try again later.', 
      type: 'danger'
    };

    $log.error(res);
  }

  var timeoutPromize = false;
  function finallyCallback() {

    // reset submitted
    $scope.submitted = false;

    if (timeoutPromize) {
      $timeout.cancel(timeoutPromize);
      timeoutPromize = false;
    }

    // Hide status messages after 7 seconds.
    $timeout(function() {
      $scope.messages = null;
    }, 7000);
  }


}]);
