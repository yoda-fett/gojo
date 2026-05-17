import './env.js';

import { initSentry } from './sentry.js';
import { registerHandler } from './workers/registry.js';
import { runWorker, registerShutdownHandlers } from './workers/run-worker.js';
import { handleTrialNudge } from './workers/trial-nudge.handler.js';
import { handleGracePeriodExpiry } from './workers/grace-period.handler.js';
import { handlePostTrialSocialProof, handlePostTrialSummary } from './workers/post-trial.handler.js';
import { handleApplyPendingDowngrade } from './workers/apply-pending-downgrade.handler.js';

initSentry();

// Register handlers before starting the worker.
registerHandler('TRIAL_NUDGE', handleTrialNudge);
registerHandler('GRACE_PERIOD_EXPIRY', handleGracePeriodExpiry);
registerHandler('POST_TRIAL_SUMMARY', handlePostTrialSummary);
registerHandler('POST_TRIAL_SOCIAL_PROOF', handlePostTrialSocialProof);
registerHandler('APPLY_PENDING_DOWNGRADE', handleApplyPendingDowngrade);

const worker = runWorker();

if (worker) {
  registerShutdownHandlers();
  console.info('api started (worker active)');
} else {
  console.info('api started (no worker — REDIS_URL unset)');
}
