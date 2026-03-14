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
  actionLoadingPlanId?: string | null;
  currentPlanId?: string | null;
};

export const PricingPlansGrid: React.FC<PricingPlansGridProps> = ({
  plans,
  billingCycle,
  onBillingCycleChange,
  showBillingToggle = true,
  onPlanAction,
  actionLoadingPlanId = null,
  currentPlanId = null,
}) => {
  const visiblePlans = sortPlansForDisplay(plans);

  return (
    <>
      {showBillingToggle && onBillingCycleChange && (
        <div className="mb-12 flex justify-center">
          <div className="bg-[#F2F2F2] p-1.5 rounded-2xl border border-[#2E2E2F]/10 flex items-center shadow-sm">
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
            { label: 'Promoted Events', val: (plan as any)?.promotions?.max_promoted_events || 0, icon: <ICONS.TrendingUp /> },
            { label: 'Promo Duration', val: ((plan as any)?.promotions?.promotion_duration_days || 7) + ' days', icon: <ICONS.Calendar /> },
            { label: 'Staff Accounts', val: plan.limits?.max_staff_accounts || 0, icon: <ICONS.Users /> },
            { label: 'Monthly Attendees', val: plan.limits?.monthly_attendees || plan.limits?.max_attendees_per_month || 0, icon: <ICONS.Users /> },
            { label: 'Paid Events Limit', val: plan.limits?.max_priced_events || 0, icon: <ICONS.Zap /> },
            { label: 'Daily Email Quota', val: (plan.limits?.email_quota_per_day || 0) + ' emails/day', icon: <ICONS.Mail /> },
          ];

          return (
            <div key={plan.planId} className="relative group h-full pt-4 mt-[-1rem]">
              {!isCurrentPlan && plan.isRecommended && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 animate-in slide-in-from-top-4 duration-700">
                  <span className="bg-[#38BDF2] text-white px-5 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-[#38BDF2]/30 border border-white/20 flex items-center gap-2 whitespace-nowrap">
                    <ICONS.CheckCircle className="w-3.5 h-3.5" />
                    Recommended
                  </span>
                </div>
              )}
              <Card className={`h-full flex flex-col border-[#2E2E2F]/10 rounded-[2.5rem] bg-[#F2F2F2] transition-all duration-500 hover:shadow-2xl hover:shadow-[#2E2E2F]/10 ${!isCurrentPlan && plan.isRecommended ? 'ring-2 ring-[#38BDF2] ring-offset-4 ring-offset-[#F2F2F2]' : ''}`}>
                <div className="p-10 flex-1 flex flex-col">
                  {/* Top: Name and Icon */}
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-2xl font-black text-[#2E2E2F] tracking-tighter uppercase mb-2 leading-none">{plan.name}</h3>
                      <div className="flex gap-2">
                        {plan.isDefault && (
                          <span className="bg-[#38BDF2] text-white text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-sm shadow-[#38BDF2]/20">DEFAULT</span>
                        )}
                        {isCurrentPlan && (
                          <span className="bg-[#38BDF2] text-white text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-sm shadow-[#38BDF2]/20 flex items-center gap-1.5">
                            <div className="w-1 h-1 bg-white rounded-full"></div>
                            ACTIVE
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-[#38BDF2]/10 text-[#38BDF2] flex items-center justify-center shadow-inner">
                      <ICONS.CreditCard className="w-6 h-6" strokeWidth={2.5} />
                    </div>
                  </div>

                  {/* Price Section */}
                  <div className="mb-8">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black text-[#2E2E2F] tracking-tighter">
                        ₱{Number(amount || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em]">
                        / {billingCycle === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[13px] text-[#2E2E2F]/60 font-bold leading-relaxed mb-10 min-h-[3rem]">
                    {plan.description || (plan.monthlyPrice === 0 ? 'Free tier for starting out' : 'Professional features for growing organizers')}
                  </p>

                  <div className="space-y-10 mt-auto">
                    {/* Features */}
                    <div>
                      <label className="block text-[9px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em] mb-4 ml-1">Plan Features</label>
                      <div className="grid grid-cols-1 gap-3">
                        {features.map((feature, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-[#F2F2F2]/50 border border-[#2E2E2F]/5 group/feat transition-all hover:border-[#38BDF2]/30 hover:shadow-sm">
                            <span className={`text-[11px] font-black uppercase tracking-widest ${feature.enabled ? 'text-[#2E2E2F]' : 'text-[#2E2E2F]/30'}`}>{feature.label}</span>
                            {feature.enabled ? (
                              <div className="w-6 h-6 rounded-lg bg-[#38BDF2]/10 text-[#38BDF2] flex items-center justify-center">
                                <ICONS.CheckCircle className="w-4 h-4" strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-lg bg-[#2E2E2F]/5 text-[#2E2E2F]/20 flex items-center justify-center">
                                <ICONS.XCircle className="w-4 h-4" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Limits */}
                    <div>
                      <label className="block text-[9px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em] mb-4 ml-1">Plan Limits & Promotion</label>
                      <div className="grid grid-cols-2 gap-3">
                        {limits.map((limit, idx) => (
                          <div key={idx} className="p-4 bg-[#F2F2F2]/50 rounded-2xl border border-[#2E2E2F]/5 hover:border-[#38BDF2]/30 transition-all group/limit hover:shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-[#38BDF2] w-4 h-4 opacity-70 group-hover/limit:opacity-100 transition-opacity">
                                {React.isValidElement(limit.icon) && React.cloneElement(limit.icon as any, { className: 'w-full h-full', strokeWidth: 3 })}
                              </div>
                              <span className={`font-black text-[#2E2E2F] tracking-tighter leading-none ${typeof limit.val === 'string' && limit.val.length > 3 ? 'text-xs' : 'text-[16px]'}`}>{limit.val}</span>
                            </div>
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#38BDF2]/50">{limit.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="px-10 py-8 bg-[#F2F2F2]/50 border-t border-[#2E2E2F]/5 rounded-b-[2.5rem]">
                  <Button
                    onClick={() => onPlanAction?.(plan)}
                    disabled={isCurrentPlan || (actionLoadingPlanId !== null && actionLoadingPlanId !== plan.planId)}
                    className={`w-full rounded-2xl py-4 font-black text-[11px] uppercase tracking-[0.2em] transition-all duration-300 ${isCurrentPlan
                      ? '!bg-[#2E2E2F]/10 !text-[#2E2E2F]/60 border border-[#2E2E2F]/10 cursor-default shadow-none'
                      : 'bg-[#38BDF2] text-white hover:bg-[#2E2E2F] shadow-xl shadow-[#38BDF2]/20 hover:shadow-none border-none active:scale-95'
                      }`}
                  >
                    {isProcessing
                      ? 'Processing...'
                      : isCurrentPlan
                        ? 'Current Plan'
                        : plan.monthlyPrice === 0 || plan.yearlyPrice === 0
                          ? 'Get Started Free'
                          : 'Choose Plan'
                    }
                  </Button>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </>
  );
};
