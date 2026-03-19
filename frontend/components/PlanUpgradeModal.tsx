import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { AdminPlan } from '../types';
import { apiService } from '../services/apiService';
import { useToast } from '../context/ToastContext';
import { Button, Modal, PageLoader } from './Shared';
import { PricingPlansGrid } from './PricingPlansGrid';
import { PlanBillingCycle, sortPlansForDisplay, getPlanAmount, formatLimitValue, formatPlanCurrency } from '../utils/pricingPlans';

type PlanUpgradeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  organizerName: string;
  onSubscribeSuccess: () => void;
  currentPlanId?: string | null;
};

export const PlanUpgradeModal: React.FC<PlanUpgradeModalProps> = ({
  isOpen,
  onClose,
  organizerName,
  onSubscribeSuccess,
  currentPlanId = null
}) => {
  const { showToast } = useToast();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<PlanBillingCycle>('monthly');
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPlans();
    }
  }, [isOpen]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const fetchedPlans = await apiService.getSubscriptionPlans();
      setPlans(fetchedPlans);
    } catch (err: any) {
      console.error('Failed to load plans for modal:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: AdminPlan) => {
    try {
      setSubscribingPlanId(plan.planId);
      const result = await apiService.createSubscription(plan.planId, billingCycle);
      if (result.free) {
        showToast('success', `Successfully subscribed to ${plan.name}!`);
        onSubscribeSuccess();
        onClose();
      } else if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
      }
    } catch (error: any) {
      showToast('error', error?.message || 'Failed to create subscription');
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideUpgradeModal', 'true');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="xl"
      className="!max-w-[1200px] w-[95vw]"
      title=""
      contentClassName="!p-0 !overflow-hidden flex flex-col"
      showClose={false}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 hover:opacity-70 cursor-pointer transition-opacity" onClick={() => setDontShowAgain(!dontShowAgain)}>
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-5 h-5 rounded-xl accent-[#38BDF2] cursor-pointer"
              />
            </div>
            <span className="text-sm font-semibold text-[#2E2E2F]/70">
              {dontShowAgain ? "Won't show again until next login" : 'Don\'t show again'}
            </span>
          </div>
          <Button variant="outline" onClick={handleClose} className="border-[#2E2E2F]/20 text-white">
            Cancel / Close
          </Button>
        </div>
      }
    >
      <div className="flex flex-col h-[75vh] sm:max-h-[70vh]">
        {/* Header */}
        <div className="p-6 pb-4 shrink-0 flex flex-col gap-4 relative z-20 bg-[#F2F2F2] border-b border-[#2E2E2F]/10">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-[#2E2E2F] mb-1">
                Upgrade Plan for {organizerName || 'Company'}
              </h2>
              <p className="text-[#2E2E2F]/60 font-medium">
                {currentPlanId 
                  ? "Manage your current plan or upgrade to unlock more features for your business."
                  : "Select a new plan to unlock more features for your business."}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="min-h-[44px] min-w-[44px] px-2 py-2 rounded-xl bg-[#38BDF2] text-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2] transition-colors shrink-0"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex justify-center w-full">
            <div className="bg-[#EAEAEA] p-1.5 rounded-xl border border-[#2E2E2F]/10 flex items-center shadow-sm">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${billingCycle === 'monthly'
                  ? 'bg-[#38BDF2] text-white shadow-lg shadow-[#38BDF2]/25'
                  : 'text-[#2E2E2F]/60 hover:text-[#2E2E2F] hover:bg-[#D9D9D9]'
                  }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${billingCycle === 'yearly'
                  ? 'bg-[#38BDF2] text-white shadow-lg shadow-[#38BDF2]/25'
                  : 'text-[#2E2E2F]/60 hover:text-[#2E2E2F] hover:bg-[#D9D9D9]'
                  }`}
              >
                Yearly
                <span className={`text-[8px] px-2 py-0.5 rounded-full ${billingCycle === 'yearly' ? 'bg-[#38BDF2] text-white' : 'bg-[#38BDF2]/10 text-[#38BDF2]'}`}>Save 20%</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 py-6 overflow-y-auto flex-1 scrollbar-thin bg-transparent">
          {loading ? (
            <div className="py-20 flex justify-center">
              <PageLoader variant="section" label="Loading plans..." />
            </div>
          ) : (
            <div className="pt-2">
              <PricingPlansGrid
                plans={plans}
                billingCycle={billingCycle}
                onBillingCycleChange={setBillingCycle}
                onPlanAction={handleSubscribe}
                actionLoadingPlanId={subscribingPlanId}
                showBillingToggle={false}
                currentPlanId={currentPlanId}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

