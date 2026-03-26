import React, { useState } from 'react';
import { ICONS } from '../constants';
import { apiService } from '../services/apiService';
import { AdminPlan } from '../types';
import { Button, Modal, Input } from './Shared';

// ── Types ────────────────────────────────────────────────────────────────────
type PlanDraft = {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  isDefault: boolean;
  isRecommended: boolean;
  isActive: boolean;
  features: AdminPlan['features'];
  limits: AdminPlan['limits'];
  promotions: { max_promoted_events: number; promotion_duration_days: number };
};

const defaultDraft: PlanDraft = {
  name: '',
  description: '',
  monthlyPrice: 0,
  yearlyPrice: 0,
  trialDays: 0,
  isDefault: false,
  isRecommended: false,
  isActive: true,
  features: {
    enable_custom_branding: false,
    enable_discount_codes: false,
    enable_advanced_reports: false,
    enable_priority_support: false,
  },
  limits: {
    max_staff_accounts: 2,
    max_attendees_per_month: 100,
    email_quota_per_day: 500,
    max_priced_events: 0,
  },
  promotions: {
    max_promoted_events: 0,
    promotion_duration_days: 7,
  },
};

const parseNumeric = (value: string, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const toPayload = (draft: PlanDraft): Partial<AdminPlan> => ({
  name: draft.name.trim(),
  description: draft.description.trim(),
  monthlyPrice: Math.max(0, Number(draft.monthlyPrice || 0)),
  yearlyPrice: Math.max(0, Number(draft.yearlyPrice || 0)),
  trialDays: Math.max(0, Math.floor(Number(draft.trialDays || 0))),
  isDefault: !!draft.isDefault,
  isRecommended: !!draft.isRecommended,
  isActive: !!draft.isActive,
  features: {
    enable_custom_branding: !!draft.features.enable_custom_branding,
    custom_branding: !!draft.features.enable_custom_branding,
    enable_discount_codes: !!draft.features.enable_discount_codes,
    discount_codes: !!draft.features.enable_discount_codes,
    enable_advanced_reports: !!draft.features.enable_advanced_reports,
    advanced_reports: !!draft.features.enable_advanced_reports,
    enable_priority_support: !!draft.features.enable_priority_support,
    priority_support: !!draft.features.enable_priority_support,
  },
  limits: {
    max_staff_accounts: draft.limits.max_staff_accounts,
    max_attendees_per_month: draft.limits.max_attendees_per_month,
    email_quota_per_day: draft.limits.email_quota_per_day,
    max_priced_events: draft.limits.max_priced_events,
  },
  promotions: {
    max_promoted_events: Math.max(0, Math.floor(draft.promotions?.max_promoted_events ?? 0)),
    promotion_duration_days: Math.max(0, Math.floor(draft.promotions?.promotion_duration_days ?? 0)),
  },
});

// ── Toggle Component ─────────────────────────────────────────────────────────
const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none ${enabled ? 'bg-[#38BDF2]' : 'bg-[#2E2E2F]/20'}`}
  >
    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

// ── Props ────────────────────────────────────────────────────────────────────
type CreatePlanModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (plan: AdminPlan) => void;
};

// ── Component ────────────────────────────────────────────────────────────────
export const CreatePlanModal: React.FC<CreatePlanModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [draft, setDraft] = useState<PlanDraft>(defaultDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (submitting) return;
    setDraft(defaultDraft);
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setError('Plan name is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const saved = await apiService.createAdminPlan(toPayload(draft));
      setDraft(defaultDraft);
      onSuccess?.(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create plan.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFeatures = [
    {
      id: 'branding',
      label: 'Custom Branding',
      desc: 'Allow organizers to use brand colors and logos',
      enabled: draft.features.enable_custom_branding,
      onToggle: (v: boolean) => setDraft(p => ({ ...p, features: { ...p.features, enable_custom_branding: v } })),
    },
    {
      id: 'discount',
      label: 'Discount Codes',
      desc: 'Enable promotional codes for events',
      enabled: draft.features.enable_discount_codes,
      onToggle: (v: boolean) => setDraft(p => ({ ...p, features: { ...p.features, enable_discount_codes: v } })),
    },
    {
      id: 'reports',
      label: 'Advanced Reports',
      desc: 'Unlocks deeper analytics and exports',
      enabled: draft.features.enable_advanced_reports,
      onToggle: (v: boolean) => setDraft(p => ({ ...p, features: { ...p.features, enable_advanced_reports: v } })),
    },
    {
      id: 'support',
      label: 'Priority Support',
      desc: 'Faster response times for support',
      enabled: draft.features.enable_priority_support,
      onToggle: (v: boolean) => setDraft(p => ({ ...p, features: { ...p.features, enable_priority_support: v } })),
    },
    {
      id: 'default',
      label: 'Default Plan',
      desc: 'Auto-assign to new organizers',
      enabled: draft.isDefault,
      onToggle: (v: boolean) => setDraft(p => ({ ...p, isDefault: v })),
    },
    {
      id: 'recommended',
      label: 'Mark as Recommended',
      desc: 'Highlight as the preferred choice',
      enabled: draft.isRecommended,
      onToggle: (v: boolean) => setDraft(p => ({ ...p, isRecommended: v })),
    },
    {
      id: 'active',
      label: 'Plan Active',
      desc: 'Make available for purchase immediately',
      enabled: draft.isActive,
      onToggle: (v: boolean) => setDraft(p => ({ ...p, isActive: v })),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Pricing Plan"
      subtitle="Set up a new subscription plan for organizers"
      size="xl"
      zoom
    >
      <div className="space-y-10 py-4">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-600">
            {error}
          </div>
        )}

        {/* Plan Details & Limits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Left: Details & Pricing */}
          <div className="space-y-6">
            <label className="block text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-3 ml-1">
              Plan Details & Pricing
            </label>
            <Input
              label="Plan Name"
              value={draft.name}
              placeholder="e.g. Enterprise Tier"
              onChange={(e: any) => setDraft(p => ({ ...p, name: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Monthly Price"
                type="number"
                value={draft.monthlyPrice}
                placeholder="0"
                onChange={(e: any) => setDraft(p => ({ ...p, monthlyPrice: Math.max(0, parseNumeric(e.target.value, 0)) }))}
              />
              <Input
                label="Yearly Price"
                type="number"
                value={draft.yearlyPrice}
                placeholder="0"
                onChange={(e: any) => setDraft(p => ({ ...p, yearlyPrice: Math.max(0, parseNumeric(e.target.value, 0)) }))}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest ml-1">
                Description
              </label>
              <textarea
                className="block w-full px-5 py-4 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/30 transition-all font-bold text-sm min-h-[120px] resize-none text-[#2E2E2F]"
                placeholder="Describe what this plan includes..."
                value={draft.description}
                onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>

          {/* Right: Limits */}
          <div className="space-y-6">
            <label className="block text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-3 ml-1">
              Plan Limits & Promotions
            </label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Input
                label="Max Promoted Event Slots"
                type="number"
                value={draft.promotions?.max_promoted_events ?? 0}
                onChange={(e: any) => setDraft(p => ({ ...p, promotions: { ...p.promotions, max_promoted_events: Math.max(0, parseNumeric(e.target.value, 0)) } }))}
              />
              <Input
                label="Promotion Duration (Days)"
                type="number"
                value={draft.promotions?.promotion_duration_days ?? 7}
                onChange={(e: any) => setDraft(p => ({ ...p, promotions: { ...p.promotions, promotion_duration_days: Math.max(0, parseNumeric(e.target.value, 0)) } }))}
              />
              <Input
                label="Max Staff Accounts"
                type="number"
                value={draft.limits.max_staff_accounts}
                onChange={(e: any) => setDraft(p => ({ ...p, limits: { ...p.limits, max_staff_accounts: parseNumeric(e.target.value, 0) } }))}
              />
              <Input
                label="Max Paid Events"
                type="number"
                value={draft.limits.max_priced_events}
                onChange={(e: any) => setDraft(p => ({ ...p, limits: { ...p.limits, max_priced_events: Math.max(0, parseNumeric(e.target.value, 0)) } }))}
              />
              <Input
                label="Monthly Attendees"
                type="number"
                value={draft.limits.max_attendees_per_month}
                onChange={(e: any) => setDraft(p => ({ ...p, limits: { ...p.limits, max_attendees_per_month: parseNumeric(e.target.value, 0) } }))}
              />
              <Input
                label="Daily Email Quota"
                type="number"
                value={(draft.limits.email_quota_per_day as any) || 500}
                onChange={(e: any) => setDraft(p => ({ ...p, limits: { ...p.limits, email_quota_per_day: Math.max(0, parseNumeric(e.target.value, 500)) } }))}
              />
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="space-y-4">
          <label className="block text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] ml-1">
            Plan Features
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {toggleFeatures.map(toggle => (
              <div
                key={toggle.id}
                className="flex items-center justify-between p-5 rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/5 hover:border-[#38BDF2]/20 transition-all"
              >
                <div>
                  <p className="text-[13px] font-black text-[#2E2E2F] uppercase tracking-tight">{toggle.label}</p>
                  <p className="text-[10px] text-[#2E2E2F]/50 font-bold uppercase tracking-widest mt-0.5">{toggle.desc}</p>
                </div>
                <Toggle enabled={toggle.enabled || false} onChange={toggle.onToggle} />
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-8 border-t border-[#2E2E2F]/5">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 rounded-xl py-4 !bg-[#F2F2F2] !text-[#2E2E2F] border-[#2E2E2F]/10 hover:!bg-[#E0E0E0] font-black text-[11px] uppercase tracking-widest"
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            className="flex-[2] rounded-xl py-4 shadow-2xl shadow-[#38BDF2]/30 font-black text-[11px] uppercase tracking-[0.2em]"
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Plan'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
