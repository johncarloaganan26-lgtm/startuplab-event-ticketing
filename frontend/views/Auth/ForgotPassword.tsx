import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '../../components/Shared';
import { supabase } from "../../supabase/supabaseClient.js";
import { ICONS } from '../../constants';

export const ForgotPassword: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            // We'll call our backend endpoint to handle the custom SMTP sending
            const API = import.meta.env.VITE_API_BASE;
            const response = await fetch(`${API}/api/auth/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || result.message || 'Failed to send reset link');
            }

            setMessage('Check your email for the password reset link.');
        } catch (err: any) {
            setError(err.message || "An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center px-4">
            <div className="max-w-md w-full py-12">
                <Card className="p-10 border-[#2E2E2F]/20 flex flex-col h-full">
                    <div className="text-center flex flex-col items-center mb-8">
                        <img
                            src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg"
                            alt="StartupLab Business Center Logo"
                            className="mx-auto mb-6 w-[170px] lg:w-[200px] max-w-full h-auto"
                            style={{ objectFit: 'contain' }}
                        />
                        <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tighter mb-2">Forgot Password?</h2>
                        <p className="text-[#2E2E2F]/70 text-sm font-medium">Enter your email and we'll send you a link to reset your password.</p>
                        <div className="w-16 h-1 bg-[#38BDF2] mx-auto mt-4 rounded-full"></div>
                    </div>

                    {!message ? (
                        <form onSubmit={handleResetRequest} className="flex flex-col gap-6">
                            <div className="relative group/input">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2E2E2F]/40 group-focus-within/input:text-[#38BDF2] transition-colors z-10">
                                    <ICONS.Mail className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e: any) => setEmail(e.target.value)}
                                    required
                                    className="w-full pl-12 pr-4 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-normal text-[14px]"
                                />
                            </div>
                            <div className="mt-2">
                                <Button
                                    className="w-full py-4 text-[13px] font-black uppercase tracking-widest shadow-lg shadow-[#38BDF2]/20"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? 'Sending link...' : 'Send Reset Link'}
                                </Button>
                            </div>
                            {error && (
                                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-500/20">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        </div>
                                        <p className="text-[11px] font-bold leading-tight tracking-tight">{error}</p>
                                    </div>
                                </div>
                            )}
                        </form>
                    ) : (
                        <div className="text-center py-8 px-4 animate-in zoom-in-95 duration-500">
                            <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-xl bg-green-500 text-white shadow-xl shadow-green-500/30 rotate-3 hover:rotate-0 transition-transform">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-xl font-black text-[#2E2E2F] mb-3">Check your inbox!</h3>
                            <p className="text-[#2E2E2F]/60 font-bold text-sm mb-8 leading-relaxed">{message}</p>
                            <Button
                                variant="outline"
                                className="w-full py-4 text-[11px] font-black uppercase tracking-widest border-[#2E2E2F]/10 hover:bg-[#2E2E2F] hover:text-white transition-all"
                                onClick={() => navigate('/login')}
                            >
                                Back to Sign In
                            </Button>
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-[#2E2E2F]/10 text-center">
                        <button
                            className="text-[#2E2E2F]/60 text-sm font-medium hover:text-[#38BDF2] transition-colors"
                            onClick={() => navigate('/login')}
                        >
                            Remembered your password? <span className="text-[#38BDF2] font-bold">Sign In</span>
                        </button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

