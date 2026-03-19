
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { OrganizerProfile as IOrganizerProfile, Event } from '../../types';
import { Button, PageLoader, Card } from '../../components/Shared';
import { ICONS } from '../../constants';
import { useUser } from '../../context/UserContext';
import { useEngagement } from '../../context/EngagementContext';

const getEmbedUrl = (link: string) => {
    if (!link) return null;
    const normalized = link.startsWith('http') ? link : `https://${link}`;
    if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/|live\/)([^#\&\?]*).*/;
        const match = normalized.match(regExp);
        const videoId = (match && match[2].length === 11) ? match[2] : null;
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0` : null;
    }
    if (normalized.includes('facebook.com') || normalized.includes('fb.watch')) {
        return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(normalized)}&show_text=0&width=500&autoplay=true&mute=true`;
    }
    if (normalized.includes('vimeo.com')) {
        const match = normalized.match(/vimeo\.com\/(\d+)/);
        const videoId = match ? match[1] : null;
        return videoId ? `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=1` : null;
    }
    return null;
};

// Helper to handle JSONB image format
const getImageUrl = (img: any): string => {
    if (!img) return 'https://via.placeholder.com/800x400';
    if (typeof img === 'string') return img;
    return img.url || img.path || img.publicUrl || 'https://via.placeholder.com/800x400';
};

const formatDate = (iso: string, timezone?: string, opts?: Intl.DateTimeFormatOptions) => {
    try {
        return new Intl.DateTimeFormat('en-GB', { timeZone: timezone || 'UTC', ...opts }).format(new Date(iso));
    } catch {
        return new Date(iso).toLocaleString();
    }
};

const formatTime = (iso: string, timezone?: string) => {
    try {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone || 'UTC',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(new Date(iso));
    } catch {
        return '';
    }
};

const formatCompactCount = (value: number) => (
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
        Math.max(0, Number(value || 0))
    )
);

