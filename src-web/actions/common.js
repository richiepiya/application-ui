/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2017, 2018. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 *******************************************************************************/

import lodash from 'lodash'

import * as Actions from './index'
import apolloClient from '../../lib/client/apollo-client'
import {
  SEARCH_QUERY,
  SEARCH_QUERY_RELATED,
  GET_RESOURCE
} from '../apollo-client/queries/SearchQueries'
import { convertStringToQuery } from '../../lib/client/search-helper'
import { mapBulkApplications } from '../reducers/data-mappers/mapApplicationsBulk'
import { mapBulkChannels } from '../reducers/data-mappers/mapChannelsBulk'
import { mapBulkSubscriptions } from '../reducers/data-mappers/mapSubscriptionsBulk'
import { mapSingleApplication } from '../reducers/data-mappers/mapApplicationsSingle'

export const changeTablePage = ({ page, pageSize }, resourceType) => ({
  type: Actions.TABLE_PAGE_CHANGE,
  page,
  pageSize,
  resourceType
})

export const searchTable = (search, resourceType) => ({
  type: Actions.TABLE_SEARCH,
  search,
  resourceType
})

export const sortTable = (sortDirection, sortColumn, resourceType) => ({
  type: Actions.TABLE_SORT,
  sortDirection,
  sortColumn,
  resourceType
})

export const receiveResourceSuccess = (response, resourceType) => ({
  type: Actions.RESOURCE_RECEIVE_SUCCESS,
  status: Actions.REQUEST_STATUS.DONE,
  items: response.items,
  resourceVersion: lodash.get(response, 'metadata.resourceVersion'), //only supported on k8s resoruces
  resourceType
})

export const receiveResourceError = (err, resourceType) => ({
  type: Actions.RESOURCE_RECEIVE_FAILURE,
  status: Actions.REQUEST_STATUS.ERROR,
  err,
  resourceType
})

export const requestResource = resourceType => ({
  type: Actions.RESOURCE_REQUEST,
  status: Actions.REQUEST_STATUS.IN_PROGRESS,
  resourceType
})

export const addResource = (item, resourceType) => ({
  type: Actions.RESOURCE_ADD,
  resourceType: item.kind || resourceType,
  item
})

export const modifyResource = (item, resourceType) => ({
  type: Actions.RESOURCE_MODIFY,
  resourceType: item.kind || resourceType,
  item
})

export const deleteResource = (item, resourceType) => ({
  type: Actions.RESOURCE_DELETE,
  resourceType: item.kind || resourceType,
  item
})

export const mutateResource = (resourceType, resourceName) => ({
  type: Actions.RESOURCE_MUTATE,
  resourceName,
  resourceType
})

export const mutateResourceSuccess = (resourceType, resourceName) => ({
  type: Actions.RESOURCE_MUTATE_SUCCESS,
  resourceName,
  resourceType
})

export const mutateResourceFailure = (resourceType, error) => ({
  type: Actions.RESOURCE_MUTATE_FAILURE,
  postStatus: Actions.REQUEST_STATUS.ERROR,
  err: { error },
  resourceType
})

export const getQueryStringForResources = resourcename => {
  switch (resourcename) {
  case 'HCMChannel':
    return convertStringToQuery('kind:channel')
  case 'HCMSubscription':
    return convertStringToQuery('kind:subscription')
  case 'HCMApplication':
    return convertStringToQuery('kind:application')
  default:
    return convertStringToQuery('kind:application')
  }
}

export const getQueryStringForResource = (resourcename, name, namespace) => {
  switch (resourcename) {
  case 'HCMChannel':
    return convertStringToQuery(
      `kind:channel name:${name} namespace:${namespace}`
    )
  case 'HCMSubscription':
    return convertStringToQuery(
      `kind:subscription name:${name} namespace:${namespace}`
    )
  case 'HCMApplication':
    return convertStringToQuery(
      `kind:application name:${name} namespace:${namespace}`
    )
  default:
    return convertStringToQuery(
      `kind:application name:${name} namespace:${namespace}`
    )
  }
}

export const fetchResources = resourceType => {
  const query = getQueryStringForResources(resourceType.name)
  return dispatch => {
    dispatch(requestResource(resourceType))
    return apolloClient
      .search(SEARCH_QUERY, { input: [query] })
      .then(response => {
        if (response.errors) {
          return dispatch(
            receiveResourceError(response.errors[0], resourceType)
          )
        }
        const itemRes =
          response &&
          response.data &&
          response.data.searchResult[0] &&
          response.data.searchResult[0].items
        const combinedQuery = []
        itemRes.map(item => {
          combinedQuery.push(
            getQueryStringForResource(
              resourceType.name,
              item.name,
              item.namespace
            )
          )
        })
        return dispatch(fetchResourcesInBulk(resourceType, combinedQuery))
      })
      .catch(err => {
        dispatch(receiveResourceError(err, resourceType))
      })
  }
}

