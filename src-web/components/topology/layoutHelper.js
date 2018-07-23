/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2018. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 *******************************************************************************/
'use strict'

import cytoscape from 'cytoscape'
import cycola from 'cytoscape-cola'
import dagre from 'cytoscape-dagre'
import _ from 'lodash'
cytoscape.use( cycola )
cytoscape.use( dagre )

import { NODE_SIZE } from './constants.js'

const SECTION_ORDER = ['internet', 'host', 'service', 'controller', 'pod', 'container', 'unmanaged']

export default class LayoutHelper {
  /**
   * Helper class to be used by TopologyDiagram.
   *
   * Contains functions to manage sections.
   */
  layout = (nodes, links, cb) => {

    // for each cluster, group into sections
    // group by type
    const groups = this.getNodeGroups(nodes)

    // group by connections
    this.groupNodesByConnections(groups, links)

    // create sections
    var sections = this.createSections({x: 200, y:200}, groups)

    // layout sections
    const layoutBBox = this.setSectionLayouts(sections)

    // then layout all sections
    this.runSectionLayouts(sections, nodes, cb)
    return layoutBBox
  }

  getNodeGroups = (nodes) => {
    // separate into types
    const groupMap = {}
    const allNodeMap = {}
    const controllerMap = {}
    const controllerSet = new Set(['deployment', 'daemonset', 'statefulset'])
    nodes.forEach(node=>{
      allNodeMap[node.uid] = node
      const type = controllerSet.has(node.type) ? 'controller' : node.type
      let group = groupMap[type]
      if (!group) {
        group = groupMap[type] = {nodes:[]}
      }
      node.layout = Object.assign(node.layout || {}, {
        type: node.type,
        label: this.layoutLabel(node.name)
      }
      )
      switch (type) {
      case 'controller':
        Object.assign(node.layout, {
          qname: node.namespace+'/'+node.name,
          pods: [],
          services: []
        })
        controllerMap[node.layout.qname] = node
        break
      case 'pod':
        node.layout.qname = node.namespace+'/'+node.name.replace(/-[0-9a-fA-F]{8,10}-[0-9a-zA-Z]{4,5}$/, '')
        break
      case 'service':
        node.layout.qname = node.namespace+'/'+node.name.replace(/-service$/, '')
        break
      }
      group.nodes.push(node)
    })

    // combine pods into their controllers
    const controllerAsService = []
    if (groupMap['controller']) {
      if (groupMap['pod']) {
        let i=groupMap['pod'].nodes.length
        while(--i>=0) {
          const node = groupMap['pod'].nodes[i]
          const controller = controllerMap[node.layout.qname]
          if (controller) {
            controller.layout.pods.push(node)
            groupMap['pod'].nodes.splice(i,1)
            delete allNodeMap[node.uid]
            delete node.layout
          }
        }
      }

      if (groupMap['service']) {
        let i=groupMap['service'].nodes.length
        while(--i>=0) {
          const node = groupMap['service'].nodes[i]
          const controller = controllerMap[node.layout.qname]
          if (controller) {
            controller.layout.services.push(node)
            groupMap['service'].nodes.splice(i,1)
            controllerAsService.push(node.layout.qname)
            delete allNodeMap[node.uid]
            delete node.layout
          }
        }
      }

      groupMap['controller'].nodes.forEach(controller=>{
        const {type, layout} = controller
        if (layout.pods.length) {
          layout.info = `${type} of ${layout.pods.length} pods`
        }
      })
    }

    // show controllers as services
    controllerAsService.forEach(qname=>{
      var inx = groupMap['controller'].nodes.findIndex(({layout})=>{
        return layout.qname === qname
      })
      if (inx!==-1) {
        const controller = groupMap['controller'].nodes.splice(inx,1)[0]
        controller.layout.type = 'service'
        groupMap['service'].nodes.push(controller)
      }
    })

    return {nodeGroups: groupMap, allNodeMap}
  }

