import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '../../components/Shared';
import { ICONS } from '../../constants';
import { supabase } from "../../supabase/supabaseClient.js";
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import { UserRole, normalizeUserRole } from '../../types';

const API = import.meta.env.VITE_API_BASE;

const PasswordInput = ({ value, onChange, placeholder, required }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; required?: boolean }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        placeholder={placeholder || 'Password'}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-4 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-normal text-[14px] pr-12"
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2E2E2F]/50 hover:text-[#2E2E2F] transition-colors p-1"
      >
        {showPassword ? (
          <ICONS.EyeOff className="w-5 h-5" />
        ) : (
          <ICONS.Eye className="w-5 h-5" />
        )}
      </button>
    </div>
  );
};

export const LoginPerspective: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    setUser({ role: normalizedRole, email });
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
    setLoading(false);
    showToast('success', 'Signed in successfully!');
    if (normalizedRole === UserRole.ADMIN) {
      navigate('/dashboard');
    } else if (normalizedRole === UserRole.STAFF) {
      navigate('/events');
    } else if (normalizedRole === UserRole.ORGANIZER) {
      navigate('/user-home');
    } else if (normalizedRole === UserRole.ATTENDEE) {
      navigate('/browse-events');
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
              className="mx-auto mb-6 w-[240px] max-w-full h-auto"
              style={{ objectFit: 'contain' }}
            />
            <p className="text-[#2E2E2F]/70 text-lg font-medium">Sign in to your account</p>
            <div className="w-20 h-1 bg-[#38BDF2] mx-auto mt-4 rounded-full"></div>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="space-y-4">
              <Input
                placeholder="Email address"
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
                type="email"
                required
              />
              <div className="space-y-2">
                <PasswordInput
                  value={password}
                  onChange={(e: any) => setPassword(e.target.value)}
                  required
                />
                <div className="flex justify-end pr-1">
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-[12px] font-semibold text-[#38BDF2] hover:text-[#2E2E2F] transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2">
              <Button
                className="w-full py-4 text-[13px] font-black uppercase tracking-widest shadow-lg shadow-[#38BDF2]/20"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Signing you in...' : 'Sign In'}
              </Button>
            </div>

            {error && (
              <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[11px] font-bold text-center animate-in fade-in slide-in-from-top-1 duration-300">
                {error}
              </div>
            )}
          </form>
          <div className="mt-8 pt-6 border-t border-[#2E2E2F]/10 text-center">
            <p className="text-[#2E2E2F]/60 text-sm font-medium">
              Don't have an account?{' '}
              <button
                className="text-[#38BDF2] font-bold hover:text-[#2E2E2F] transition-colors"
                onClick={() => navigate('/signup')}
              >
                Create an Account
              </button>
            </p>
          </div>
        </Card>
        <div className="mt-16 flex flex-col items-center gap-6">
          <button
            className="text-[#2E2E2F]/60 hover:text-[#38BDF2] transition-colors text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2"
            onClick={() => navigate('/')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Event Home
          </button>
        </div>
      </div>
    </div>
  );
};
