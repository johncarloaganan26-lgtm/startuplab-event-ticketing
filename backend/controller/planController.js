import supabase from '../database/db.js';

const FEATURE_KEYS = {
  enable_custom_branding: 'enable_custom_branding',
  enable_discount_codes: 'enable_discount_codes',
  enable_advanced_reports: 'enable_advanced_reports',
  enable_priority_support: 'enable_priority_support',
};

const LIMIT_KEYS = {
  max_events: 'max_events',
  max_active_events: 'max_active_events',
  max_staff_accounts: 'max_staff_accounts',
  max_attendees_per_month: 'max_attendees_per_month',
  max_priced_events: 'max_priced_events',
};

const PROMOTION_KEYS = {
  max_promoted_events: 'max_promoted_events',
  promotion_duration_days: 'promotion_duration_days',
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const coerceLimitValue = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  if (/^unlimited$/i.test(raw)) return 'Unlimited';
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
};

const mapPlan = (row, featureRows = []) => {
  const features = {
    enable_custom_branding: false,
    enable_discount_codes: false,
    enable_advanced_reports: false,
    enable_priority_support: false,
  };
  const limits = {
    max_staff_accounts: 0,
    max_attendees_per_month: 0,
    email_quota_per_day: 500,
    max_priced_events: 0,
  };
  const promotions = {
    max_promoted_events: 0,
    promotion_duration_days: 7,
  };

  featureRows.forEach((item) => {
    if (!item) return;
    if (item.key === FEATURE_KEYS.enable_custom_branding) features.enable_custom_branding = toBoolean(item.value, false);
    if (item.key === FEATURE_KEYS.enable_discount_codes) features.enable_discount_codes = toBoolean(item.value, false);
    if (item.key === FEATURE_KEYS.enable_advanced_reports) features.enable_advanced_reports = toBoolean(item.value, false);
    if (item.key === FEATURE_KEYS.enable_priority_support) features.enable_priority_support = toBoolean(item.value, false);
    
    if (item.key === LIMIT_KEYS.max_events) limits.max_events = coerceLimitValue(item.value);
    if (item.key === LIMIT_KEYS.max_active_events) limits.max_active_events = coerceLimitValue(item.value);
    if (item.key === LIMIT_KEYS.max_staff_accounts) limits.max_staff_accounts = coerceLimitValue(item.value);
    if (item.key === LIMIT_KEYS.max_attendees_per_month) limits.max_attendees_per_month = coerceLimitValue(item.value);
    if (item.key === LIMIT_KEYS.max_priced_events) limits.max_priced_events = coerceLimitValue(item.value);
    if (item.key === 'email_quota_per_day') limits.email_quota_per_day = coerceLimitValue(item.value);

    if (item.key === PROMOTION_KEYS.max_promoted_events) promotions.max_promoted_events = toNumber(item.value, 0);
    if (item.key === PROMOTION_KEYS.promotion_duration_days) promotions.promotion_duration_days = toNumber(item.value, 7);
  });

  return {
    planId: row.planId,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    monthlyPrice: toNumber(row.monthlyPrice, 0),
    yearlyPrice: toNumber(row.yearlyPrice, 0),
    currency: row.currency || 'PHP',
    billingInterval: row.billingInterval || 'monthly',
    trialDays: Math.max(0, Math.floor(toNumber(row.trialDays, 0))),
    isDefault: !!row.isDefault,
    isRecommended: !!row.isRecommended,
    isActive: !!row.isActive,
    features,
    limits,
    promotions,
  };
};

export const listPublicPlans = async (_req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .eq('isActive', true)
      .order('monthlyPrice', { ascending: true });

    if (error) throw error;
    if (!plans || plans.length === 0) return res.json({ plans: [] });

    const planIds = plans.map((item) => item.planId);
    const { data: featureRows, error: featureError } = await supabase
      .from('planFeatures')
      .select('planId, key, value')
      .in('planId', planIds);

    if (featureError) throw featureError;

    const featureMap = new Map();
    (featureRows || []).forEach((item) => {
      if (!featureMap.has(item.planId)) featureMap.set(item.planId, []);
      featureMap.get(item.planId).push(item);
    });

    const mapped = plans.map((item) => mapPlan(item, featureMap.get(item.planId) || []));
    return res.json({ plans: mapped });
  } catch (error) {
    console.error('listPublicPlans error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load plans' });
  }
};
