import React from 'react';
import { ICONS } from '../constants';
import { AdminPlan } from '../types';
import { Button, Card } from './Shared';
import { PlanBillingCycle, formatPlanCurrency, getPlanAmount, sortPlansForDisplay, formatLimitValue } from '../utils/pricingPlans';

type PricingPlansGridProps = {
  plans: AdminPlan[];
  billingCycle: PlanBillingCycle;
  onBillingCycleChange?: (cycle: PlanBillingCycle) => void;
  showBillingToggle?: boolean;
  onPlanAction?: (plan: AdminPlan) => void;
  onDelete?: (plan: AdminPlan) => void;
  onToggleActive?: (plan: AdminPlan) => void;
  isAdmin?: boolean;
  actionLoadingPlanId?: string | null;
  currentPlanId?: string | null;
};

export const PricingPlansGrid: React.FC<PricingPlansGridProps> = ({
  plans,
  billingCycle,
  onBillingCycleChange,
  showBillingToggle = true,
  onPlanAction,
  onDelete,
  onToggleActive,
  isAdmin = false,
  actionLoadingPlanId = null,
  currentPlanId = null,
}) => {
  const visiblePlans = sortPlansForDisplay(plans);

  return (
    <>
      {showBillingToggle && onBillingCycleChange && (
        <div className="mb-12 flex justify-center">
          <div className="bg-[#F2F2F2] p-1.5 rounded-xl border border-[#2E2E2F]/10 flex items-center shadow-sm">
            <button
              type="button"
              onClick={() => onBillingCycleChange('monthly')}
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${billingCycle === 'monthly'
                ? 'bg-[#38BDF2] text-white shadow-lg shadow-[#38BDF2]/25'
                : 'text-[#2E2E2F]/60 hover:text-[#2E2E2F] hover:bg-[#EAEAEA]'
                }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => onBillingCycleChange('yearly')}
              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${billingCycle === 'yearly'
                ? 'bg-[#38BDF2] text-white shadow-lg shadow-[#38BDF2]/25'
                : 'text-[#2E2E2F]/60 hover:text-[#2E2E2F] hover:bg-[#EAEAEA]'
                }`}
            >
              Yearly
              <span className={`text-[8px] px-2 py-0.5 rounded-full ${billingCycle === 'yearly' ? 'bg-white/20 text-white' : 'bg-[#38BDF2]/10 text-[#38BDF2]'}`}>Save 20%</span>
            </button>
          </div>
        </div>
      )}

      {visiblePlans.length === 0 && (
        <Card className="p-10 text-center border-[#2E2E2F]/10 bg-[#F2F2F2]">
          <p className="text-sm font-bold text-[#2E2E2F]/40 uppercase tracking-widest">No active plans available right now.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-10">
        {visiblePlans.map((plan) => {
          const amount = getPlanAmount(plan, billingCycle);
          const isCurrentPlan = currentPlanId === plan.planId;
          const isProcessing = actionLoadingPlanId === plan.planId;

          const features = [
            { label: 'Custom Branding', enabled: (plan.features as any)?.enable_custom_branding || (plan.features as any)?.custom_branding },
            { label: 'Discount Codes', enabled: (plan.features as any)?.discount_codes || (plan.features as any)?.enable_discount_codes },
            { label: 'Advanced Reports', enabled: (plan.features as any)?.advanced_reports || (plan.features as any)?.enable_advanced_reports },
            { label: 'Priority Support', enabled: (plan.features as any)?.priority_support || (plan.features as any)?.enable_priority_support },
          ];

          const limits = [
            { label: 'Promoted Event Slots', val: (plan as any)?.promotions?.max_promoted_events || 0, icon: <ICONS.TrendingUp /> },
            { label: 'Promoted Event Duration', val: ((plan as any)?.promotions?.promotion_duration_days || 0) + ' days', icon: <ICONS.Calendar /> },
            { label: 'Staff Accounts', val: plan.limits?.max_staff_accounts || 0, icon: <ICONS.Users /> },
            { label: 'Monthly Attendees', val: plan.limits?.monthly_attendees || plan.limits?.max_attendees_per_month || 0, icon: <ICONS.Users /> },
            { label: 'Paid Events Limit', val: plan.limits?.max_priced_events || 0, icon: <ICONS.Zap /> },
            { label: 'Daily Email Quota', val: (plan.limits?.email_quota_per_day || 0) + ' emails/day', icon: <ICONS.Mail /> },
          ];

          return (
            <div key={plan.planId} className="relative group h-full pt-4 mt-[-1rem]">
              {!isCurrentPlan && plan.isRecommended && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 animate-in slide-in-from-top-4 duration-700 -translate-y-1/2">
                  <span className="bg-[#38BDF2] text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-black/30 border border-[#38BDF2] flex items-center gap-2 whitespace-nowrap">
                    <ICONS.CheckCircle className="w-4 h-4" />
                    Recommended
                  </span>
                </div>
              )}
              <Card className={`h-full flex flex-col border-2 border-[#2E2E2F]/15 rounded-xl bg-[#F2F2F2] text-[#2E2E2F] transition-all duration-500 hover:shadow-2xl hover:shadow-[#2E2E2F]/10 ${!isCurrentPlan && plan.isRecommended ? 'ring-2 ring-[#38BDF2] ring-offset-4 ring-offset-[#F2F2F2]' : ''}`}>
                <div className={`p-8 sm:p-10 flex-1 flex flex-col ${!isCurrentPlan && plan.isRecommended ? '' : 'pt-12'}`}>
                  {/* Top: Name and Description */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-3xl md:text-4xl lg:text-[42px] font-black tracking-tighter uppercase text-[#2E2E2F]">{plan.name}</h3>
                      {isCurrentPlan && (
                        <span className="bg-[#38BDF2] text-white text-[8px] sm:text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">ACTIVE</span>
                      )}
                    </div>
                    <p className="text-sm sm:text-base font-medium leading-tight text-[#2E2E2F]/60">
                      {plan.description || "The ideal solution for organizers looking to scale their event portfolio."}
                    </p>
                  </div>

                  {/* Price Section */}
                  <div className={`mb-10 p-6 sm:p-8 rounded-xl border-2 bg-[#F2F2F2]/30 border-[#2E2E2F]/10`}>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-5xl sm:text-6xl font-black tracking-tighter text-[#2E2E2F]">
                        ₱{Number(amount || 0).toLocaleString()}
                      </span>
                      <span className="text-xs font-black uppercase tracking-widest text-[#2E2E2F]/40">
                        /{billingCycle === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>
                    {billingCycle === 'yearly' && Number(amount) > 0 && (
                      <p className="text-[11px] font-bold mt-2 uppercase tracking-widest text-[#2E2E2F]/40">
                        Billed annually (₱{Number(plan.yearlyPrice).toLocaleString()} per year)
                      </p>
                    )}
                    {/* Trial days badge removed */}
                  </div>

                  {/* Consolidated Features & Limits - Dynamic Grid for compactness */}
                  <div className="flex flex-col gap-y-4 text-sm mb-12 text-[#2E2E2F]">
                    {[
                      { label: `${formatLimitValue(plan.limits?.max_priced_events || 0)} Max Paid Events`, enabled: true },
                      { label: `${formatLimitValue(plan.limits?.max_attendees_per_month || plan.limits?.monthly_attendees || 0)} Monthly Attendees`, enabled: true },
                      { label: `${formatLimitValue(plan.limits?.max_staff_accounts || 0)} Max Staff Accounts`, enabled: true },
                      { label: `${formatLimitValue((plan as any)?.promotions?.max_promoted_events || 0)} Max Promoted Event Slots`, enabled: true },
                      { label: `${formatLimitValue((plan as any)?.promotions?.promotion_duration_days || 0)} Promoted Event Duration (Days)`, enabled: true },
                      { label: `${formatLimitValue(plan.limits?.email_quota_per_day || 0)} Daily Email Quota`, enabled: true },
                      { label: 'Custom Branding', enabled: (plan.features as any)?.enable_custom_branding || (plan.features as any)?.custom_branding },
                      { label: 'Discount Codes', enabled: (plan.features as any)?.discount_codes || (plan.features as any)?.enable_discount_codes },
                      { label: 'Advanced Reports', enabled: (plan.features as any)?.enable_advanced_reports || (plan.features as any)?.advanced_reports },
                      { label: 'Priority Support', enabled: (plan.features as any)?.enable_priority_support || (plan.features as any)?.priority_support },
                    ].map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-3 group/feat">
                        <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                          feature.enabled 
                          ? 'bg-[#38BDF2]/20 text-[#38BDF2]'
                          : 'bg-[#2E2E2F]/5 text-[#2E2E2F]/20'
                        }`}>
                          {feature.enabled ? <ICONS.Check className="w-3.5 h-3.5" strokeWidth={5} /> : <ICONS.XCircle className="w-3.5 h-3.5 opacity-40" />}
                        </div>
                        <span className={`text-[12px] sm:text-[13px] font-bold tracking-tight leading-normal transition-colors ${
                          feature.enabled 
                          ? 'text-[#2E2E2F]'
                          : 'text-[#2E2E2F]/30'
                        }`}>
                          {feature.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Footer Action */}
                  <div className="mt-auto">
                    <Button
                      onClick={() => onPlanAction?.(plan)}
                      disabled={isCurrentPlan || (actionLoadingPlanId !== null && actionLoadingPlanId !== plan.planId)}
                      className={`w-full h-14 rounded-xl font-black text-[13px] uppercase tracking-[0.2em] transition-all duration-300 shadow-xl ${isCurrentPlan
                        ? '!bg-[#F2F2F2] !text-[#2E2E2F]/40 border border-[#2E2E2F]/5 shadow-none'
                        : 'bg-[#38BDF2] text-white hover:bg-[#2E2E2F] shadow-[#38BDF2]/20 hover:shadow-[#2E2E2F]/20'
                        }`}
                    >
                      {isProcessing
                        ? 'Processing...'
                        : isCurrentPlan
                          ? 'Current Plan'
                          : isAdmin
                            ? 'Configure Plan'
                            : plan.monthlyPrice === 0 || (billingCycle === 'yearly' && plan.yearlyPrice === 0)
                              ? 'Get Started Free'
                              : `Go ${plan.name}`
                      }
                    </Button>
                  </div>
                </div>

                {/* Admin Specific Footer: Toggle & Delete */}
                {isAdmin && (
                  <div className="px-8 py-5 bg-[#F2F2F2]/50 border-t-2 border-[#2E2E2F]/10 flex items-center justify-between rounded-b-[2.5rem]">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onToggleActive?.(plan)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none ${plan.isActive ? 'bg-[#38BDF2]' : 'bg-[#2E2E2F]/20'}`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out ${plan.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${plan.isActive ? 'text-[#38BDF2]' : 'text-[#2E2E2F]/40'}`}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {!plan.isDefault && (
                      <button
                        onClick={() => onDelete?.(plan)}
                        className="p-2 text-[#2E2E2F]/20 hover:text-red-500 transition-colors"
                        title="Delete Plan"
                      >
                        <ICONS.Trash className="w-4 h-4" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </>
  );
};

