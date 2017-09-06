import {ZabbixAppConfigCtrl} from './components/config';
import {loadPluginCss} from 'app/plugins/sdk';

loadPluginCss({
  dark: 'plugins/hzmc-onekeeper-app/css/grafana-zabbix.dark.css',
  light: 'plugins/hzmc-onekeeper-app/css/grafana-zabbix.light.css'
});

export {
  ZabbixAppConfigCtrl as ConfigCtrl
};
