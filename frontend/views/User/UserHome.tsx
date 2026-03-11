
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { apiService } from '../../services/apiService';
import { Event, TicketType, EventStatus } from '../../types';
import { Card, Button, Modal, Input } from '../../components/Shared';
import { OnsiteLocationAssistant } from '../../components/OnsiteLocationAssistant';
import { PlanUpgradeModal } from '../../components/PlanUpgradeModal';
import { ICONS } from '../../constants';

const getImageUrl = (img: any): string => {
    if (!img) return 'https://via.placeholder.com/800x400';
    if (typeof img === 'string') return img;
    return img.url || img.path || img.publicUrl || 'https://via.placeholder.com/800x400';
};

export const UserHome: React.FC = () => {
    const navigate = useNavigate();
    const { name, email } = useUser();
    const displayName = name?.trim() || email?.split('@')[0] || 'there';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const initialFormData = {
        eventName: '',
        description: '',
        eventDate: '',
        eventTime: '09:00',
        endDate: '',
        endTime: '17:00',
        timezone: 'Asia/Manila',
        locationType: 'ONSITE' as Event['locationType'],
        location: '',
        capacityTotal: 100,
        imageUrl: 'https://images.unsplash.com/photo-1540575861501-7ad0582373f3?auto=format&fit=crop&q=80&w=800',
        status: 'DRAFT' as EventStatus,
        regOpenDate: new Date().toISOString().split('T')[0],
        regCloseDate: '',
        regCloseTime: '',
        streamingPlatform: '',
        ticketTypes: [] as TicketType[]
    };

    const [formData, setFormData] = useState(initialFormData);
    const [stats, setStats] = useState({ liveEventsCount: 0, ticketsSold: 0 });
    const [loadingStats, setLoadingStats] = useState(true);
    const [organizerProfile, setOrganizerProfile] = useState<any>(null);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const [events, analytics, organizer] = await Promise.all([
                    apiService.getUserEvents(),
                    apiService.getAnalytics(),
                    apiService.getMyOrganizer()
                ]);
                const liveCount = events.filter(e => e.status === 'PUBLISHED').length;
                setStats({
                    liveEventsCount: liveCount,
                    ticketsSold: analytics.totalRegistrations || 0
                });
                setOrganizerProfile(organizer);

                const hideModal = localStorage.getItem('hideUpgradeModal');
                if (!hideModal) {
                    setIsUpgradeModalOpen(true);
                }
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            } finally {
                setLoadingStats(false);
            }
        };
        fetchData();
    }, []);

    React.useEffect(() => {
        if (notification) {
            const t = setTimeout(() => setNotification(null), 4000);
            return () => clearTimeout(t);
        }
    }, [notification]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSubmitting(true);
        try {
            const { publicUrl } = await apiService.uploadUserEventImage(file);
            setFormData(prev => ({ ...prev, imageUrl: publicUrl }));
        } catch {
            setNotification({ message: 'Image upload failed.', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const isSubscriptionReady = !!organizerProfile?.currentPlanId && organizerProfile?.subscriptionStatus !== 'pending';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isSubscriptionReady) {
            setNotification({ message: 'Select a plan (free or paid) before initializing events.', type: 'error' });
            setTimeout(() => navigate('/subscription'), 1500);
            return;
        }

        setSubmitting(true);
        try {
            const mergeDateTime = (date: string, time: string) => {
                if (!date) return null;
                return `${date}T${time || '09:00'}:00`;
            };
            await apiService.createUserEvent({
                eventName: formData.eventName,
                description: formData.description,
                startAt: mergeDateTime(formData.eventDate, formData.eventTime),
                endAt: formData.endDate ? mergeDateTime(formData.endDate, formData.endTime) : null,
                timezone: formData.timezone,
                locationType: formData.locationType,
                locationText: formData.location,
                capacityTotal: formData.capacityTotal,
                imageUrl: formData.imageUrl,
                status: formData.status,
                regOpenAt: formData.regOpenDate || null,
                regCloseAt: formData.regCloseDate || null,
                streamingPlatform: formData.streamingPlatform
            });
            setNotification({ message: 'Event created successfully!', type: 'success' });
            setIsModalOpen(false);
            setFormData(initialFormData);
            setTimeout(() => navigate('/my-events'), 1200);
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to create event.', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const applyLocationValue = (locationValue: string) => {
        const nextData: any = { ...formData, location: locationValue };
        if ((formData.locationType === 'ONLINE' || formData.locationType === 'HYBRID') && !formData.streamingPlatform) {
            const lowUrl = locationValue.toLowerCase();
            if (lowUrl.includes('meet.google.com')) nextData.streamingPlatform = 'Google Meet';
            else if (lowUrl.includes('zoom.us') || lowUrl.includes('zoom.com')) nextData.streamingPlatform = 'Zoom';
            else if (lowUrl.includes('teams.microsoft.com')) nextData.streamingPlatform = 'Microsoft Teams';
        }
        setFormData(nextData);
    };

    return (
        <div className="space-y-12 max-w-6xl">
            {notification && (
                <div className="fixed top-8 right-8 z-[120] animate-in slide-in-from-top-4 duration-300">
                    <Card className={`flex items-center gap-4 px-6 py-4 rounded-2xl border-2 shadow-xl ${notification.type === 'success'
                        ? 'bg-[#38BDF2]/10 border-[#38BDF2] text-[#2E2E2F]'
                        : 'bg-red-50 border-red-500 text-red-700'}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${notification.type === 'success' ? 'bg-[#38BDF2] text-white' : 'bg-red-500 text-white'}`}>
                            {notification.type === 'success' ? <ICONS.CheckCircle className="w-5 h-5" /> : <ICONS.AlertTriangle className="w-5 h-5" />}
                        </div>
                        <p className="font-bold text-sm tracking-tight">{notification.message}</p>
                    </Card>
                </div>
            )}

            {/* Welcome Section */}
            <div className="bg-[#F2F2F2] border-2 border-[#2E2E2F]/5 rounded-[3rem] p-10 md:p-14 mb-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#38BDF2]/10 border border-[#38BDF2]/20 text-[#38BDF2] text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                            Organizer Portal
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black text-[#2E2E2F] tracking-tighter leading-none mb-6">
                            Oh hello, <span className="text-[#38BDF2]">{displayName}</span>
                        </h1>
                        <p className="text-[#2E2E2F]/60 text-lg font-medium leading-relaxed">
                            Welcome back to your event nerve center. Craft new experiences, engage your audience, and scale your influence with StartupLab.
                        </p>
                    </div>
                    <div className="flex gap-10 shrink-0">
                        <div className="text-center group">
                            <p className={`text-[#38BDF2] text-5xl font-black leading-none mb-3 transition-all duration-700 ${loadingStats ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
                                {stats.liveEventsCount}
                            </p>
                            <p className="text-[10px] uppercase font-black text-[#2E2E2F] tracking-[0.25em] opacity-40 group-hover:opacity-100 transition-opacity">Live Events</p>
                        </div>
                        <div className="w-px h-14 bg-[#2E2E2F]/10 self-center" />
                        <div className="text-center group">
                            <p className={`text-[#38BDF2] text-5xl font-black leading-none mb-3 transition-all duration-700 delay-100 ${loadingStats ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
                                {stats.ticketsSold}
                            </p>
                            <p className="text-[10px] uppercase font-black text-[#2E2E2F] tracking-[0.25em] opacity-40 group-hover:opacity-100 transition-opacity">Tickets</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Create First Event Card */}
                <div
                    className="group relative bg-[#F2F2F2] border-2 border-[#2E2E2F]/5 rounded-[2.5rem] p-8 flex flex-col items-start transition-all duration-300 hover:border-[#38BDF2] hover:shadow-[0_20px_40px_-20px_rgba(56,189,242,0.3)] hover:-translate-y-1"
                    onClick={() => navigate('/my-events?openModal=true')}
                >
                    <div className="w-14 h-14 rounded-2xl bg-[#38BDF2] text-white flex items-center justify-center mb-8 shadow-lg shadow-[#38BDF2]/30 group-hover:scale-110 transition-transform">
                        <ICONS.Plus className="w-8 h-8 stroke-[3]" />
                    </div>
                    <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tight mb-3">Create First Event</h2>
                    <p className="text-[#2E2E2F]/60 font-medium leading-relaxed mb-8 flex-1">
                        Follow the organizer workflow: complete your identity, set up your organization profile, pick a subscription plan, save your event as a draft, then add tickets before finally publishing.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-black text-[#38BDF2] uppercase tracking-[0.2em]">
                        Start Wizard <ICONS.ChevronRight className="w-4 h-4" />
                    </div>
                </div>

                {/* Manage Events Card */}
                <div
                    className="group relative bg-[#F2F2F2] border-2 border-[#2E2E2F]/5 rounded-[2.5rem] p-8 flex flex-col items-start transition-all duration-300 hover:border-[#2E2E2F] hover:shadow-[0_20px_40px_-20px_rgba(46,46,47,0.1)] hover:-translate-y-1"
                    onClick={() => navigate('/my-events')}
                >
                    <div className="w-14 h-14 rounded-2xl bg-[#2E2E2F] text-white flex items-center justify-center mb-8 shadow-lg shadow-[#2E2E2F]/30 group-hover:scale-110 transition-transform">
                        <ICONS.Calendar className="w-7 h-7 stroke-[2]" />
                    </div>
                    <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tight mb-3">Manage My Events</h2>
                    <p className="text-[#2E2E2F]/60 font-medium leading-relaxed mb-8 flex-1">
                        View, edit, and track the performance of all your existing events. Stay on top of registrations.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-black text-[#2E2E2F] uppercase tracking-[0.2em]">
                        Open Library <ICONS.ChevronRight className="w-4 h-4" />
                    </div>
                </div>
            </div>


            {/* Create Event Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Initialize Event"
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-12">
                    {/* Live Preview / Hero Section */}
                    <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-[#2E2E2F]/10 bg-[#2E2E2F] group">
                        {formData.imageUrl ? (
                            <img src={getImageUrl(formData.imageUrl)} alt="Event preview" className="w-full h-full object-cover opacity-60" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2E2E2F] to-[#2E2E2F]/90">
                                <ICONS.Image className="w-16 h-16 text-white/10" />
                            </div>
                        )}
                        <div className="absolute inset-0 p-8 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                            <h3 className="text-3xl font-black text-white tracking-tight mb-4 drop-shadow-lg">
                                {formData.eventName || 'Session Identity'}
                            </h3>
                            <div className="flex flex-wrap gap-4">
                                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-white text-xs font-bold uppercase tracking-tight">
                                    <ICONS.Calendar className="w-4 h-4 text-[#38BDF2]" />
                                    {formData.eventDate ? new Date(`${formData.eventDate}T${formData.eventTime}`).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Setting Date...'}
                                </div>
                                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-white text-xs font-bold uppercase tracking-tight">
                                    <ICONS.MapPin className="w-4 h-4 text-[#38BDF2]" />
                                    <span className="truncate max-w-[150px]">{formData.location || 'Defining Venue...'}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                        >
                            Change Key Art
                        </button>
                    </div>

                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="md:col-span-2 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <Input
                                        label="What's the name of this session?"
                                        placeholder="e.g. Founders Workshop 2026"
                                        value={formData.eventName}
                                        onChange={(e: any) => setFormData({ ...formData, eventName: e.target.value })}
                                    />
                                </div>
                                <div className="w-1/3">
                                    <label className="block text-[11px] font-black uppercase tracking-widest text-[#2E2E2F]/40 mb-2.5">Status</label>
                                    <select
                                        className="w-full px-4 py-[13.5px] bg-[#F2F2F2] border-2 border-[#2E2E2F]/10 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:border-[#38BDF2] transition-colors appearance-none"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
                                    >
                                        <option value="PUBLISHED">Go Live</option>
                                        <option value="DRAFT">Dev Only</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-widest text-[#2E2E2F]/40 mb-2.5">The Narrative</label>
                                <textarea
                                    className="w-full px-5 py-4 bg-[#F2F2F2] border-2 border-[#2E2E2F]/10 rounded-3xl text-sm min-h-[140px] focus:border-[#38BDF2] transition-colors outline-none resize-none"
                                    placeholder="Tell the story of your event..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <Input label="Kickoff Date" type="date" value={formData.eventDate} onChange={(e: any) => setFormData({ ...formData, eventDate: e.target.value })} />
                            <Input label="Kickoff Time" type="time" value={formData.eventTime} onChange={(e: any) => setFormData({ ...formData, eventTime: e.target.value })} />
                        </div>
                        <div className="space-y-6">
                            <Input label="Wrap Up Date" type="date" value={formData.endDate} onChange={(e: any) => setFormData({ ...formData, endDate: e.target.value })} />
                            <Input label="Wrap Up Time" type="time" value={formData.endTime} onChange={(e: any) => setFormData({ ...formData, endTime: e.target.value })} />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-black uppercase tracking-widest text-[#2E2E2F]/40 mb-2.5">Operational Presence</label>
                            <div className="flex gap-4">
                                {['ONSITE', 'ONLINE', 'HYBRID'].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, locationType: type as any })}
                                        className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${formData.locationType === type
                                            ? 'bg-[#2E2E2F] border-[#2E2E2F] text-white shadow-lg'
                                            : 'bg-[#F2F2F2] border-[#2E2E2F]/5 text-[#2E2E2F]/40 hover:bg-[#2E2E2F]/5'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <Input
                                label="Venue Identity / Digital Access Point"
                                placeholder="Where is the action happening?"
                                value={formData.location}
                                onChange={(e: any) => applyLocationValue(e.target.value)}
                            />
                        </div>

                        {formData.locationType === 'ONSITE' && (
                            <div className="md:col-span-2">
                                <OnsiteLocationAssistant value={formData.location} onChange={applyLocationValue} />
                            </div>
                        )}
                    </div>

                    <div className="flex gap-6 pt-10 border-t-2 border-[#2E2E2F]/5">
                        <Button
                            className="flex-1 min-h-[56px] text-[#2E2E2F] bg-transparent border-2 border-[#2E2E2F]/10 hover:bg-[#2E2E2F]/5 hover:border-[#2E2E2F]/20"
                            onClick={() => setIsModalOpen(false)}
                        >
                            Abort
                        </Button>
                        <Button
                            type="submit"
                            className="flex-[2] min-h-[56px] bg-[#38BDF2] text-white shadow-[0_20px_40px_-10px_rgba(56,189,242,0.4)] hover:bg-[#2E2E2F] transition-all"
                            disabled={submitting}
                        >
                            {submitting ? 'Propagating...' : 'Initialize Session'}
                        </Button>
                    </div>
                </form>
            </Modal>
            <PlanUpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                organizerName={organizerProfile?.organizerName || ''}
                currentPlanId={organizerProfile?.currentPlanId}
                onSubscribeSuccess={() => {
                    setNotification({ message: 'Plan upgraded successfully!', type: 'success' });
                    // Refresh data after upgrade
                    setTimeout(() => window.location.reload(), 1500);
                }}
            />
        </div>
    );
};
