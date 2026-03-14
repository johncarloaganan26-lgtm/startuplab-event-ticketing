import supabase from '../database/db.js';
import { logAudit } from '../utils/auditLogger.js';

const DEFAULT_FEATURES = {
  enable_custom_branding: false,
  enable_discount_codes: false,
  enable_advanced_reports: false,
  enable_priority_support: false,
};

const DEFAULT_LIMITS = {
  max_staff_accounts: 2,
  max_attendees_per_month: 100,
  email_quota_per_day: 500,
  max_priced_events: 0,
};

const DEFAULT_PROMOTIONS = {
  max_promoted_events: 0,
  promotion_duration_days: 7,
};

const FEATURE_KEYS = {
  enable_custom_branding: 'enable_custom_branding',
  enable_discount_codes: 'enable_discount_codes',
  enable_advanced_reports: 'enable_advanced_reports',
  enable_priority_support: 'enable_priority_support',
};

const LIMIT_KEYS = {
  max_staff_accounts: 'max_staff_accounts',
  max_attendees_per_month: 'max_attendees_per_month',
  email_quota_per_day: 'email_quota_per_day',
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

const slugify = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeStorage = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return DEFAULT_LIMITS.storage;
  return /\d/.test(raw) && !/[a-z]/i.test(raw) ? `${raw} GB` : raw;
};

const normalizePlanInput = (body = {}) => {
  const normalizedName = String(body.name || '').trim();
  const normalizedDescription = String(body.description || '').trim();
  const normalizedMonthlyPrice = Math.max(0, toNumber(body.monthlyPrice, 0));
  const normalizedYearlyPrice = Math.max(0, toNumber(body.yearlyPrice, 0));
  const normalizedTrialDays = Math.max(0, Math.floor(toNumber(body.trialDays, 0)));
  const normalizedCurrency = String(body.currency || 'PHP').trim().toUpperCase() || 'PHP';
  const normalizedBillingInterval =
    String(body.billingInterval || 'monthly').trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly';

  const features = {
    enable_custom_branding: toBoolean(body?.features?.enable_custom_branding, DEFAULT_FEATURES.enable_custom_branding),
    enable_discount_codes: toBoolean(body?.features?.enable_discount_codes, DEFAULT_FEATURES.enable_discount_codes),
    enable_advanced_reports: toBoolean(body?.features?.enable_advanced_reports, DEFAULT_FEATURES.enable_advanced_reports),
    enable_priority_support: toBoolean(body?.features?.enable_priority_support, DEFAULT_FEATURES.enable_priority_support),
  };

  const limits = {
    max_staff_accounts: body?.limits?.max_staff_accounts ?? DEFAULT_LIMITS.max_staff_accounts,
    max_attendees_per_month: body?.limits?.max_attendees_per_month ?? DEFAULT_LIMITS.max_attendees_per_month,
    email_quota_per_day: body?.limits?.email_quota_per_day ?? DEFAULT_LIMITS.email_quota_per_day,
    max_priced_events: body?.limits?.max_priced_events ?? body?.max_priced_events ?? DEFAULT_LIMITS.max_priced_events,
  };

  const promotions = {
    max_promoted_events: Math.max(0, Math.floor(toNumber(body?.promotions?.max_promoted_events, DEFAULT_PROMOTIONS.max_promoted_events))),
    promotion_duration_days: Math.max(1, Math.floor(toNumber(body?.promotions?.promotion_duration_days, DEFAULT_PROMOTIONS.promotion_duration_days))),
  };

  return {
    plan: {
      name: normalizedName,
      description: normalizedDescription || null,
      monthlyPrice: normalizedMonthlyPrice,
      yearlyPrice: normalizedYearlyPrice,
      priceAmount: normalizedBillingInterval === 'yearly' ? normalizedYearlyPrice : normalizedMonthlyPrice,
      currency: normalizedCurrency,
      billingInterval: normalizedBillingInterval,
      trialDays: normalizedTrialDays,
      isDefault: toBoolean(body.isDefault, false),
      isRecommended: toBoolean(body.isRecommended, false),
      isActive: toBoolean(body.isActive, true),
    },
    features,
    limits,
    promotions,
  };
};

