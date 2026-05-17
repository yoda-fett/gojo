import servicesSubscriptionGate from './rules/services-subscription-gate.js';

const plugin = {
  meta: {
    name: 'eslint-plugin-mogojo',
    version: '0.0.0',
  },
  rules: {
    'services-subscription-gate': servicesSubscriptionGate,
  },
};

export default plugin;
