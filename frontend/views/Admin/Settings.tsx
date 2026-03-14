import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Input, Badge, Modal } from '../../components/Shared';
import { ICONS } from '../../constants';
import { UserRole } from '../../types';
import { apiService } from '../../services/apiService';
import { AdminPaymentSettings } from './AdminPaymentSettings';
import { SubscriptionPlans } from './SubscriptionPlans';
import { SupportTickets } from './SupportTickets';
import { useUser } from '../../context/UserContext';

const API_BASE = import.meta.env.VITE_API_BASE;

// Refined granular permissions for staff as per developer brief
type PermissionCategory = 'view_events' | 'edit_events' | 'manual_checkin' | 'receive_notifications';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  imageUrl?: string | null;
  role: string;
  perspective: UserRole;
  status: 'Active' | 'Inactive' | 'Pending';
  isOwner?: boolean;
  permissions: PermissionCategory[];
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SettingsView: React.FC = () => {
  const [userName, setUserName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  React.useEffect(() => {
    // Assume user info is available from context or fetch whoAmI
    const fetchName = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/whoAmI`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUserName(data.name || '');
          setAdminEmail(data.email || '');
        }
      } catch { }
    };
    fetchName();
  }, []);

  const handleSaveName = async () => {
    try {
      await apiService.updateUserName(userName);
      setNotification({ message: 'Name updated successfully.', type: 'success' });
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to update name.', type: 'error' });
    }
  };

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'permissions'>('directory');

  const { role } = useUser();

  const TABS = role === UserRole.STAFF ? [
    { id: 'profile', label: 'Profile & Security', description: 'Personal security' }
  ] : [
    { id: 'team', label: 'Teams & Access', description: 'Internal team management and permissions' },
    { id: 'plans', label: 'Subscription Plans', description: 'Tier configuration' },
    { id: 'email', label: 'Email Configuration', description: 'SMTP server settings' },
    { id: 'payments', label: 'Payment Gateway', description: 'HitPay credentials' },
    { id: 'support', label: 'Support Tickets', description: 'Organizer inquiries' },
    { id: 'profile', label: 'Profile & Security', description: 'Personal security' }
  ];

  type SettingsTab = 'team' | 'plans' | 'email' | 'payments' | 'support' | 'profile';

  const requestedTab = searchParams.get('tab');
  const activeTab = (TABS.some((tab) => tab.id === requestedTab) ? requestedTab : (role === UserRole.STAFF ? 'profile' : 'team')) as SettingsTab;
  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  const activeTabMeta = TABS.find(t => t.id === activeTab) || TABS[0];
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!adminEmail) return;
    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: adminEmail })
      });
      if (!res.ok) throw new Error('Failed to send reset email');
      setNotification({ message: 'Password reset email sent!', type: 'success' });
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to send reset email.', type: 'error' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  React.useEffect(() => {
    fetch(`${API_BASE}/api/users/all`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        const mapped = Array.isArray(data)
          ? data
            .map(u => {
              const rawRole = String(u.role || '').toUpperCase();
              const role = rawRole === 'USER' ? UserRole.ORGANIZER : rawRole;
              if (role !== UserRole.ADMIN && role !== UserRole.STAFF && role !== UserRole.ORGANIZER) return null;
              return {
                id: u.userId,
                name: u.name || '',
                email: u.email,
                imageUrl: u.imageUrl || null,
                role,
                perspective: role as UserRole,
                permissions: [
                  ...(u.canViewEvents ? ['view_events'] : []),
                  ...(u.canEditEvents ? ['edit_events'] : []),
                  ...(u.canManualCheckIn ? ['manual_checkin'] : []),
                  ...(u.canReceiveNotifications ? ['receive_notifications'] : [])
                ],
              } as TeamMember;
            })
            .filter((member): member is TeamMember => member !== null)
          : [];
        const sorted = mapped.sort((a, b) => {
          const rank = { [UserRole.ADMIN]: 0, [UserRole.STAFF]: 1, [UserRole.ORGANIZER]: 2 } as const;
          const aRank = rank[a.perspective] ?? 99;
          const bRank = rank[b.perspective] ?? 99;
          if (aRank !== bRank) return aRank - bRank;
          return a.name.localeCompare(b.name);
        });
        setTeamMembers(sorted);
      });
  }, []);

  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'STAFF',
    perspective: UserRole.STAFF,
    permissions: ['view_events'] as PermissionCategory[]
  });

  const toggleMemberPermission = async (memberId: string, perm: PermissionCategory) => {
    const target = teamMembers.find(m => m.id === memberId && m.perspective === UserRole.STAFF);
    if (!target) return;
    const hasPerm = target.permissions.includes(perm);
    const nextPerms = hasPerm
      ? target.permissions.filter(p => p !== perm)
      : [...target.permissions, perm];

    // Optimistic update
    setTeamMembers(prev => prev.map(m => m.id === memberId ? { ...m, permissions: nextPerms } : m));

    const payload = {
      canViewEvents: nextPerms.includes('view_events'),
      canEditEvents: nextPerms.includes('edit_events'),
      canManualCheckIn: nextPerms.includes('manual_checkin'),
      canReceiveNotifications: nextPerms.includes('receive_notifications'),
    };

    try {
      await apiService.updateUserPermissions(memberId, payload);
    } catch (err) {
      // rollback on failure
      setTeamMembers(prev => prev.map(m => m.id === memberId ? { ...m, permissions: target.permissions } : m));
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = inviteData.email.split('@')[0] || inviteData.email;
    const res = await fetch(`${API_BASE}/api/invite/create-and-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: inviteData.email,
        role: UserRole.STAFF,
      })
    });
    if (!res.ok) {
      return;
    }
    const newMember: TeamMember = {
      id: Math.random().toString(36).substr(2, 9),
      name: displayName,
      email: inviteData.email,
      role: 'STAFF',
      perspective: UserRole.STAFF,
      status: 'Pending',
      permissions: inviteData.permissions
    };
    setTeamMembers(prev => [...prev, newMember]);
    setInviteData({ email: '', role: 'STAFF', perspective: UserRole.STAFF, permissions: ['view_events'] });
    setIsInviteModalOpen(false);
    setNotification({ message: 'Invitation sent successfully.', type: 'success' });
  };

  const PermissionShield: React.FC<{ active?: boolean, onClick?: () => void, disabled?: boolean, iconType?: 'shield' | 'bell' }> = ({ active = false, onClick, disabled = false, iconType = 'shield' }) => (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${disabled
        ? 'text-[#2E2E2F]/40 bg-[#F2F2F2] cursor-not-allowed opacity-60'
        : active
          ? 'text-[#F2F2F2] bg-[#38BDF2]'
          : 'text-[#2E2E2F]/40 bg-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2]'
        }`}
    >
      {iconType === 'bell' ? (
        <ICONS.Bell className="w-4 h-4" />
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="space-y-10 pb-20">
      {notification && (
        <div className="fixed top-24 right-8 z-[120] animate-in slide-in-from-right-10 duration-500">
          <Card className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-xl border ${notification.type === 'success' ? 'bg-[#F2F2F2] border-[#38BDF2]/20 text-[#2E2E2F]' : 'bg-[#F2F2F2] border-red-200 text-[#2E2E2F]'}`}>
            <div className={`p-2 rounded-xl ${notification.type === 'success' ? 'bg-[#38BDF2] text-[#F2F2F2] shadow-lg shadow-[#38BDF2]/30' : 'bg-red-500 text-white shadow-lg shadow-red-500/30'}`}>
              {notification.type === 'success' ? <ICONS.CheckCircle className="w-5 h-5" /> : <ICONS.Layout className="w-5 h-5" />}
            </div>
            <p className="font-black text-sm tracking-tight">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="ml-4 text-[#2E2E2F]/40 hover:text-[#2E2E2F] text-xl font-black transition-colors">&times;</button>
          </Card>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#2E2E2F] tracking-tighter">Settings</h1>
          <p className="text-[#2E2E2F]/70 font-medium text-sm mt-1 text-balance">Configure organizational parameters and visualize system architecture.</p>
        </div>
      </div>

      <div className="mt-8">
        {activeTab === 'team' && (
          <div className="space-y-10">
            {/* Sub-navigation for Team */}
            <div className="flex justify-end border-b border-[#2E2E2F]/10 pb-2">
              <div className="flex bg-[#F2F2F2] p-1 rounded-2xl border border-[#2E2E2F]/10 shrink-0">
                {[
                  { id: 'directory', label: 'Directory' },
                  { id: 'permissions', label: 'Access Control' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id as any)}
                    className={`min-h-[32px] px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors ${activeSubTab === tab.id ? 'bg-[#38BDF2] text-[#F2F2F2]' : 'bg-[#F2F2F2] text-[#2E2E2F] hover:bg-[#2E2E2F] hover:text-[#F2F2F2]'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeSubTab === 'directory' ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] mb-3 ml-1">Team Directory</label>
                  <Button onClick={() => setIsInviteModalOpen(true)}>
                    <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                      <ICONS.Users className="w-3.5 h-3.5" />
                      Invite a Team Member
                    </span>
                  </Button>
                </div>
                <Card className="overflow-hidden border-[#2E2E2F]/10 rounded-[2.5rem] bg-[#F2F2F2]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#F2F2F2] border-b border-[#2E2E2F]/10">
                        <tr>
                          <th className="px-10 py-6 text-[9px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em]">Name</th>
                          <th className="px-10 py-6 text-[9px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em]">Position</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2E2E2F]/10">
                        {teamMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-[#38BDF2]/10 transition-colors group">
                            <td className="px-10 py-8">
                              <div className="flex items-center gap-5">
                                <div className={`w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center font-black text-lg ${member.isOwner ? 'bg-[#38BDF2] text-[#F2F2F2]' : 'bg-[#38BDF2] text-[#F2F2F2]'}`}>
                                  {member.imageUrl ? (
                                    <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                                  ) : (
                                    member.name.charAt(0)
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-3 mb-1">
                                    <div className="font-black text-[#2E2E2F] text-[15px] tracking-tight">{member.name}</div>
                                    {member.isOwner && (
                                      <div className="bg-[#38BDF2] text-[#F2F2F2] text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest">owner</div>
                                    )}
                                  </div>
                                  <div className="text-[12px] text-[#2E2E2F]/60 font-bold tracking-tight">{member.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-10 py-8">
                              <div className="text-[13px] font-black text-[#2E2E2F] uppercase tracking-widest">{member.role}</div>
                              <div className="text-[10px] font-bold text-[#2E2E2F]/60 uppercase tracking-[0.2em] mt-1">{member.perspective} HUB</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] mb-3 ml-1">Access Control</label>
                  <Badge type="info" className="font-black text-[9px] tracking-widest uppercase bg-[#38BDF2]/20 text-[#2E2E2F]">Manage Team Permissions</Badge>
                </div>
                <Card className="overflow-hidden border-[#2E2E2F]/10 rounded-[2.5rem] bg-[#F2F2F2]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#F2F2F2] border-b border-[#2E2E2F]/10">
                        <tr>
                          <th className="px-10 py-6 text-[9px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em]">Name</th>
                          <th className="px-6 py-6 text-[9px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] text-center">View Events</th>
                          <th className="px-6 py-6 text-[9px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] text-center">Edit Events</th>
                          <th className="px-6 py-6 text-[9px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] text-center">Check-in</th>
                          <th className="px-6 py-6 text-[9px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] text-center">Notify</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2E2E2F]/10">
                        {teamMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-[#38BDF2]/10 transition-colors group">
                            <td className="px-10 py-8">
                              <div className="flex items-center gap-5">
                                <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center font-black text-sm ${member.isOwner ? 'bg-[#38BDF2] text-[#F2F2F2]' : 'bg-[#38BDF2] text-[#2E2E2F]'}`}>
                                  {member.imageUrl ? (
                                    <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                                  ) : (
                                    member.name.charAt(0)
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <div className="font-black text-[#2E2E2F] text-[14px] tracking-tight">{member.name}</div>
                                  </div>
                                  <div className="text-[10px] text-[#2E2E2F]/60 font-black uppercase tracking-widest">{member.role}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-8">
                              <div className="flex justify-center">
                                <PermissionShield active={member.permissions.includes('view_events')} disabled={member.perspective !== UserRole.STAFF} onClick={() => toggleMemberPermission(member.id, 'view_events')} />
                              </div>
                            </td>
                            <td className="px-6 py-8">
                              <div className="flex justify-center">
                                <PermissionShield active={member.permissions.includes('edit_events')} disabled={member.perspective !== UserRole.STAFF} onClick={() => toggleMemberPermission(member.id, 'edit_events')} />
                              </div>
                            </td>
                            <td className="px-6 py-8">
                              <div className="flex justify-center">
                                <PermissionShield active={member.permissions.includes('manual_checkin')} disabled={member.perspective !== UserRole.STAFF} onClick={() => toggleMemberPermission(member.id, 'manual_checkin')} />
                              </div>
                            </td>
                            <td className="px-6 py-8">
                              <div className="flex justify-center">
                                <PermissionShield iconType="bell" active={member.permissions.includes('receive_notifications')} disabled={member.perspective !== UserRole.STAFF} onClick={() => toggleMemberPermission(member.id, 'receive_notifications')} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
        {activeTab === 'plans' && <SubscriptionPlans />}
        {activeTab === 'email' && <AdminEmailSettings setNotification={setNotification} />}
        {activeTab === 'payments' && <AdminPaymentSettings />}
        {activeTab === 'support' && <SupportTickets />}
        {activeTab === 'profile' && (
          <div className="space-y-8 max-w-2xl">
            <Card className="p-10 border-[#2E2E2F]/10 rounded-[2.5rem] bg-[#F2F2F2]">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-xl bg-[#38BDF2]/10 text-[#38BDF2] flex items-center justify-center">
                  <ICONS.Users className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#2E2E2F] uppercase tracking-wider">Admin Profile</h3>
                  <p className="text-[10px] text-[#2E2E2F]/40 font-bold uppercase tracking-widest mt-0.5">Manage your personal identification</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em] ml-1">Full Name</label>
                  <Input
                    value={userName}
                    onChange={(e: any) => setUserName(e.target.value)}
                    placeholder="StartupLab Admin"
                    className="font-bold text-[#2E2E2F]"
                  />
                </div>
                <div className="space-y-1.5 opacity-60">
                  <label className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em] ml-1">Email Address</label>
                  <div className="px-5 py-3.5 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl text-xs text-[#2E2E2F] font-bold">
                    {adminEmail}
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button
                    className="rounded-xl px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.2em]"
                    onClick={handleSaveName}
                  >
                    Save Profile
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-10 border-[#2E2E2F]/10 rounded-[2.5rem] bg-[#F2F2F2]">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
                  <ICONS.Shield className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#2E2E2F] uppercase tracking-wider">Security</h3>
                  <p className="text-[10px] text-[#2E2E2F]/40 font-bold uppercase tracking-widest mt-0.5">Manage your authentication credentials</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 rounded-3xl bg-[#F2F2F2] border border-[#2E2E2F]/5">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#2E2E2F]">Password Protection</h4>
                    <p className="text-[11px] text-[#2E2E2F]/50 font-medium tracking-tight">Generate a secure reset link</p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl px-5 py-2 text-[10px] font-black uppercase tracking-widest border-[#2E2E2F]/10"
                    onClick={handleResetPassword}
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? 'Sending link...' : 'Change Password'}
                  </Button>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex gap-3">
                  <ICONS.Layout className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-orange-800 font-medium leading-relaxed">
                    By clicking "Change Password", you will receive a reset link at <strong>{adminEmail}</strong>. This email is sent using your configured Admin SMTP settings.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invite Team Member" size="lg">
        <form onSubmit={handleInviteSubmit} className="space-y-10 px-2">
          <div className="space-y-6">
            <Input label="Work Email" type="email" placeholder="j.miller@startuplab.co" required className="w-full py-5 px-6 rounded-2xl bg-[#F2F2F2] border-[#2E2E2F]/20 text-base" value={inviteData.email} onChange={(e: any) => setInviteData({ ...inviteData, email: e.target.value })} />
            <Input label="Assigned Position" value="STAFF" disabled className="w-full py-5 px-6 rounded-2xl bg-[#F2F2F2] border-[#2E2E2F]/20 text-[#2E2E2F]/60 text-base" />
          </div>
          <div className="pt-8 flex flex-col sm:flex-row gap-4">
            <Button className="flex-1" onClick={() => setIsInviteModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="flex-[2]">Send Invite</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const AdminEmailSettings: React.FC<{ setNotification: any }> = ({ setNotification }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  const [formData, setFormData] = useState({
    emailProvider: 'SMTP',
    mailDriver: 'smtp',
    smtpHost: '',
    smtpPort: '587',
    smtpUsername: '',
    smtpPassword: '',
    mailEncryption: 'TLS',
    fromAddress: '',
    fromName: ''
  });

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const data = await apiService.getSmtpSettings();
        if (data && Object.keys(data).length > 0) {
          setFormData(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error('Failed to load SMTP settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiService.updateSmtpSettings(formData);
      setNotification({ message: 'Email settings saved successfully!', type: 'success' });
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to save settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testRecipient) {
      setNotification({ message: 'Please enter a recipient email for the test.', type: 'error' });
      return;
    }
    try {
      setTesting(true);
      await apiService.testSmtpSettings({ ...formData, recipientEmail: testRecipient });
      setNotification({ message: 'Test email sent! Please check your inbox.', type: 'success' });
    } catch (err: any) {
      setNotification({ message: err.message || 'SMTP test failed.', type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="p-8 font-black text-[10px] text-[#2E2E2F]/40 uppercase tracking-widest">Loading Gateway Configuration...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6">
        <div className="pl-6">
          <h1 className="text-xl font-bold text-[#2E2E2F] tracking-tight">
            Email Settings
          </h1>
          <p className="text-[#2E2E2F]/40 text-[11px] mt-1.5 font-bold">
            Configure server parameters for system-wide mail transmission and verification
          </p>
        </div>
        <Button
          onClick={handleSave}
          className="bg-[#38BDF2] hover:bg-[#2E2E2F] text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm active:scale-95"
          disabled={saving}
        >
          <ICONS.CheckCircle className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <Card className="lg:col-span-2 p-8 rounded-3xl bg-[#F2F2F2] border-[#2E2E2F]/10 shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#2E2E2F]/40 uppercase tracking-widest pl-1">Email Provider</label>
              <select
                name="emailProvider"
                value={formData.emailProvider}
                onChange={handleChange}
                className="w-full px-6 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-full outline-none focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] font-medium text-[#2E2E2F] transition-all hover:bg-[#F2F2F2]/80 px-6 py-3"
              >
                <option value="SMTP">SMTP Server</option>
                <option value="SES">Amazon SES</option>
                <option value="Mailgun">Mailgun</option>
                <option value="SendGrid">SendGrid</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#2E2E2F]/40 uppercase tracking-widest pl-1">Mail Driver</label>
              <Input
                name="mailDriver"
                value={formData.mailDriver}
                onChange={handleChange}
                placeholder="smtp"
                className="bg-[#F2F2F2] border border-[#2E2E2F]/10 focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] transition-all rounded-full px-6"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#2E2E2F]/40 uppercase tracking-widest pl-1">SMTP Host</label>
              <Input
                name="smtpHost"
                value={formData.smtpHost}
                onChange={handleChange}
                placeholder="mail.yourserver.com"
                className="bg-[#F2F2F2] border border-[#2E2E2F]/10 focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] transition-all rounded-full px-6"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#2E2E2F]/40 uppercase tracking-widest pl-1">SMTP Port</label>
              <Input
                name="smtpPort"
                value={formData.smtpPort}
                onChange={handleChange}
                placeholder="587"
                className="bg-[#F2F2F2] border border-[#2E2E2F]/10 focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] transition-all rounded-full px-6"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#2E2E2F]/40 uppercase tracking-widest pl-1">SMTP Username</label>
              <Input
                name="smtpUsername"
                value={formData.smtpUsername}
                onChange={handleChange}
                placeholder="hello@example.com"
                className="bg-[#F2F2F2] border border-[#2E2E2F]/10 focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] transition-all rounded-full px-6"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#2E2E2F]/40 uppercase tracking-widest pl-1">SMTP Password</label>
              <Input
                type="password"
                name="smtpPassword"
                value={formData.smtpPassword}
                onChange={handleChange}
                placeholder="••••••••••••"
                className="bg-[#F2F2F2] border border-[#2E2E2F]/10 focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] transition-all rounded-full px-6"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#2E2E2F]/40 uppercase tracking-widest pl-1">Mail Encryption</label>
              <select
                name="mailEncryption"
                value={formData.mailEncryption}
                onChange={handleChange}
                className="w-full px-6 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-full outline-none focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] font-medium text-[#2E2E2F] transition-all hover:bg-[#F2F2F2]/80 px-6 py-3"
              >
                <option value="TLS">TLS</option>
                <option value="SSL">SSL</option>
                <option value="NONE">None</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#2E2E2F]/40 uppercase tracking-widest pl-1">From Address</label>
              <Input
                name="fromAddress"
                value={formData.fromAddress}
                onChange={handleChange}
                placeholder="no-reply@example.com"
                className="bg-[#F2F2F2] border border-[#2E2E2F]/10 focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] transition-all rounded-full px-6"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[11px] font-black text-[#2E2E2F]/40 uppercase tracking-widest pl-1">From Name</label>
              <Input
                name="fromName"
                value={formData.fromName}
                onChange={handleChange}
                placeholder="Your Organization Name"
                className="bg-[#F2F2F2] border border-[#2E2E2F]/10 focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] transition-all rounded-full px-6"
              />
            </div>
          </div>
        </Card>

        {/* Sidebar - Test Configuration */}
        <div className="space-y-6">
          <Card className="p-8 rounded-3xl bg-[#F2F2F2] border-[#2E2E2F]/10 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#38BDF2]/10 flex items-center justify-center text-[#38BDF2]">
                <ICONS.Send className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-black text-[#2E2E2F] tracking-tight">Test Configuration</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#2E2E2F]/50 uppercase pl-1">Send Test To</label>
                <Input
                  value={testRecipient}
                  onChange={(e: any) => setTestRecipient(e.target.value)}
                  placeholder="test@example.com"
                  className="bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-full px-6"
                />
              </div>
              <p className="text-[10px] text-[#2E2E2F]/40 font-medium pl-1">
                Enter an email address to send a test message to verify your settings.
              </p>
              <Button
                onClick={handleTest}
                className="w-full bg-[#38BDF2] hover:bg-[#2E2E2F] text-white py-3 rounded-2xl font-black text-xs tracking-widest flex items-center justify-center gap-2 transition-all uppercase shadow-md"
                disabled={testing}
              >
                <ICONS.Send className="w-3.5 h-3.5" />
                {testing ? 'Sending...' : 'Send Test Email'}
              </Button>
            </div>
          </Card>

          <div className="p-6 rounded-2xl bg-[#38BDF2]/5 border-2 border-[#38BDF2]/20 relative overflow-hidden group hover:bg-[#38BDF2]/10 transition-colors">
            <div className="absolute top-0 right-0 p-2">
              <ICONS.Bell className="w-4 h-4 text-[#38BDF2]/40" />
            </div>
            <h4 className="text-[11px] font-black text-[#38BDF2] uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF2] animate-pulse" />
              Security Tip
            </h4>
            <p className="text-[11px] text-[#2E2E2F] leading-relaxed font-bold">
              When using Gmail, you must use a dedicated <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-[#38BDF2] underline decoration-2 underline-offset-2 hover:text-[#2E2E2F] transition-colors">App Password</a> rather than your main password.
            </p>
            <p className="text-[10px] text-[#2E2E2F]/50 mt-2 font-medium">
              This ensures secure access and bypasses 2FA requirements for the SMTP server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
