import React, { useEffect, useState } from 'react';
import { ICONS } from '../../constants';
import { apiService } from '../../services/apiService';
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
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notification]);

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
      setNotification({ type: 'error', message: error?.message || 'Failed to load subscription data' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: AdminPlan) => {
    try {
      setSubscribing(plan.planId);
      const result = await apiService.createSubscription(plan.planId, billingCycle);

      if (result.free) {
        setNotification({ type: 'success', message: `Successfully subscribed to ${plan.name}!` });
        await loadData();
      } else if (result.paymentUrl) {
        // Redirect to HitPay payment
        window.location.href = result.paymentUrl;
      }
    } catch (error: any) {
      setNotification({ type: 'error', message: error?.message || 'Failed to create subscription' });
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    if (!currentSubscription?.subscription?.subscriptionId) return;
    if (!window.confirm('Are you sure you want to cancel your subscription? This will immediately revoke your plan features.')) return;

    try {
      await apiService.cancelSubscription(currentSubscription.subscription.subscriptionId);
      setNotification({ type: 'success', message: 'Subscription has been cancelled and features have been revoked.' });
      setCurrentSubscription(null); // Clear local state immediately for better UX
      await loadData();
    } catch (error: any) {
      setNotification({ type: 'error', message: error?.message || 'Failed to cancel subscription' });
    }
  };

  if (loading) {
    return <PageLoader variant="page" label="Loading subscription..." />;
  }

  return (
    <div className="min-h-screen bg-[#F2F2F2] pb-20">
      {notification && (
        <div className="fixed top-20 right-4 z-50">
          <Card className={`px-5 py-4 rounded-2xl border ${notification.type === 'success' ? 'bg-green-100 border-green-400 text-green-800' : 'bg-red-100 border-red-400 text-red-800'}`}>
            <p className="font-bold text-sm">{notification.message}</p>
          </Card>
        </div>
      )}

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
          <Card className="mb-8 p-8 rounded-3xl border-[#2E2E2F]/10">
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
            <div className="mt-8 pt-8 border-t border-[#2E2E2F]/10">
              <p className="text-xs font-black text-[#2E2E2F]/40 uppercase tracking-widest mb-4">Your Plan Includes</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Events', val: currentSubscription.plan.limits?.max_total_events || currentSubscription.plan.limits?.max_events || 0 },
                  { label: 'Active Events', val: currentSubscription.plan.limits?.max_active_events || currentSubscription.plan.limits?.max_events || 0 },
                  { label: 'Staff Accounts', val: currentSubscription.plan.limits?.max_staff_accounts || 0 },
                  { label: 'Monthly Attendees', val: currentSubscription.plan.limits?.monthly_attendees || currentSubscription.plan.limits?.max_attendees_per_month || 0 },
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#F2F2F2] rounded-2xl p-4">
                    <p className="text-2xl font-black text-[#2E2E2F]">{item.val}</p>
                    <p className="text-xs text-[#2E2E2F]/50 uppercase tracking-wider">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* No Subscription */}
        {!currentSubscription && (
          <Card className="mb-8 p-8 rounded-3xl border-[#2E2E2F]/10 bg-gradient-to-r from-[#38BDF8]/10 to-transparent">
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
