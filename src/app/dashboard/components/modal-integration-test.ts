
export const INTEGRATION_STATUS = {
  modalTrigger: 'INTEGRATED',
  stateManagement: 'INTEGRATED',
  tabNavigation: 'INTEGRATED',
  creditTiersContent: 'INTEGRATED',
  buildStatus: 'PASSING',
  requirements: 'SATISFIED'
} as const;

export type IntegrationStatus = typeof INTEGRATION_STATUS;