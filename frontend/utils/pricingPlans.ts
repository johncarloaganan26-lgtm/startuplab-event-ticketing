import { AdminPlan } from '../types';

export type PlanBillingCycle = 'monthly' | 'yearly';

const isUnlimited = (value: number | string) => /^unlimited$/i.test(String(value ?? '').trim());

export const formatLimitValue = (value: number | string): string => {
  if (isUnlimited(value)) return 'Unlimited';

  if (typeof value === 'number') return value.toLocaleString();

  const raw = String(value ?? '').trim();
  if (!raw) return '0';
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw).toLocaleString();
  return raw;
};

export const formatPlanCurrency = (amount: number, currencyCode: string): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'PHP',
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `PHP ${amount.toLocaleString()}`;
  }
};

export const getPlanAmount = (plan: AdminPlan, billingCycle: PlanBillingCycle): number => {
  if (billingCycle === 'yearly') return Number(plan.yearlyPrice || 0);
  return Number(plan.monthlyPrice || 0);
};

export const getPlanValueItems = (plan: AdminPlan): string[] => {
  const items: string[] = [];

  // Limits
  if (plan.limits) {
    items.push(`${formatLimitValue(plan.limits.max_events)} Total Events`);
    items.push(`${formatLimitValue(plan.limits.max_active_events)} Active Events`);
    items.push(`${formatLimitValue(plan.limits.max_staff_accounts)} Staff Accounts`);
    items.push(`${formatLimitValue(plan.limits.max_attendees_per_month)} Monthly Attendees`);
    if (plan.limits.max_priced_events !== undefined) {
      items.push(`${formatLimitValue(plan.limits.max_priced_events)} Paid Events`);
    }
  }

  // Features
  if (plan.features) {
    if (plan.features.enable_custom_branding) items.push('Custom Branding');
    if (plan.features.enable_discount_codes) items.push('Discount Codes');
    if (plan.features.enable_advanced_reports) items.push('Advanced Reports');
    if (plan.features.enable_priority_support) items.push('Priority Support');
  }

  return items;
};

export const sortPlansForDisplay = (plans: AdminPlan[]): AdminPlan[] => {
  return [...plans].sort((a, b) => {
    if (!!a.isDefault !== !!b.isDefault) return a.isDefault ? -1 : 1;
    return Number(a.monthlyPrice || 0) - Number(b.monthlyPrice || 0);
  });
};
