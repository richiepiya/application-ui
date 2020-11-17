/*******************************************************************************
 * Copyright (c) 2020 Red Hat, Inc.
 *******************************************************************************/

const config = JSON.parse(Cypress.env("TEST_CONFIG"));
import {
  deleteNamespaceHub,
  deleteNamespaceTarget
} from "../../views/resources";

describe("Cleanup resouces Test", () => {
  const kubeconfigs = Cypress.env("KUBE_CONFIG");
  for (const type in config) {
    const apps = config[type].data;
    apps.forEach(data => {
      if (data.enable) {
        it(`[P1,Sev1,app-lifecycle-ui] Verify it deletes namespace ${
          data.name
        }-ns on hub cluster`, () => {
          deleteNamespaceHub(data, data.name, type);
        });
        it(`[P1,Sev1,app-lifecycle-ui] Verify it deletes namespace ${
          data.name
        }-ns on target cluster`, () => {
          kubeconfigs
            ? kubeconfigs.forEach(kubeconfig =>
                deleteNamespaceTarget(data.name, kubeconfig)
              )
            : cy.log("skipping - no kubeconfig defined");
        });
      } else {
        it(`disable deletion on resource ${data.name} ${type}`, () => {
          cy.log(`skipping ${type} - ${data.name}`);
        });
      }
    });
  }
});