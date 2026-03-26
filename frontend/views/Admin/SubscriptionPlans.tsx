import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ICONS } from '../../constants';
import { apiService } from '../../services/apiService';
import { AdminPlan, UserRole } from '../../types';
import { Button, Card, Modal, Input } from '../../components/Shared';
import { useUser } from '../../context/UserContext';
import { PricingPlansGrid } from '../../components/PricingPlansGrid';
import { formatLimitValue } from '../../utils/pricingPlans';

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
  promotions?: { max_promoted_events: number; promotion_duration_days: number };
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
};const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none ${enabled ? 'bg-[#38BDF2]' : 'bg-[#2E2E2F]/20'}`}
  >
    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);
const parseNumeric = (value: string, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const toDraft = (plan: AdminPlan): PlanDraft => ({
  name: plan.name || '',
  description: plan.description || '',
  monthlyPrice: Number(plan.monthlyPrice || 0),
  yearlyPrice: Number(plan.yearlyPrice || 0),
  trialDays: Number(plan.trialDays || 0),
  isDefault: !!plan.isDefault,
  isRecommended: !!plan.isRecommended,
  isActive: !!plan.isActive,
  features: {
    enable_custom_branding: !!(plan.features?.enable_custom_branding || (plan.features as any)?.custom_branding),
    enable_discount_codes: !!(plan.features?.enable_discount_codes || (plan.features as any)?.discount_codes),
    enable_advanced_reports: !!(plan.features?.enable_advanced_reports || (plan.features as any)?.advanced_reports),
    enable_priority_support: !!(plan.features?.enable_priority_support || (plan.features as any)?.priority_support),
  },
  limits: {
    max_staff_accounts: plan.limits?.max_staff_accounts ?? 0,
    max_attendees_per_month: plan.limits?.max_attendees_per_month ?? 0,
    email_quota_per_day: plan.limits?.email_quota_per_day ?? 500,
    max_priced_events: plan.limits?.max_priced_events ?? 0,
  },
  promotions: {
    max_promoted_events: (plan as any)?.promotions?.max_promoted_events ?? 0,
    promotion_duration_days: (plan as any)?.promotions?.promotion_duration_days ?? 7,
  },
});

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

export const SubscriptionPlans: React.FC = () => {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [draft, setDraft] = useState<PlanDraft>(defaultDraft);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useUser();
  const isAdmin = role === UserRole.ADMIN;

  const loadPlans = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const data = await apiService.getAdminPlans();
      setPlans(data);
    } catch (error: any) {
      setNotification({ type: 'error', message: error?.message || 'Failed to load plans.' });
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans(true);
  }, []);

  // Open the plan modal automatically when ?openPlanModal=1 is present
  useEffect(() => {
    const shouldOpen = searchParams.get('openPlanModal');
    if (shouldOpen) {
      openAddModal();
      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete('openPlanModal');
      setSearchParams(cleaned, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notification]);

  const openEditModal = (plan: AdminPlan) => {
    setEditingPlan(plan);
    setDraft(toDraft(plan));
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingPlan(null);
    setDraft(defaultDraft);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingPlan(null);
    setDraft(defaultDraft);
  };

  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('hide-admin-ui');
    } else {
      document.body.classList.remove('hide-admin-ui');
    }
    return () => document.body.classList.remove('hide-admin-ui');
  }, [isModalOpen]);

  const handleToggleActive = async (plan: AdminPlan) => {
    try {
      await apiService.updateAdminPlanStatus(plan.planId, !plan.isActive);
      await loadPlans(false);
      setNotification({ type: 'success', message: 'Plan status updated.' });
    } catch (error: any) {
      setNotification({ type: 'error', message: error?.message || 'Failed to update plan status.' });
    }
  };

  const handleDeletePlan = async (plan: AdminPlan) => {
    if (plan.isDefault) {
      setNotification({ type: 'error', message: 'Default plan cannot be deleted.' });
      return;
    }
    if (!window.confirm(`Delete plan "${plan.name}"?`)) return;

    try {
      await apiService.deleteAdminPlan(plan.planId);
      await loadPlans(false);
      setNotification({ type: 'success', message: 'Plan deleted.' });
    } catch (error: any) {
      setNotification({ type: 'error', message: error?.message || 'Failed to delete plan.' });
    }
  };

  const handleSavePlan = async () => {
    if (!draft.name.trim()) {
      setNotification({ type: 'error', message: 'Plan name is required.' });
      return;
    }

    try {
      setSubmitting(true);
      const payload = toPayload(draft);
      let saved: AdminPlan;

      if (editingPlan?.planId) {
        saved = await apiService.updateAdminPlan(editingPlan.planId, payload);
        await loadPlans(false);
        setNotification({ type: 'success', message: 'Plan updated.' });
      } else {
        saved = await apiService.createAdminPlan(payload);
        await loadPlans(false);
        setNotification({ type: 'success', message: 'Plan created.' });
      }

      closeModal();
    } catch (error: any) {
      setNotification({ type: 'error', message: error?.message || 'Failed to save plan.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-10 text-sm font-semibold text-[#2E2E2F]/60">Loading plans...</div>;
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      {notification && (
        <Card className={`px-5 py-4 rounded-xl border ${notification.type === 'success' ? 'bg-[#38BDF2]/20 border-[#38BDF2]/40 text-[#2E2E2F]' : 'bg-[#2E2E2F]/10 border-[#2E2E2F]/30 text-[#2E2E2F]'}`}>
          <p className="font-bold text-sm tracking-tight">{notification.message}</p>
        </Card>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <label className="block text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] mb-3 ml-1">Pricing Plans</label>
          <div className="bg-[#F2F2F2] p-1 rounded-xl border border-[#2E2E2F]/10 flex items-center self-start">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`min-h-[32px] px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors ${billingCycle === 'monthly' ? 'bg-[#38BDF2] text-[#F2F2F2]' : 'bg-[#F2F2F2] text-[#2E2E2F] hover:bg-[#2E2E2F] hover:text-[#F2F2F2]'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`min-h-[32px] px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-[#38BDF2] text-[#F2F2F2]' : 'bg-[#F2F2F2] text-[#2E2E2F] hover:bg-[#2E2E2F] hover:text-[#F2F2F2]'}`}
            >
              Yearly
              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${billingCycle === 'yearly' ? 'bg-[#F2F2F2] text-[#38BDF2]' : 'bg-[#38BDF2] text-white'}`}>SAVE 20%</span>
            </button>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={openAddModal} className="rounded-xl px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-[#38BDF2]/20 active:scale-95 transition-transform">
            <span className="flex items-center gap-2">
              <ICONS.Plus className="w-3.5 h-3.5" strokeWidth={3} />
              Add New Plan
            </span>
          </Button>
        )}
      </div>

      <PricingPlansGrid
        plans={plans}
        billingCycle={billingCycle}
        showBillingToggle={false}
        isAdmin={isAdmin}
        onPlanAction={isAdmin ? openEditModal : undefined}
        onDelete={handleDeletePlan}
        onToggleActive={handleToggleActive}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingPlan ? 'Edit Pricing Plan' : 'Create New Pricing Plan'}
        subtitle={editingPlan ? `Editing: ${editingPlan.name}` : 'Set up a new subscription plan for organizers'}
        size="xl"
        zoom
      >
        <div className="space-y-12 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-3 ml-1">Plan Details & Pricing</label>
                <div className="space-y-6">
                  <Input
                    label="Plan Name"
                    value={draft.name}
                    placeholder="e.g. Enterprise Tier"
                    onChange={(e: any) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Monthly Price"
                      type="number"
                      value={draft.monthlyPrice}
                      placeholder="0"
                      onChange={(e: any) => setDraft((prev) => ({ ...prev, monthlyPrice: Math.max(0, parseNumeric(e.target.value, 0)) }))}
                    />
                    <Input
                      label="Yearly Price"
                      type="number"
                      value={draft.yearlyPrice}
                      placeholder="0"
                      onChange={(e: any) => setDraft((prev) => ({ ...prev, yearlyPrice: Math.max(0, parseNumeric(e.target.value, 0)) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest ml-1">Description</label>
                    <textarea
                      className="block w-full px-5 py-4 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/30 transition-all font-bold text-sm min-h-[140px] resize-none text-[#2E2E2F]"
                      placeholder="Describe what this plan includes..."
                      value={draft.description}
                      onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-3 ml-1">Plan Limits & Promotions</label>
                <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                  <Input label="Max Promoted Event Slots" type="number" value={draft.promotions?.max_promoted_events ?? 0} onChange={(e: any) => setDraft((prev) => ({ ...prev, promotions: { ...prev.promotions, max_promoted_events: Math.max(0, parseNumeric(e.target.value, 0)) } }))} />
                  <Input label="Promoted Event Duration (Days)" type="number" value={draft.promotions?.promotion_duration_days ?? 0} onChange={(e: any) => setDraft((prev) => ({ ...prev, promotions: { ...prev.promotions, promotion_duration_days: Math.max(0, parseNumeric(e.target.value, 0)) } }))} />
                  <Input label="Max Staff Accounts" type="number" value={draft.limits.max_staff_accounts} onChange={(e: any) => setDraft((prev) => ({ ...prev, limits: { ...prev.limits, max_staff_accounts: parseNumeric(e.target.value, 0) } }))} />
                  <Input label="Max Paid Events" type="number" value={draft.limits.max_priced_events} onChange={(e: any) => setDraft((prev) => ({ ...prev, limits: { ...prev.limits, max_priced_events: Math.max(0, parseNumeric(e.target.value, 0)) } }))} />
                  <Input label="Monthly Attendees" type="number" value={draft.limits.max_attendees_per_month} onChange={(e: any) => setDraft((prev) => ({ ...prev, limits: { ...prev.limits, max_attendees_per_month: parseNumeric(e.target.value, 0) } }))} />
                  {/* Free Trial Days input removed */}
                  <Input label="Daily Email Quota" type="number" value={(draft.limits.email_quota_per_day as any) || 500} onChange={(e: any) => setDraft((prev) => ({ ...prev, limits: { ...prev.limits, email_quota_per_day: Math.max(0, parseNumeric(e.target.value, 500)) } }))} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <label className="block text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] ml-1">Plan Features</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: 'branding',
                  label: 'Custom Branding',
                  desc: 'Allow organizers to use their own brand colors and logo',
                  enabled: draft.features.enable_custom_branding,
                  onToggle: (value: boolean) => setDraft((prev) => ({ ...prev, features: { ...prev.features, enable_custom_branding: value } })),
                },
                {
                  id: 'discount',
                  label: 'Discount Codes',
                  desc: 'Enable creation of promotional codes for events',
                  enabled: draft.features.enable_discount_codes,
                  onToggle: (value: boolean) => setDraft((prev) => ({ ...prev, features: { ...prev.features, enable_discount_codes: value } })),
                },
                {
                  id: 'reports',
                  label: 'Advanced Reports',
                  desc: 'Unlocks deeper analytics and exportable reports',
                  enabled: draft.features.enable_advanced_reports,
                  onToggle: (value: boolean) => setDraft((prev) => ({ ...prev, features: { ...prev.features, enable_advanced_reports: value } })),
                },
                {
                  id: 'support',
                  label: 'Priority Support',
                  desc: 'Guaranteed faster response times for support requests',
                  enabled: draft.features.enable_priority_support,
                  onToggle: (value: boolean) => setDraft((prev) => ({ ...prev, features: { ...prev.features, enable_priority_support: value } })),
                },
                {
                  id: 'default',
                  label: 'Default Plan',
                  desc: 'Automatically assign this plan to new users',
                  enabled: draft.isDefault,
                  onToggle: (value: boolean) => setDraft((prev) => ({ ...prev, isDefault: value })),
                },
                {
                  id: 'recommended',
                  label: 'Mark as Recommended',
                  desc: 'Highlight this plan as the preferred choice',
                  enabled: draft.isRecommended,
                  onToggle: (value: boolean) => setDraft((prev) => ({ ...prev, isRecommended: value })),
                },
                {
                  id: 'active',
                  label: 'Plan Status',
                  desc: 'Make this plan available or unavailable for purchase',
                  enabled: draft.isActive,
                  onToggle: (value: boolean) => setDraft((prev) => ({ ...prev, isActive: value })),
                },
              ].map((toggle) => (
                <div key={toggle.id} className="flex items-center justify-between p-6 rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/5 group/modal-toggle hover:border-[#38BDF2]/20 transition-all">
                  <div>
                    <p className="text-[13px] font-black text-[#2E2E2F] uppercase tracking-tight">{toggle.label}</p>
                    <p className="text-[10px] text-[#2E2E2F]/50 font-bold uppercase tracking-widest mt-0.5">{toggle.desc}</p>
                  </div>
                  <Toggle enabled={toggle.enabled || false} onChange={toggle.onToggle} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 pt-10 border-t border-[#2E2E2F]/5">
            <Button
              variant="outline"
              onClick={closeModal}
              className="flex-1 rounded-xl py-4 !bg-[#F2F2F2] !text-[#2E2E2F] border-[#2E2E2F]/10 hover:!bg-[#E0E0E0] font-black text-[11px] uppercase tracking-widest"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSavePlan()}
              className="flex-[2] rounded-xl py-4 shadow-2xl shadow-[#38BDF2]/30 font-black text-[11px] uppercase tracking-[0.2em]"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : (editingPlan ? 'Save Changes' : 'Create Plan')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