export const fetchResource = (resourceType, namespace, name) => {
  const query = getQueryStringForResource(resourceType.name, name, namespace)
  return dispatch => {
    dispatch(requestResource(resourceType))
    return apolloClient
      .search(SEARCH_QUERY_RELATED, { input: [query] })
      .then(response => {
        if (response.errors) {
          return dispatch(
            receiveResourceError(response.errors[0], resourceType)
          )
        }
        return dispatch(
          receiveResourceSuccess(
            {
              items: mapSingleApplication(
                lodash.cloneDeep(response.data.searchResult[0])
              )
            },
            resourceType
          )
        )
      })
      .catch(err => {
        dispatch(receiveResourceError(err, resourceType))
      })
  }
}

export const fetchResourcesInBulk = (resourceType, bulkquery) => {
  return dispatch => {
    dispatch(requestResource(resourceType))
    return apolloClient
      .search(SEARCH_QUERY_RELATED, { input: bulkquery })
      .then(response => {
        if (response.errors) {
          return dispatch(
            receiveResourceError(response.errors[0], resourceType)
          )
        }
        const dataClone = lodash.cloneDeep(response.data.searchResult)
        let result = false
        if (resourceType.name === 'HCMChannel') {
          result = mapBulkChannels(dataClone)
        } else if (resourceType.name === 'HCMApplication') {
          result = mapBulkApplications(dataClone)
        } else if (resourceType.name === 'HCMSubscription') {
          result = mapBulkSubscriptions(dataClone)
        } else if (resourceType.name === 'CEMIncidentList') {
          result = dataClone
        } else {
          result = dataClone
        }
        return dispatch(
          receiveResourceSuccess({ items: result }, resourceType)
        )
      })
      .catch(err => {
        dispatch(receiveResourceError(err, resourceType))
      })
  }
}

export const fetchIncidents = (resourceType, namespace, name) => {
  return dispatch => {
    dispatch(requestResource(resourceType))
    return apolloClient
      .getResource(resourceType, { namespace, name })
      .then(response => {
        if (response.errors) {
          return dispatch(
            receiveResourceError(response.errors[0], resourceType)
          )
        }
        return dispatch(
          receiveResourceSuccess(
            { items: lodash.cloneDeep(response.data.items) },
            resourceType
          )
        )
      })
      .catch(err => dispatch(receiveResourceError(err, resourceType)))
  }
}

//fetch containers for selected pod
export const fetchContainersForPod = (selfLink, namespace, name, cluster) => {
  return dispatch => {
    dispatch(requestResource(resourceType))
    return apolloClient
      .search(GET_RESOURCE, {
        selfLink: selfLink,
        namespace: namespace,
        kind: 'PODS',
        name: name,
        cluster: cluster
      })
      .then(response => {
        if (response.errors) {
          return dispatch(
            receiveResourceError(response.errors[0], resourceType)
          )
        }
        return dispatch(
          receiveResourceSuccess(
            { items: lodash.cloneDeep(response.data.searchResult[0].items) },
            resourceType
          )
        )
      })
      .catch(err => {
        dispatch(receiveResourceError(err, resourceType))
      })
  }
}

export const updateResourceLabels = (
  resourceType,
  namespace,
  name,
  labels,
  selfLink
) => {
  return dispatch => {
    dispatch(putResource(resourceType))
    return apolloClient
      .updateResourceLabels(
        resourceType.name,
        namespace,
        name,
        labels,
        selfLink,
        '/metadata/labels'
      )
      .then(response => {
        if (response.errors) {
          return dispatch(receivePutError(response.errors[0], resourceType))
        }
        dispatch(fetchResources(resourceType))
        dispatch(updateModal({ open: false, type: 'label-editing' }))
        return dispatch(receivePutResource(resourceType))
      })
      .catch(err => dispatch(receivePutError(err, resourceType)))
  }
}

export const editResource = (
  resourceType,
  namespace,
  name,
  body,
  selfLink,
  resourcePath
) => dispatch => {
  dispatch(putResource(resourceType))
  return apolloClient
    .updateResource(
      resourceType.name,
      namespace,
      name,
      body,
      selfLink,
      resourcePath
    )
    .then(response => {
      if (response.errors) {
        return dispatch(receivePutError(response.errors[0], resourceType))
      } else {
        dispatch(updateModal({ open: false, type: 'resource-edit' }))
      }
      dispatch(fetchResources(resourceType))
      return dispatch(receivePutResource(response, resourceType))
    })
}

