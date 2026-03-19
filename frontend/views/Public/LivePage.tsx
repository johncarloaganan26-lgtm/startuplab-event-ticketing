
import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/apiService';
import { Event } from '../../types';
import { ICONS } from '../../constants';
import { PageLoader } from '../../components/Shared';
import { Link } from 'react-router-dom';

const getEmbedUrl = (link: string, autoplay: boolean = true) => {
    if (!link) return null;
    const normalized = link.startsWith('http') ? link : `https://${link}`;

    const autoPlayParam = autoplay ? '1' : '0';
    const autoPlayBool = autoplay ? 'true' : 'false';

    // YouTube
    if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/|live\/)([^#\&\?]*).*/;
        const match = normalized.match(regExp);
        const videoId = (match && match[2].length === 11) ? match[2] : null;
        return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=${autoPlayParam}&mute=1&rel=0` : null;
    }

    // Facebook
    if (normalized.includes('facebook.com') || normalized.includes('fb.watch')) {
        return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(normalized)}&show_text=0&width=500&autoplay=${autoPlayBool}&mute=true`;
    }

    // Vimeo
    if (normalized.includes('vimeo.com')) {
        const match = normalized.match(/vimeo\.com\/(\d+)/);
        const videoId = match ? match[1] : null;
        return videoId ? `https://player.vimeo.com/video/${videoId}?autoplay=${autoPlayParam}&muted=1` : null;
    }

    return null;
};

// Helper: determines if a streaming URL is an embeddable video platform (YouTube, Facebook, Vimeo)
// Meeting links (Google Meet, Zoom) and other non-video URLs return false
const isEmbeddableVideoUrl = (link: string): boolean => {
    if (!link || !link.trim()) return false;
    const normalized = link.startsWith('http') ? link : `https://${link}`;
    if (/youtube\.com|youtu\.be/.test(normalized)) return true;
    if (/facebook\.com|fb\.watch|fb\.com/.test(normalized)) return true;
    if (/vimeo\.com/.test(normalized)) return true;
    return false;
};

