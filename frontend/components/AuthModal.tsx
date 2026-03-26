import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, PasswordInput, PasswordRequirements, Checkbox } from './Shared';
import { ICONS } from '../constants';
import { supabase } from "../supabase/supabaseClient.js";
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { UserRole, normalizeUserRole } from '../types';
import { validatePassword } from '../utils/passwordValidation';

const API = import.meta.env.VITE_API_BASE;

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'login' | 'signup' | 'forgot-password';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialView = 'login' }) => {
  const [view, setView] = useState<'login' | 'signup' | 'forgot-password'>(initialView);
  const navigate = useNavigate();
  const { setUser } = useUser();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signup States
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Forgot Password States
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setError('');
      setForgotMessage('');
    }
  }, [isOpen, initialView]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    
    if (loginError || !data.session) {
      setLoading(false);
      const msg = loginError?.message || "Incorrect email or password.";
      setError(msg);
      showToast('error', msg);
      return;
    }

    const roleRes = await fetch(`${API}/api/user/role-by-email?email=${encodeURIComponent(email)}`);
    if (!roleRes.ok) {
      setLoading(false);
      const msg = 'Account not found or not authorized.';
      setError(msg);
      showToast('error', msg);
      return;
    }

    const userData = await roleRes.json().catch(() => null);
    const normalizedRole = normalizeUserRole(userData?.role);
    if (!normalizedRole) {
      setLoading(false);
      const msg = 'Account not found or not authorized.';
      setError(msg);
      showToast('error', msg);
      return;
    }

    const isOnboarded = !!userData?.isOnboarded;
    setUser({ userId: data.user.id, role: normalizedRole, email, isOnboarded });
    
    const { access_token, refresh_token } = data.session;
    const response = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ access_token, refresh_token })
    });

    if (!response.ok) {
      setLoading(false);
      const result = await response.json().catch(() => ({}));
      const msg = result.message || "Failed to store session";
      setError(msg);
      showToast('error', msg);
      return;
    }

    localStorage.removeItem("sb-ddkkbtijqrgpitncxylx-auth-token");
    
    if (!data.user?.email_confirmed_at) {
      setLoading(false);
      showToast('info', 'Please confirm your email address if you haven\'t already.');
      await supabase.auth.signOut();
      return;
    }

    setLoading(false);
    showToast('success', 'Welcome back!');
    onClose();

    // Redirection logic
    if (normalizedRole === UserRole.ADMIN) {
      navigate('/dashboard');
    } else if (normalizedRole === UserRole.STAFF) {
      navigate('/events');
    } else if (normalizedRole === UserRole.ORGANIZER) {
      navigate(isOnboarded ? '/user-home' : '/onboarding');
    } else if (normalizedRole === UserRole.ATTENDEE) {
      navigate('/browse-events');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (signupData.password !== signupData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const passError = validatePassword(signupData.password);
    if (passError) {
      setError(passError);
      showToast('error', passError);
      return;
    }
    if (!signupData.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!agreedToTerms) {
      setError('You must agree to the terms.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupData.name.trim(),
          email: signupData.email.trim().toLowerCase(),
          password: signupData.password
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || 'Failed to create account.';
        setError(msg);
        showToast('error', msg);
        return;
      }

      showToast('success', data.message || 'Account created. Verify your email to continue.');
      setView('login');
      setEmail(signupData.email);
    } catch (err: any) {
      setError(err?.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setForgotMessage('');
    setError('');

    try {
      const response = await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || 'Failed to send reset link');

      const msg = 'Check your email for the password reset link.';
      setForgotMessage(msg);
      showToast('success', msg);
    } catch (err: any) {
      const errMsg = err.message || "An error occurred. Please try again.";
      setError(errMsg);
      showToast('error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center py-8 px-[5px] overflow-y-auto bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      {/* Decorative side elements */}
      <div className="hidden lg:block absolute left-12 top-1/2 -translate-y-1/2 opacity-[0.03] select-none pointer-events-none">
        <ICONS.Zap className="w-64 h-64 text-[#2E2E2F]" />
      </div>
      <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 opacity-[0.03] select-none pointer-events-none">
        <ICONS.Calendar className="w-64 h-64 text-[#2E2E2F]" />
      </div>

      <div 
        className="max-w-[540px] w-full relative origin-center animate-in zoom-in-95 duration-300"
        style={{ zoom: 0.8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="p-8 sm:p-10 border-[#2E2E2F]/10 border-[1.5px] flex flex-col w-full bg-[#F2F2F2] shadow-2xl rounded-xl overflow-hidden relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full text-[#2E2E2F]/20 hover:text-[#38BDF2] hover:bg-white shadow-sm transition-all"
          >
            <ICONS.X className="w-5 h-5" />
          </button>

          <div className="text-center flex flex-col items-center mb-8">
            <img
              src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg"
              alt="Logo"
              className="mx-auto mb-4 w-[180px] max-w-full h-auto"
              style={{ objectFit: 'contain' }}
            />
            <p className="text-[#2E2E2F]/70 text-base font-medium">
              {view === 'login' ? 'Sign in to your account' : view === 'signup' ? 'Create a new account' : 'Reset your password'}
            </p>
            <div className="w-16 h-1 bg-[#38BDF2] mx-auto mt-3 rounded-full"></div>
          </div>

          {view === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="space-y-4">
                <div className="space-y-1.5 w-full">
                  <label className="block text-[10.5px] font-bold text-[#2E2E2F]/70 tracking-tight ml-1">Email Address <span className="text-red-500">*</span></label>
                  <div className="relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2E2E2F]/40 group-focus-within/input:text-[#38BDF2] transition-colors z-10">
                      <ICONS.Mail className="w-5 h-5" />
                    </div>
                    <input
                      type="email"
                      placeholder="e.g. you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-3.5 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-2xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-semibold text-[14px]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10.5px] font-bold text-[#2E2E2F]/70 tracking-tight ml-1">Password <span className="text-red-500">*</span></label>
                  <div className="space-y-2">
                    <PasswordInput
                      value={password}
                      onChange={(e: any) => setPassword(e.target.value)}
                      required
                      icon={<ICONS.Lock className="w-5 h-5" />}
                      className="!rounded-2xl"
                    />
                    <div className="flex justify-end pr-1">
                      <button
                        type="button"
                        onClick={() => setView('forgot-password')}
                        className="text-[11px] font-bold text-[#38BDF2] hover:text-[#2E2E2F] transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                className="w-full py-4 text-[13px] font-black uppercase tracking-[0.2em] rounded-2xl"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Wait...' : 'Sign In'}
              </Button>

              <div className="mt-4 pt-4 border-t border-[#2E2E2F]/10 text-center">
                <p className="text-[#2E2E2F]/60 text-[13px] font-medium">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    className="text-[#38BDF2] font-black hover:text-[#2E2E2F] transition-colors ml-1"
                    onClick={() => setView('signup')}
                  >
                    Create Account
                  </button>
                </p>
              </div>
            </form>
          )}

          {view === 'signup' && (
            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <div className="space-y-3">
                <div className="space-y-1 w-full">
                  <label className="block text-[10.5px] font-bold text-[#2E2E2F]/70 tracking-tight ml-1">Full Name <span className="text-red-500">*</span></label>
                  <div className="relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2E2E2F]/40 group-focus-within/input:text-[#38BDF2] transition-colors z-10">
                      <ICONS.Users className="w-4 h-4" />
                    </div>
                    <input
                      placeholder="e.g. John Doe"
                      required
                      value={signupData.name}
                      onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                      className="w-full pl-11 pr-4 py-2.5 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-2xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-semibold text-[13px]"
                    />
                  </div>
                </div>

                <div className="space-y-1 w-full">
                  <label className="block text-[10.5px] font-bold text-[#2E2E2F]/70 tracking-tight ml-1">Email Address <span className="text-red-500">*</span></label>
                  <div className="relative group/input">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2E2E2F]/40 group-focus-within/input:text-[#38BDF2] transition-colors z-10">
                      <ICONS.Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      required
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      className="w-full pl-11 pr-4 py-2.5 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-2xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-semibold text-[13px]"
                    />
                  </div>
                </div>

                <div className="space-y-1 w-full">
                  <label className="block text-[10.5px] font-bold text-[#2E2E2F]/70 tracking-tight ml-1">Password <span className="text-red-500">*</span></label>
                  <PasswordInput
                    placeholder="••••••••"
                    required
                    value={signupData.password}
                    onChange={(e: any) => setSignupData({ ...signupData, password: e.target.value })}
                    icon={<ICONS.Lock className="w-4 h-4" />}
                    className="!rounded-2xl py-2.5"
                  />
                </div>
                <PasswordRequirements password={signupData.password} />
                <div className="space-y-1 w-full">
                  <label className="block text-[10.5px] font-bold text-[#2E2E2F]/70 tracking-tight ml-1">Confirm Password <span className="text-red-500">*</span></label>
                  <PasswordInput
                    placeholder="••••••••"
                    required
                    value={signupData.confirmPassword}
                    onChange={(e: any) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                    icon={<ICONS.Lock className="w-4 h-4" />}
                    className="!rounded-2xl py-2.5"
                  />
                </div>
              </div>

              <Checkbox
                checked={agreedToTerms}
                onChange={setAgreedToTerms}
                className="px-1"
                label={
                  <span className="text-[11px] text-[#2E2E2F]/60 font-medium leading-relaxed">
                    I agree to the{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[#38BDF2] font-bold hover:underline">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[#38BDF2] font-bold hover:underline">Privacy Policy</a>.
                  </span>
                }
              />

              <Button
                type="submit"
                className="w-full py-4 text-[13px] font-black uppercase tracking-[0.2em] rounded-2xl"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Account'}
              </Button>

              <div className="mt-4 pt-4 border-t border-[#2E2E2F]/10 text-center">
                <p className="text-[#2E2E2F]/60 text-[13px] font-medium">
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="text-[#38BDF2] font-black hover:text-[#2E2E2F] transition-colors ml-1"
                    onClick={() => setView('login')}
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </form>
          )}

          {view === 'forgot-password' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {!forgotMessage ? (
                <form onSubmit={handleForgotRequest} className="flex flex-col gap-5">
                  <p className="text-[#2E2E2F]/60 text-[13px] font-medium text-center leading-relaxed">
                    Enter your email and we'll send you a link to reset your password.
                  </p>
                  <div className="space-y-1.5 w-full text-left">
                    <label className="block text-[10.5px] font-bold text-[#2E2E2F]/70 tracking-tight ml-1">Email Address <span className="text-red-500">*</span></label>
                    <div className="relative group/input">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2E2E2F]/40 group-focus-within/input:text-[#38BDF2] transition-all z-10">
                        <ICONS.Mail className="w-5 h-5" />
                      </div>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        className="w-full pl-12 pr-4 py-3.5 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-2xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-semibold text-[14px]"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full py-4 text-[13px] font-black uppercase tracking-[0.2em] rounded-2xl"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? 'Wait...' : 'Send Link'}
                  </Button>
                  <button 
                    type="button"
                    onClick={() => setView('login')}
                    className="text-[11px] font-bold text-[#2E2E2F]/40 hover:text-[#38BDF2] transition-colors"
                  >
                    Back to Sign In
                  </button>
                </form>
              ) : (
                <div className="text-center py-4">
                  <p className="text-[#2E2E2F]/60 font-bold text-[13px] mb-6">{forgotMessage}</p>
                  <Button
                    className="w-full py-4 text-[11px] font-black uppercase tracking-widest rounded-[5px]"
                    onClick={() => setView('login')}
                  >
                    Back to Sign In
                  </Button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[11px] font-bold text-center animate-in shake duration-300">
              {error}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
