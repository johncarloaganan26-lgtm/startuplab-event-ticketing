import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, PageLoader } from '../../components/Shared';
import { ICONS } from '../../constants';
import { apiService } from '../../services/apiService';
import { useToast } from '../../context/ToastContext';

const SUBSCRIPTION_REF_STORAGE_KEY = 'subscriptionReferenceId';

export const SubscriptionSuccess: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading');
    const [message, setMessage] = useState('Processing your subscription...');
    const { showToast } = useToast();

    // HitPay passes the reference_id in the redirect URL
    // We try multiple ways to get it, because HashRouter can be tricky on localhost
    const referenceId = searchParams.get('reference_id') ||
        searchParams.get('reference_number') ||
        sessionStorage.getItem(SUBSCRIPTION_REF_STORAGE_KEY) ||
        new URLSearchParams((window.location.hash.split('?')[1] || '')).get('reference_id') ||
        new URLSearchParams((window.location.hash.split('?')[1] || '')).get('reference_number') ||
        new URLSearchParams(window.location.search).get('reference_id') ||
        new URLSearchParams(window.location.search).get('reference_number');

    useEffect(() => {
        const verify = async () => {
            console.log('🔍 [SubscriptionSuccess] Reference ID detected:', referenceId);
            if (!referenceId) {
                // If it's still missing, try one last check on the current subscription
                try {
                    const subData = await apiService.getCurrentSubscription();
                    if (subData.subscription && subData.subscription.status === 'active') {
                        setStatus('success');
                        setMessage('Your subscription is already active!');
                        return;
                    }
                } catch (e) { }

                setStatus('error');
                setMessage('Missing subscription reference. Please check your subscription page.');
                return;
            }

            try {
                // Try to verify the subscription
                const result = await apiService.verifySubscription(referenceId);

                if (result.success && result.status === 'active') {
                    setStatus('success');
                    setMessage('Your subscription has been activated!');
                    showToast('success', 'Subscription activated successfully.');
                    setTimeout(() => navigate('/subscription', { replace: true }), 400);
                } else if (result.status === 'pending') {
                    // Payment might still be processing
                    setStatus('pending');
                    setMessage('Payment is still being processed. Please wait a moment...');

                    // Retry verification after a delay
                    setTimeout(async () => {
                        try {
                            const retryResult = await apiService.verifySubscription(referenceId);
                            if (retryResult.success && retryResult.status === 'active') {
                                setStatus('success');
                                setMessage('Your subscription has been activated!');
                                showToast('success', 'Subscription activated successfully.');
                                setTimeout(() => navigate('/subscription', { replace: true }), 400);
                            }
                        } catch (e) {
                            // Keep showing pending
                        }
                    }, 3000);
                } else {
                    setStatus('error');
                    setMessage(`Subscription status: ${result.status}`);
                    showToast('error', `Subscription status: ${result.status}`);
                }
            } catch (err: any) {
                console.error('Verification error:', err);
                // If verification fails, it might be because:
                // 1. User is not logged in
                // 2. Webhook already processed the subscription
                // Let's try to check the current subscription instead
                setStatus('pending');
                setMessage('Verifying your subscription...');

                // Try to get current subscription
                try {
                    const subData = await apiService.getCurrentSubscription();
                    if (subData.subscription && subData.subscription.status === 'active') {
                        setStatus('success');
                        setMessage('Your subscription is active!');
                        showToast('success', 'Your subscription is active!');
                        setTimeout(() => navigate('/subscription', { replace: true }), 400);
                    } else if (subData.subscription && subData.subscription.status === 'pending') {
                        setStatus('pending');
                        setMessage('Your payment is being processed. Please check back in a few minutes.');
                    } else {
                        setStatus('error');
                        setMessage('Could not verify subscription. Please sign in and check your billing page.');
                        showToast('error', 'Could not verify subscription. Please sign in and check billing.');
                    }
                } catch (subErr) {
                    setStatus('error');
                    setMessage('Please sign in to view your updated subscription status.');
                    showToast('error', 'Please sign in to view your updated subscription status.');
                }
            }
        };

        // If parameters are in the URL, move them to storage and clean the hash URL
        if (searchParams.has('reference_id') || searchParams.has('reference_number')) {
            const rid = searchParams.get('reference_id') || searchParams.get('reference_number');
            if (rid) {
                sessionStorage.setItem(SUBSCRIPTION_REF_STORAGE_KEY, rid);
                // Clean the hash by navigating to the same route without search params
                navigate('/subscription/success', { replace: true });
                return;
            }
        }

        verify();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-[70vh] flex items-center justify-center p-6">
            <Card className="max-w-md w-full p-10 text-center rounded-[2.5rem] border-[#2E2E2F]/10 shadow-2xl">
                {status === 'loading' ? (
                    <div className="space-y-6">
                        <div className="w-20 h-20 bg-[#38BDF8]/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                            <ICONS.CreditCard className="w-10 h-10 text-[#38BDF8]" />
                        </div>
                        <h1 className="text-2xl font-black text-[#2E2E2F]">Processing Payment...</h1>
                        <p className="text-[#2E2E2F]/60">{message}</p>
                        <PageLoader variant="section" />
                    </div>
                ) : status === 'success' ? (
                    <div className="space-y-6 animate-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/30">
                            <ICONS.CheckCircle className="w-10 h-10 text-white" strokeWidth={3} />
                        </div>
                        <h1 className="text-3xl font-black text-[#2E2E2F]">Subscription Active!</h1>
                        <p className="text-[#2E2E2F]/60 px-4">
                            {message}
                        </p>

                        <div className="pt-4 space-y-3">
                            <Button
                                onClick={() => navigate('/user-home')}
                                className="w-full py-4 rounded-2xl font-black tracking-widest text-xs"
                            >
                                GO TO DASHBOARD
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => navigate('/subscription')}
                                className="w-full py-4 rounded-2xl font-black tracking-widest text-xs border-[#2E2E2F]/10"
                            >
                                VIEW BILLING
                            </Button>
                        </div>
                    </div>
                ) : status === 'pending' ? (
                    <div className="space-y-6 animate-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-yellow-500/30">
                            <ICONS.CreditCard className="w-10 h-10 text-white" strokeWidth={3} />
                        </div>
                        <h1 className="text-3xl font-black text-[#2E2E2F]">Payment Processing</h1>
                        <p className="text-[#2E2E2F]/60 px-4">
                            {message}
                        </p>

                        <div className="pt-4 space-y-3">
                            <Button
                                onClick={() => navigate('/subscription')}
                                className="w-full py-4 rounded-2xl font-black tracking-widest text-xs"
                            >
                                CHECK STATUS
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in zoom-in duration-500">
                        <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-red-500/30">
                            <ICONS.XCircle className="w-10 h-10 text-white" strokeWidth={3} />
                        </div>
                        <h1 className="text-3xl font-black text-[#2E2E2F]">Verification Issue</h1>
                        <p className="text-[#2E2E2F]/60 px-4">
                            {message}
                        </p>

                        <div className="pt-4 space-y-3">
                            <Button
                                onClick={() => navigate('/subscription')}
                                className="w-full py-4 rounded-2xl font-black tracking-widest text-xs"
                            >
                                GO TO SUBSCRIPTION
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => navigate('/user-home')}
                                className="w-full py-4 rounded-2xl font-black tracking-widest text-xs border-[#2E2E2F]/10"
                            >
                                GO TO DASHBOARD
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};