export const removeResource = (resourceType, vars) => async dispatch => {
  dispatch(delResource(resourceType))
  try {
    const response = await apolloClient.remove(resourceType, vars)
    if (response.errors) {
      return dispatch(receiveDelError(response.errors, resourceType))
    }
    dispatch(receiveDelResource(response, resourceType, vars))
  } catch (err) {
    return dispatch(receiveDelError(err, resourceType))
  }
}

export const updateSecondaryHeader = (title, tabs, breadcrumbItems, links) => ({
  type: Actions.SECONDARY_HEADER_UPDATE,
  title,
  tabs,
  breadcrumbItems,
  links
})

export const updateModal = data => ({
  type: Actions.MODAL_UPDATE,
  data
})

export const postResource = resourceType => ({
  // TODO: Consider renaming
  type: Actions.POST_REQUEST,
  postStatus: Actions.REQUEST_STATUS.IN_PROGRESS,
  resourceType
})

export const receivePostResource = (item, resourceType) => ({
  type: Actions.POST_RECEIVE_SUCCESS,
  postStatus: Actions.REQUEST_STATUS.DONE,
  resourceType: item.kind || resourceType,
  item
})

export const receivePostError = (err, resourceType) => ({
  type: Actions.POST_RECEIVE_FAILURE,
  postStatus: Actions.REQUEST_STATUS.ERROR,
  err,
  resourceType
})

export const putResource = resourceType => ({
  // TODO: Consider renaming
  type: Actions.PUT_REQUEST,
  putStatus: Actions.REQUEST_STATUS.IN_PROGRESS,
  resourceType
})

export const receivePutResource = (item, resourceType) => {
  return {
    type: Actions.PUT_RECEIVE_SUCCESS,
    putStatus: Actions.REQUEST_STATUS.DONE,
    resourceType: item.kind || resourceType,
    item
  }
}

export const receivePutError = (err, resourceType) => ({
  type: Actions.PUT_RECEIVE_FAILURE,
  putStatus: Actions.REQUEST_STATUS.ERROR,
  err,
  resourceType
})

export const delResource = resourceType => ({
  // TODO: Consider renaming
  type: Actions.DEL_REQUEST,
  delStatus: Actions.REQUEST_STATUS.IN_PROGRESS,
  resourceType
})

export const receiveDelResource = (item, resourceType, resource) => ({
  type: Actions.DEL_RECEIVE_SUCCESS,
  delStatus: Actions.REQUEST_STATUS.DONE,
  resourceType: item.kind || resourceType,
  item,
  resource
})

export const receiveDelError = (err, resourceType) => ({
  type: Actions.DEL_RECEIVE_FAILURE,
  delStatus: Actions.REQUEST_STATUS.ERROR,
  err,
  resourceType
})

export const clearRequestStatus = resourceType => ({
  type: Actions.CLEAR_REQUEST_STATUS,
  resourceType: resourceType
})

export const resetResource = resourceType => ({
  type: Actions.RESOURCE_RESET,
  resourceType: resourceType
})

export const createResources = (resourceType, resourceJson) => {
  return dispatch => {
    dispatch(mutateResource(resourceType))
    return apolloClient.createResources(resourceJson).then(result => {
      if (
        result.data.createResources.errors &&
        result.data.createResources.errors.length > 0
      ) {
        dispatch(
          mutateResourceFailure(
            resourceType,
            result.data.createResources.errors[0]
          )
        )
      } else {
        dispatch(mutateResourceSuccess(resourceType))
      }
      return result
    })
  }
}

export const createResource = (resourceType, variables) => {
  return dispatch => {
    dispatch(postResource(resourceType))
    return apolloClient
      .createResource(resourceType, variables)
      .then(response => {
        if (response.errors) {
          return dispatch(receivePostError(response.errors[0], resourceType))
        }

        return dispatch(
          receivePostResource(
            lodash.cloneDeep(response.data.setHelmRepo),
            resourceType
          )
        )
      })
      .catch(err => dispatch(receivePostError(err, resourceType)))
  }
}

export const createPolicy = (resourceType, resourceJson) => {
  return dispatch => {
    dispatch(mutateResource(resourceType))
    return apolloClient.createPolicy(resourceJson).then(result => {
      if (result.errors && result.errors.length > 0) {
        dispatch(mutateResourceFailure(resourceType, result.errors[0]))
      } else {
        dispatch(mutateResourceSuccess(resourceType))
      }
      return result
    })
  }
}

export const createCompliance = (resourceType, resourceJson) => {
  return dispatch => {
    dispatch(mutateResource(resourceType))
    return apolloClient.createCompliance(resourceJson).then(result => {
      if (result.errors && result.errors.length > 0) {
        dispatch(mutateResourceFailure(resourceType, result.errors[0]))
      } else {
        dispatch(mutateResourceSuccess(resourceType))
      }
      return result
    })
  }
}
