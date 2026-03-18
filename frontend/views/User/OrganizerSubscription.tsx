import React, { useEffect, useState } from 'react';
import { ICONS } from '../../constants';
import { apiService } from '../../services/apiService';
import { useToast } from '../../context/ToastContext';
import { AdminPlan } from '../../types';
import { Button, Card, PageLoader } from '../../components/Shared';
import { PricingPlansGrid } from '../../components/PricingPlansGrid';

type CurrentSubscription = {
  subscription: any;
  plan: AdminPlan;
  billingInterval: string;
  status: string;
  endDate: string;
};

export const OrganizerSubscription: React.FC = () => {
  const { showToast } = useToast();
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subData, plansData] = await Promise.all([
        apiService.getCurrentSubscription(),
        apiService.getSubscriptionPlans()
      ]);

      if (subData.subscription) {
        setCurrentSubscription({
          subscription: subData.subscription,
          plan: subData.subscription.plan,
          billingInterval: subData.subscription.billingInterval,
          status: subData.subscription.status,
          endDate: subData.subscription.endDate
        });
      }

      setAvailablePlans(plansData);
    } catch (error: any) {
      showToast('error', error?.message || 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: AdminPlan) => {
    try {
      setSubscribing(plan.planId);
      const result = await apiService.createSubscription(plan.planId, billingCycle);

      if (result.free) {
        showToast('success', `Successfully subscribed to ${plan.name}!`);
        await loadData();
      } else if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      }
    } catch (error: any) {
      showToast('error', error?.message || 'Failed to create subscription');
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    if (!currentSubscription?.subscription?.subscriptionId) return;
    if (!window.confirm('Are you sure you want to cancel your subscription? This will immediately revoke your plan features.')) return;

    try {
      await apiService.cancelSubscription(currentSubscription.subscription.subscriptionId);
      showToast('success', 'Subscription has been cancelled and features have been revoked.');
      setCurrentSubscription(null);
      await loadData();
    } catch (error: any) {
      showToast('error', error?.message || 'Failed to cancel subscription');
    }
  };

  if (loading) {
    return <PageLoader variant="page" label="Loading subscription..." />;
  }

  return (
    <div className="min-h-screen bg-[#F2F2F2] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#38BDF8] to-[#0EA5E9] py-12">
        <div className="max-w-6xl mx-auto px-5">
          <h1 className="text-3xl font-black text-white mb-2">Subscription</h1>
          <p className="text-white/80">Manage your plan and billing</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 -mt-8">
        {/* Current Plan */}
        {currentSubscription && (
          <Card className="mb-8 p-8 rounded-3xl border-2 border-[#2E2E2F]/15 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black text-[#38BDF8] uppercase tracking-widest mb-2">Current Plan</p>
                <h2 className="text-2xl font-black text-[#2E2E2F] mb-1">{currentSubscription.plan.name}</h2>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentSubscription.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {currentSubscription.status === 'active' ? 'Active' : currentSubscription.status}
                  </span>
                  <span className="text-sm text-[#2E2E2F]/60">
                    {currentSubscription.billingInterval === 'yearly' ? 'Yearly' : 'Monthly'} billing
                  </span>
                </div>
                {currentSubscription.endDate && (
                  <p className="text-sm text-[#2E2E2F]/50 mt-2">
                    {currentSubscription.subscription.cancelAtPeriodEnd
                      ? `Cancels on ${new Date(currentSubscription.endDate).toLocaleDateString()}`
                      : `Renews on ${new Date(currentSubscription.endDate).toLocaleDateString()}`
                    }
                  </p>
                )}
              </div>
              {!currentSubscription.subscription.cancelAtPeriodEnd && (
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="!border-red-300 !text-red-500 hover:!bg-red-50"
                >
                  Cancel Subscription
                </Button>
              )}
            </div>

            {/* Current Plan Features */}
            <div className="mt-8 pt-8 border-t-2 border-[#2E2E2F]/10">
              <div className="space-y-10">
                {/* Plan Features */}
                <div>
                  <p className="text-xs font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-4 ml-1">Plan Features</p>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { label: 'Custom Branding', enabled: (currentSubscription.plan.features as any)?.enable_custom_branding || (currentSubscription.plan.features as any)?.custom_branding },
                      { label: 'Discount Codes', enabled: (currentSubscription.plan.features as any)?.enable_discount_codes || (currentSubscription.plan.features as any)?.discount_codes },
                      { label: 'Advanced Reports', enabled: (currentSubscription.plan.features as any)?.enable_advanced_reports || (currentSubscription.plan.features as any)?.advanced_reports },
                      { label: 'Priority Support', enabled: (currentSubscription.plan.features as any)?.enable_priority_support || (currentSubscription.plan.features as any)?.priority_support },
                    ].map((feature, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-[#F2F2F2]/50 border-2 border-[#2E2E2F]/10 group/feat transition-all hover:border-[#38BDF2]/30 hover:shadow-sm">
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

                {/* Plan Limits & Promotion */}
                <div>
                  <p className="text-xs font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-4 ml-1">Plan Limits & Promotion</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Promoted Event Slots', val: (currentSubscription.plan as any)?.promotions?.max_promoted_events || 0, icon: <ICONS.TrendingUp /> },
                      { label: 'Promoted Event Duration', val: ((currentSubscription.plan as any)?.promotions?.promotion_duration_days || 0) + ' days', icon: <ICONS.Calendar /> },
                      { label: 'Staff Accounts', val: currentSubscription.plan.limits?.max_staff_accounts || 0, icon: <ICONS.Users /> },
                      { label: 'Monthly Attendees', val: currentSubscription.plan.limits?.monthly_attendees || currentSubscription.plan.limits?.max_attendees_per_month || 0, icon: <ICONS.Users /> },
                      { label: 'Paid Events Limit', val: currentSubscription.plan.limits?.max_priced_events || 0, icon: <ICONS.Zap /> },
                      { label: 'Daily Email Quota', val: (currentSubscription.plan.limits?.email_quota_per_day || 500) + ' /day', icon: <ICONS.Mail /> },
                    ].map((limit, idx) => (
                      <div key={idx} className="p-4 bg-[#F2F2F2]/50 rounded-2xl border-2 border-[#2E2E2F]/10 hover:border-[#38BDF2]/30 transition-all group/limit hover:shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-[#38BDF2] w-4 h-4 opacity-70 group-hover/limit:opacity-100 transition-opacity">
                            {React.cloneElement(limit.icon as React.ReactElement<any>, { className: 'w-full h-full', strokeWidth: 3 })}
                          </div>
                          <span className={`font-black text-[#2E2E2F] tracking-tighter leading-none ${typeof limit.val === 'string' && limit.val.includes(' ') ? 'text-sm' : 'text-[16px]'}`}>{limit.val}</span>
                        </div>
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#38BDF2]/50">{limit.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* No Subscription */}
        {!currentSubscription && (
          <Card className="mb-8 p-8 rounded-3xl border-2 border-[#2E2E2F]/15 bg-gradient-to-r from-[#38BDF8]/10 to-transparent shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#38BDF8]/20 flex items-center justify-center">
                <ICONS.CreditCard className="w-8 h-8 text-[#38BDF8]" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#2E2E2F]">No Active Subscription</h2>
                <p className="text-[#2E2E2F]/60">Subscribe to a plan to unlock full features</p>
              </div>
            </div>
          </Card>
        )}

        {/* Available Plans */}
        <div className="mt-12">
          <PricingPlansGrid
            plans={availablePlans}
            billingCycle={billingCycle}
            onBillingCycleChange={(cycle) => setBillingCycle(cycle)}
            onPlanAction={handleSubscribe}
            actionLoadingPlanId={subscribing}
            currentPlanId={currentSubscription?.plan?.planId}
            showBillingToggle
          />
        </div>

      </div>
    </div>
  );
};
