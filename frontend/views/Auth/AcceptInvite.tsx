import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Input } from '../../components/Shared';
import { ICONS } from '../../constants';
export const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get('token') || '';
  const token = rawToken.trim().replace(/[?.,;:!]+$/, '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const API = import.meta.env.VITE_API_BASE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    const res = await fetch(`${API}/api/invite/accept-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, name: name.trim() })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Invalid or expired invite');
      return;
    }
    setSuccess('Account created! You can now log in.');
    setTimeout(() => navigate('/login'), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F2F2] px-4">
      <Card className="p-10 w-full max-w-md bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl">
        <h2 className="text-2xl font-black mb-6 text-[#2E2E2F]">Complete Your Account</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5 w-full">
            <label className="block text-sm font-medium text-[#2E2E2F]/70">Full Name</label>
            <div className="relative group/input">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2E2E2F]/40 group-focus-within/input:text-[#38BDF2] transition-colors z-10">
                <ICONS.Users className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-normal text-[14px]"
              />
            </div>
          </div>

          <div className="space-y-1.5 w-full">
            <label className="block text-sm font-medium text-[#2E2E2F]/70">New Password</label>
            <div className="relative group/input">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2E2E2F]/40 group-focus-within/input:text-[#38BDF2] transition-colors z-10">
                <ICONS.Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-normal text-[14px]"
              />
            </div>
          </div>

          <div className="space-y-1.5 w-full">
            <label className="block text-sm font-medium text-[#2E2E2F]/70">Confirm Password</label>
            <div className="relative group/input">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2E2E2F]/40 group-focus-within/input:text-[#38BDF2] transition-colors z-10">
                <ICONS.Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-normal text-[14px]"
              />
            </div>
          </div>
          {error && <div className="text-[#2E2E2F] text-sm font-bold">{error}</div>}
          {success && <div className="text-[#2E2E2F] text-sm font-bold">{success}</div>}
          <Button type="submit" className="w-full">Set Password</Button>
        </form>
      </Card>
    </div>
  );
};