  groupNodesByConnections = (groups, links) => {
    const {nodeGroups, allNodeMap} = groups
    const sourceMap = {}
    const targetMap = {}
    const anyConnectedSet = new Set()
    links
      .filter(link=>{
        return (link.source && link.target && allNodeMap[link.source] && allNodeMap[link.target])
      })
      .forEach(link=>{
        // all sources of this target
        let sources = sourceMap[link.target]
        if (!sources) {
          sources = sourceMap[link.target] = []
        }
        sources.push({source:link.source, link})

        // all targets of this source
        let targets = targetMap[link.source]
        if (!targets) {
          targets = targetMap[link.source] = []
        }
        targets.push({target:link.target, link})

        // anything that's connected
        anyConnectedSet.add(link.source)
        anyConnectedSet.add(link.target)
      })
    const connectedSet = new Set()
    SECTION_ORDER.forEach(type=>{
      if (nodeGroups[type]) {
        const group = nodeGroups[type]
        // sort nodes/links into sections
        const connected = nodeGroups[type].connected = []
        const unconnected = nodeGroups[type].unconnected = []

        // find the connected nodes
        group.nodes.forEach(node => {
          const {uid} = node
          // if this node is connected to anything start a new group
          if (!connectedSet.has(uid) && anyConnectedSet.has(uid)) {
            const grp = {
              nodeMap: {},
              edges: []
            }
            connected.push(grp)

            // then add everything connected to this node to this group
            this.groupNodesByConnectionsHelper(uid, grp, sourceMap, targetMap, connectedSet, allNodeMap)
          } else if (!anyConnectedSet.has(uid)) {
            unconnected.push(node)
          }
        })
      }
    })
  }

  groupNodesByConnectionsHelper = (node, grp, sourceMap, targetMap, connectedSet, allNodeMap) => {
    // already connected to another group??
    if (!connectedSet.has(node)) {
      connectedSet.add(node)
      grp.nodeMap[node] = allNodeMap[node]

      // any sources for this node??
      if (sourceMap[node]) {
        sourceMap[node].forEach(({link, source})=>{
          if (!connectedSet.has(source)) {
            // add link
            link.layout = {
              source: allNodeMap[link.source].layout,
              target: allNodeMap[link.target].layout
            }
            grp.edges.push(link)

            // reiterate until nothing else connected
            this.groupNodesByConnectionsHelper(source, grp, sourceMap, targetMap, connectedSet, allNodeMap)
          }
        })
      }

      // any targets for this node??
      if (targetMap[node]) {
        targetMap[node].forEach(({link, target})=>{
          if (!connectedSet.has(target)) {
            // add link
            link.layout = {
              source: allNodeMap[link.source].layout,
              target: allNodeMap[link.target].layout
            }
            grp.edges.push(link)

            // reiterate until nothing else connected
            this.groupNodesByConnectionsHelper(target, grp, sourceMap, targetMap, connectedSet, allNodeMap)
          }
        })
      }
    }
  }

  createSections = (center, groups) => {
    const {nodeGroups} = groups
    const sections = {connected:[], unconnected:[]}
    SECTION_ORDER.forEach(type=>{
      if (nodeGroups[type]) {
        const {connected, unconnected} = nodeGroups[type]
        connected.forEach(({nodeMap, edges})=>{
          const section = {elements: {nodes:[], edges:[]} }
          _.forOwn(nodeMap, (node, uid) => {
            node.layout.center = center
            section.elements.nodes.push({
              data: {
                id: uid,
                node
              }
            })
          })
          edges.forEach(edge=>{
            edge.layout.center = center
            section.elements.edges.push({
              data: edge
            })
          })
          sections.connected.push(section)
        })

        const section = {elements: {nodes:[]} }
        unconnected.forEach(node=>{
          node.layout.center =center
          section.elements.nodes.push({
            data: {
              id: node.uid,
              node
            }
          })
        })
        sections.unconnected.push(section)
      }
    })
    return sections
  }

  setSectionLayouts = (sections) => {
    const {connected, unconnected} = sections
    const connectedDim = this.setConnectedLayouts(connected)
    const unconnectedDim = this.setGridLayouts(unconnected)

    // move unconnected below connected
    unconnected.forEach(({options})=>{
      options.boundingBox.y1 += connectedDim.height
    })

    // center top over bottom
    if (connectedDim.width>unconnectedDim.width) {
      const dx = (connectedDim.width-unconnectedDim.width)/2
      unconnected.forEach(({options})=>{
        options.boundingBox.x1 += dx
      })
    } else {
      const dx = (unconnectedDim.width-connectedDim.width)/2
      connected.forEach(({options})=>{
        options.boundingBox.x1 += dx
      })
    }


    return {x:0, y:0,
      width:Math.max(connectedDim.width, unconnectedDim.width)+NODE_SIZE*2,
      height:connectedDim.height+unconnectedDim.height
    }
  }

