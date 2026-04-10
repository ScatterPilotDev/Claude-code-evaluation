/**
 * Plan access utility — mirrors access_control.py logic on the frontend.
 * Use this wherever features need to be gated by subscription plan.
 */

export function canAccessFeature(billingStatus, feature) {
  const plan = billingStatus?.subscription_plan;
  const status = billingStatus?.subscription_status;

  // Trial gets Pro access
  if (status === 'trialing') return true;

  // Active, past_due, or canceled subscribers — check their plan
  const featureAccess = {
    remove_branding:   ['pro', 'agency'],
    reports:           ['pro', 'agency'],
    invoice_templates: ['pro', 'agency'],
    team_seats:        ['agency'],
    client_portal:     ['agency'],
    api_access:        ['agency'],
  };

  return featureAccess[feature]?.includes(plan) ?? false;
}