export const OrganizerProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useUser();
    const { isFollowing, toggleFollowing, canLikeFollow } = useEngagement();

    const [organizer, setOrganizer] = useState<IOrganizerProfile | null>(null);
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [interactionNotice, setInteractionNotice] = useState('');
    const [bioExpanded, setBioExpanded] = useState(false);
    const [liveEvent, setLiveEvent] = useState<Event | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!id) return;
            try {
                const [orgData, eventData, allLiveEvents] = await Promise.all([
                    apiService.getOrganizerById(id),
                    apiService.getEvents(1, 100, '', '', id),
                    apiService.getLiveEvents()
                ]);
                setOrganizer(orgData);
                setEvents(eventData.events || []);

                // Check if any of this organizer's events are live WITH an embeddable video URL
                const isEmbeddableVideo = (url: string) => {
                    if (!url || !url.trim()) return false;
                    const n = url.startsWith('http') ? url : `https://${url}`;
                    return /youtube\.com|youtu\.be/.test(n) || /facebook\.com|fb\.watch|fb\.com/.test(n) || /vimeo\.com/.test(n);
                };
                const matchingLive = allLiveEvents.find(e => {
                    const isOurOrg = e.organizerId === orgData.organizerId;
                    const hasVideo = isEmbeddableVideo(e.streaming_url || '');

                    // Ensure the event is actually happening NOW
                    const eventNow = new Date();
                    const eventStart = new Date(e.startAt);
                    const eventEnd = e.endAt ? new Date(e.endAt) : new Date(eventStart.getTime() + 2 * 60 * 60 * 1000);

                    const isOngoing = eventNow >= eventStart && eventNow < eventEnd;

                    return isOurOrg && hasVideo && isOngoing;
                });
                setLiveEvent(matchingLive || null);
            } catch (error) {
                console.error('Failed to load organizer profile:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id]);

    const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
    const now = new Date();

    useEffect(() => {
        if (!interactionNotice) return;
        const timeoutId = window.setTimeout(() => setInteractionNotice(''), 2200);
        return () => window.clearTimeout(timeoutId);
    }, [interactionNotice]);

    if (loading) return <PageLoader label="Loading profile..." />;
    if (!organizer) return (
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
            <h2 className="text-2xl font-bold text-[#2E2E2F] mb-4">Organizer profile not found</h2>
            <Button onClick={() => navigate('/')}>Back to Home</Button>
        </div>
    );

    const following = isFollowing(organizer.organizerId);

    const handleFollow = async () => {
        if (!isAuthenticated) {
            navigate('/signup');
            return;
        }
        if (!canLikeFollow) {
            setInteractionNotice('Switch to Attending mode to follow organizations.');
            return;
        }
        try {
            const { following: nextFollowing, confirmationEmailSent } = await toggleFollowing(organizer.organizerId);
            setOrganizer(prev => prev ? {
                ...prev,
                followersCount: nextFollowing ? prev.followersCount + 1 : Math.max(0, prev.followersCount - 1)
            } : null);

            const msg = nextFollowing
                ? (confirmationEmailSent ? 'Following! Check your email for confirmation.' : 'Following!')
                : 'Removed from followings.';
            setInteractionNotice(msg);
        } catch (error: any) {
            setInteractionNotice(error.message || 'Failed to update follow status.');
        }
    };


    const upcomingEvents = events.filter(e => {
        const end = e.endAt ? new Date(e.endAt) : new Date(new Date(e.startAt).getTime() + 2 * 60 * 60 * 1000);
        return end >= now;
    }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    const pastEvents = events.filter(e => {
        const end = e.endAt ? new Date(e.endAt) : new Date(new Date(e.startAt).getTime() + 2 * 60 * 60 * 1000);
        return end < now;
    }).sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

    const displayEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;

    const organizerImage = getImageUrl(organizer.profileImageUrl);
    const coverImage = getImageUrl(organizer.coverImageUrl);
    const organizerInitial = (organizer.organizerName || 'O').charAt(0).toUpperCase();
    const brandColor = organizer.brandColor || '#38BDF2';
    const embedUrl = liveEvent ? getEmbedUrl(liveEvent.streaming_url || liveEvent.locationText) : null;

    return (
        <div className="bg-[#F2F2F2] min-h-screen">
            <div className="max-w-[1250px] mx-auto bg-[#F2F2F2] border-x border-b border-[#2E2E2F]/5 shadow-sm rounded-b-[2rem] overflow-hidden">
                {/* Cover Photo / Live Player Area */}
                <div className="relative group">
                    <div className="aspect-[3.5/1] w-full overflow-hidden bg-[#2E2E2F]/5">
                        {liveEvent ? (
                            <div className="w-full h-full relative">
                                {embedUrl ? (
                                    <iframe
                                        className="absolute inset-0 w-full h-full"
                                        src={embedUrl}
                                        title="Live Stream"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#F2F2F2]">
                                        <div className="flex items-center gap-3 bg-red-600 px-6 py-2.5 rounded-full border border-red-500 shadow-lg animate-pulse mb-4">
                                            <div className="w-2 h-2 bg-white rounded-full" />
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Now</span>
                                        </div>
                                        <a
                                            href={liveEvent.streaming_url || liveEvent.locationText}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="bg-[#38BDF2] text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md hover:scale-105 transition-transform"
                                        >
                                            View Broadcast
                                        </a>
                                    </div>
                                )}
                                <div className="absolute top-6 right-8 bg-red-600 px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase tracking-widest shadow-lg animate-pulse z-20">
                                    LIVE
                                </div>
                            </div>
                        ) : organizer.coverImageUrl ? (
                            <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2E2E2F]/10 to-[#F2F2F2]">
                                <ICONS.Image className="w-16 h-16 text-[#2E2E2F]/20" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Profile Header section */}
                <div className="px-6 lg:px-12">
                    <div className="relative flex flex-col lg:flex-row gap-6 lg:gap-10 pb-10">
                        {/* Profile Pic overlap - positioned relatively to clear cover */}
                        <div className="relative -mt-16 lg:-mt-24 shrink-0 z-10">
                            <div className="w-32 h-32 lg:w-56 lg:h-56 rounded-xl border-[10px] border-[#F2F2F2] overflow-hidden bg-gradient-to-br from-[#38BDF2] to-[#A5E1FF] shadow-[0_25px_60px_rgba(0,0,0,0.12)]">
                                {organizer.profileImageUrl ? (
                                    <img src={organizerImage} alt={organizer.organizerName} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-7xl font-black text-white flex h-full w-full items-center justify-center drop-shadow-2xl">{organizerInitial}</span>
                                )}
                            </div>
                            {liveEvent && (
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border-2 border-[#F2F2F2] shadow-xl animate-pulse">
                                    Live Now
                                </div>
                            )}
                        </div>

                        {/* Name, Stats and Actions - Aligned better */}
                        <div className="flex-1 flex flex-col lg:flex-row lg:items-end justify-between pt-4 lg:pt-6 gap-6">
                            <div className="space-y-3">
                                <h1 className="text-3xl sm:text-4xl lg:text-[3.5rem] font-black text-[#2E2E2F] tracking-tight leading-[1.1]">
                                    {organizer.organizerName}
                                </h1>
                                <div className="flex flex-wrap items-center gap-4 text-[#2E2E2F]/50 font-black text-[10px] uppercase tracking-[0.2em]">
                                    <div className="flex items-center gap-2 bg-[#2E2E2F]/5 px-3 py-1.5 rounded-xl">
                                        <ICONS.Users className="w-3.5 h-3.5" />
                                        <span>{formatCompactCount(organizer.followersCount)} followers</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-[#2E2E2F]/5 px-3 py-1.5 rounded-xl">
                                        <ICONS.Calendar className="w-3.5 h-3.5" />
                                        <span>{organizer.eventsHostedCount || 0} events hosted</span>
                                    </div>
                                    {organizer.websiteUrl && (
                                        <div className="flex items-center gap-2 bg-[#2E2E2F]/5 px-3 py-1.5 rounded-xl">
                                            <ICONS.Globe className="w-3.5 h-3.5" />
                                            <a href={organizer.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#38BDF2] transition-colors">Website</a>
                                        </div>
                                    )}
                                </div>

                                {/* Social Connectivity */}
                                <div className="flex items-center gap-3 pt-4">
                                    {organizer.facebookId && (
                                        <a href={`https://facebook.com/${organizer.facebookId}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-80 shadow-sm" style={{ backgroundColor: brandColor }}>
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                        </a>
                                    )}
                                    {organizer.twitterHandle && (
                                        <a href={`https://twitter.com/${organizer.twitterHandle}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-80 shadow-sm" style={{ backgroundColor: brandColor }}>
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* CTAs */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
                                <button
                                    onClick={handleFollow}
                                    className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 shadow-md ${following
                                        ? 'bg-[#2E2E2F] !text-white opacity-40 cursor-default border-none shadow-none'
                                        : '!text-white hover:opacity-90 border-none hover:shadow-lg'
                                        }`}
                                    style={!following ? { backgroundColor: brandColor } : {}}
                                >
                                    {following ? <ICONS.CheckCircle className="w-4 h-4" /> : <ICONS.Users className="w-4 h-4" />}
                                    {following ? 'Following' : 'Follow Organizer'}
                                </button>
                                <button
                                    onClick={() => {
                                        if (organizer.websiteUrl) window.open(organizer.websiteUrl, '_blank');
                                        else setInteractionNotice('No contact method specified.');
                                    }}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-md active:scale-95 text-white hover:opacity-90"
                                    style={{ backgroundColor: brandColor }}
                                >
                                    <ICONS.Mail className="w-4 h-4" />
                                    Contact
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Bar */}
                    <div className="flex items-center gap-8 border-t border-[#2E2E2F]/5">
                        <button
                            onClick={() => setActiveTab('upcoming')}
                            className="relative pt-6 pb-4 px-2 group"
                        >
                            <span className={`font-black text-[10px] uppercase tracking-[0.3em] transition-colors ${activeTab === 'upcoming' ? 'text-[#38BDF2]' : 'text-[#2E2E2F]/40'}`}>Upcoming Events</span>
                            {activeTab === 'upcoming' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#38BDF2] rounded-full" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('past')}
                            className="relative pt-6 pb-4 px-2 group"
                        >
                            <span className={`font-black text-[10px] uppercase tracking-[0.3em] transition-colors ${activeTab === 'past' ? 'text-[#38BDF2]' : 'text-[#2E2E2F]/40'}`}>Past Events</span>
                            {activeTab === 'past' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#38BDF2] rounded-full" />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-[1250px] mx-auto mt-8 px-4 pb-24 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 lg:gap-8">
                {/* Main Content Area - Left */}
                <div className="space-y-8">
                    {interactionNotice && (
                        <Card className="bg-[#38BDF2]/10 border border-[#38BDF2]/30 rounded-xl p-5 text-xs font-black uppercase tracking-widest text-[#38BDF2] animate-in fade-in slide-in-from-top-2">
                            {interactionNotice}
                        </Card>
                    )}

                    <div className="bg-[#F2F2F2] p-8 rounded-xl shadow-sm border border-[#2E2E2F]/10 overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tight uppercase tracking-wider">
                                {activeTab === 'upcoming' ? 'Upcoming & Live Events' : 'Past Events Archive'}
                            </h2>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${activeTab === 'upcoming' ? 'bg-[#38BDF2] animate-pulse' : 'bg-[#2E2E2F]/30'}`} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40">{displayEvents.length} Results</span>
                            </div>
                        </div>

                        {displayEvents.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {displayEvents.map(event => (
                                    <EventMiniCard key={event.eventId} event={event} brandColor={brandColor} isPast={activeTab === 'past'} />
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center bg-[#F2F2F2]/50 rounded-xl border-2 border-dashed border-[#2E2E2F]/10">
                                <ICONS.Calendar className="w-12 h-12 text-[#2E2E2F]/10 mx-auto mb-4" />
                                <p className="text-[#2E2E2F]/40 font-black uppercase tracking-widest text-sm">
                                    {activeTab === 'upcoming' ? 'No upcoming events scheduled yet.' : 'No past events found.'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar - Right */}
                <div className="space-y-8">
                    <Card className="p-8 rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/10 shadow-sm">
                        <h2 className="text-xl font-black text-[#2E2E2F] mb-6 tracking-tight uppercase tracking-widest text-xs opacity-50">About Organizer</h2>
                        {organizer.bio ? (
                            <div className="space-y-8">
                                <p className="text-[#2E2E2F]/80 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                    {organizer.bio}
                                </p>
                                <div className="space-y-5 pt-6 border-t border-[#2E2E2F]/5">
                                    {organizer.websiteUrl && (
                                        <div className="flex items-center gap-4 text-[#2E2E2F]">
                                            <div className="w-10 h-10 rounded-xl bg-[#F2F2F2] flex items-center justify-center text-[#2E2E2F]/60">
                                                <ICONS.Globe className="w-5 h-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-[#2E2E2F]/40 uppercase tracking-widest">Official Website</span>
                                                <a href={organizer.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold hover:text-[#38BDF2] transition-colors">
                                                    {new URL(organizer.websiteUrl).hostname}
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-4 text-[#2E2E2F]">
                                        <div className="w-10 h-10 rounded-xl bg-[#F2F2F2] flex items-center justify-center text-[#2E2E2F]/60">
                                            <ICONS.Users className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-[#2E2E2F]/40 uppercase tracking-widest">Community</span>
                                            <p className="text-sm font-bold">{formatCompactCount(organizer.followersCount)} Active Followers</p>
                                        </div>
                                    </div>
                                    {organizer.brandColor && (
                                        <div className="flex items-center gap-4 text-[#2E2E2F]">
                                            <div className="w-10 h-10 rounded-xl bg-[#F2F2F2] flex items-center justify-center text-[#2E2E2F]/60">
                                                <div className="w-5 h-5 rounded-full border border-[#2E2E2F]/10 shadow-sm" style={{ backgroundColor: organizer.brandColor }} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-[#2E2E2F]/40 uppercase tracking-widest">Brand System</span>
                                                <p className="text-sm font-bold">Verified Identity Active</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="py-10 text-center rounded-xl bg-[#F2F2F2]/30 border border-dashed border-[#2E2E2F]/10">
                                <p className="text-[#2E2E2F]/30 text-[10px] font-black uppercase tracking-widest">No detailed bio provided</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

const EventMiniCard: React.FC<{ event: Event; brandColor: string; isPast?: boolean }> = ({ event, brandColor, isPast }) => {
    const navigate = useNavigate();
    const { isAuthenticated } = useUser();
    const { isLiked, toggleLike, canLikeFollow } = useEngagement();
    const liked = isLiked(event.eventId);

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isAuthenticated) { navigate('/signup'); return; }
        if (!canLikeFollow) return;
        try {
            await toggleLike(event.eventId);
        } catch (err) { }
    };

    return (
        <Card
            className="group overflow-hidden border border-[#2E2E2F]/10 rounded-xl bg-[#F2F2F2] transition-all cursor-pointer shadow-sm hover:shadow-xl hover:scale-[1.01]"
            style={{ borderColor: brandColor ? `${brandColor}40` : '#2E2E2F1A' }}
            onClick={() => navigate(`/events/${event.slug}`)}
        >
            <div className="relative h-48">
                <img
                    src={getImageUrl(event.imageUrl)}
                    alt={event.eventName}
                    className="w-full h-full object-cover"
                />

                {/* Status Badge */}
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                    {isPast ? (
                        <div className="rounded-full px-2.5 py-1 bg-[#2E2E2F]/60 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-[0.15em] shadow-lg">
                            PAST EVENT
                        </div>
                    ) : (
                        <div className="rounded-full px-2.5 py-1 bg-[#38BDF2] text-white text-[9px] font-black uppercase tracking-[0.15em] shadow-lg">
                            UPCOMING
                        </div>
                    )}
                </div>

                {/* Promoted Badge - Upper Left (Offset if status badge exists) */}
                {(event.is_promoted || (event as any).isPromoted) && (
                    <div className="absolute top-12 left-4 z-10 group/promoted">
                        <div
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full shadow-lg border border-white/20 animate-in fade-in zoom-in duration-500 cursor-help"
                            style={{
                                background: brandColor
                                    ? `linear-gradient(135deg, ${brandColor}, ${brandColor}DD)`
                                    : 'linear-gradient(135deg, #38BDF2, #00AEEF)',
                                boxShadow: `0 0 15px ${brandColor ? brandColor + '66' : 'rgba(56,189,242,0.4)'}`
                            }}
                        >
                            <ICONS.Info className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-white drop-shadow-sm">Promoted</span>
                        </div>
                        <div className="absolute left-0 top-full mt-2 w-48 p-3 bg-[#2E2E2F] text-white text-[9px] font-bold rounded-xl shadow-2xl opacity-0 translate-y-1 pointer-events-none group-hover/promoted:opacity-100 group-hover/promoted:translate-y-0 transition-all z-50 leading-relaxed">
                            The organizer has highlighted this event as part of their elite plan features.
                            <div className="absolute bottom-full left-4 border-8 border-transparent border-b-[#2E2E2F]"></div>
                        </div>
                    </div>
                )}
                <button
                    onClick={handleLike}
                    className={`absolute top-4 right-4 w-11 h-11 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all ${liked ? 'text-white' : 'bg-white/90 text-[#2E2E2F] border border-[#2E2E2F]/10'}`}
                    style={liked ? { backgroundColor: brandColor } : {}}
                    aria-label={liked ? 'Unlike event' : 'Like event'}
                >
                    <ICONS.Heart className="w-4 h-4" />
                </button>
            </div>
            <div className="p-6">
                <h3 className="text-lg font-bold text-[#2E2E2F] mb-1 line-clamp-1">{event.eventName}</h3>
                <p className="text-[10px] text-[#2E2E2F]/60 font-semibold mb-4">
                    {formatDate(event.startAt, event.timezone, { day: 'numeric', month: 'short', year: 'numeric' })} · {formatTime(event.startAt, event.timezone)}
                </p>
                <div className="flex items-center justify-between mt-auto">
                    <span className="text-[9px] font-black text-[#2E2E2F]/40 uppercase tracking-widest truncate max-w-[150px]">{event.locationText}</span>
                    <span className="font-black text-[10px] uppercase tracking-widest group-hover:underline" style={{ color: brandColor }}>View Details</span>
                </div>
            </div>
        </Card>
    );
};

