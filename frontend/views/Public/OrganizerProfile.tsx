
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

                // Check if any of this organizer's events are live
                const matchingLive = allLiveEvents.find(e => e.organizerId === orgData.organizerId);
                setLiveEvent(matchingLive || null);
            } catch (error) {
                console.error('Failed to load organizer profile:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id]);

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
                <div className="px-6 md:px-12 pb-8">
                    <div className="flex flex-col md:flex-row md:items-end -mt-12 md:-mt-20 gap-6 md:gap-8 border-b border-[#2E2E2F]/5 pb-8">
                        {/* Profile Pic overlap */}
                        <div className="relative">
                            <div className="w-32 h-32 md:w-48 md:h-48 rounded-[2rem] border-[6px] border-white overflow-hidden bg-[#2E2E2F] shadow-2xl flex-shrink-0">
                                {organizer.profileImageUrl ? (
                                    <img src={organizerImage} alt={organizer.organizerName} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-6xl font-black text-white flex h-full w-full items-center justify-center">{organizerInitial}</span>
                                )}
                            </div>
                            {liveEvent && (
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border-2 border-white shadow-lg">
                                    Live
                                </div>
                            )}
                        </div>

                        {/* Name and Stats */}
                        <div className="flex-1 mb-2">
                            <h1 className="text-3xl md:text-[3rem] font-black text-[#2E2E2F] tracking-tighter mb-2">
                                {organizer.organizerName}
                            </h1>
                            <div className="flex items-center gap-2 text-[#2E2E2F]/60 font-black text-xs uppercase tracking-widest">
                                <span>{formatCompactCount(organizer.followersCount)} followers</span>
                                <span className="opacity-30">|</span>
                                <span>{organizer.eventsHostedCount || 0} events hosted</span>
                            </div>

                            {/* Social Icons Row */}
                            <div className="flex items-center gap-3 mt-6">
                                {organizer.websiteUrl && (
                                    <a href={organizer.websiteUrl} target="_blank" rel="noopener noreferrer" className="p-3 rounded-2xl bg-[#F2F2F2] text-[#2E2E2F] hover:bg-[#38BDF2] hover:text-white transition-all shadow-sm" title="Website">
                                        <ICONS.Globe className="w-5 h-5" />
                                    </a>
                                )}
                                {organizer.facebookId && (
                                    <a href={`https://facebook.com/${organizer.facebookId}`} target="_blank" rel="noopener noreferrer" className="p-3 rounded-2xl bg-[#F2F2F2] text-[#2E2E2F] hover:bg-[#38BDF2] hover:text-white transition-all shadow-sm" title="Facebook">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                    </a>
                                )}
                                {organizer.twitterHandle && (
                                    <a href={`https://twitter.com/${organizer.twitterHandle}`} target="_blank" rel="noopener noreferrer" className="p-3 rounded-2xl bg-[#F2F2F2] text-[#2E2E2F] hover:bg-[#38BDF2] hover:text-white transition-all shadow-sm" title="X (Twitter)">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mb-2">
                            <button
                                onClick={handleFollow}
                                className={`flex items-center gap-2 px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 shadow-xl ${following
                                    ? '!bg-[#2E2E2F] !text-white opacity-30 cursor-default border-none'
                                    : 'bg-[#38BDF2] text-white hover:bg-[#2E2E2F] shadow-[#38BDF2]/20 hover:shadow-[#2E2E2F]/20 border-none'
                                    }`}
                            >
                                <ICONS.CheckCircle className={`w-4 h-4 ${following ? '' : 'hidden'}`} />
                                {following ? 'Following' : 'Follow Organizer'}
                            </button>
                            <button
                                onClick={() => {
                                    if (organizer.websiteUrl) window.open(organizer.websiteUrl, '_blank');
                                    else setInteractionNotice('No contact method specified.');
                                }}
                                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-[#2E2E2F] text-white font-black text-xs uppercase tracking-widest hover:bg-[#38BDF2] shadow-xl shadow-[#2E2E2F]/10 hover:shadow-[#38BDF2]/30 transition-all duration-300 border-none"
                            >
                                <ICONS.Mail className="w-4 h-4" />
                                Contact
                            </button>
                        </div>
                    </div>

                    {/* Navigation Bar */}
                    <div className="flex items-center gap-1 mt-2">
                        <div className="px-6 py-4 text-[#38BDF2] border-b-4 border-[#38BDF2] font-black text-xs uppercase tracking-widest cursor-pointer">
                            Hosted Events
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1250px] mx-auto mt-8 px-4 pb-24 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
                {/* Main Content Area - Left */}
                <div className="space-y-8">
                    {interactionNotice && (
                        <Card className="bg-[#38BDF2]/10 border border-[#38BDF2]/30 rounded-[1.5rem] p-5 text-xs font-black uppercase tracking-widest text-[#38BDF2] animate-in fade-in slide-in-from-top-2">
                            {interactionNotice}
                        </Card>
                    )}

                    <div className="bg-[#F2F2F2] p-8 rounded-[2rem] shadow-sm border border-[#2E2E2F]/10 overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tight">Upcoming & Live Events</h2>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#38BDF2] animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40">{events.length} Results</span>
                            </div>
                        </div>

                        {events.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {events.map(event => (
                                    <EventMiniCard key={event.eventId} event={event} brandColor={brandColor} />
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center bg-[#F2F2F2]/50 rounded-[2rem] border-2 border-dashed border-[#2E2E2F]/10">
                                <ICONS.Calendar className="w-12 h-12 text-[#2E2E2F]/10 mx-auto mb-4" />
                                <p className="text-[#2E2E2F]/40 font-black uppercase tracking-widest text-sm">No public events scheduled yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar - Right */}
                <div className="space-y-8">
                    <Card className="p-8 rounded-[2rem] bg-[#F2F2F2] border border-[#2E2E2F]/10 shadow-sm">
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
                            <div className="py-10 text-center rounded-[1.5rem] bg-[#F2F2F2]/30 border border-dashed border-[#2E2E2F]/10">
                                <p className="text-[#2E2E2F]/30 text-[10px] font-black uppercase tracking-widest">No detailed bio provided</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

const EventMiniCard: React.FC<{ event: Event; brandColor: string }> = ({ event, brandColor }) => {
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
            className="group overflow-hidden border border-[#2E2E2F]/10 rounded-3xl bg-[#F2F2F2] transition-all cursor-pointer shadow-sm hover:shadow-xl hover:scale-[1.01]"
            style={{ borderColor: brandColor ? `${brandColor}40` : '#2E2E2F1A' }}
            onClick={() => navigate(`/events/${event.slug}`)}
        >
            <div className="relative h-48">
                <img
                    src={getImageUrl(event.imageUrl)}
                    alt={event.eventName}
                    className="w-full h-full object-cover"
                />
                <button
                    onClick={handleLike}
                    className={`absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${liked ? 'bg-red-500 text-white' : 'bg-white/90 text-[#2E2E2F] border border-[#2E2E2F]/10'}`}
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
