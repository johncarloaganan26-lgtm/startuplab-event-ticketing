import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../../components/Shared';
import { ICONS } from '../../constants';
import { useUser } from '../../context/UserContext';
import { supabase } from "../../supabase/supabaseClient";
import { useToast } from '../../context/ToastContext';

const API = import.meta.env.VITE_API_BASE;

const UserIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);

const CameraIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
);

const ShieldIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);

const AlertIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
);

const XCircleIcon = (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
);

export const AccountSettings: React.FC = () => {
    const { userId, name, email, imageUrl, setUser, role } = useUser();
    const { showToast } = useToast();
    const [formName, setFormName] = useState(name || '');
    const [previewUrl, setPreviewUrl] = useState<string | null>(imageUrl || null);
    const [saving, setSaving] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);


    // 🔥 Auto-sync form state when context updates (e.g. after backend JIT sync)
    useEffect(() => {
        if (name && (!formName || formName === '')) {
            setFormName(name);
        }
    }, [name]);

    useEffect(() => {
        if (imageUrl && !previewUrl) {
            setPreviewUrl(imageUrl);
        }
    }, [imageUrl]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const localUrl = URL.createObjectURL(file);
        setPreviewUrl(localUrl);
        setSaving(true);
        try {
            const form = new FormData();
            form.append('image', file);
            const res = await fetch(`${API}/api/user/avatar`, {
                method: 'POST',
                credentials: 'include',
                body: form,
            });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            const newUrl = data.imageUrl || localUrl;
            setPreviewUrl(newUrl);
            setUser({ userId: userId!, role: role!, email: email!, name: formName || name, imageUrl: newUrl });
            showToast('success', 'Profile photo updated!');
        } catch {
            showToast('error', 'Failed to upload photo.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveName = async () => {
        const trimmed = formName.trim();
        if (!trimmed) return;
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/user/name`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: trimmed }),
            });
            if (!res.ok) throw new Error('Save failed');
            setUser({ userId: userId!, role: role!, email: email!, name: trimmed, imageUrl: previewUrl });
            showToast('success', 'Name updated successfully!');
        } catch {
            showToast('error', 'Failed to save name.');
        } finally {
            setSaving(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) return;
        setPasswordLoading(true);
        try {
            const res = await fetch(`${API}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to send reset link');
            }

            showToast('success', 'Password reset link sent to your email!');
        } catch (err: any) {
            showToast('error', err.message || 'Failed to send reset email.');
        } finally {
            setPasswordLoading(false);
        }
    };

    const initials = (formName || name || email || 'U')
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <div className="space-y-10 pb-20">

            {/* Profile Section */}
            <Card className="p-10 border-2 border-[#2E2E2F]/15 rounded-xl bg-[#F2F2F2] shadow-sm">
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 rounded-xl bg-[#38BDF2]/10 text-[#38BDF2] flex items-center justify-center">
                        <UserIcon className="w-5 h-5" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-[#2E2E2F] uppercase tracking-wider">Public Profile</h3>
                        <p className="text-[10px] text-[#2E2E2F]/40 font-bold uppercase tracking-widest mt-0.5">Manage your personal identification</p>
                    </div>
                </div>

                <div className="space-y-10">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-8">
                        <div
                            className="relative group w-28 h-28 rounded-xl overflow-hidden border-2 border-[#2E2E2F]/5 bg-[#F2F2F2] flex items-center justify-center cursor-pointer hover:border-[#38BDF2] transition-all"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {previewUrl ? (
                                <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-3xl font-black text-[#2E2E2F]/20">{initials}</span>
                            )}
                            <div className="absolute inset-0 bg-[#2E2E2F]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <CameraIcon className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-[#2E2E2F]">Profile Photo</h4>
                            <p className="text-[11px] text-[#2E2E2F]/50 font-medium max-w-xs leading-relaxed">
                                Upload a profile picture to make your account more recognizable.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    className="rounded-xl px-5 py-2 text-[10px] font-black uppercase tracking-widest border-[#2E2E2F]/10"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={saving}
                                >
                                    Change photo
                                </Button>
                            </div>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t-2 border-[#2E2E2F]/10">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em] ml-1">Full Name</label>
                            <Input
                                value={formName}
                                onChange={(e: any) => setFormName(e.target.value)}
                                placeholder="StartupLab Admin"
                                className="font-bold text-[#2E2E2F]"
                            />
                        </div>
                        <div className="space-y-1.5 opacity-60">
                            <label className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em] ml-1">Email Address</label>
                            <div className="px-5 py-3.5 bg-[#F2F2F2] border-2 border-[#2E2E2F]/10 rounded-xl text-xs text-[#2E2E2F] font-bold">
                                {email}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 gap-4">
                        <Button
                            className="rounded-xl px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] bg-[#2E2E2F] text-white hover:bg-black transition-all"
                            onClick={handleSaveName}
                            disabled={saving || !formName.trim() || formName.trim() === name}
                        >
                            {saving ? 'Updating...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Security Section */}
            <Card className="p-10 border-2 border-[#2E2E2F]/15 rounded-xl bg-[#F2F2F2] shadow-sm">
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 rounded-xl bg-[#38BDF2]/10 text-[#38BDF2] flex items-center justify-center">
                        <ShieldIcon className="w-5 h-5" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-[#2E2E2F] uppercase tracking-wider">Security & Access</h3>
                        <p className="text-[10px] text-[#2E2E2F]/40 font-bold uppercase tracking-widest mt-0.5">Manage your credentials and account safety</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 rounded-xl bg-[#F2F2F2] border-2 border-[#2E2E2F]/10">
                        <div className="space-y-1">
                            <h4 className="text-xs font-bold text-[#2E2E2F]">Password</h4>
                            <p className="text-[11px] text-[#2E2E2F]/50 font-medium">Last changed: (Not recorded)</p>
                        </div>
                        <Button
                            variant="outline"
                            className="rounded-xl px-5 py-2 text-[10px] font-black uppercase tracking-widest border-[#2E2E2F]/10 hover:border-[#38BDF2] hover:text-[#38BDF2] transition-colors"
                            onClick={handleResetPassword}
                            disabled={passwordLoading}
                        >
                            {passwordLoading ? 'Sending Link...' : 'Change Password'}
                        </Button>
                    </div>

                    <div className="flex gap-3 items-start p-4 bg-[#38BDF2]/5 border-2 border-[#38BDF2]/20 rounded-xl">
                        <AlertIcon className="w-4 h-4 text-[#38BDF2] mt-0.5 shrink-0" />
                        <p className="text-[10px] text-[#2E2E2F]/70 font-medium leading-relaxed">
                            Clicking "Change Password" will send a secure reset link to your email ({email}).
                            This link is powered by the system's professional SMTP configuration.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

