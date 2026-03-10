
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Event, TicketType, UserRole } from '../../types';
import { Button, Card, PageLoader } from '../../components/Shared';
import { ICONS } from '../../constants';
import { useUser } from '../../context/UserContext';
import { useEngagement } from '../../context/EngagementContext';
import { getEventCategoryKeys } from '../../utils/eventCategories';

// Helper to handle JSONB image format
const getImageUrl = (img: any): string => {
  if (!img) return 'https://via.placeholder.com/800x400';
  if (typeof img === 'string') return img;
  return img.url || img.path || img.publicUrl || 'https://via.placeholder.com/800x400';
};

// Formatting helpers (use event timezone)
const formatDate = (iso: string, timezone?: string, opts?: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone || 'UTC', ...opts }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
};

const formatRange = (startAt?: string, endAt?: string, timezone?: string) => {
  if (!startAt) return '';
  const startDate = new Date(startAt);
  const startStr = `${formatDate(startAt, timezone, { dateStyle: 'medium' })} ${formatDate(startAt, timezone, { timeStyle: 'short' })}`;
  if (!endAt) return startStr;
  const endDate = new Date(endAt);
  const sameDay = startDate.toDateString() === endDate.toDateString();
  if (sameDay) {
    const endTime = formatDate(endAt, timezone, { timeStyle: 'short' });
    return `${startStr} – ${endTime}`;
  }
  const endStr = `${formatDate(endAt, timezone, { dateStyle: 'medium' })} ${formatDate(endAt, timezone, { timeStyle: 'short' })}`;
  return `${startStr} → ${endStr}`;
};

const formatCompactCount = (value: number) => (
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Math.max(0, Number(value || 0))
  )
);