const buildFeatureRows = (planId, features, limits, promotions) => [
  { planId, key: FEATURE_KEYS.enable_custom_branding, value: String(Boolean(features.enable_custom_branding)) },
  { planId, key: FEATURE_KEYS.enable_discount_codes, value: String(Boolean(features.enable_discount_codes)) },
  { planId, key: FEATURE_KEYS.enable_advanced_reports, value: String(Boolean(features.enable_advanced_reports)) },
  { planId, key: FEATURE_KEYS.enable_priority_support, value: String(Boolean(features.enable_priority_support)) },
  { planId, key: LIMIT_KEYS.max_staff_accounts, value: String(limits.max_staff_accounts ?? DEFAULT_LIMITS.max_staff_accounts) },
  { planId, key: LIMIT_KEYS.max_attendees_per_month, value: String(limits.max_attendees_per_month ?? DEFAULT_LIMITS.max_attendees_per_month) },
  { planId, key: LIMIT_KEYS.email_quota_per_day, value: String(limits.email_quota_per_day ?? DEFAULT_LIMITS.email_quota_per_day) },
  { planId, key: LIMIT_KEYS.max_priced_events, value: String(limits.max_priced_events ?? DEFAULT_LIMITS.max_priced_events) },
  { planId, key: PROMOTION_KEYS.max_promoted_events, value: String(promotions.max_promoted_events ?? DEFAULT_PROMOTIONS.max_promoted_events) },
  { planId, key: PROMOTION_KEYS.promotion_duration_days, value: String(promotions.promotion_duration_days ?? DEFAULT_PROMOTIONS.promotion_duration_days) },
];

const coerceLimitValue = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  if (/^unlimited$/i.test(raw)) return 'Unlimited';
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
};

const buildPlanResponse = (row, featureRows = []) => {
  const features = { ...DEFAULT_FEATURES };
  const limits = { ...DEFAULT_LIMITS };
  const promotions = { ...DEFAULT_PROMOTIONS };

  featureRows.forEach((item) => {
    if (!item) return;
    if (item.key === FEATURE_KEYS.enable_custom_branding) features.enable_custom_branding = toBoolean(item.value, false);
    if (item.key === FEATURE_KEYS.enable_discount_codes) features.enable_discount_codes = toBoolean(item.value, false);
    if (item.key === FEATURE_KEYS.enable_advanced_reports) features.enable_advanced_reports = toBoolean(item.value, false);
    if (item.key === FEATURE_KEYS.enable_priority_support) features.enable_priority_support = toBoolean(item.value, false);
    if (item.key === LIMIT_KEYS.max_staff_accounts) limits.max_staff_accounts = coerceLimitValue(item.value);
    if (item.key === LIMIT_KEYS.max_attendees_per_month) limits.max_attendees_per_month = coerceLimitValue(item.value);
    if (item.key === LIMIT_KEYS.email_quota_per_day) limits.email_quota_per_day = coerceLimitValue(item.value);
    if (item.key === LIMIT_KEYS.max_priced_events) limits.max_priced_events = coerceLimitValue(item.value);
    if (item.key === PROMOTION_KEYS.max_promoted_events) promotions.max_promoted_events = toNumber(item.value, DEFAULT_PROMOTIONS.max_promoted_events);
    if (item.key === PROMOTION_KEYS.promotion_duration_days) promotions.promotion_duration_days = toNumber(item.value, DEFAULT_PROMOTIONS.promotion_duration_days);
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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const fetchPlansWithFeatures = async () => {
  const { data: rows, error } = await supabase
    .from('plans')
    .select('*')
    .order('isDefault', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const planIds = rows.map((row) => row.planId);
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

  return rows.map((row) => buildPlanResponse(row, featureMap.get(row.planId) || []));
};

const clearExistingDefaultIfNeeded = async (isDefault, excludePlanId = null) => {
  if (!isDefault) return;
  let query = supabase
    .from('plans')
    .update({ isDefault: false, updated_at: new Date().toISOString() })
    .eq('isDefault', true);

  if (excludePlanId) query = query.neq('planId', excludePlanId);
  const { error } = await query;
  if (error) throw error;
};

const createUniqueSlug = async (name, preferredSlug = null) => {
  const base = slugify(preferredSlug || name) || `plan-${Date.now()}`;
  let candidate = base;
  for (let index = 0; index < 5; index += 1) {
    const { data, error } = await supabase
      .from('plans')
      .select('planId')
      .eq('slug', candidate)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return candidate;
    candidate = `${base}-${Date.now()}-${index + 1}`;
  }
  return `${base}-${Date.now()}`;
};

export const listAdminPlans = async (_req, res) => {
  try {
    const plans = await fetchPlansWithFeatures();
    return res.json({ plans });
  } catch (error) {
    console.error('listAdminPlans error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load plans' });
  }
};

export const createAdminPlan = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { plan, features, limits, promotions } = normalizePlanInput(req.body);
    if (!plan.name) return res.status(400).json({ error: 'Plan name is required.' });

    await clearExistingDefaultIfNeeded(plan.isDefault);

    const slug = await createUniqueSlug(plan.name, req.body?.slug);
    const now = new Date().toISOString();

    const { data: inserted, error: insertError } = await supabase
      .from('plans')
      .insert({
        name: plan.name,
        slug,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        priceAmount: plan.priceAmount,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        trialDays: plan.trialDays,
        isDefault: plan.isDefault,
        isRecommended: plan.isRecommended,
        isActive: plan.isActive,
        maxPricedEvents: toNumber(limits.max_priced_events, 0), // Sync native column
        features, // Sync JSONB column
        limits,   // Sync JSONB column
        promotions, // Sync JSONB column
        createdBy: userId,
        updated_at: now,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    const featureRows = buildFeatureRows(inserted.planId, features, limits, promotions);
    const { error: featureError } = await supabase
      .from('planFeatures')
      .upsert(featureRows, { onConflict: 'planId,key' });

    if (featureError) throw featureError;

    const responsePlan = buildPlanResponse(inserted, featureRows);

    await logAudit({
      actionType: 'PLAN_CREATED',
      details: { planId: inserted?.planId, planName: inserted?.name },
      req
    });

    return res.status(201).json({ plan: responsePlan });
  } catch (error) {
    console.error('createAdminPlan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create plan' });
  }
};

export const updateAdminPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    if (!planId) return res.status(400).json({ error: 'Plan ID is required.' });

    const { data: existing, error: lookupError } = await supabase
      .from('plans')
      .select('*')
      .eq('planId', planId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return res.status(404).json({ error: 'Plan not found.' });

    const { plan, features, limits, promotions } = normalizePlanInput({ ...existing, ...req.body });
    if (!plan.name) return res.status(400).json({ error: 'Plan name is required.' });

    await clearExistingDefaultIfNeeded(plan.isDefault, planId);
    const slug = req.body?.slug ? slugify(req.body.slug) : existing.slug;

    const { data: updated, error: updateError } = await supabase
      .from('plans')
      .update({
        name: plan.name,
        slug: slug || existing.slug,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        priceAmount: plan.priceAmount,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        trialDays: plan.trialDays,
        isDefault: plan.isDefault,
        isRecommended: plan.isRecommended,
        isActive: plan.isActive,
        maxPricedEvents: toNumber(limits.max_priced_events, 0), // Sync native column
        features, // Sync JSONB column
        limits,   // Sync JSONB column
        promotions, // Sync JSONB column
        updated_at: new Date().toISOString(),
      })
      .eq('planId', planId)
      .select('*')
      .single();
    if (updateError) throw updateError;

    const featureRows = buildFeatureRows(planId, features, limits, promotions);
    const { error: featureError } = await supabase
      .from('planFeatures')
      .upsert(featureRows, { onConflict: 'planId,key' });
    if (featureError) throw featureError;

    await logAudit({
      actionType: 'PLAN_UPDATED',
      details: { planId: updated?.planId, planName: updated?.name },
      req
    });

    return res.json({ plan: buildPlanResponse(updated, featureRows) });
  } catch (error) {
    console.error('updateAdminPlan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update plan' });
  }
};

