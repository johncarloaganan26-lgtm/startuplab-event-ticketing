import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, Modal } from '../../components/Shared';
import { ICONS } from '../../constants';
import { UserRole } from '../../types';
import { apiService } from '../../services/apiService';

const API_BASE = import.meta.env.VITE_API_BASE;

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

export const TeamSettings: React.FC = () => {
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'directory' | 'permissions'>('directory');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isInviting, setIsInviting] = useState(false);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [staffLimit, setStaffLimit] = useState<{ allowed: boolean; message?: string; limit?: number; current?: number } | null>(null);

    const refreshTeamData = async () => {
        try {
            // Fetch staff limit
            const limitRes = await fetch(`${API_BASE}/api/invite/check-limit`, { credentials: 'include' });
            if (limitRes.ok) {
                const limitData = await limitRes.json();
                setStaffLimit(limitData);
            }

            // Fetch team members
            const res = await fetch(`${API_BASE}/api/users/all?teamOnly=true`, { credentials: 'include' });
            const data = await res.json();

            // Fetch pending invites to show in UI
            const inviteRes = await fetch(`${API_BASE}/api/invite/list-invites`, { credentials: 'include' });
            const pendingInvites = inviteRes.ok ? await inviteRes.json() : [];

            const mapped = Array.isArray(data)
                ? data
                    .map(u => {
                        const rawRole = String(u.role || '').toUpperCase();
                        const role = rawRole === 'USER' ? UserRole.ORGANIZER : rawRole;
                        if (role !== UserRole.ADMIN && role !== UserRole.STAFF && role !== UserRole.ORGANIZER) return null;
                        const isOwner = role === UserRole.ORGANIZER;
                        return {
                            id: u.userId,
                            name: u.name || '',
                            email: u.email,
                            imageUrl: u.imageUrl || null,
                            role,
                            perspective: role as UserRole,
                            status: 'Active',
                            isOwner,
                            permissions: isOwner
                                ? ['view_events', 'edit_events', 'manual_checkin', 'receive_notifications']
                                : [
                                    ...(u.canViewEvents ? ['view_events'] : []),
                                    ...(u.canEditEvents ? ['edit_events'] : []),
                                    ...(u.canManualCheckIn ? ['manual_checkin'] : []),
                                    ...(u.canReceiveNotifications ? ['receive_notifications'] : [])
                                ],
                        } as TeamMember;
                    })
                    .filter((member): member is TeamMember => member !== null)
                : [];

            // Add pending invites to list
            if (Array.isArray(pendingInvites)) {
                pendingInvites.forEach(inv => {
                    // Check if already in list by email (in case they just accepted but invite row still exists)
                    if (!mapped.some(m => m.email.toLowerCase() === inv.email.toLowerCase())) {
                        mapped.push({
                            id: inv.inviteId || `pending-${inv.email}`,
                            name: inv.email.split('@')[0],
                            email: inv.email,
                            role: inv.role || 'STAFF',
                            perspective: (inv.role || 'STAFF') as UserRole,
                            status: 'Pending',
                            permissions: ['view_events']
                        });
                    }
                });
            }

            const sorted = mapped.sort((a, b) => {
                const rank = { [UserRole.ORGANIZER]: 0, [UserRole.ADMIN]: 1, [UserRole.STAFF]: 2 } as const;
                const aRank = rank[a.perspective] ?? 99;
                const bRank = rank[b.perspective] ?? 99;
                if (aRank !== bRank) return aRank - bRank;
                return a.name.localeCompare(b.name);
            });
            setTeamMembers(sorted);
        } catch (err) {
            console.error("Failed to load team data", err)
        }
    };

    useEffect(() => {
        refreshTeamData();
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
        if (!inviteData.email.trim()) {
            setNotification({ message: 'Email is required.', type: 'error' });
            return;
        }

        setIsInviting(true);
        const displayName = inviteData.email.split('@')[0] || inviteData.email;
        try {
            const res = await fetch(`${API_BASE}/api/invite/create-and-send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    email: inviteData.email.trim(),
                    role: UserRole.STAFF,
                    name: displayName
                })
            });

            if (!res.ok) {
                const errorPayload = await res.json().catch(() => ({}));
                setNotification({ message: errorPayload?.error || 'Failed to send invitation.', type: 'error' });
                return;
            }

            const newMember: TeamMember = {
                id: `pending-${Date.now()}`,
                name: displayName,
                email: inviteData.email.trim(),
                role: 'STAFF',
                perspective: UserRole.STAFF,
                status: 'Pending',
                permissions: inviteData.permissions
            };
            setTeamMembers(prev => [...prev, newMember]);
            setInviteData({ email: '', role: 'STAFF', perspective: UserRole.STAFF, permissions: ['view_events'] });
            setIsInviteModalOpen(false);
            setNotification({ message: 'Invitation sent successfully.', type: 'success' });
            refreshTeamData(); // Refetch to update limit status and pending list
        } catch {
            setNotification({ message: 'Failed to send invitation.', type: 'error' });
        } finally {
            setIsInviting(false);
        }
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
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {notification && (
                <div className="fixed top-24 right-8 z-[120]">
                    <Card className={`flex items-center gap-4 px-6 py-4 rounded-xl border-2 shadow-xl ${notification.type === 'success' ? 'bg-[#F2F2F2] border-[#38BDF2]/40 text-[#2E2E2F]' : 'bg-[#F2F2F2] border-red-500/30 text-[#2E2E2F]'}`}>
                        <div className={`p-2 rounded-xl border-2 ${notification.type === 'success' ? 'bg-[#38BDF2]/10 border-[#38BDF2]/20 text-[#2E2E2F]' : 'bg-red-50 border-red-200 text-[#2E2E2F]'}`}>
                            {notification.type === 'success' ? <ICONS.CheckCircle className="w-5 h-5" /> : <ICONS.Layout className="w-5 h-5" />}
                        </div>
                        <p className="font-bold text-sm tracking-tight">{notification.message}</p>
                        <button onClick={() => setNotification(null)} className="ml-4 text-[#2E2E2F]/60 hover:text-[#2E2E2F] text-lg font-black">&times;</button>
                    </Card>
                </div>
            )}

            <div className="flex justify-end pb-2 border-b border-[#2E2E2F]/10">
                <div className="flex bg-[#F2F2F2] p-1 rounded-xl border-2 border-[#2E2E2F]/15 shrink-0">
                    {[
                        { id: 'directory', label: 'Directory' },
                        { id: 'permissions', label: 'Access Control' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id as any)}
                            className={`min-h-[32px] px-4 py-2 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-colors ${activeSubTab === tab.id ? 'bg-[#38BDF2] text-[#F2F2F2]' : 'bg-[#F2F2F2] text-[#2E2E2F] hover:bg-[#2E2E2F] hover:text-[#F2F2F2]'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-6">
                {activeSubTab === 'directory' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <label className="block text-[10px] font-semibold text-[#2E2E2F]/60 uppercase tracking-[0.2em] mb-1 ml-1">Team Directory</label>
                            <Button
                                onClick={() => setIsInviteModalOpen(true)}
                                disabled={staffLimit?.allowed === false}
                                variant={staffLimit?.allowed === false ? 'outline' : 'primary'}
                                className={staffLimit?.allowed === false ? 'opacity-50 cursor-not-allowed border-2 border-[#2E2E2F]/15' : ''}
                            >
                                <span className={`text-[9px] font-semibold uppercase tracking-widest flex items-center gap-2 ${staffLimit?.allowed === false ? 'text-[#2E2E2F]' : 'text-white'}`}>
                                    {staffLimit?.allowed === false ? (
                                        <ICONS.Lock className="w-3.5 h-3.5" />
                                    ) : (
                                        <ICONS.Users className="w-3.5 h-3.5" />
                                    )}
                                    {staffLimit?.allowed === false ? 'Invite Locked' : 'Invite a Team Member'}
                                </span>
                            </Button>
                        </div>
                        <Card className="overflow-hidden border-2 border-[#2E2E2F]/15 rounded-xl bg-[#F2F2F2] shadow-sm">
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
                                                        <div className={`w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center font-black text-lg ${member.isOwner ? 'bg-[#38BDF2] text-[#F2F2F2]' : 'bg-[#38BDF2] text-[#F2F2F2]'}`}>
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
                )}

                {activeSubTab === 'permissions' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <label className="block text-[10px] font-semibold text-[#2E2E2F]/60 uppercase tracking-[0.2em] mb-1 ml-1">Access Control</label>
                            <Badge type="info" className="font-black text-[9px] tracking-widest uppercase bg-[#38BDF2]/20 text-[#2E2E2F]">Manage Team Permissions</Badge>
                        </div>
                        <Card className="overflow-hidden border-2 border-[#2E2E2F]/15 rounded-xl bg-[#F2F2F2] shadow-sm">
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
                                                        <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center font-black text-sm ${member.isOwner ? 'bg-[#38BDF2] text-[#F2F2F2]' : 'bg-[#38BDF2] text-[#F2F2F2]'}`}>
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
                                                        <PermissionShield active={member.permissions.includes('view_events')} disabled={member.isOwner} onClick={() => toggleMemberPermission(member.id, 'view_events')} />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-8">
                                                    <div className="flex justify-center">
                                                        <PermissionShield active={member.permissions.includes('edit_events')} disabled={member.isOwner} onClick={() => toggleMemberPermission(member.id, 'edit_events')} />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-8">
                                                    <div className="flex justify-center">
                                                        <PermissionShield active={member.permissions.includes('manual_checkin')} disabled={member.isOwner} onClick={() => toggleMemberPermission(member.id, 'manual_checkin')} />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-8">
                                                    <div className="flex justify-center">
                                                        <PermissionShield iconType="bell" active={member.permissions.includes('receive_notifications')} disabled={member.isOwner} onClick={() => toggleMemberPermission(member.id, 'receive_notifications')} />
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

            <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invite Team Member" size="lg">
                <form onSubmit={handleInviteSubmit} className="space-y-10 px-2">
                    <div className="space-y-6">
                        <Input label="Work Email" type="email" placeholder="j.miller@startuplab.co" required className="w-full py-5 px-6 rounded-xl bg-[#F2F2F2] border-2 border-[#2E2E2F]/20 text-base" value={inviteData.email} onChange={(e: any) => setInviteData({ ...inviteData, email: e.target.value })} />
                        <Input label="Assigned Position" value="STAFF" disabled className="w-full py-5 px-6 rounded-xl bg-[#F2F2F2] border-2 border-[#2E2E2F]/20 text-[#2E2E2F]/60 text-base" />
                    </div>
                    <div className="pt-8 flex flex-col sm:flex-row gap-4">
                        <Button className="flex-1" onClick={() => setIsInviteModalOpen(false)} disabled={isInviting}>Cancel</Button>
                        <Button type="submit" className="flex-[2]" disabled={isInviting}>
                            {isInviting ? 'Sending...' : 'Send Invite'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

