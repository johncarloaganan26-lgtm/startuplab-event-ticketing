import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../../components/Shared';
import { apiService } from '../../services/apiService';
import { ICONS } from '../../constants';
import { OrganizerProfile } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

export const EmailSettings: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [profile, setProfile] = useState<OrganizerProfile | null>(null);

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

    const [testRecipient, setTestRecipient] = useState('');

    const canCustomSmtp = !!(profile?.plan?.features?.enable_custom_branding || profile?.plan?.features?.custom_branding);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                const [profileData, smtpData] = await Promise.all([
                    apiService.getMyOrganizer(),
                    apiService.getSmtpSettings()
                ]);
                
                setProfile(profileData);
                
                if (smtpData && Object.keys(smtpData).length > 0) {
                    setFormData(prev => ({ ...prev, ...smtpData }));
                }
            } catch (err) {
                console.error('Failed to load email settings:', err);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await apiService.updateSmtpSettings(formData);
            showToast('success', 'Email settings saved successfully!');
        } catch (err: any) {
            showToast('error', err.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!testRecipient) {
            showToast('error', 'Please enter a recipient email for the test.');
            return;
        }
        try {
            setTesting(true);
            await apiService.testSmtpSettings({ ...formData, recipientEmail: testRecipient });
            showToast('success', 'Test email sent! Please check your inbox.');
        } catch (err: any) {
            showToast('error', err.message || 'SMTP test failed.');
        } finally {
            setTesting(false);
        }
    };


    if (loading) return <div className="p-8 text-[#2E2E2F]/60">Loading email settings...</div>;

    if (!canCustomSmtp) {
        return (
            <div className="max-w-4xl mx-auto p-12">
                <Card className="relative overflow-hidden border-2 border-[#2E2E2F]/15 bg-[#F2F2F2] rounded-[2.5rem] p-12 text-center shadow-sm">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <ICONS.Mail className="w-64 h-64 -mr-20 -mt-20" />
                    </div>
                    
                    <div className="relative z-10 space-y-8">
                        <div className="w-24 h-24 bg-[#2E2E2F]/5 rounded-3xl flex items-center justify-center mx-auto mb-8 ring-8 ring-[#2E2E2F]/5">
                            <ICONS.Mail className="w-12 h-12 text-[#2E2E2F]" />
                        </div>
                        
                        <div className="space-y-4">
                            <h2 className="text-4xl font-black text-[#2E2E2F] tracking-tight leading-tight">
                                Professional <br/>
                                <span className="opacity-40 uppercase tracking-widest text-[0.4em] block mt-2 font-bold italic">Email Support</span>
                            </h2>
                            <p className="text-lg text-[#2E2E2F]/60 font-medium max-w-lg mx-auto leading-relaxed">
                                Deliver event communications from your <span className="text-[#2E2E2F] font-bold underline decoration-[#2E2E2F]/20 underline-offset-4">official domain</span> and unlock high-volume sending quotas.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto pt-4">
                            <div className="flex items-center gap-4 bg-[#2E2E2F]/5 p-5 rounded-2xl border border-[#2E2E2F]/10">
                                <div className="bg-[#E8E8E8] p-2 rounded-xl shadow-sm text-[#2E2E2F]"><ICONS.CheckCircle className="w-5 h-5" /></div>
                                <div className="text-left">
                                    <p className="text-[13px] font-black text-[#2E2E2F]">White-Label Presence</p>
                                    <p className="text-[11px] text-[#2E2E2F]/50 font-bold uppercase tracking-wide">Brand Your Outbound Emails</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-[#2E2E2F]/5 p-5 rounded-2xl border border-[#2E2E2F]/10">
                                <div className="bg-[#E8E8E8] p-2 rounded-xl shadow-sm text-[#2E2E2F]"><ICONS.Send className="w-5 h-5" /></div>
                                <div className="text-left">
                                    <p className="text-[13px] font-black text-[#2E2E2F]">Unrestricted Quota</p>
                                    <p className="text-[11px] text-[#2E2E2F]/50 font-bold uppercase tracking-wide">Bypass Daily Platform Limits</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8">
                            <Button
                                onClick={() => navigate('/user-settings?tab=subscription')}
                                className="bg-[#2E2E2F] hover:bg-[#38BDF2] text-white px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl transition-all"
                            >
                                Upgrade Plan
                            </Button>
                            <p className="mt-6 text-[11px] font-bold text-[#2E2E2F]/40 uppercase tracking-widest">
                                Enforced for <span className="text-[#2E2E2F]">Custom Branding</span> Compliance
                            </p>
                        </div>
                    </div>
                </Card>

                <div className="mt-12 p-8 bg-[#2E2E2F]/5 rounded-3xl border border-[#2E2E2F]/10 flex items-start gap-6">
                    <div className="w-12 h-12 bg-[#E8E8E8] rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-[#2E2E2F]/5">
                        <ICONS.Info className="w-6 h-6 text-[#2E2E2F]/40" />
                    </div>
                    <div className="space-y-2">
                        <h4 className="text-sm font-black text-[#2E2E2F] uppercase tracking-wide">Infrastructure Notice</h4>
                        <p className="text-sm text-[#2E2E2F]/60 leading-relaxed font-medium">
                            Your account is using the <span className="font-bold underline decoration-[#2E2E2F]/10">StartupLab Shared SMTP</span>. Activity is monitored and subject to daily volume restrictions to ensure platform performance.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-16 space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6">
                <div></div>
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
                <Card className="lg:col-span-2 p-8 rounded-xl bg-[#F2F2F2] border-[#2E2E2F]/10 shadow-sm space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-[#2E2E2F]/40 uppercase tracking-widest pl-1">Email Provider</label>
                            <select
                                name="emailProvider"
                                value={formData.emailProvider}
                                onChange={handleChange}
                                className="w-full px-6 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-full outline-none focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] font-medium text-[#2E2E2F] transition-all hover:bg-[#F2F2F2]/80"
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
                                className="w-full px-6 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-full outline-none focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] font-medium text-[#2E2E2F] transition-all hover:bg-[#F2F2F2]/80"
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
                    <Card className="p-8 rounded-xl bg-[#F2F2F2] border-[#2E2E2F]/10 shadow-sm space-y-6">
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
                                className="w-full bg-[#38BDF2] hover:bg-[#2E2E2F] text-white py-3 rounded-xl font-black text-xs tracking-widest flex items-center justify-center gap-2 transition-all uppercase shadow-md active:scale-95"
                                disabled={testing}
                            >
                                <ICONS.Send className="w-3.5 h-3.5" />
                                {testing ? 'Sending...' : 'Send Test Email'}
                            </Button>
                        </div>
                    </Card>

                    <div className="p-6 rounded-xl bg-[#38BDF2]/5 border-2 border-[#38BDF2]/20 relative overflow-hidden group hover:bg-[#38BDF2]/10 transition-colors">
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

