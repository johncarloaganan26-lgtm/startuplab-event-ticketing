import React, { useEffect, useState } from 'react';
import { AdminPlan } from '../types';
import { apiService } from '../services/apiService';
import { Card } from './Shared';
import { PricingPlansGrid } from './PricingPlansGrid';
import { PlanBillingCycle } from '../utils/pricingPlans';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export const PricingSection: React.FC = () => {
    const [plans, setPlans] = useState<AdminPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [billingCycle, setBillingCycle] = useState<PlanBillingCycle>('monthly');
    const navigate = useNavigate();
    const { isAuthenticated } = useUser();

    useEffect(() => {
        let active = true;

        const loadPlans = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await apiService.getPublicPlans();
                if (!active) return;
                setPlans(data);
            } catch (err: any) {
                if (!active) return;
                setError(err?.message || 'Failed to load plans.');
                setPlans([]);
            } finally {
                if (active) setLoading(false);
            }
        };

        void loadPlans();
        return () => {
            active = false;
        };
    }, []);

    return (
        <section className="py-20">
            <div className="max-w-6xl mx-auto px-5 sm:px-8">
                <div className="text-center mb-16">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#38BDF2] mb-4">Pricing Plans</p>
                    <h2 className="text-3xl sm:text-4xl font-black text-[#2E2E2F] tracking-tight mb-4">
                        Simple & Transparent Pricing
                    </h2>
                    <p className="max-w-xl mx-auto text-[#2E2E2F]/60 font-medium">
                        Live values are synced from the admin subscription plan settings.
                    </p>
                </div>

                {loading && (
                    <Card className="p-6 mb-8 border-[#2E2E2F]/10">
                        <p className="text-sm font-semibold text-[#2E2E2F]">Loading pricing plans...</p>
                    </Card>
                )}

                {error && !loading && (
                    <Card className="p-6 mb-8 border-[#2E2E2F]/10">
                        <p className="text-sm font-semibold text-[#2E2E2F]">{error}</p>
                    </Card>
                )}

                {!loading && !error && (
                    <PricingPlansGrid
                        plans={plans}
                        billingCycle={billingCycle}
                        onBillingCycleChange={setBillingCycle}
                        showBillingToggle
                        onPlanAction={() => {
                            if (!isAuthenticated) {
                                navigate('/signup');
                            } else {
                                navigate('/subscription');
                            }
                        }}
                    />
                )}
            </div>
        </section>
    );
};
