'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _angular = require('angular');

var _angular2 = _interopRequireDefault(_angular);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DEFAULT_QUERY_LIMIT = 10000;
var HISTORY_TO_TABLE_MAP = {
  '0': 'history',
  '1': 'history_str',
  '2': 'history_log',
  '3': 'history_uint',
  '4': 'history_text'
};

var TREND_TO_TABLE_MAP = {
  '0': 'trends',
  '3': 'trends_uint'
};

var consolidateByFunc = {
  'avg': 'AVG',
  'min': 'MIN',
  'max': 'MAX',
  'sum': 'SUM',
  'count': 'COUNT'
};

var consolidateByTrendColumns = {
  'avg': 'value_avg',
  'min': 'value_min',
  'max': 'value_max'
};

/** @ngInject */
function ZabbixDBConnectorFactory(datasourceSrv, backendSrv) {
  var ZabbixDBConnector = function () {
    function ZabbixDBConnector(sqlDataSourceId) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      _classCallCheck(this, ZabbixDBConnector);

      var limit = options.limit;


      this.sqlDataSourceId = sqlDataSourceId;
      this.limit = limit || DEFAULT_QUERY_LIMIT;
    }

    /**
     * Try to load DS with given id to check it's exist.
     * @param {*} datasourceId ID of SQL data source
     */


    _createClass(ZabbixDBConnector, [{
      key: 'loadSQLDataSource',
      value: function loadSQLDataSource(datasourceId) {
        var ds = _lodash2.default.find(datasourceSrv.getAll(), { 'id': datasourceId });
        if (ds) {
          return datasourceSrv.loadDatasource(ds.name).then(function (ds) {
            console.log('SQL data source loaded', ds);
          });
        } else {
          return Promise.reject('SQL Data Source with ID ' + datasourceId + ' not found');
        }
      }

      /**
       * Try to invoke test query for one of Zabbix database tables.
       */

    }, {
      key: 'testSQLDataSource',
      value: function testSQLDataSource() {
        var testQuery = 'SELECT itemid AS metric, clock AS time_sec, value_avg AS value FROM trends_uint LIMIT 1';
        return this.invokeSQLQuery(testQuery);
      }
    }, {
      key: 'getHistory',
      value: function getHistory(items, timeFrom, timeTill, options) {
        var _this = this;

        var intervalMs = options.intervalMs,
            consolidateBy = options.consolidateBy;

        var intervalSec = Math.ceil(intervalMs / 1000);

        consolidateBy = consolidateBy || 'avg';
        var aggFunction = consolidateByFunc[consolidateBy];

        // Group items by value type and perform request for each value type
        var grouped_items = _lodash2.default.groupBy(items, 'value_type');
        var promises = _lodash2.default.map(grouped_items, function (items, value_type) {
          var itemids = _lodash2.default.map(items, 'itemid').join(', ');
          var table = HISTORY_TO_TABLE_MAP[value_type];

          var query = '\n          SELECT itemid AS metric, clock AS time_sec, ' + aggFunction + '(value) AS value\n            FROM ' + table + '\n            WHERE itemid IN (' + itemids + ')\n              AND clock > ' + timeFrom + ' AND clock < ' + timeTill + '\n            GROUP BY time_sec DIV ' + intervalSec + ', metric\n        ';

          query = compactSQLQuery(query);
          return _this.invokeSQLQuery(query);
        });

        return Promise.all(promises).then(function (results) {
          return _lodash2.default.flatten(results);
        });
      }
    }, {
      key: 'getTrends',
      value: function getTrends(items, timeFrom, timeTill, options) {
        var _this2 = this;

        var intervalMs = options.intervalMs,
            consolidateBy = options.consolidateBy;

        var intervalSec = Math.ceil(intervalMs / 1000);

        consolidateBy = consolidateBy || 'avg';
        var aggFunction = consolidateByFunc[consolidateBy];

        // Group items by value type and perform request for each value type
        var grouped_items = _lodash2.default.groupBy(items, 'value_type');
        var promises = _lodash2.default.map(grouped_items, function (items, value_type) {
          var itemids = _lodash2.default.map(items, 'itemid').join(', ');
          var table = TREND_TO_TABLE_MAP[value_type];
          var valueColumn = _lodash2.default.includes(['avg', 'min', 'max'], consolidateBy) ? consolidateBy : 'avg';
          valueColumn = consolidateByTrendColumns[valueColumn];

          var query = '\n          SELECT itemid AS metric, clock AS time_sec, ' + aggFunction + '(' + valueColumn + ') AS value\n            FROM ' + table + '\n            WHERE itemid IN (' + itemids + ')\n              AND clock > ' + timeFrom + ' AND clock < ' + timeTill + '\n            GROUP BY time_sec DIV ' + intervalSec + ', metric\n        ';

          query = compactSQLQuery(query);
          return _this2.invokeSQLQuery(query);
        });

        return Promise.all(promises).then(function (results) {
          return _lodash2.default.flatten(results);
        });
      }
    }, {
      key: 'handleGrafanaTSResponse',
      value: function handleGrafanaTSResponse(history, items) {
        var addHostName = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

        return convertGrafanaTSResponse(history, items, addHostName);
      }
    }, {
      key: 'invokeSQLQuery',
      value: function invokeSQLQuery(query) {
        var queryDef = {
          refId: 'A',
          format: 'time_series',
          datasourceId: this.sqlDataSourceId,
          rawSql: query,
          maxDataPoints: this.limit
        };

        return backendSrv.datasourceRequest({
          url: '/api/tsdb/query',
          method: 'POST',
          data: {
            queries: [queryDef]
          }
        }).then(function (response) {
          var results = response.data.results;
          if (results['A']) {
            return results['A'].series;
          } else {
            return null;
          }
        });
      }
    }]);

    return ZabbixDBConnector;
  }();

  return ZabbixDBConnector;
}

_angular2.default.module('grafana.services').factory('ZabbixDBConnector', ZabbixDBConnectorFactory);

///////////////////////////////////////////////////////////////////////////////

function convertGrafanaTSResponse(time_series, items, addHostName) {
  var hosts = _lodash2.default.uniqBy(_lodash2.default.flatten(_lodash2.default.map(items, 'hosts')), 'hostid'); //uniqBy is needed to deduplicate
  var grafanaSeries = _lodash2.default.map(time_series, function (series) {
    var itemid = series.name;
    var item = _lodash2.default.find(items, { 'itemid': itemid });
    var alias = item.name;
    if (_lodash2.default.keys(hosts).length > 1 && addHostName) {
      //only when actual multi hosts selected
      var host = _lodash2.default.find(hosts, { 'hostid': item.hostid });
      alias = host.name + ": " + alias;
    }
    // zabbixCachingProxy deduplicates requests and returns one time series for equal queries.
    // Clone is needed to prevent changing of series object shared between all targets.
    var datapoints = _lodash2.default.cloneDeep(series.points);
    return {
      target: alias,
      datapoints: datapoints
    };
  });

  return _lodash2.default.sortBy(grafanaSeries, 'target');
}

function compactSQLQuery(query) {
  return query.replace(/\s+/g, ' ');
}
