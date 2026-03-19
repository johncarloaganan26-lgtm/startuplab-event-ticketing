
import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from '../../components/Shared';
import { apiService } from '../../services/apiService';
import { ICONS } from '../../constants';

export const EmailSettings: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

    useEffect(() => {
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

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    if (loading) return <div className="p-8 text-[#2E2E2F]/60">Loading email settings...</div>;

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    className="bg-[#38BDF2] hover:bg-[#2E2E2F] text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors"
                    disabled={saving}
                >
                    <ICONS.CheckCircle className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            {notification && (
                <div className="fixed top-24 right-8 z-[120] animate-in slide-in-from-right-10 duration-500">
                    <Card className={`flex items-center gap-4 px-6 py-4 rounded-xl shadow-2xl border ${notification.type === 'success' ? 'bg-[#F2F2F2] border-green-200 text-[#2E2E2F]' : 'bg-[#F2F2F2] border-red-200 text-[#2E2E2F]'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${notification.type === 'success' ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-red-500 text-white shadow-lg shadow-red-500/30'}`}>
                            {notification.type === 'success' ? <ICONS.CheckCircle className="w-5 h-5" /> : <ICONS.Layout className="w-5 h-5" />}
                        </div>
                        <p className="font-black text-sm tracking-tight">{notification.message}</p>
                        <button onClick={() => setNotification(null)} className="ml-4 text-[#2E2E2F]/40 hover:text-[#2E2E2F] text-xl font-black transition-colors">&times;</button>
                    </Card>
                </div>
            )}

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
                                className="w-full px-6 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-full outline-none focus:ring-2 focus:ring-[#38BDF2] focus:border-[#38BDF2] font-medium text-[#2E2E2F] transition-all hover:bg-[#F2F2F2]/80 px-6 py-3"
                            >
                                <option value="SMTP">SMTP</option>
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
                                onChange={(e: any) => setFormData(prev => ({ ...prev, fromName: e.target.value }))}
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
                                className="w-full bg-[#38BDF2] hover:bg-[#2E2E2F] text-white py-3 rounded-xl font-black text-xs tracking-widest flex items-center justify-center gap-2 transition-all uppercase shadow-md"
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