const StreamStatusBanner: React.FC<{ event: Event; isOwner?: boolean }> = ({ event, isOwner }) => {
  // Check if event is LIVE either by status or by time (event is happening now)
  const now = new Date();
  const startAt = event.startAt ? new Date(event.startAt) : null;
  const endAt = event.endAt ? new Date(event.endAt) : null;
  const isLiveByTime = startAt && now >= startAt && (!endAt || now <= endAt);
  const isLiveStatus = isLiveByTime || event.status === 'LIVE';
  const isOnline = event.locationType === 'ONLINE' || event.locationType === 'HYBRID' || isLiveStatus;
  const url = event.streaming_url || event.locationText || '';
  const normalizedUrl = url && !url.startsWith('http') ? `https://${url}` : url;
  const isYouTube = /youtube\.com|youtu\.be/.test(normalizedUrl);
  const isFacebook = /facebook\.com|fb\.watch|fb\.com/.test(normalizedUrl);

  const getYouTubeId = (url: string) => {
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/|live\/)([^#\&\?]*).*/;
      const match = url.match(regExp);
      const id = (match && match[2].length === 11) ? match[2] : null;
      console.log('YouTube ID extraction:', { url, id });
      return id;
    } catch (e) {
      console.error('YouTube extraction error:', e);
      return null;
    }
  };

  const videoId = isYouTube ? getYouTubeId(normalizedUrl) : null;
  const hasLink = !!(normalizedUrl && normalizedUrl.startsWith('http'));

  // Logic: if it has a link AND is a valid YouTube/Facebook URL, we show it IF it's either explicitly LIVE status OR set as Online/Hybrid
  const hasValidStreamingUrl = hasLink && (isYouTube || isFacebook);
  const showingLive = hasValidStreamingUrl && (isLiveStatus || isOnline);

  // Hide entire banner if not online or no valid YouTube/Facebook streaming URL
  if (!isOnline || !hasValidStreamingUrl) return null;

  return (
    <div className={`overflow-hidden rounded-[2.5rem] border border-[#2E2E2F]/10 mb-10 shadow-2xl ${isOwner && hasLink ? 'ring-2 ring-[#2E2E2F]/30' : ''}`}>
      {/* Header */}
      <div className="bg-[#00AEEF] p-6 text-white text-left flex justify-between items-center border-b border-[#00AEEF]/20 shadow-[0_4px_20px_rgba(0,174,239,0.3)]">
        <div>
          <h2 className="text-xl font-black tracking-tight leading-tight">{event.eventName} {isLiveStatus && <span className="ml-2 px-2 py-0.5 bg-red-600 rounded text-[9px] animate-pulse text-white">LIVE</span>}</h2>
          <p className="text-[11px] font-bold opacity-90 mt-1 uppercase tracking-widest text-[#F2F2F2]">
            {formatDate(event.startAt, event.timezone, { weekday: 'long' })} AT {formatDate(event.startAt, event.timezone, { timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex items-center gap-2 z-10 bg-red-600 px-4 py-1.5 rounded-full border border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.4)] animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{isLiveStatus ? 'BROADCASTING' : 'LIVE NOW'}</span>
        </div>
      </div>

      {/* Body */}
      <div className={`bg-[#F2F2F2] ${showingLive ? 'p-4' : 'p-12'} flex flex-col items-center justify-center text-center relative border-t border-[#2E2E2F]/10`}>
        {isOwner && showingLive && (
          <div className="absolute top-4 left-4 flex items-center gap-2 z-10 bg-[#2E2E2F]/5 px-2 py-1 rounded-lg border border-[#2E2E2F]/10">
            <ICONS.Monitor className="w-2.5 h-2.5 text-[#2E2E2F]" />
            <span className="text-[8px] font-black text-[#2E2E2F] uppercase tracking-[0.1em]">Organizer Preview</span>
          </div>
        )}

        {!showingLive ? (
          <>
            <div className="mb-6 opacity-30">
              <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2E2E2F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m16 16-3.5 1.5M2 2l20 20M7 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2M21 16V9a2 2 0 0 0-2-2h-3L12 3v1" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-[#2E2E2F] mb-2 uppercase tracking-tighter">No Live Stream</h3>
            <p className="text-[#2E2E2F]/60 text-xs max-w-sm mb-8 font-medium leading-relaxed">
              There is no live stream at the moment. Please check back during our service times.
            </p>
            <button
              className="bg-[#2E2E2F] text-white px-8 py-3.5 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-2"
              onClick={() => {
                const el = document.getElementById('event-schedule-info');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <ICONS.Calendar className="w-4 h-4" />
              VIEW SERVICE TIMES
            </button>
          </>
        ) : (
          <div className="w-full">
            {isYouTube && videoId ? (
              <div className="relative aspect-video rounded-3xl overflow-hidden bg-[#2E2E2F]/5 border border-[#2E2E2F]/10 shadow-inner">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1`}
                  title="YouTube Live Session"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : isFacebook ? (
              <div className="relative aspect-video rounded-3xl overflow-hidden bg-[#2E2E2F]/5 border border-[#2E2E2F]/10 shadow-inner">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(normalizedUrl)}&show_text=0&autoplay=1&mute=1`}
                  title="Facebook Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : (
              <a
                href={normalizedUrl}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center p-14 rounded-3xl bg-[#F2F2F2] border border-[#2E2E2F]/10 hover:bg-[#2E2E2F]/5 hover:border-[#2E2E2F]/30 transition-all group shadow-sm text-[#2E2E2F]"
              >
                <div className="w-20 h-20 rounded-full bg-[#2E2E2F]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg">
                  <ICONS.Monitor className="w-10 h-10 text-[#2E2E2F]" />
                </div>
                <p className="text-[#2E2E2F] font-black text-xl tracking-tight">Open Live Stream Channel</p>
                <div className="mt-4 flex items-center gap-2 text-[10px] text-[#2E2E2F]/40 uppercase tracking-[0.3em] font-black group-hover:text-[#2E2E2F] transition-colors">
                  <span>Watch External</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7-7 7M5 12h16" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CompactEventRow: React.FC<{ event: Event; brandColor: string }> = ({ event, brandColor }) => {
  const navigate = useNavigate();
  const minPrice = event.ticketTypes?.length
    ? Math.min(...event.ticketTypes.map(t => t.priceAmount))
    : 0;

  return (
    <div
      className="group flex items-center justify-between py-6 border-b border-[#2E2E2F]/10 cursor-pointer hover:bg-black/[0.02] active:scale-[0.99] transition-all px-2 -mx-2 rounded-xl"
      onClick={() => {
        navigate(`/events/${event.slug}`);
        window.scrollTo(0, 0);
      }}
    >
      <div className="flex-1 pr-6 min-w-0">
        <h4 className="text-[17px] font-black text-[#2E2E2F] mb-1 leading-tight group-hover:text-[#38BDF2] transition-colors line-clamp-1">
          {event.eventName}
        </h4>
        <p className="text-[13px] font-bold text-[#2E2E2F]/60 mb-0.5">
          {formatDate(event.startAt, event.timezone, { weekday: 'short', day: 'numeric', month: 'long' })} • {formatDate(event.startAt, event.timezone, { timeStyle: 'short' })}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {event.locationText && (
            <p className="text-[12px] font-medium text-[#2E2E2F]/40 line-clamp-1">
              {event.locationText}
            </p>
          )}
          <p className="text-[12px] font-bold text-[#2E2E2F]/60">
            {minPrice > 0 ? `Starts at ${minPrice.toFixed(2)} PHP` : 'Free'}
          </p>
        </div>
        {(event as any).trendingRank && (
          <div className="mt-2 flex items-center gap-1.5 opacity-60">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#2E2E2F]/40">Promoted</span>
            <ICONS.Info className="w-2.5 h-2.5 text-[#2E2E2F]/30" />
          </div>
        )}
      </div>
      <div className="w-24 h-16 sm:w-32 sm:h-20 shrink-0 rounded-xl overflow-hidden border border-[#2E2E2F]/5 shadow-sm">
        <img
          src={getImageUrl(event.imageUrl)}
          alt={event.eventName}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
      </div>
    </div>
  );
};

export const EventDetails: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, role, email } = useUser();
  const {
    canLikeFollow,
    isAttendingView,
    isLiked,
    toggleLike,
    isFollowing,
    toggleFollowing
  } = useEngagement();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [interactionNotice, setInteractionNotice] = useState('');
  const [isOwnEvent, setIsOwnEvent] = useState(false);
  const [organizerEvents, setOrganizerEvents] = useState<Event[]>([]);
  const [recommendedEvents, setRecommendedEvents] = useState<Event[]>([]);

  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;

    const loadEvent = async () => {
      if (!slug) return;
      try {
        const data = await apiService.getEventBySlug(slug);
        if (!mounted) return;
        setEvent(data);
        if (data && data.ticketTypes.length > 0) {
          const initialQuantities: Record<string, number> = {};
          data.ticketTypes.forEach((ticketType) => {
            initialQuantities[ticketType.ticketTypeId] = 0;
          });
          setQuantities(initialQuantities);
        }

        // Check if the logged-in organizer owns this event
        if (data && isAuthenticated && role === UserRole.ORGANIZER) {
          try {
            const myOrg = await apiService.getMyOrganizer();
            if (myOrg && data.organizerId && myOrg.organizerId === data.organizerId) {
              setIsOwnEvent(true);
            } else {
              setIsOwnEvent(false);
            }
          } catch {
            setIsOwnEvent(false);
          }
        } else {
          setIsOwnEvent(false);
        }

        // Fetch related events
        if (data) {
          // More from this organizer
          if (data.organizerId) {
            apiService.getEvents(1, 4, '', '', data.organizerId).then(res => {
              setOrganizerEvents((res.events || []).filter(e => e.eventId !== data.eventId).slice(0, 3));
            });
          }

          // Recommended events (Discovery / Random) - Always show broad discovery content
          apiService.getEvents(1, 50, '', '').then(res => {
            const allEvents = (res.events || []).filter(e => e.eventId !== data.eventId);
            // Shuffle to ensure true randomness
            const shuffled = [...allEvents].sort(() => 0.5 - Math.random());
            setRecommendedEvents(shuffled.slice(0, 12));
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadEvent();
    return () => {
      mounted = false;
    };
  }, [slug, isAuthenticated, role]);

  useEffect(() => {
    if (!slug) return;

    // Refresh event data periodically to capture status changes (e.g. going LIVE)
    const intervalId = window.setInterval(async () => {
      try {
        const updated = await apiService.getEventBySlug(slug);
        if (updated) {
          setEvent(prev => {
            if (!prev) return updated;
            // Preserve local states if needed, but here we just want the latest from server
            return updated;
          });
        }
      } catch {
        // Keep UI stable on transient network errors.
      }
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [slug]);

  useEffect(() => {
    if (!interactionNotice) return;
    const timeoutId = window.setTimeout(() => setInteractionNotice(''), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [interactionNotice]);

  if (loading) return <PageLoader label="Loading event details..." />;
  if (!event) return <div className="p-20 text-center text-[#2E2E2F]/60">Session not found.</div>;

  const updateQuantity = (ticketTypeId: string, change: number, available: number) => {
    setQuantities(prev => ({
      ...prev,
      [ticketTypeId]: Math.max(0, Math.min((Number(prev[ticketTypeId]) || 0) + change, available))
    }));
  };

  const totalQuantity = (Object.values(quantities) as number[]).reduce((acc: number, q: number) => acc + q, 0);
  const grandTotal = event.ticketTypes.reduce((acc: number, t: TicketType) => acc + (t.priceAmount * (Number(quantities[t.ticketTypeId]) || 0)), 0);
  const ctaLabel = totalQuantity === 0 ? 'Select Tickets' : 'Reserve Access';

  // Registration window
  const now = new Date();
  const regOpen = event.regOpenAt ? new Date(event.regOpenAt) : null;
  const regClose = event.regCloseAt ? new Date(event.regCloseAt) : null;
  let regState = '';
  if (regOpen && now < regOpen) {
    regState = `Opens ${formatDate(regOpen.toISOString(), event.timezone, { year: 'numeric', month: 'short', day: 'numeric' })}`;
  } else if (regClose && now > regClose) {
    regState = 'Registration closed';
  } else if (regClose) {
    regState = `Closes ${formatDate(regClose.toISOString(), event.timezone, { year: 'numeric', month: 'short', day: 'numeric' })}`;
  }

  const hasPhysicalLocation = !!event.locationText?.trim() && !event.locationText.startsWith('http');
  const mapEmbedUrl = hasPhysicalLocation
    ? `https://maps.google.com/maps?q=${encodeURIComponent(event.locationText.trim())}&z=15&output=embed`
    : '';
  const openMapUrl = hasPhysicalLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.locationText.trim())}`
    : '';

  const handleRegister = () => {
    if (totalQuantity > 0) {
      const selections = event.ticketTypes.filter(t => (Number(quantities[t.ticketTypeId]) || 0) > 0).map(t => ({
        id: t.ticketTypeId,
        qty: Number(quantities[t.ticketTypeId])
      }));
      const selectionParam = encodeURIComponent(JSON.stringify(selections));
      navigate(`/events/${event.slug}/register?selections=${selectionParam}`);
    }
  };

  const organizer = event.organizer;
  const organizerId = event.organizerId || organizer?.organizerId || '';
  const organizerImage = getImageUrl(organizer?.profileImageUrl);
  const organizerInitial = (organizer?.organizerName || 'O').charAt(0).toUpperCase();
  const organizerDescription = organizer?.eventPageDescription || organizer?.bio || '';
  const organizerWebsite = organizer?.websiteUrl
    ? organizer.websiteUrl
    : '';
  const facebookLink = organizer?.facebookId
    ? `https://facebook.com/${organizer.facebookId.replace(/^@/, '')}`
    : '';
  const twitterLink = organizer?.twitterHandle
    ? `https://x.com/${organizer.twitterHandle.replace(/^@/, '')}`
    : '';
  const liked = isLiked(event.eventId);
  const following = organizerId ? isFollowing(organizerId) : false;
  const organizerRestricted = isAuthenticated && role === UserRole.ORGANIZER && !isAttendingView;

  const goToSignup = () => navigate('/signup');

  const handleLike = async () => {
    if (!isAuthenticated) {
      goToSignup();
      return;
    }
    if (!canLikeFollow) {
      setInteractionNotice('Switch to Attending mode to like events.');
      return;
    }
    try {
      const nextLiked = await toggleLike(event.eventId);
      setEvent((prev) => {
        if (!prev) return prev;
        const currentCount = Number(prev.likesCount || 0);
        return {
          ...prev,
          likesCount: nextLiked ? currentCount + 1 : Math.max(0, currentCount - 1),
        };
      });
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Unable to update like state.';
      setInteractionNotice(message);
    }
  };

  const handleShare = async () => {
    if (!isAuthenticated) {
      goToSignup();
      return;
    }
    const shareUrl = `${window.location.origin}/#/events/${event.slug}`;
    const payload = {
      title: event.eventName,
      text: `Check out this event: ${event.eventName}`,
      url: shareUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setInteractionNotice('Event link copied to clipboard.');
      } else {
        setInteractionNotice('Sharing is not available on this browser.');
      }
    } catch {
      // User cancelled native share.
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) {
      goToSignup();
      return;
    }
    if (!canLikeFollow) {
      setInteractionNotice('Switch to Attending mode to follow organizations.');
      return;
    }
    if (!organizerId) {
      setInteractionNotice('Organization profile is not available yet.');
      return;
    }
    try {
      const { following: nextFollowing, confirmationEmailSent } = await toggleFollowing(organizerId);
      setEvent((prev) => {
        if (!prev?.organizer) return prev;
        const currentCount = Number(prev.organizer.followersCount || 0);
        const nextCount = nextFollowing ? currentCount + 1 : Math.max(0, currentCount - 1);
        return {
          ...prev,
          organizer: {
            ...prev.organizer,
            followersCount: nextCount,
          },
        };
      });
      const msg = nextFollowing
        ? (confirmationEmailSent ? 'Following! Check your email for confirmation.' : 'Following!')
        : 'Removed from followings.';
      setInteractionNotice(msg);
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Unable to update following state.';
      setInteractionNotice(message);
    }
  };

  const likesCount = Number(event.likesCount || 0);
  const likesLabel = liked
    ? (likesCount <= 1
      ? 'You liked this event'
      : `You and ${formatCompactCount(likesCount - 1)} others`)
    : `${formatCompactCount(likesCount)} likes`;

  const brandColor = event.organizer?.brandColor || '#38BDF2';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24 sm:pb-32 lg:py-16 lg:pb-16">
      <div className="mb-8">
        <button
          onClick={() => navigate('/')}
          className="hover:opacity-75 text-[#2E2E2F] text-[11px] font-black tracking-widest uppercase flex items-center mb-10 gap-2 transition-colors"
          style={{ color: brandColor }}
        >
          <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
          BACK TO EVENTS
        </button>

        <div className="flex flex-col lg:flex-row gap-16 items-start">
          <div className="flex-1 space-y-10">
            {/* Event Profile Body */}
            <div>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
                <h1 className="text-4xl lg:text-5xl font-black text-[#2E2E2F] tracking-tighter leading-tight">
                  {event.eventName}
                </h1>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLike}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${liked
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-[#F2F2F2] text-[#2E2E2F] border-[#2E2E2F]/20 hover:bg-black/5'
                      }`}
                    style={!liked ? { color: brandColor } : {}}
                    title={organizerRestricted ? 'Switch to Attending to like events' : 'Like event'}
                  >
                    <ICONS.Heart className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="w-10 h-10 rounded-xl border bg-[#F2F2F2] text-[#2E2E2F] border-[#2E2E2F]/20 flex items-center justify-center hover:bg-black/5 transition-colors"
                    style={{ color: brandColor }}
                    title="Share event"
                  >
                    <ICONS.Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Visual Header */}
              <div className="overflow-hidden rounded-[2.5rem] border border-[#2E2E2F]/10">
                <img
                  src={getImageUrl(event.imageUrl)}
                  alt={event.eventName}
                  className="w-full aspect-video object-cover"
                />
              </div>

              {interactionNotice && (
                <div
                  className="mt-6 rounded-xl border px-3 py-2 text-xs font-semibold text-[#2E2E2F]"
                  style={{ backgroundColor: `${brandColor}15`, borderColor: `${brandColor}30` }}
                >
                  {interactionNotice}
                </div>
              )}

              <div id="event-schedule-info" className="flex flex-wrap gap-4 mt-10 mb-12">
                <div className="flex items-center text-[#2E2E2F]/80 bg-[#F2F2F2] px-4 py-2 rounded-2xl border border-[#2E2E2F]/10 text-[12px]">
                  <ICONS.Calendar className="w-4 h-4 mr-3" style={{ color: brandColor }} />
                  {formatRange(event.startAt, event.endAt, event.timezone)}{event.timezone ? ` TZ: ${event.timezone}` : ''}
                </div>
                <div className="flex items-center text-[#2E2E2F]/80 bg-[#F2F2F2] px-4 py-2 rounded-2xl border border-[#2E2E2F]/10 text-[11px] font-bold">
                  <ICONS.Monitor className="w-3.5 h-3.5 mr-2" style={{ color: brandColor }} />
                  {event.locationType === 'ONLINE' ? 'DIGITAL SESSION' : event.locationType === 'HYBRID' ? 'HYBRID ACCESS' : 'IN-PERSON EVENT'}
                </div>
                {event.streamingPlatform && (event.locationType === 'ONLINE' || event.locationType === 'HYBRID') && (
                  <div
                    className="flex items-center px-4 py-2 rounded-2xl border text-[11px] font-black tracking-wide"
                    style={{ color: brandColor, backgroundColor: `${brandColor}10`, borderColor: `${brandColor}20` }}
                  >
                    VIA {event.streamingPlatform.toUpperCase()}
                  </div>
                )}
                <div className="flex items-center text-[#2E2E2F]/80 bg-[#F2F2F2] px-4 py-2 rounded-2xl border border-[#2E2E2F]/10 text-[11px] font-bold">
                  CAPACITY: {(event.ticketTypes || []).reduce((sum, t) => sum + (t.quantityTotal || 0), 0)}
                </div>
                {regState && (
                  <div className="flex items-center text-[#2E2E2F]/80 bg-[#F2F2F2] px-4 py-2 rounded-2xl border border-[#2E2E2F]/10 text-[11px] font-black uppercase">
                    {regState}
                  </div>
                )}
              </div>

              {/* Event Description */}
              <div className="p-8 bg-[#F2F2F2] rounded-[2rem] border border-[#2E2E2F]/10 mb-10">
                <h3 className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.4em] mb-6">EVENT DETAILS</h3>
                <p className="text-[#2E2E2F]/70 leading-relaxed text-base font-medium whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>

              {/* Organizer Card */}
              <div className="p-8 bg-[#F2F2F2] rounded-[2rem] border border-[#2E2E2F]/10 mb-10">
                <h3 className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.4em] mb-6">ORGANIZED BY</h3>
                <div className="rounded-[1.5rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-5 flex flex-col md:flex-row md:items-center gap-5">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-[#2E2E2F] text-[#F2F2F2] flex items-center justify-center text-xl font-bold shrink-0">
                    {organizer?.profileImageUrl ? (
                      <img src={organizerImage} alt={organizer?.organizerName || 'Organizer'} className="w-full h-full object-cover" />
                    ) : (
                      organizerInitial
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-2xl font-black text-[#2E2E2F] tracking-tight">
                      {organizer?.organizerName || 'Organizer profile coming soon'}
                    </p>
                    <div className="flex flex-wrap items-center gap-6 mt-2 text-[#2E2E2F]/80">
                      <div>
                        <p className="text-[11px] uppercase tracking-widest font-black text-[#2E2E2F]/50">Followers</p>
                        <p className="text-2xl font-black">{organizer?.followersCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-widest font-black text-[#2E2E2F]/50">Events</p>
                        <p className="text-2xl font-black">{organizer?.eventsHostedCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-widest font-black text-[#2E2E2F]/50">Hosting</p>
                        <p className="text-2xl font-black">{organizer ? 'Active' : '--'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {organizerWebsite ? (
                      <a
                        href={organizerWebsite}
                        target="_blank"
                        rel="noreferrer"
                        className="px-8 py-3 rounded-xl border border-[#2E2E2F]/20 text-[#2E2E2F] font-black text-sm hover:bg-[#2E2E2F] hover:text-[#F2F2F2] transition-colors"
                      >
                        Contact
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="px-8 py-3 rounded-xl border border-[#2E2E2F]/20 text-[#2E2E2F]/40 font-black text-sm cursor-not-allowed"
                      >
                        Contact
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleFollow}
                      disabled={!organizerId}
                      className={`px-8 py-3 rounded-xl font-black text-sm transition-colors ${following
                        ? 'bg-[#00E6FF] text-white shadow-[0_0_0_1px_rgba(0,230,255,0.75),0_0_24px_rgba(0,230,255,0.55)]'
                        : organizerId
                          ? 'bg-[#00D4FF] text-white shadow-[0_0_0_1px_rgba(0,212,255,0.65),0_0_18px_rgba(0,212,255,0.4)] hover:bg-[#00E6FF]'
                          : 'bg-[#F2F2F2] text-[#2E2E2F]/40 border border-[#2E2E2F]/20 cursor-not-allowed'
                        }`}
                    >
                      {following ? 'Following' : 'Follow'}
                    </button>
                  </div>
                </div>

                {(organizerDescription || organizerWebsite || facebookLink || twitterLink) && (
                  <div className="mt-5 space-y-3">
                    {organizerDescription && (
                      <p className="text-sm text-[#2E2E2F]/70 leading-relaxed whitespace-pre-wrap">{organizerDescription}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide">
                      {organizerWebsite && (
                        <a href={organizerWebsite} target="_blank" rel="noreferrer" className="hover:opacity-70" style={{ color: brandColor }}>
                          Website
                        </a>
                      )}
                      {facebookLink && (
                        <a href={facebookLink} target="_blank" rel="noreferrer" className="hover:opacity-70" style={{ color: brandColor }}>
                          Facebook
                        </a>
                      )}
                      {twitterLink && (
                        <a href={twitterLink} target="_blank" rel="noreferrer" className="hover:opacity-70" style={{ color: brandColor }}>
                          Twitter
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Live Stream Section */}
                {(() => {
                  const now = new Date();
                  const startAt = event.startAt ? new Date(event.startAt) : null;
                  const endAt = event.endAt ? new Date(event.endAt) : null;
                  const isLiveByTime = startAt && now >= startAt && (!endAt || now <= endAt);
                  const isEventLive = isLiveByTime;
                  return (event.locationType === 'ONLINE' || event.locationType === 'HYBRID' || isEventLive);
                })() && (
                    <div className="mt-8 pt-8 border-t border-[#2E2E2F]/10">
                      <StreamStatusBanner
                        event={event}
                        isOwner={isOwnEvent}
                      />
                    </div>
                  )}
              </div>

              {/* Location Card */}
              {hasPhysicalLocation && (
                <div className="p-8 bg-[#F2F2F2] rounded-[2rem] border border-[#2E2E2F]/10 mb-10">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.4em]">EXACT LOCATION</h3>
                    <a
                      href={openMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-colors"
                      style={{ color: brandColor }}
                    >
                      Open in Maps
                    </a>
                  </div>
                  <p className="text-sm text-[#2E2E2F]/70 font-medium mb-5">{event.locationText}</p>
                  <div className="rounded-2xl overflow-hidden border border-[#2E2E2F]/10 bg-[#F2F2F2]">
                    <iframe
                      src={mapEmbedUrl}
                      title="Event location map"
                      className="w-full h-72"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Secure Access Sidebar */}
          <div className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-24 self-start">
            <Card className="p-8 rounded-[2.5rem] bg-[#F2F2F2] border border-[#2E2E2F]/10 lg:max-h-[calc(100vh-7rem)] lg:flex lg:flex-col">
              {isOwnEvent ? (
                <div className="flex flex-col items-center text-center py-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: `${brandColor}15` }}>
                    <ICONS.Calendar className="w-8 h-8" style={{ color: brandColor }} />
                  </div>
                  <h2 className="text-xl font-black text-[#2E2E2F] mb-2 tracking-tight">
                    This is your event
                  </h2>
                  <p className="text-sm text-[#2E2E2F]/50 font-medium mb-6 leading-relaxed">
                    You can't purchase tickets for your own event. Browse other events to discover sessions from other organizers.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => navigate('/browse-events')}
                    style={{ backgroundColor: brandColor }}
                  >
                    Browse Events
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-black text-[#2E2E2F] mb-8 lg:mb-6 tracking-tight lg:shrink-0">
                    Get Tickets
                  </h2>

                  <div className="space-y-5 mb-10 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2 lg:mb-6">
                    {event.ticketTypes.map(ticket => {
                      const qty = quantities[ticket.ticketTypeId] || 0;
                      const available = ticket.quantityTotal - ticket.quantitySold;
                      const isSoldOut = available <= 0;

                      return (
                        <div
                          key={ticket.ticketTypeId}
                          className="p-6 rounded-[1.75rem] border-2 transition-colors bg-[#F2F2F2] hover:opacity-90"
                          style={{ borderColor: qty > 0 ? brandColor : '#2E2E2F1A' }}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[#2E2E2F] text-[13px] uppercase tracking-wider">{ticket.name}</span>
                            <span
                              className="text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest text-[#F2F2F2]"
                              style={{ backgroundColor: isSoldOut ? '#2E2E2F' : brandColor }}
                            >
                              {isSoldOut ? 'SOLD OUT' : 'AVAILABLE'}
                            </span>
                          </div>
                          <div className="text-xl font-black text-[#2E2E2F] mb-6 tracking-tighter">
                            {ticket.priceAmount === 0 ? 'FREE' : <><span className="">PHP</span> <span className="font-black">{ticket.priceAmount.toLocaleString()}.00</span></>}
                          </div>

                          <div className="pt-6 border-t border-[#2E2E2F]/10 flex items-center justify-between">
                            <span className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em]">QUANTITY</span>
                            <div className="flex items-center gap-5">
                              <button
                                onClick={() => updateQuantity(ticket.ticketTypeId, -1, available)}
                                disabled={qty === 0}
                                className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors disabled:opacity-20 disabled:cursor-not-allowed border border-[#2E2E2F]/10"
                                style={qty > 0 ? { backgroundColor: brandColor, color: '#F2F2F2' } : {}}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M20 12H4" /></svg>
                              </button>
                              <span className="font-black text-lg text-[#2E2E2F] w-4 text-center">{qty}</span>
                              <button
                                onClick={() => updateQuantity(ticket.ticketTypeId, 1, available)}
                                disabled={isSoldOut || qty >= available}
                                className="w-8 h-8 flex items-center justify-center rounded-xl text-[#F2F2F2] transition-colors disabled:opacity-20 disabled:cursor-not-allowed border border-[#2E2E2F]/10"
                                style={!isSoldOut && qty < available ? { backgroundColor: brandColor } : {}}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 4v16m8-8H4" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-6 lg:pt-6 lg:border-t lg:border-[#2E2E2F]/10 lg:shrink-0">
                    <Button
                      className="w-full"
                      disabled={totalQuantity === 0}
                      onClick={handleRegister}
                      style={{ backgroundColor: brandColor }}
                    >
                      {ctaLabel}
                    </Button>
                    <div className="flex items-center justify-center gap-3 opacity-30">
                      <ICONS.CreditCard className="w-4 h-4" />
                      <p className="text-[10px] text-center font-black uppercase tracking-[0.4em] text-[#2E2E2F]">
                        SECURE HITPAY CHECKOUT
                      </p>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>

        {/* Global Related Content Sections - Span Full Width Below Main Content */}
        <div className="mt-32 space-y-24">
          {organizerEvents.length > 0 && (
            <div>
              <h2 className="text-3xl font-black text-[#2E2E2F] tracking-tighter mb-10 flex items-center gap-4">
                More events from this organizer
                <div className="h-px flex-1 bg-[#2E2E2F]/10" />
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-8">
                {organizerEvents.map(e => (
                  <CompactEventRow key={e.eventId} event={e} brandColor={brandColor} />
                ))}
              </div>
            </div>
          )}

          {/* Recommended Events - Always Visible */}
          <div>
            <h2 className="text-3xl font-black text-[#2E2E2F] tracking-tighter mb-10 flex items-center gap-4">
              You might also like...
              <div className="h-px flex-1 bg-[#2E2E2F]/10" />
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-8">
              {recommendedEvents.length > 0 ? (
                recommendedEvents.map(e => (
                  <CompactEventRow key={e.eventId} event={e} brandColor={brandColor} />
                ))
              ) : (
                <div className="col-span-full py-12 text-center bg-[#F2F2F2] rounded-[2rem] border border-dashed border-[#2E2E2F]/20">
                  <p className="text-[#2E2E2F]/40 font-bold uppercase tracking-widest text-[11px]">Searching for more interesting sessions...</p>
                </div>
              )}
            </div>
            {recommendedEvents.length > 0 && (
              <div className="mt-12 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => navigate('/browse-events')}
                  className="rounded-full px-10 border-[#2E2E2F]/10 text-[#2E2E2F] font-black uppercase tracking-widest text-[11px] hover:bg-[#2E2E2F] hover:text-[#F2F2F2]"
                >
                  Explore All Events
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isOwnEvent && (
        <div
          className="fixed inset-x-0 z-[60] px-3 sm:px-4 lg:hidden pointer-events-none"
          style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="pointer-events-auto mx-auto w-full max-w-xl max-h-[calc(100dvh-7.5rem)] overflow-y-auto overscroll-contain rounded-[2rem] border border-[#2E2E2F]/15 bg-[#F2F2F2]/98 backdrop-blur px-6 py-6 shadow-[0_18px_38px_-18px_rgba(46,46,47,0.35)]">
            <p className="text-xl font-black text-[#2E2E2F] tracking-tight">
              Get Tickets
            </p>
            <div className="mt-5 border-t border-[#2E2E2F]/10" />
            <Button
              className="w-full mt-5"
              disabled={totalQuantity === 0}
              onClick={handleRegister}
              style={{ backgroundColor: brandColor }}
            >
              {ctaLabel}
            </Button>
            <div className="mt-4 flex items-center justify-center gap-2 opacity-40">
              <ICONS.CreditCard className="w-4 h-4" />
              <p className="text-[9px] text-center font-black uppercase tracking-[0.3em] text-[#2E2E2F]">
                SECURE HITPAY CHECKOUT
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
