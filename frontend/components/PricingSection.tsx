import React, { useEffect, useState } from 'react';
import { AdminPlan } from '../types';
import { apiService } from '../services/apiService';
import { Card } from './Shared';
import { PricingPlansGrid } from './PricingPlansGrid';
import { PlanBillingCycle } from '../utils/pricingPlans';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { ICONS } from '../constants';

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
        <section id="pricing" className="py-32">
            <div className="max-w-6xl mx-auto px-5 sm:px-8">
                <div className="text-center mb-16 px-4">
                    <p className="text-xs font-bold text-[#38BDF2] mb-3 tracking-tight uppercase">Pricing Plans</p>
                    <h2 className="text-2xl md:text-4xl font-black text-[#2E2E2F] tracking-tight leading-none mb-4">
                        Simple & Transparent Pricing
                    </h2>
                    <p className="text-[#2E2E2F]/50 text-sm md:text-base font-medium max-w-xl mx-auto leading-relaxed">
                        Choose the best plan for your needs.
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
                <div className="flex justify-center mt-12">
                    <button
                        onClick={() => navigate('/pricing')}
                        className="flex items-center gap-3 px-8 py-3 bg-[#38BDF2] text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#2E2E2F] transition-all active:scale-95 shadow-md shadow-[#38BDF2]/15"
                    >
                        {isAuthenticated ? 'Plan Settings' : 'Start now'}
                        <ICONS.ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </button>
                </div>
            </div>
        </section>
    );
};
