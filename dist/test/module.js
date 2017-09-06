'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ConfigCtrl = undefined;

var _config = require('./components/config');

var _sdk = require('app/plugins/sdk');

(0, _sdk.loadPluginCss)({
  dark: 'plugins/hzmc-onekeeper-app/css/grafana-zabbix.dark.css',
  light: 'plugins/hzmc-onekeeper-app/css/grafana-zabbix.light.css'
});

exports.ConfigCtrl = _config.ZabbixAppConfigCtrl;