export const updateAdminPlanStatus = async (req, res) => {
  try {
    const { planId } = req.params;
    const { isActive } = req.body || {};

    if (!planId) return res.status(400).json({ error: 'Plan ID is required.' });
    if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive must be boolean.' });

    const { data: updated, error } = await supabase
      .from('plans')
      .update({ isActive, updated_at: new Date().toISOString() })
      .eq('planId', planId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!updated) return res.status(404).json({ error: 'Plan not found.' });

    await logAudit({
      actionType: 'PLAN_STATUS_CHANGED',
      details: { planId: updated?.planId, planName: updated?.name, isActive: updated?.isActive },
      req
    });

    return res.json({ planId, isActive: updated.isActive });
  } catch (error) {
    console.error('updateAdminPlanStatus error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update plan status' });
  }
};

export const deleteAdminPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    if (!planId) return res.status(400).json({ error: 'Plan ID is required.' });

    const { data: existing, error: lookupError } = await supabase
      .from('plans')
      .select('planId, isDefault')
      .eq('planId', planId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return res.status(404).json({ error: 'Plan not found.' });
    if (existing.isDefault) return res.status(400).json({ error: 'Default plan cannot be deleted.' });

    const { error: deleteError } = await supabase
      .from('plans')
      .delete()
      .eq('planId', planId);
    if (deleteError) throw deleteError;

    await logAudit({
      actionType: 'PLAN_DELETED',
      details: { planId },
      req
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('deleteAdminPlan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete plan' });
  }
};