  setConnectedLayouts = (connected) => {
    let x = 0
    let height = 0
    // get rough idea how many to allocate for each section based on # of nodes
    const columns = connected.map(section => {
      const count = section.elements.nodes.length
      return count<=3 ? 1 : (count<=6 ? 2 : (count<=12 ? 3 : (count<=24? 4:5)))
    })
    const sizes = columns.map(count => {
      return {w: count*NODE_SIZE*5, h: count*NODE_SIZE*2}
    })
    connected.forEach((section, index)=>{
      const {w, h} = sizes[index]
      const {elements} = section
      if (elements.edges) {
        section.options = {
          name: 'cola',
          boundingBox: {
            x1: x,
            y1: 0,
            w,
            h
          },
        }
      }
      height = Math.max(h, height)
      x+=w
    })
    return {width:x, height}
  }

  setGridLayouts = (unconnected) => {
    let x = 0
    let height = 0
    // get rough idea how many to allocate for each section based on # of nodes
    const columns = unconnected.map(section => {
      const count = section.elements.nodes.length
      return count<=9 ? 3 : (count<=12 ? 4 : (count<=18? 5:(count<=24? 6:(count<=30? 7:8))))
    })
    unconnected.forEach((section, index)=>{
      const count = section.elements.nodes.length
      const cols = Math.min(count, columns[index])
      const h = Math.ceil(count/columns[index])*NODE_SIZE*2
      const w = cols*NODE_SIZE*2
      const {elements} = section
      if (!elements.edges) {
        section.options = {
          name: 'grid',
          avoidOverlap: false, // prevents node overlap, may overflow boundingBox if not enough space
          boundingBox: {
            x1: x,
            y1: 0,
            w,
            h
          },
          sort: (a,b) => {
            const {node: nodea} = a.data()
            const {node: nodeb} = b.data()
            return nodea.layout.type.localeCompare(nodeb.layout.type)
          },
          cols
        }
      }
      height = Math.max(h, height)
      x+=w+NODE_SIZE
    })
    return {width:x, height}
  }

  runSectionLayouts = (sections, nodes, cb) => {
    // start headless cytoscape
    const cy = cytoscape({
      headless: true
    })

    // layout each sections
    const allSections = sections.connected.concat(sections.unconnected)
    let totalLayouts = allSections.length
    allSections.forEach(({elements, options})=>{
      const section = cy.add(elements)
      const layout = section.layout(options)
      layout.pon('layoutstop').then(()=>{
        section.forEach(ele=>{
          const data = ele.data()
          if (ele.isNode()) {
            Object.assign(data.node.layout, ele.position())
          } else {
            Object.assign(data.layout, {
              isLoop: ele.isLoop()
            })
          }
        })

        // after all sections laid out, move nodes/links
        totalLayouts--
        if (totalLayouts<=0) {
          nodes.forEach((n)=>{
            if (n.layout && n.layout.dragged) {
              const {layout} = n
              layout.x = layout.dragged.x
              layout.y = layout.dragged.y
            }
          })
          cb()
        }
      })
      layout.run()
    })
  }

  layoutLabel = (name) => {
    // replace any guid with {uid}
    let label = name.replace(/[0-9a-fA-F]{8,10}-[0-9a-zA-Z]{4,5}$/, '{uid}')

    // if too long, add elipse
    if (label.length>40) {
      label = label.substr(0, 15)+'...'+label.substr(-25)
    }

    // wrap the rest
    return this.wrapLabel(label)
  }

  wrapLabel = (label, width=18) => {
    if ((label.length - width) > 3) {
      let i=width
      while (i>0 && /[a-zA-Z\d]/.test(label[i])) {
        i--
      }
      if (i>0) {
        const left = label.substring(0, i)
        const right = label.substring(i+1)
        return left + label[i] +'\n' + this.wrapLabel(right, width)
      }
    }
    return label
  }

}
