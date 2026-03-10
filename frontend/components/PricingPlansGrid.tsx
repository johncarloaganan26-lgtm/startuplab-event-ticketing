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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 lg:gap-10">
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
            { label: 'Total Events', val: formatLimitValue(plan.limits?.max_total_events || plan.limits?.max_events || 0), icon: <ICONS.Box /> },
            { label: 'Active Events', val: formatLimitValue(plan.limits?.max_active_events || plan.limits?.max_events || 0), icon: <ICONS.CheckCircle /> },
            { label: 'Staff Accounts', val: formatLimitValue(plan.limits?.max_staff_accounts || 0), icon: <ICONS.Users /> },
            { label: 'Monthly Attendees', val: formatLimitValue(plan.limits?.monthly_attendees || plan.limits?.max_attendees_per_month || 0), icon: <ICONS.Users /> },
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
              <Card className={`h-full flex flex-col border-[#2E2E2F]/10 rounded-[3rem] bg-[#F2F2F2] transition-all duration-500 hover:shadow-2xl hover:shadow-[#2E2E2F]/10 ${!isCurrentPlan && plan.isRecommended ? 'ring-2 ring-[#38BDF2] ring-offset-4 ring-offset-[#F2F2F2]' : ''}`}>
                <div className="p-10 flex-1 flex flex-col">
                  {/* Top: Name and Icon */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-4xl font-black text-[#2E2E2F] tracking-tighter uppercase mb-3">{plan.name}</h3>
                      <div className="flex gap-2">
                        {plan.isDefault && (
                          <span className="bg-[#38BDF2] text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm shadow-[#38BDF2]/20">DEFAULT</span>
                        )}
                        {isCurrentPlan && (
                          <span className="bg-[#38BDF2] text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm shadow-[#38BDF2]/20 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            ACTIVE
                          </span>
                        )}
                        {/* Removed internal badge inline string for Recommended */}
                      </div>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-[#38BDF2]/10 text-[#38BDF2] flex items-center justify-center shadow-sm">
                      <ICONS.CreditCard className="w-7 h-7" strokeWidth={2.5} />
                    </div>
                  </div>

                  {/* Price Section */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black text-[#2E2E2F] tracking-tighter">
                        {formatPlanCurrency(amount, plan.currency).replace('.00', '')}
                      </span>
                      <span className="text-[12px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em]">
                        / {billingCycle === 'monthly' ? 'month' : 'year'}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[15px] text-[#2E2E2F]/60 font-bold leading-relaxed mb-10">
                    {plan.description || (plan.monthlyPrice === 0 ? 'Free tier for starting out' : 'Professional features for growing organizers')}
                  </p>

                  {/* Features */}
                  <div className="mb-10">
                    <label className="block text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em] mb-5 ml-1">Plan Features</label>
                    <div className="space-y-3">
                      {features.map((feature, idx) => (
                        <div key={idx} className="flex items-center justify-between p-6 px-7 rounded-[1.5rem] bg-[#F2F2F2]/50 border border-[#2E2E2F]/5 group/feat transition-all">
                          <span className={`text-[13px] font-black uppercase tracking-widest ${feature.enabled ? 'text-[#2E2E2F]' : 'text-[#2E2E2F]/20'}`}>{feature.label}</span>
                          <div className="flex items-center justify-center">
                            {feature.enabled ? (
                              <div className="text-[#38BDF2]">
                                <ICONS.CheckCircle className="w-6 h-6" strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="text-[#2E2E2F]/15">
                                <ICONS.XCircle className="w-6 h-6" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Limits */}
                  <div className="mb-10">
                    <label className="block text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em] mb-5 ml-1">Plan Limits</label>
                    <div className="grid grid-cols-2 gap-4">
                      {limits.map((limit, idx) => (
                        <div key={idx} className="p-6 bg-[#F2F2F2]/50 rounded-[1.5rem] border border-[#2E2E2F]/5 group/limit">
                          <div className="flex items-center gap-2.5 mb-2">
                            <div className="text-[#38BDF2] w-5 h-5 flex items-center justify-center">
                              {limit.icon && React.isValidElement(limit.icon)
                                ? React.cloneElement(limit.icon as React.ReactElement<any>, { className: 'w-full h-full', strokeWidth: 3 })
                                : null}
                            </div>
                            <span className="text-[20px] font-black text-[#2E2E2F] tracking-tighter leading-none">{limit.val}</span>
                          </div>
                          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#38BDF2]/60">{limit.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="px-10 py-10 bg-[#F2F2F2]/50 border-t border-[#2E2E2F]/5 rounded-b-[3rem]">
                  <Button
                    onClick={() => onPlanAction?.(plan)}
                    disabled={isCurrentPlan || (actionLoadingPlanId !== null && actionLoadingPlanId !== plan.planId)}
                    className={`w-full rounded-[1.5rem] py-5 font-black text-[12px] uppercase tracking-[0.2em] transition-all duration-300 ${isCurrentPlan
                      ? '!bg-[#2E2E2F] !text-white opacity-30 cursor-default border-none'
                      : 'bg-[#38BDF2] text-white hover:bg-[#2E2E2F] shadow-xl shadow-[#38BDF2]/20 hover:shadow-[#2E2E2F]/20 border-none'
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
