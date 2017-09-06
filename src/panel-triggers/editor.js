/**
 * Grafana-Zabbix
 * Zabbix plugin for Grafana.
 * http://github.com/alexanderzobnin/grafana-zabbix
 *
 * Trigger panel.
 * This feature sponsored by CORE IT
 * http://www.coreit.fr
 *
 * Copyright 2015 Alexander Zobnin alexanderzobnin@gmail.com
 * Licensed under the Apache License, Version 2.0
 */

import _ from 'lodash';
import * as utils from '../datasource-zabbix/utils';

import '../datasource-zabbix/css/query-editor.css!';

class TriggerPanelEditorCtrl {

  /** @ngInject */
  constructor($scope, $rootScope, uiSegmentSrv, datasourceSrv, templateSrv, popoverSrv) {
    $scope.editor = this;
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;

    this.datasourceSrv = datasourceSrv;
    this.templateSrv = templateSrv;
    this.popoverSrv = popoverSrv;

    // Map functions for bs-typeahead
    this.getGroupNames = _.partial(getMetricNames, this, 'groupList');
    this.getHostNames = _.partial(getMetricNames, this, 'hostList');
    this.getApplicationNames = _.partial(getMetricNames, this, 'appList');

    // Update metric suggestion when template variable was changed
    $rootScope.$on('template-variable-value-updated', () => this.onVariableChange());

    this.fontSizes = ['80%', '90%', '100%', '110%', '120%', '130%', '150%', '160%', '180%', '200%', '220%', '250%'];
    this.ackFilters = [
      'all triggers',
      'unacknowledged',
      'acknowledged'
    ];
    this.sortByFields = [
      { text: 'last change',  value: 'lastchange' },
      { text: 'severity',     value: 'priority' }
    ];
    this.showEventsFields = [
      { text: 'All',     value: [0,1] },
      { text: 'OK',      value: [0] },
      { text: 'Problems', value: 1 }
    ];

    // Load scope defaults
    var scopeDefaults = {
      metric: {},
      inputStyles: {},
      oldTarget: _.cloneDeep(this.panel.triggers)
    };
    _.defaults(this, scopeDefaults);

    // Set default datasource
    this.datasources = _.map(this.getZabbixDataSources(), 'name');
    if (!this.panel.datasource) {
      this.panel.datasource = this.datasources[0];
    }
    // Load datasource
    this.datasourceSrv.get(this.panel.datasource)
    .then(datasource => {
      this.datasource = datasource;
      this.zabbix = datasource.zabbix;
      this.queryBuilder = datasource.queryBuilder;
      this.initFilters();
      this.panelCtrl.refresh();
    });
  }

  initFilters() {
    return Promise.all([
      this.suggestGroups(),
      this.suggestHosts(),
      this.suggestApps()
    ]);
  }

  suggestGroups() {
    return this.zabbix.getAllGroups()
    .then(groups => {
      this.metric.groupList = groups;
      return groups;
    });
  }

  suggestHosts() {
    let groupFilter = this.datasource.replaceTemplateVars(this.panel.triggers.group.filter);
    return this.zabbix.getAllHosts(groupFilter)
    .then(hosts => {
      this.metric.hostList = hosts;
      return hosts;
    });
  }

  suggestApps() {
    let groupFilter = this.datasource.replaceTemplateVars(this.panel.triggers.group.filter);
    let hostFilter = this.datasource.replaceTemplateVars(this.panel.triggers.host.filter);
    return this.zabbix.getAllApps(groupFilter, hostFilter)
    .then(apps => {
      this.metric.appList = apps;
      return apps;
    });
  }

  onVariableChange() {
    if (this.isContainsVariables()) {
      this.targetChanged();
    }
  }

  /**
   * Check query for template variables
   */
  isContainsVariables() {
    return _.some(['group', 'host', 'application'], field => {
      return utils.isTemplateVariable(this.panel.triggers[field].filter, this.templateSrv.variables);
    });
  }

  targetChanged() {
    this.initFilters();
    this.panelCtrl.refresh();
  }

  parseTarget() {
    this.initFilters();
    var newTarget = _.cloneDeep(this.panel.triggers);
    if (!_.isEqual(this.oldTarget, this.panel.triggers)) {
      this.oldTarget = newTarget;
      this.panelCtrl.refresh();
    }
  }

  refreshTriggerSeverity() {
    _.each(this.triggerList, function(trigger) {
      trigger.color = this.panel.triggerSeverity[trigger.priority].color;
      trigger.severity = this.panel.triggerSeverity[trigger.priority].severity;
    });
    this.panelCtrl.refresh();
  }

  datasourceChanged() {
    this.panelCtrl.refresh();
  }

  changeTriggerSeverityColor(trigger, color) {
    this.panel.triggerSeverity[trigger.priority].color = color;
    this.refreshTriggerSeverity();
  }

  isRegex(str) {
    return utils.isRegex(str);
  }

  isVariable(str) {
    return utils.isTemplateVariable(str, this.templateSrv.variables);
  }

  getZabbixDataSources() {
    let ZABBIX_DS_ID = 'hzmc-onekeeper-datasource';
    return _.filter(this.datasourceSrv.getMetricSources(), datasource => {
      return datasource.meta.id === ZABBIX_DS_ID && datasource.value;
    });
  }
}

// Get list of metric names for bs-typeahead directive
function getMetricNames(scope, metricList) {
  return _.uniq(_.map(scope.metric[metricList], 'name'));
}

export function triggerPanelEditor() {
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/plugins/hzmc-onekeeper-app/panel-triggers/editor.html',
    controller: TriggerPanelEditorCtrl,
  };
}
