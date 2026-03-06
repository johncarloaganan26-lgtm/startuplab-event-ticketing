import React from 'react';
import { ICONS } from '../constants.tsx';
import { Button, Card } from './Shared';

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

export const PricingSection: React.FC = () => {
    return (
        <section className="py-20">
            <div className="max-w-6xl mx-auto px-5 sm:px-8">
                <div className="text-center mb-16">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#38BDF2] mb-4">Pricing Plans</p>
                    <h2 className="text-3xl sm:text-4xl font-black text-[#2E2E2F] tracking-tight mb-4">
                        Simple & Transparent Pricing
                    </h2>
                    <p className="max-w-xl mx-auto text-[#2E2E2F]/60 font-medium">
                        Whether you're hosting a small meetup or a large-scale conference, we have a plan that scales with your community.
                    </p>
                </div>

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
            </div>
        </section>
    );
};
