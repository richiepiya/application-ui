/** *****************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2019. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 ****************************************************************************** */
// Copyright (c) 2020 Red Hat, Inc.
// Copyright Contributors to the Open Cluster Management project
'use strict'

import config from '../../../../lib/shared/config'
import { VALID_DNS_LABEL } from 'temptifly'
import githubChannelData from './ControlDataGit'
import helmChannelData from './ControlDataHelm'
import { loadExistingArgoServer } from './utils'

export const controlData = [
  {
    id: 'createStep',
    type: 'step',
    title: 'argo.basic.info'
  },
  {
    id: 'showSecrets',
    type: 'hidden',
    active: false
  },
  ///////////////////////  General  /////////////////////////////////////
  {
    name: 'argo.create.name',
    tooltip: 'argo.set.name.tooltip',
    id: 'appSetName',
    type: 'text',
    label: 'argo.create.name',
    placeholder: 'argo.create.placeholder',
    validation: {
      constraint: VALID_DNS_LABEL,
      notification: 'import.form.invalid.dns.label',
      required: true
    },
    reverse: 'ApplicationSet[0].metadata.name'
  },
  {
    id: 'curlyName',
    type: 'hidden',
    active: '{{name}}'
  },
  {
    name: 'argo.server.name',
    tooltip: 'argo.cluster.tooltip',
    id: 'argoServer',
    type: 'combobox',
    label: 'argo.cluster.name',
    placeholder: 'argo.server.placeholder',
    fetchAvailable: loadExistingArgoServer(),
    validation: {
      // constraint: VALID_DNS_LABEL,
      notification: 'import.form.invalid.dns.label',
      required: true
    }
    // reverse: 'ApplicationSet[0].spec.template.metadata.name'
  },
  {
    id: 'curlyServer',
    type: 'hidden',
    active: '{{server}}'
  },
  ///////// requeue time /////////
  {
    name: 'argo.cluster.decision.requeue.title',
    tooltip: 'argo.cluster.decision.requeue.title.tooltip',
    id: 'requeueTime',
    type: 'combobox',
    placeholder: 'argo.cluster.decision.resource.placeholder',
    active: '180',
    available: ['30', '60', '120', '180', '300'],
    validation: {
      required: true
    },
    reverse:
      'ApplicationSet[0].spec.generators[0].clusterDecisionResource.requeueAfterSeconds'
  },

  ///////////////////////  template  /////////////////////////////////////
  {
    id: 'template',
    type: 'step',
    title: 'argo.template.title'
  },
  {
    id: 'source',
    type: 'title',
    info: 'argo.template.source.title'
  },
  ///////////////////////  channels  /////////////////////////////////////
  {
    id: 'channels',
    type: 'group',
    controlData: [
      {
        id: 'channel',
        type: 'section',
        title: 'creation.app.channel.title',
        collapsable: true,
        collapsed: false,
        editing: { editMode: true }
      },
      ///////////////////////  channel name  /////////////////////////////////////
      {
        id: 'channelPrompt',
        type: 'hidden',
        active: ''
      },
      {
        id: 'selfLinks',
        type: 'hidden',
        active: ''
      },
      {
        id: 'channelType',
        type: 'cards',
        sort: false,
        collapseCardsControlOnSelect: true,
        scrollViewToTopOnSelect: true,
        title: 'creation.app.channel.type',
        collapsable: true,
        collapsed: false,
        available: [
          {
            id: 'github',
            logo: `${config.contextPath}/graphics/git-repo.svg`,
            title: 'channel.type.git',
            tooltip: 'tooltip.creation.app.channel.git',
            change: {
              insertControlData: githubChannelData
            }
          },
          {
            id: 'helmrepo',
            logo: `${config.contextPath}/graphics/helm-repo.png`,
            title: 'channel.type.helmrepo',
            tooltip: 'tooltip.channel.type.helmrepo',
            change: {
              insertControlData: helmChannelData
            }
          }
        ],
        active: '',
        validation: {}
      }
    ]
  },
  ///////// destination //////////
  {
    id: 'destination',
    type: 'title',
    info: 'argo.template.destination.title'
  },
  {
    id: 'destinationNS',
    name: 'argo.destination.namespace',
    tooltip: 'argo.destination.namespace.tooltip',
    type: 'text',
    placeholder: 'argo.destination.namespace.placeholder',
    validation: {
      constraint: VALID_DNS_LABEL,
      notification: 'import.form.invalid.dns.label',
      required: true
    },
    reverse: 'ApplicationSet[0].spec.template.spec.destination.namespace'
  },
  ///////////////////////  placement  /////////////////////////////////////
  {
    id: 'placement',
    type: 'step',
    title: 'argo.placement.title'
  },
  ///////// name /////////
  {
    name: 'argo.cluster.decision.resource.name',
    tooltip: 'argo.cluster.decision.resource.name.tooltip',
    id: 'decisionResourceName',
    type: 'combobox',
    placeholder: 'argo.cluster.decision.resource.placeholder',
    validation: {
      constraint: VALID_DNS_LABEL,
      notification: 'import.form.invalid.dns.label'
      // required: true
    },
    reverse: 'ApplicationSet[0].spec.generators[0].clusterDecisionResource.name'
  }
]