export const LivePage: React.FC = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentEvent, setCurrentEvent] = useState<Event | null>(null);

    useEffect(() => {
        const fetchLive = async () => {
            try {
                const data = await apiService.getLiveEvents();
                // Only show events with embeddable video URLs (YouTube, Facebook, Vimeo)
                const videoEvents = data.filter(e => isEmbeddableVideoUrl(e.streaming_url || ''));
                setEvents(videoEvents);
                
                // Only auto-select if there's a LIVE event, otherwise leave as null so user must select
                if (!currentEvent && videoEvents.length > 0) {
                    const now = new Date();
                    const liveItem = videoEvents.find(e => {
                        const start = new Date(e.startAt);
                        const end = e.endAt ? new Date(e.endAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
                        return now >= start && now <= end;
                    });
                    if (liveItem) {
                        setCurrentEvent(liveItem);
                    }
                } else if (videoEvents.length === 0) {
                    setCurrentEvent(null);
                }
            } catch (err) {
                console.error('Failed to fetch live events:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchLive();
        const interval = setInterval(fetchLive, 60000);
        return () => clearInterval(interval);
    }, [currentEvent]);

    if (loading) return <PageLoader label="Loading Live Broadcasts..." variant="page" />;

    const now = new Date();
    const liveItems = events.filter(e => {
        const start = new Date(e.startAt);
        const end = e.endAt ? new Date(e.endAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
        return now >= start && now <= end;
    });
    const archiveItems = events.filter(e => {
        const start = new Date(e.startAt);
        const end = e.endAt ? new Date(e.endAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
        return now > end;
    });

    // Helper to determine status label
    const getEventStatus = (e: Event) => {
        const start = new Date(e.startAt);
        const end = e.endAt ? new Date(e.endAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
        if (now < start) return 'UPCOMING';
        if (now >= start && now <= end) return 'LIVE';
        return 'PAST';
    };

    const status = currentEvent ? getEventStatus(currentEvent) : 'NONE';
    const embedUrl = currentEvent ? getEmbedUrl(currentEvent.streaming_url || '', status === 'LIVE') : null;

    return (
        <div className="min-h-screen bg-[#F2F2F2]">
            <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 h-[260px] sm:h-[300px] lg:h-[350px] overflow-hidden mb-12">
                <div className="absolute inset-0 bg-[linear-gradient(116deg,#38BDF2_0%,#38BDF2_44%,#F2F2F2_100%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,62,134,0.45)_0%,rgba(0,62,134,0.2)_34%,rgba(0,62,134,0)_72%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_32%,rgba(255,255,255,0.34),transparent_46%),linear-gradient(90deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.06)_26%,rgba(255,255,255,0)_52%)]" />
                <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl items-center px-5 sm:px-8">
                    <div className="max-w-[740px]">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 mb-4">Broadcasts</p>
                        <h1 className="text-[2.1rem] font-black leading-none tracking-tight text-white sm:text-5xl">
                            Watch Events Live
                        </h1>
                        <p className="mt-4 max-w-[700px] text-base leading-relaxed text-white/95 sm:text-[1.1rem]">
                            {liveItems.length > 0 ? 'Streaming live from StartupLab' : 'Archived Broadcasts & Replays'}
                        </p>
                    </div>
                </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    
                    {/* Main Area (Player or Placeholder) */}
                    <div className="lg:col-span-8 space-y-8">
                        {currentEvent ? (
                            <div className="space-y-8">
                                <div className="overflow-hidden rounded-xl border border-[#2E2E2F]/10 shadow-2xl bg-[#F2F2F2]">
                                    {/* Integrated Header */}
                                    <div className={`${status === 'LIVE' ? 'bg-[#00AEEF]' : 'bg-[#2E2E2F]'} p-8 text-white text-left flex justify-between items-center border-b border-white/10 shadow-xl`}>
                                        <div>
                                            <h2 className="text-3xl font-black tracking-tight leading-tight uppercase mb-1">{currentEvent.eventName}</h2>
                                            <p className="text-[12px] font-black opacity-90 uppercase tracking-[0.2em] text-[#F2F2F2]">
                                                {new Date(currentEvent.startAt).toLocaleDateString('en-US', { weekday: 'long' })} AT {new Date(currentEvent.startAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </p>
                                        </div>
                                        <div className={`flex items-center gap-2.5 ${status === 'LIVE' ? 'bg-red-600 border-red-500 animate-pulse' : 'bg-white/10 border-white/20'} px-5 py-2.5 rounded-full border shadow-lg`}>
                                            {status === 'LIVE' && <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />}
                                            <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">
                                                {status === 'LIVE' ? 'Live Now' : status === 'PAST' ? 'Archived' : 'Upcoming'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Body / Player */}
                                    <div className="p-4 bg-[#F2F2F2]">
                                        <div className="overflow-hidden rounded-xl border border-[#2E2E2F]/10 shadow-inner bg-black relative aspect-video group">
                                            {/* Watermark */}
                                            <div className="absolute top-6 left-8 flex items-center gap-2.5 z-10 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 group-hover:bg-black/40 transition-all">
                                                <ICONS.Monitor className="w-3.5 h-3.5 text-white/60" />
                                                <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em]">Organizer Preview</span>
                                            </div>

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
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-[#F2F2F2]">
                                                    <div className="w-24 h-24 rounded-full bg-[#2E2E2F]/5 flex items-center justify-center mb-8 border border-[#2E2E2F]/10">
                                                        <ICONS.Monitor className="w-10 h-10 text-[#2E2E2F]/40" />
                                                    </div>
                                                    <h3 className="text-2xl font-black text-[#2E2E2F] mb-4 uppercase tracking-tighter">External Link</h3>
                                                    <p className="text-[#2E2E2F]/60 text-sm max-w-sm mb-10 font-medium leading-relaxed">
                                                        This broadcast is hosted on an external platform. {status === 'PAST' ? 'Watch the replay by clicking below.' : 'Click to watch the active stream.'}
                                                    </p>
                                                    <a
                                                        href={currentEvent.streaming_url || ''}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="bg-[#00AEEF] text-white px-10 py-5 rounded-xl font-black text-[12px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all hover:scale-105 hover:bg-[#0098D6] active:scale-95 shadow-2xl"
                                                    >
                                                        <ICONS.Globe className="w-5 h-5" />
                                                        Watch on {currentEvent.streamingPlatform || 'Platform'}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-10 rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/10 shadow-xl">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-3xl font-black text-[#2E2E2F] tracking-tighter">
                                            {currentEvent.eventName}
                                        </h2>
                                        <div className="flex items-center gap-3 bg-[#00AEEF]/10 px-4 py-2 rounded-xl text-[#00AEEF]">
                                            <ICONS.Monitor className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">{currentEvent.streamingPlatform || 'Broadcast'}</span>
                                        </div>
                                    </div>
                                    <p className="text-[#2E2E2F]/60 text-lg leading-relaxed font-medium line-clamp-3">
                                        {currentEvent.description}
                                    </p>
                                    <div className="mt-10 pt-10 border-t border-[#2E2E2F]/5 flex flex-wrap gap-8 items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {currentEvent.organizer?.profileImageUrl ? (
                                                <img
                                                    src={currentEvent.organizer.profileImageUrl}
                                                    alt={currentEvent.organizer?.organizerName}
                                                    className="w-14 h-14 rounded-xl object-cover border border-[#2E2E2F]/10 shadow-sm"
                                                />
                                            ) : (
                                                <div className="w-14 h-14 rounded-xl bg-[#2E2E2F] flex items-center justify-center text-white text-lg font-bold shadow-lg">
                                                    {currentEvent.organizer?.organizerName?.[0] || 'O'}
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40 mb-1">Organized By</p>
                                                <p className="text-base font-black text-[#2E2E2F] tracking-tight">{currentEvent.organizer?.organizerName || 'Organizer'}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-12 gap-y-6">
                                            <div className="flex flex-col">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40 mb-1">Schedule</p>
                                                <div className="flex items-center gap-2 text-[#2E2E2F]">
                                                    <ICONS.Calendar className="w-3.5 h-3.5 opacity-50" />
                                                    <p className="text-xs font-bold uppercase tracking-wider">
                                                        {new Date(currentEvent.startAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} AT {new Date(currentEvent.startAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>

                                            {currentEvent.locationType !== 'ONLINE' && (
                                                <div className="flex flex-col">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40 mb-1">Venue</p>
                                                    <div className="flex items-center gap-2 text-[#2E2E2F]">
                                                        <ICONS.MapPin className="w-3.5 h-3.5 opacity-50" />
                                                        <p className="text-xs font-bold uppercase tracking-wider line-clamp-1 max-w-[150px]">
                                                            {currentEvent.locationText}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            <Link to={`/events/${currentEvent.slug}`} className="px-6 py-3 rounded-xl bg-[#00AEEF] text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#0098D6] transition-all shadow-lg shadow-[#00AEEF]/20 active:scale-95">
                                                View Full Details
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-32 text-center bg-[#F2F2F2] border border-[#2E2E2F]/5 rounded-xl shadow-sm">
                                <div className="w-32 h-32 rounded-full bg-[#F2F2F2] flex items-center justify-center mb-10">
                                    {events.length > 0 ? (
                                        <ICONS.Monitor className="w-12 h-12 text-[#2E2E2F]/20" />
                                    ) : (
                                        <ICONS.Globe className="w-12 h-12 text-[#2E2E2F]/20" />
                                    )}
                                </div>
                                <h2 className="text-4xl font-black text-[#2E2E2F] mb-4 uppercase tracking-tighter">
                                    {events.length > 0 ? 'Select a Broadcast' : 'No Active Broadcasts'}
                                </h2>
                                <p className="text-[#2E2E2F]/40 text-sm max-w-sm mb-12 font-medium leading-relaxed">
                                    {events.length > 0
                                        ? 'Choose an active stream or browse our archives from the sidebar to start watching.'
                                        : 'There are no events streaming right now. Check back later or browse upcoming sessions in our discovery feed.'
                                    }
                                </p>
                                <Link to="/browse-events" className="bg-[#00AEEF] text-white px-10 py-5 rounded-xl font-black text-[12px] uppercase tracking-[0.2em] transition-all hover:bg-[#0098D6] hover:scale-105 shadow-xl shadow-[#00AEEF]/20">
                                    Browse Events
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Sidebar List (Always on the right) */}
                    <div className="lg:col-span-4 space-y-6">
                        {liveItems.length > 0 && (
                            <>
                                <div className="flex items-center justify-between mb-4 mt-2">
                                    <h3 className="text-[10px] font-black text-[#2E2E2F]/50 uppercase tracking-[0.3em]">Happening Now</h3>
                                    <span className="text-[10px] font-black text-white bg-red-600 px-2.5 py-1 rounded-full shadow-lg shadow-red-600/20 animate-pulse">LIVE</span>
                                </div>
                                <div className="space-y-4">
                                    {liveItems.map((event) => (
                                        <button
                                            key={event.eventId}
                                            onClick={() => {
                                                setCurrentEvent(event);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className={`w-full text-left p-6 rounded-xl transition-all duration-300 border ${currentEvent?.eventId === event.eventId
                                                ? 'bg-[#F2F2F2] border-[#00AEEF] shadow-xl shadow-[#00AEEF]/10 scale-[1.02] ring-1 ring-[#00AEEF]/30'
                                                : 'bg-[#F2F2F2] border-[#2E2E2F]/5 hover:border-[#00AEEF]/40 hover:scale-[1.01]'
                                                }`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="w-24 h-16 rounded-xl bg-[#2E2E2F]/5 flex items-center justify-center overflow-hidden border border-[#2E2E2F]/5 shrink-0 relative">
                                                    {event.imageUrl ? (
                                                        <img src={typeof event.imageUrl === 'string' ? event.imageUrl : event.imageUrl?.url} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <ICONS.Monitor className="w-5 h-5 text-[#2E2E2F]/20" />
                                                    )}
                                                    <div className="absolute bottom-1 right-1 bg-red-600 px-1.5 py-0.5 rounded text-[7px] font-black text-white uppercase tracking-widest shadow-lg">
                                                        LIVE
                                                    </div>
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-[#2E2E2F] line-clamp-1 mb-1 tracking-tight">
                                                        {event.eventName}
                                                    </h4>
                                                    <p className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-wider">
                                                        {event.streamingPlatform || 'Broadcast'}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {archiveItems.length > 0 && (
                            <>
                                <div className="flex items-center justify-between mb-4 pt-4 border-t border-[#2E2E2F]/5">
                                    <h3 className="text-[10px] font-black text-[#2E2E2F]/50 uppercase tracking-[0.3em]">Archive / Replays</h3>
                                    <span className="text-[10px] font-black text-[#2E2E2F]/40 bg-[#2E2E2F]/10 px-2 py-0.5 rounded-xl">{archiveItems.length}</span>
                                </div>
                                <div className="space-y-4">
                                    {archiveItems.map((event) => (
                                        <button
                                            key={event.eventId}
                                            onClick={() => {
                                                setCurrentEvent(event);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className={`w-full text-left p-6 rounded-xl transition-all duration-300 border ${currentEvent?.eventId === event.eventId
                                                ? 'bg-[#F2F2F2] border-[#2E2E2F] shadow-xl shadow-black/5 scale-[1.02]'
                                                : 'bg-[#F2F2F2] border-[#2E2E2F]/5 hover:border-[#2E2E2F]/20 hover:scale-[1.01]'
                                                }`}
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="w-24 h-16 rounded-xl bg-[#2E2E2F]/5 flex items-center justify-center overflow-hidden border border-[#2E2E2F]/5 shrink-0 relative">
                                                    {event.imageUrl ? (
                                                        <img src={typeof event.imageUrl === 'string' ? event.imageUrl : event.imageUrl?.url} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <ICONS.Monitor className="w-5 h-5 text-[#2E2E2F]/20" />
                                                    )}
                                                    <div className="absolute bottom-1 right-1 bg-[#2E2E2F]/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[7px] font-black text-white uppercase tracking-widest">
                                                        PAST
                                                    </div>
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-[#2E2E2F] line-clamp-1 mb-1 tracking-tight">
                                                        {event.eventName}
                                                    </h4>
                                                    <p className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-wider mb-2">
                                                        {event.streamingPlatform || 'Broadcast'}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-[9px] font-bold text-[#2E2E2F]/30 uppercase tracking-widest">
                                                        <ICONS.Calendar className="w-3 h-3" />
                                                        <span>{new Date(event.startAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

