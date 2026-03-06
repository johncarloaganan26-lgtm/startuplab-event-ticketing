import React from 'react';
import { ICONS } from '../../constants';
import { Button, Card } from '../../components/Shared';

const plans = [
    {
        name: 'Free',
        price: '0',
        description: 'Perfect for getting started with free community events.',
        features: [
            'Unlimited free events',
            'Basic attendee management',
            'Public event listing',
            'Standard check-in tools',
            'Email support',
        ],
        buttonText: 'Get Started',
        popular: false,
    },
    {
        name: 'Pro',
        price: '19',
        description: 'Advanced tools for professional organizers hosting paid events.',
        features: [
            'Everything in Free, plus:',
            'Paid ticket support',
            '2% + $0.50 transaction fee',
            'Custom ticketing policies',
            'Advanced event analytics',
            'Priority email support',
        ],
        buttonText: 'Start Pro Trial',
        popular: true,
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        description: 'Scale your organization with advanced security and dedicated support.',
        features: [
            'Everything in Pro, plus:',
            'Unlimited paid events',
            'Reduced transaction fees',
            'SSO & Advanced Security',
            'Dedicated success manager',
            'Custom integrations',
        ],
        buttonText: 'Contact Sales',
        popular: false,
    },
];

export const PricingPage: React.FC = () => {
    return (
        <div className="bg-[#F2F2F2] min-h-screen">
            {/* Hero Section */}
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
                            Whether you're hosting a small meetup or a large-scale conference, we have a plan that scales with your community.
                        </p>
                    </div>
                </div>
            </section>

            {/* Pricing Cards */}
            <div className="max-w-6xl mx-auto px-5 sm:px-8 -mt-12 sm:-mt-16 pb-20 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                    {plans.map((plan) => (
                        <Card
                            key={plan.name}
                            className={`flex flex-col p-8 bg-[#F2F2F2] border-2 relative ${plan.popular
                                ? 'border-[#38BDF2] shadow-[0_30px_60px_-15px_rgba(56,189,242,0.3)] scale-[1.05] z-10'
                                : 'border-[#2E2E2F]/5'
                                } transition-all duration-300 hover:translate-y-[-4px]`}
                        >
                            {plan.popular && (
                                <div className="mb-6 flex justify-center">
                                    <span className="bg-[#38BDF2] text-white px-6 py-2 rounded-full font-black tracking-[0.2em] uppercase text-[12px] shadow-[0_10px_25px_-5px_rgba(56,189,242,0.5)] border border-white/20">
                                        Most Popular
                                    </span>
                                </div>
                            )}

                            <div className="mb-8 mt-2">
                                <h3 className="text-xl font-black text-[#2E2E2F] tracking-tight mb-2">{plan.name}</h3>
                                <p className="text-sm text-[#2E2E2F]/60 leading-relaxed min-h-[40px]">
                                    {plan.description}
                                </p>
                            </div>

                            <div className="mb-8">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl sm:text-5xl font-black text-[#2E2E2F]">
                                        {plan.price === 'Custom' ? 'Custom' : `$${plan.price}`}
                                    </span>
                                    {plan.price !== 'Custom' && (
                                        <span className="text-sm font-bold text-[#2E2E2F]/40 uppercase tracking-widest">/ month</span>
                                    )}
                                </div>
                            </div>

                            <Button
                                variant="primary"
                                className="w-full py-4 text-[12px] font-black tracking-[0.15em] mb-8 bg-[#2E2E2F] text-[#F2F2F2] hover:bg-[#38BDF2] hover:text-[#F2F2F2] border-none shadow-lg transition-all duration-300"
                            >
                                {plan.buttonText}
                            </Button>

                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40 mb-6">
                                    What's included:
                                </p>
                                <ul className="space-y-4">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3">
                                            <div className="mt-0.5 w-5 h-5 rounded-full bg-[#38BDF2]/10 flex items-center justify-center shrink-0">
                                                <ICONS.Check className="w-3 h-3 text-[#38BDF2] stroke-[3]" />
                                            </div>
                                            <span className="text-sm text-[#2E2E2F]/75 leading-tight font-medium">
                                                {feature}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Tailored Solutions Section */}
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
