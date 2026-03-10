import React, { useEffect, useState } from 'react';
import { ICONS } from '../../constants';
import { AdminPlan } from '../../types';
import { apiService } from '../../services/apiService';
import { Button, Card, PageLoader } from '../../components/Shared';
import { PricingPlansGrid } from '../../components/PricingPlansGrid';
import { PlanBillingCycle } from '../../utils/pricingPlans';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

export const PricingPage: React.FC = () => {
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
                setError(err?.message || 'Failed to load pricing plans.');
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

    if (loading) return <PageLoader variant="page" label="Loading pricing plans..." />;

    return (
        <div className="bg-[#F2F2F2] min-h-screen">
            <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 h-[260px] sm:h-[300px] lg:h-[350px] overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(116deg,#38BDF2_0%,#38BDF2_44%,#F2F2F2_100%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,62,134,0.45)_0%,rgba(0,62,134,0.2)_34%,rgba(0,62,134,0)_72%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_32%,rgba(255,255,255,0.34),transparent_46%),linear-gradient(90deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.06)_26%,rgba(255,255,255,0)_52%)]" />
                <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl items-center px-5 sm:px-8">
                    <div className="max-w-[740px]">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 mb-4">Pricing Plans</p>
                        <h1 className="text-[2.5rem] font-black leading-none tracking-tight text-white sm:text-6xl">
                            Simple & Transparent Pricing
                        </h1>
                        <p className="mt-6 max-w-[600px] text-base leading-relaxed text-white/95 sm:text-[1.1rem]">
                            Live plans below are synced from the admin subscription configuration.
                        </p>
                    </div>
                </div>
            </section>

            <div className="max-w-6xl mx-auto px-5 sm:px-8 -mt-12 sm:-mt-16 pb-20 relative z-20">
                {error && (
                    <Card className="p-6 mb-8 border-[#2E2E2F]/10">
                        <p className="text-sm font-semibold text-[#2E2E2F]">{error}</p>
                    </Card>
                )}

                {!error && (
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

                <section className="mt-24 text-center">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tight mb-4">
                            Need a tailored solution?
                        </h2>
                        <p className="text-[#2E2E2F]/60 mb-8 font-medium">
                            We offer customized volume pricing for organizations processing more than 500 tickets per month.
                            Our team is ready to help you optimize your event operations.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button variant="outline" className="w-full sm:w-auto px-8 border-[#2E2E2F] text-[#2E2E2F] hover:bg-[#2E2E2F] hover:text-[#F2F2F2]">
                                Schedule a Demo
                            </Button>
                            <Button variant="ghost" className="w-full sm:w-auto flex items-center gap-2 group text-[#2E2E2F] hover:text-[#38BDF2] font-black uppercase tracking-widest text-[10px]">
                                View detailed fee breakdown
                                <ICONS.ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
