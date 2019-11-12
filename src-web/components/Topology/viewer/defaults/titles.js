/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2018, 2019. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 *******************************************************************************/
'use strict'

import msgs from '../../../../../nls/platform.properties'
import _ from 'lodash'

export const getNodeTitle = (node) => {
  const {type} = node
  switch (type) {
  case 'policy':
    return 'policy'

  default:
    return _.get(node, 'specs.title', '')
  }
}

export const getSectionTitles = (clusters, types, environs, locale) => {
  const set = new Set()
  types.forEach(type=>{
    switch (type) {
    case 'cluster':
      set.add(environs)
      break

    case 'pod':
      set.add(msgs.get('topology.title.pods', locale))
      break

    case 'service':
      set.add(msgs.get('topology.title.services', locale))
      break

    case 'container':
      set.add(msgs.get('topology.title.containers', locale))
      break

    case 'host':
      set.add(msgs.get('topology.title.hosts', locale))
      break

    case 'internet':
      set.add(msgs.get('topology.title.internet', locale))
      break

    case 'deployment':
    case 'daemonset':
    case 'statefulset':
    case 'cronjob':
      set.add(msgs.get('topology.title.controllers', locale))
      break

    default:
      break
    }
  })
  return Array.from(set).sort().join(', ')
}