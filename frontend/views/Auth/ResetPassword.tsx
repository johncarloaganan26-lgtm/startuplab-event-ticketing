import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, PasswordInput } from '../../components/Shared';
import { supabase } from "../../supabase/supabaseClient.js";
import { ICONS } from '../../constants';

const parseResetParams = (): URLSearchParams => {
    const merged = new URLSearchParams(window.location.search);
    const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;

    const segments = hash.split('#').filter(Boolean);
    for (const segment of segments) {
        const queryPart = segment.includes('?') ? segment.split('?').slice(1).join('?') : segment;
        if (!queryPart.includes('=')) continue;
        const params = new URLSearchParams(queryPart);
        params.forEach((value, key) => {
            if (!merged.has(key)) merged.set(key, value);
        });
    }

    return merged;
};

const clearResetUrlTokens = () => {
    window.history.replaceState({}, document.title, `${window.location.pathname}#/reset-password`);
};

export const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const resetParams = useMemo(() => parseResetParams(), []);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [recoveryVerified, setRecoveryVerified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (!recoveryVerified) {
                const tokenHash = resetParams.get('token_hash');
                const accessToken = resetParams.get('access_token');
                const refreshToken = resetParams.get('refresh_token');
                const code = resetParams.get('code');

                if (tokenHash) {
                    const { error: verifyErr } = await supabase.auth.verifyOtp({
                        type: 'recovery',
                        token_hash: tokenHash,
                    });
                    if (verifyErr) throw verifyErr;
                } else if (accessToken && refreshToken) {
                    const { error: sessionErr } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (sessionErr) throw sessionErr;
                } else if (code) {
                    const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
                    if (codeErr) throw codeErr;
                } else {
                    throw new Error('Reset link is invalid or expired. Please request a new one.');
                }

                setRecoveryVerified(true);
            }

            const { error: resetError } = await supabase.auth.updateUser({
                password: password
            });

            if (resetError) throw resetError;

            clearResetUrlTokens();
            setMessage('Your password has been successfully updated.');
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            setError(err.message || "Failed to update password. Link may be expired.");
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
                        <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tighter mb-2">Reset Password</h2>
                        <p className="text-[#2E2E2F]/70 text-sm font-medium">Create a new secure password for your account.</p>
                        <div className="w-16 h-1 bg-[#38BDF2] mx-auto mt-4 rounded-full"></div>
                    </div>

                    {!message ? (
                        <form onSubmit={handleResetPassword} className="flex flex-col gap-6">
                            <div className="space-y-4">
                                <PasswordInput
                                    placeholder="New Password"
                                    value={password}
                                    onChange={(e: any) => setPassword(e.target.value)}
                                    required
                                    icon={<ICONS.Lock className="w-5 h-5" />}
                                />
                                <PasswordInput
                                    placeholder="Confirm New Password"
                                    value={confirmPassword}
                                    onChange={(e: any) => setConfirmPassword(e.target.value)}
                                    required
                                    icon={<ICONS.Lock className="w-5 h-5" />}
                                />
                            </div>
                            <div className="mt-2">
                                <Button
                                    className="w-full py-4 text-[13px] font-black uppercase tracking-widest shadow-lg shadow-[#38BDF2]/20"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? 'Updating password...' : 'Update Password'}
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
                            <h3 className="text-xl font-black text-[#2E2E2F] mb-3">Password Updated!</h3>
                            <p className="text-[#2E2E2F]/60 font-bold text-sm mb-4 leading-relaxed">{message}</p>
                            <div className="flex items-center justify-center gap-2 text-[#38BDF2] font-black text-[10px] uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#38BDF2] animate-ping" />
                                Redirecting to login...
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

