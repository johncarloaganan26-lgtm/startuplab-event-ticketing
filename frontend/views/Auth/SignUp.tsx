import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input } from '../../components/Shared';
import { useToast } from '../../context/ToastContext';

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
    if (formData.password.length < 6) {
      const msg = 'Password must be at least 6 characters.';
      setError(msg);
      showToast('error', msg);
      return;
    }
    if (!formData.name.trim()) {
      const msg = 'Name is required.';
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

      const msg = data.message || 'Account created! Please check your email to verify your account before signing in.';
      showToast('success', msg);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      const msg = err?.message || 'Failed to create account.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setIsSubmitting(false);
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
            <p className="text-[#2E2E2F]/70 text-lg font-medium">Create your account</p>
            <div className="w-20 h-1 bg-[#38BDF2] mx-auto mt-4 rounded-full"></div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Full Name"
              placeholder="e.g. John Doe"
              required
              value={formData.name}
              onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              required
              value={formData.email}
              onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              required
              value={formData.password}
              onChange={(e: any) => setFormData({ ...formData, password: e.target.value })}
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              required
              value={formData.confirmPassword}
              onChange={(e: any) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />

            <Button
              type="submit"
              className="w-full mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </Button>

            {error && (
              <div className="mt-2 text-[#2E2E2F] text-sm font-bold text-center">{error}</div>
            )}
          </form>
          <div className="mt-8 pt-6 border-t border-[#2E2E2F]/10 text-center">
            <p className="text-[#2E2E2F]/60 text-sm font-medium">
              Already have an account?{' '}
              <button
                className="text-[#38BDF2] font-bold hover:text-[#2E2E2F] transition-colors"
                onClick={() => navigate('/login')}
              >
                Sign In
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
