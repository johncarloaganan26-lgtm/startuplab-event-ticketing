import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, PasswordInput, PasswordRequirements, Checkbox } from '../../components/Shared';
import { useToast } from '../../context/ToastContext';
import { ICONS } from '../../constants';
import { validatePassword } from '../../utils/passwordValidation';

const API = import.meta.env.VITE_API_BASE;

export const SignUpView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      const msg = 'Passwords do not match.';
      setError(msg);
      showToast('error', msg);
      return;
    }
    const passError = validatePassword(formData.password);
    if (passError) {
      setError(passError);
      showToast('error', passError);
      return;
    }
    if (!formData.name.trim()) {
      const msg = 'Name is required.';
      setError(msg);
      showToast('error', msg);
      return;
    }
    if (!agreedToTerms) {
      const msg = 'You must agree to the Terms of Service and Privacy Policy.';
      setError(msg);
      showToast('error', msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message || 'Failed to create account.';
        setError(msg);
        showToast('error', msg);
        setIsSubmitting(false);
        return;
      }

      const msg = data.message || 'Account created. Verify your email, then continue setup.';
      showToast('success', msg);
      navigate('/login', { replace: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create account.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center py-4 px-[5px] overflow-y-auto bg-[#F2F2F2]">
      {/* Decorative side elements */}
      <div className="hidden lg:block absolute left-12 top-1/2 -translate-y-1/2 opacity-[0.03] select-none pointer-events-none">
        <ICONS.Zap className="w-64 h-64 text-[#2E2E2F]" />
      </div>
      <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 opacity-[0.03] select-none pointer-events-none">
        <ICONS.Calendar className="w-64 h-64 text-[#2E2E2F]" />
      </div>
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 p-2 rounded-full text-[#2E2E2F]/40 hover:text-[#38BDF2] hover:bg-white shadow-sm transition-all group"
        title="Go to Home"
      >
        <ICONS.Home className="w-6 h-6" />
      </button>

      <div className="max-w-[540px] w-full relative z-10 origin-center flex flex-col items-center" style={{ zoom: 0.8 }}>
        <Card className="p-6 sm:p-10 border-[#2E2E2F]/10 border-[1.5px] flex flex-col w-full bg-[#F2F2F2] shadow-2xl rounded-xl overflow-hidden">
          <div className="text-center flex flex-col items-center mb-2">
            <img
              src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg"
              alt="StartupLab Business Center Logo"
              className="mx-auto mb-2 w-[160px] h-auto"
              style={{ objectFit: 'contain' }}
            />
            <p className="text-[#2E2E2F]/70 text-[14px] font-medium">Create your account</p>
            <div className="w-16 h-1 bg-[#38BDF2] mx-auto mt-2 rounded-full"></div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                    value={formData.name}
                    onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-11 pr-4 py-2 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-2xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-semibold text-[13px]"
                  />
                </div>
              </div>

              <div className="space-y-1 w-full">
                <label className="block text-[10.5px] font-bold text-[#2E2E2F]/70 tracking-tight ml-1">Email <span className="text-red-500">*</span></label>
                <div className="relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2E2E2F]/40 group-focus-within/input:text-[#38BDF2] transition-colors z-10">
                    <ICONS.Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={formData.email}
                    onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-11 pr-4 py-2 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-2xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-semibold text-[13px]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-[#2E2E2F]/70 tracking-tight ml-1">Password <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  <PasswordInput
                    placeholder="••••••••"
                    required
                    value={formData.password}
                    onChange={(e: any) => setFormData({ ...formData, password: e.target.value })}
                    icon={<ICONS.Lock className="w-4 h-4" />}
                    className="!rounded-2xl"
                  />
                  <PasswordRequirements password={formData.password} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-bold text-[#2E2E2F]/70 tracking-tight ml-1">Confirm Password <span className="text-red-500">*</span></label>
                <PasswordInput
                  placeholder="••••••••"
                  required
                  value={formData.confirmPassword}
                  onChange={(e: any) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  icon={<ICONS.Lock className="w-4 h-4" />}
                  className="!rounded-2xl"
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              <Checkbox
                checked={agreedToTerms}
                onChange={setAgreedToTerms}
                className="px-1"
                label={
                  <span className="text-[11px] text-[#2E2E2F]/60 font-medium leading-relaxed group-hover:text-[#2E2E2F] transition-colors">
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
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </Button>
            </div>

            {error && (
              <div className="mt-1 p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[11px] font-bold text-center">
                {error}
              </div>
            )}
          </form>

          <div className="mt-5 pt-5 border-t border-[#2E2E2F]/10 text-center">
            <p className="text-[#2E2E2F]/60 text-[12px] font-medium">
              Already have an account?{' '}
              <button
                className="text-[#38BDF2] font-black hover:text-[#2E2E2F] transition-colors ml-1"
                onClick={() => navigate('/login')}
              >
                Sign In
              </button>
            </p>
          </div>
        </Card>

      </div>
    </div>
  );
};




