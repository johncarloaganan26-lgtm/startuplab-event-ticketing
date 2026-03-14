import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Event, UserRole, OrganizerProfile } from '../../types';
import { Card, Button, PageLoader } from '../../components/Shared';
import { BrowseEventsNavigator, BrowseTabKey, ONLINE_LOCATION_VALUE } from '../../components/BrowseEventsNavigator';
import { ICONS } from '../../constants';
import { EVENT_CATEGORIES } from '../../utils/eventCategories';
import { useUser } from '../../context/UserContext';
import { useEngagement } from '../../context/EngagementContext';
import { PricingSection } from '../../components/PricingSection';


// Helper to handle JSONB image format
const getImageUrl = (img: any): string => {
  if (!img) return 'https://via.placeholder.com/800x400';
  if (typeof img === 'string') return img;
  return img.url || img.path || img.publicUrl || 'https://via.placeholder.com/800x400';
};

// Date/time formatting with event timezone
const formatDate = (iso: string, timezone?: string, opts?: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone || 'UTC', ...opts }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
};

const formatStartForCard = (startAt: string, timezone?: string) => {
  const d = formatDate(startAt, timezone, { month: 'short', day: 'numeric' });
  const t = formatDate(startAt, timezone, { hour: '2-digit', minute: '2-digit' });
  return `${d} • ${t}`;
};

const LOCATION_STORAGE_KEY = 'browse_events_location';
const DEFAULT_LOCATION = 'Your Location';

const getInitialBrowseLocation = (): string => {
  if (typeof window === 'undefined') return DEFAULT_LOCATION;
  return localStorage.getItem(LOCATION_STORAGE_KEY) || DEFAULT_LOCATION;
};

const getUpcomingWeekendRange = (baseDate: Date) => {
  const day = baseDate.getDay();
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);

  if (day === 0) {
    start.setDate(start.getDate() - 1);
  } else if (day !== 6) {
    start.setDate(start.getDate() + (6 - day));
  }

  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

function formatTime(dateString: string, timezone?: string) {
  const d = new Date(dateString);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    ...(timezone ? { timeZone: timezone } : {})
  }).replace(':00', '');
}

function formatCompactCount(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Math.max(0, Number(value || 0))
  );
}

interface EventCardProps {
  event: Event;
  onActionNotice?: (message: string) => void;
  trendingRank?: number | null;
  organizers?: OrganizerProfile[];
  isLanding?: boolean;
  listing?: string;
}

export const EventCard: React.FC<EventCardProps> = ({ 
  event, 
  onActionNotice, 
  trendingRank = null, 
  organizers = [],
  isLanding = true,
  listing = 'all'
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, role, name, email } = useUser();
  const {
    canLikeFollow,
    isAttendingView,
    isLiked,
    toggleLike,
    isFollowing,
    toggleFollowing
  } = useEngagement();
  const [menuOpen, setMenuOpen] = useState(false);
  const [likeCount, setLikeCount] = useState<number>(Number(event.likesCount || 0));
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  useEffect(() => {
    setLikeCount(Number(event.likesCount || 0));
  }, [event.eventId, event.likesCount]);

  // Safe calculation for minPrice if ticketTypes exist
  const minPrice = event.ticketTypes?.length
    ? Math.min(...event.ticketTypes.map(t => t.priceAmount))
    : 0;

  const organizerId = event.organizerId || event.organizer?.organizerId || '';

  // Lookup correct organizer profile from global list if missing on event object
  const resolvedOrganizer = useMemo(() => {
    return event.organizer || organizers.find(o => o.organizerId === organizerId);
  }, [event.organizer, organizers, organizerId]);

  const organizerName = resolvedOrganizer?.organizerName || 'Organization';
  const pageName = (name || email?.split('@')[0] || 'My Page').trim();
  const liked = isLiked(event.eventId);
  const following = organizerId ? isFollowing(organizerId) : false;
  const organizerRestricted = isAuthenticated && role === UserRole.ORGANIZER && !isAttendingView;

  // Registration window label
  const now = new Date();
  const regOpen = event.regOpenAt ? new Date(event.regOpenAt) : null;
  const regClose = event.regCloseAt ? new Date(event.regCloseAt) : null;
  const regLabel = regOpen && now < regOpen
    ? `Opens ${formatDate(regOpen.toISOString(), event.timezone, { year: 'numeric', month: 'short', day: 'numeric' })}`
    : regClose
      ? `Closes ${formatDate(regClose.toISOString(), event.timezone, { year: 'numeric', month: 'short', day: 'numeric' })}`
      : '';

  const gotoSignup = () => navigate('/signup');

  const handleLike = async (eventClick: React.MouseEvent<HTMLButtonElement>) => {
    eventClick.stopPropagation();
    if (!isAuthenticated) {
      gotoSignup();
      return;
    }
    if (!canLikeFollow) {
      onActionNotice?.('Switch to Attending mode to like events.');
      return;
    }
    try {
      const nextLiked = await toggleLike(event.eventId);
      setLikeCount((prev) => (
        nextLiked ? prev + 1 : Math.max(0, prev - 1)
      ));
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Unable to update like state.';
      onActionNotice?.(message);
    }
  };

  const handleShare = async (eventClick: React.MouseEvent<HTMLButtonElement>) => {
    eventClick.stopPropagation();
    if (!isAuthenticated) {
      gotoSignup();
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
        onActionNotice?.('Event link copied to clipboard.');
      } else {
        onActionNotice?.('Sharing is not available on this browser.');
      }
    } catch {
      // User may cancel native share; keep silent.
    }
  };

  const handleFollow = async (eventClick: React.MouseEvent<HTMLButtonElement>) => {
    eventClick.stopPropagation();
    if (!isAuthenticated) {
      gotoSignup();
      return;
    }
    if (!canLikeFollow) {
      onActionNotice?.('Switch to Attending mode to follow organizations.');
      return;
    }
    if (!organizerId) {
      onActionNotice?.('Organization profile is not available yet.');
      return;
    }
    try {
      const { following: nextFollowing, confirmationEmailSent } = await toggleFollowing(organizerId);
      setMenuOpen(false);
      const msg = nextFollowing
        ? (confirmationEmailSent ? 'Following! Check your email for confirmation.' : 'Following!')
        : 'Removed from followings.';
      onActionNotice?.(msg);
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Unable to update following state.';
      onActionNotice?.(message);
    }
  };

  const likeLabel = liked
    ? (likeCount <= 1
      ? 'You liked this'
      : `You and ${formatCompactCount(likeCount - 1)} others`)
    : `${formatCompactCount(likeCount)} likes`;

  // Brand Color fallback
  const brandColor = event.organizer?.brandColor || '#38BDF2';

  // Completion calculation
  const eventStart = event.startAt ? new Date(event.startAt) : null;
  const eventEnd = event.endAt ? new Date(event.endAt) : (eventStart ? new Date(eventStart.getTime() + 2 * 60 * 60 * 1000) : null);
  const isDone = eventEnd && now > eventEnd;

  // Branding Restriction for Trending Landing Cards
  const isTrendingLanding = isLanding && listing === 'all';
  const effectiveBrandColor = isTrendingLanding ? '#2E2E2F' : brandColor;

  return (
    <Card
      className="group flex flex-col h-full border border-transparent hover:border-[#2E2E2F]/10 rounded-[1.35rem] overflow-hidden bg-[#F2F2F2] transition-all duration-300 cursor-pointer hover:shadow-xl"
      style={{
        borderColor: menuOpen ? `${effectiveBrandColor}40` : undefined,
      }}
      onMouseEnter={(e: any) => e.currentTarget.style.borderColor = `${effectiveBrandColor}60`}
      onMouseLeave={(e: any) => e.currentTarget.style.borderColor = menuOpen ? `${effectiveBrandColor}40` : 'transparent'}
      onClick={() => navigate(`/events/${event.slug}`)}
    >
      {/* Image Section - Increased Height per User Request */}
      <div className="relative h-64 overflow-hidden">
        <img
          src={getImageUrl(event.imageUrl)}
          alt={event.eventName}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {/* Top Left: Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          {trendingRank && (isLanding && listing === 'all') ? (
            <div
              className="rounded-full px-2.5 py-1 bg-[#38BDF2] text-white text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-black/10 transition-transform active:scale-95"
            >
              #{trendingRank} Trending
            </div>
          ) : (event.isPromoted || (event as any).is_promoted) ? (
            <div className="group/promoted relative">
              <div 
                className="flex items-center gap-1.5 px-3 py-1 rounded-full shadow-lg border border-white/20 animate-in fade-in zoom-in duration-500 cursor-help"
                style={{ background: `linear-gradient(135deg, ${effectiveBrandColor}, ${isTrendingLanding ? '#4A4A4A' : effectiveBrandColor + 'CC'})` }}
              >
                <ICONS.Info className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                <span className="text-[9px] font-black uppercase tracking-widest text-white drop-shadow-sm">Promoted</span>
              </div>
              <div className="absolute left-0 top-full mt-2 w-48 p-3 bg-[#2E2E2F] text-white text-[9px] font-bold rounded-xl shadow-2xl opacity-0 translate-y-1 pointer-events-none group-hover/promoted:opacity-100 group-hover/promoted:translate-y-0 transition-all z-50 leading-relaxed">
                The organizer has highlighted this event as part of their elite plan features.
                <div className="absolute bottom-full left-4 border-8 border-transparent border-b-[#2E2E2F]"></div>
              </div>
            </div>
          ) : trendingRank ? (
            <div
              className="rounded-full px-2.5 py-1 bg-[#38BDF2] text-white text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-black/10 transition-transform active:scale-95"
            >
              #{trendingRank} Trending
            </div>
          ) : null}
      </div>
      <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">
        <button
          type="button"
          onClick={handleLike}
          className={`pointer-events-auto w-9 h-9 rounded-xl border backdrop-blur-sm flex items-center justify-center transition-colors ${liked
            ? 'bg-[#38BDF2] text-white border-[#38BDF2]'
            : 'bg-white/90 text-[#2E2E2F] border-[#2E2E2F]/20 hover:bg-[#38BDF2]/20'
            }`}
          title={organizerRestricted ? 'Switch to Attending to like events' : 'Like event'}
        >
          <ICONS.Heart className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleShare}
          className={`pointer-events-auto w-9 h-9 rounded-xl border bg-white/90 text-[#2E2E2F] border-[#2E2E2F]/20 backdrop-blur-sm flex items-center justify-center ${isTrendingLanding ? 'hover:bg-[#2E2E2F]/10' : 'hover:bg-[#38BDF2]/20'} transition-colors`}
          title="Share event"
        >
          <ICONS.Download className="w-4 h-4" />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(eventClick) => {
              eventClick.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className={`w-9 h-9 rounded-xl border bg-white/90 text-[#2E2E2F] border-[#2E2E2F]/20 backdrop-blur-sm flex items-center justify-center ${isTrendingLanding ? 'hover:bg-[#2E2E2F]/10' : 'hover:bg-[#38BDF2]/20'} transition-colors`}
            title="More options"
          >
            <ICONS.MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 mt-2 min-w-[220px] rounded-2xl border border-[#2E2E2F]/10 bg-[#F2F2F2] shadow-xl z-20 overflow-hidden"
              onClick={(eventClick) => eventClick.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-[#2E2E2F]/10">
                <p className="text-[10px] uppercase tracking-widest font-black text-[#2E2E2F]/50">Page</p>
                <p className="text-xs font-semibold text-[#2E2E2F]">{pageName}</p>
              </div>
              <div className="px-4 py-3 border-b border-[#2E2E2F]/10">
                <p className="text-[10px] uppercase tracking-widest font-black text-[#2E2E2F]/50">Organization</p>
                <p className="text-xs font-semibold text-[#2E2E2F]">{organizerName}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  navigate(`/organizer/${organizerId}`);
                }}
                className="w-full text-left px-4 py-3 text-xs font-semibold text-[#2E2E2F] hover:bg-[#38BDF2]/10 transition-colors disabled:text-[#2E2E2F]/40 disabled:cursor-not-allowed"
                disabled={!organizerId}
              >
                View Profile
              </button>
              <button
                type="button"
                onClick={handleFollow}
                className="w-full text-left px-4 py-3 text-xs font-semibold text-[#2E2E2F] hover:bg-[#38BDF2]/10 transition-colors disabled:text-[#2E2E2F]/40 disabled:cursor-not-allowed"
                disabled={!organizerId}
              >
                {following ? 'Following' : 'Follow organization'}
              </button>
              {following && (
                <button
                  type="button"
                  onClick={(eventClick) => {
                    eventClick.stopPropagation();
                    setMenuOpen(false);
                    navigate('/followings');
                  }}
                  className="w-full text-left px-4 py-3 text-xs font-semibold text-[#2E2E2F] hover:bg-[#38BDF2]/10 transition-colors border-t border-[#2E2E2F]/10"
                >
                  Following list
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    {/* Content Section */ }
  <div className="p-5 flex-1 flex flex-col">


    {/* Organizer Profile Summary - Hidden in Trending Landing & All Events page */}
    {isLanding && listing !== 'all' && (
      <div 
        className="flex items-center gap-3 mb-5 p-1 rounded-2xl transition-colors hover:bg-black/5"
        onClick={(e) => {
          e.stopPropagation();
          if (organizerId) navigate(`/organizers/${organizerId}`);
        }}
      >
        <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2E2E2F] border-2 border-white shadow-md shrink-0">
          {resolvedOrganizer?.profileImageUrl ? (
            <img src={getImageUrl(resolvedOrganizer.profileImageUrl)} alt={organizerName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-black text-xs">
              {organizerName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[12px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.15em] truncate">
            {organizerName}
          </span>
        </div>
      </div>
    )}

    <h4 className="text-[#2E2E2F] text-xl font-bold tracking-tight leading-tight mb-3 line-clamp-2">
      {event.eventName}
    </h4>
    <div className="flex items-center gap-2 text-[13px] font-semibold text-[#2E2E2F]/70 mb-3">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center ${liked ? 'bg-[#38BDF2] text-white' : 'bg-[#2E2E2F]/10 text-[#2E2E2F]/65'}`}>
        <ICONS.Heart className="w-3.5 h-3.5" />
      </span>
      <span>{likeLabel}</span>
    </div>
    <div className="flex flex-col gap-1.5 text-[13px] font-medium text-[#2E2E2F]/70 mb-4">
      <div className="flex items-center gap-2">
        <ICONS.Users className="w-4 h-4 text-[#2E2E2F]" />
        <span className="text-[#2E2E2F]">
          {(event as any).registrationCount ?? (event.ticketTypes || []).reduce((sum, t) => sum + (t.quantitySold || 0), 0)} registered / {(event.ticketTypes || []).reduce((sum, t) => sum + (t.quantityTotal || 0), 0)} slots
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ICONS.MapPin className="w-4 h-4" />
        <span className="line-clamp-1">{event.locationText}</span>
      </div>
      <div className="flex items-center gap-2">
        <ICONS.Calendar className="w-4 h-4" />
        <span>{formatDate(event.startAt, event.timezone, { day: 'numeric', month: 'short', year: 'numeric' })} · {formatTime(event.startAt, event.timezone)}</span>
      </div>
    </div>

    {/* Price / Fee section */}
    <div className="mt-auto w-full">
      <div className="h-[1px] w-full bg-[#2E2E2F]/10 invisible group-hover:visible group-hover:opacity-100 transition-all duration-300" />
      {isDone ? (
        <div className="pt-5 flex flex-col items-start">
          <p className="text-[12px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-1">Status</p>
          <p className="text-2xl font-black text-[#2E2E2F]">Event Ended</p>
        </div>
      ) : (
        <div className="pt-5 flex flex-col items-start">
          <p className="text-[12px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-1">Tickets From</p>
          <p className="text-2xl font-black text-[#2E2E2F]">
            {minPrice > 0 
              ? `₱${minPrice.toLocaleString()}` 
              : (event.ticketTypes && event.ticketTypes.length > 0) || (minPrice === 0 && event.ticketTypes?.length) 
                ? 'Free' 
                : 'TBA'}
          </p>
        </div>
      )}
    </div>


  </div>
    </Card >
  );
};

type EventListProps = {
  mode?: 'landing' | 'events';
  listing?: 'all' | 'liked' | 'followings';
};

export const EventList: React.FC<EventListProps> = ({ mode = 'landing', listing = 'all' }) => {
  const isLanding = mode === 'landing';
  const isSpecialListing = listing !== 'all';
  const isLandingAllListing = isLanding && listing === 'all';
  const navigate = useNavigate();
  const location = useLocation();
  const { likedEventIds, followedOrganizerIds } = useEngagement();
  const [events, setEvents] = useState<Event[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 6, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [activeBrowseTab, setActiveBrowseTab] = useState<BrowseTabKey>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>(getInitialBrowseLocation);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [interactionNotice, setInteractionNotice] = useState('');
  const [organizers, setOrganizers] = useState<OrganizerProfile[]>([]);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const initialLoadRef = useRef(true);
  const requestIdRef = useRef(0);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPrice, setSelectedPrice] = useState<'all' | 'free' | 'paid'>('all');
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'online' | 'in-person'>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [showCategoriesFull, setShowCategoriesFull] = useState(false);
  const [sortBy, setSortBy] = useState<string>('relevance');

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Promoted Events state
  const [promotedEvents, setPromotedEvents] = useState<Event[]>([]);
  const [loadingPromoted, setLoadingPromoted] = useState(true);
  const [currentPromotedIndex, setCurrentPromotedIndex] = useState(0);
  const [promotedCarouselInterval, setPromotedCarouselInterval] = useState<NodeJS.Timeout | null>(null);

  const likedSet = useMemo(() => new Set(likedEventIds), [likedEventIds]);
  const followedSet = useMemo(() => new Set(followedOrganizerIds), [followedOrganizerIds]);

  const serverSearchTerm = useMemo(() => {
    const searchParts = [debouncedSearch];
    if (selectedLocation !== 'Your Location' && selectedLocation !== ONLINE_LOCATION_VALUE) {
      searchParts.push(selectedLocation);
    }
    return searchParts.filter(Boolean).join(' ').trim();
  }, [debouncedSearch, selectedLocation]);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 350);
    return () => window.clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.toString()) return;

    const nextSearch = (params.get('search') || '').trim();
    const locationFromQuery = (params.get('location') || '').trim();
    const nextLocation = locationFromQuery || (isLanding ? getInitialBrowseLocation() : DEFAULT_LOCATION);

    setSearchTerm(nextSearch);
    setDebouncedSearch(nextSearch);
    setSelectedLocation(nextLocation);
    setActiveBrowseTab('ALL');
    setCurrentPage(1);
  }, [location.search, isLanding]);

  useEffect(() => {
    const fetchData = async () => {
      const requestId = ++requestIdRef.current;
      const pageSize = isSpecialListing ? 200 : (isLandingAllListing ? 3 : 12);
      const requestedPage = (isSpecialListing || isLandingAllListing) ? 1 : currentPage;
      if (initialLoadRef.current) {
        setLoading(true);
      } else {
        setIsFetching(true);
      }
      try {
        const filters: any = {
          category: selectedCategory,
          price: selectedPrice,
          format: selectedFormat,
          sortBy: isLandingAllListing ? 'trending' : sortBy
        };

        if (selectedDate !== 'all' || activeBrowseTab !== 'ALL') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const dateType = activeBrowseTab !== 'ALL' ? activeBrowseTab.toLowerCase() : selectedDate;

          if (dateType === 'today') {
            filters.startDate = today.toISOString();
            const tonight = new Date(today);
            tonight.setHours(23, 59, 59, 999);
            filters.endDate = tonight.toISOString();
          } else if (dateType === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            filters.startDate = tomorrow.toISOString();
            const tomorrowNight = new Date(tomorrow);
            tomorrowNight.setHours(23, 59, 59, 999);
            filters.endDate = tomorrowNight.toISOString();
          } else if (dateType === 'this_weekend' || dateType === 'weekend') {
            const range = getUpcomingWeekendRange(today);
            filters.startDate = range.start.toISOString();
            filters.endDate = range.end.toISOString();
          }
        }

        const data = await apiService.getEvents(requestedPage, pageSize, serverSearchTerm, '', '', filters);
        if (requestId !== requestIdRef.current) return;
        setEvents(data.events || []);
        if (isSpecialListing) {
          setPagination({
            page: 1,
            limit: pageSize,
            total: (data.events || []).length,
            totalPages: 1,
          });
        } else {
          setPagination(data.pagination || { page: 1, limit: pageSize, total: 0, totalPages: 1 });
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setIsFetching(false);
          initialLoadRef.current = false;
        }
      }
    };
    fetchData();
  }, [currentPage, isSpecialListing, isLandingAllListing, serverSearchTerm, selectedCategory, selectedPrice, selectedFormat, selectedDate, activeBrowseTab, sortBy]);

  useEffect(() => {
    const fetchOrganizers = async () => {
      try {
        const list = await apiService.getOrganizers();
        setOrganizers(list || []);
      } catch (err) {
        console.error('Failed to fetch organizers:', err);
      }
    };
    fetchOrganizers();
  }, []);

  // Load promoted events with real-time polling
  useEffect(() => {
    const loadPromotedEvents = async (silent = false) => {
      if (!silent) setLoadingPromoted(true);
      try {
        const result = await apiService.getPromotedEvents(6);
        setPromotedEvents(result.events || []);
      } catch (err) {
        console.error('Failed to load promoted events:', err);
      } finally {
        if (!silent) setLoadingPromoted(false);
      }
    };

    if (listing === 'all') {
      loadPromotedEvents();
      // Poll every 30 seconds for real-time updates
      const poll = setInterval(() => loadPromotedEvents(true), 30000);
      return () => clearInterval(poll);
    }
  }, [listing]);

  const organizerLogos = useMemo(() => {
    return organizers
      .filter(org => org.profileImageUrl)
      .slice(0, 3)
      .map(org => getImageUrl(org.profileImageUrl));
  }, [organizers]);

  const organizerCount = organizers.length || 0;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedLocation]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeBrowseTab]);

  useEffect(() => {
    if (!interactionNotice) return;
    const timeoutId = window.setTimeout(() => setInteractionNotice(''), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [interactionNotice]);

  // Promoted carousel autoplay effect
  useEffect(() => {
    if (!isLanding || promotedEvents.length === 0) return;

    const interval = setInterval(() => {
      setCurrentPromotedIndex((prev) => (prev + 1) % promotedEvents.length);
    }, 5000);

    setPromotedCarouselInterval(interval);
    return () => clearInterval(interval);
  }, [isLanding, promotedEvents.length]);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedLocation === DEFAULT_LOCATION) {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(LOCATION_STORAGE_KEY, selectedLocation);
  }, [selectedLocation]);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
todayEnd.setHours(23, 59, 59, 999);
    const weekendRange = getUpcomingWeekendRange(now);

    const listingFiltered = events.filter((event) => {
      if (listing === 'liked') {
        return likedSet.has(event.eventId);
      }
      if (listing === 'followings') {
        const organizerId = event.organizerId || event.organizer?.organizerId || '';
        return !!organizerId && followedSet.has(organizerId);
      }
      return true;
    });

    const locationFiltered = listingFiltered.filter((event) => {
      if (selectedLocation === 'Your Location') return true;
      if (selectedLocation === ONLINE_LOCATION_VALUE) {
        return event.locationType === 'ONLINE' || event.locationType === 'HYBRID';
      }
      const locationNeedle = selectedLocation.toLowerCase();
      return (event.locationText || '').toLowerCase().includes(locationNeedle);
    });

    if (activeBrowseTab === 'TODAY') {
      return locationFiltered.filter((event) => {
        const eventStart = new Date(event.startAt);
        return eventStart >= todayStart && eventStart <= todayEnd;
      });
    }

    if (activeBrowseTab === 'THIS_WEEKEND') {
      return locationFiltered.filter((event) => {
        const eventStart = new Date(event.startAt);
        return eventStart >= weekendRange.start && eventStart <= weekendRange.end;
      });
    }

    if (activeBrowseTab === 'FOR_YOU') {
      return locationFiltered
        .filter((event) => {
          const availability = (event.ticketTypes || []).reduce(
            (total, type) => total + Math.max((type.quantityTotal || 0) - (type.quantitySold || 0), 0),
            0
          );
          const registrationCount = Number((event as any).registrationCount || 0);
          const daysUntilEvent = (new Date(event.startAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          const isSoon = daysUntilEvent >= 0 && daysUntilEvent <= 30;

          let score = 0;
          if (availability > 0) score += 1;
          if (registrationCount > 0) score += 1;
          if (isSoon) score += 1;
          if (selectedLocation !== 'Your Location') score += 1;

          return score >= 2;
        })
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    }

    return locationFiltered;
  }, [events, activeBrowseTab, selectedLocation, listing, likedSet, followedSet]);

  const orderedEvents = useMemo(() => {
    const ranked = [...filteredEvents];
    ranked.sort((a, b) => {
      // 1. Prioritize likes
      const likesA = Number(a.likesCount || 0);
      const likesB = Number(b.likesCount || 0);
      if (likesB !== likesA) return likesB - likesA;

      // 2. Fallback to most recently created
      const bTime = new Date(b.created_at || b.startAt || 0).getTime();
      const aTime = new Date(a.created_at || a.startAt || 0).getTime();
      return bTime - aTime;
    });
    return ranked;
  }, [filteredEvents]);

  const trendingRankByEventId = useMemo(() => {
    const map = new Map<string, number>();
    if (listing !== 'all') return map;
    // On landing we always show top 3 ranks even if likes are 0 (as long as they are the top 3 returned)
    // Actually, user wants "trending" so maybe only if > 0 likes? 
    // Usually trending implies > 0. Let's keep it to > 0 to match screenshot.
    if (!isLanding && currentPage !== 1) return map;

    orderedEvents
      .filter((event) => Number(event.likesCount || 0) > 0)
      .slice(0, 3)
      .forEach((event, index) => {
        map.set(event.eventId, index + 1);
      });
    return map;
  }, [listing, orderedEvents, isLanding, currentPage]);

  const displayEvents = useMemo(() => {
    if (isLandingAllListing) {
      // Show top 3 events by popular demand (including promoted if they have likes)
      return orderedEvents.slice(0, 3);
    }

    // For Browse Events (main catalog), always show promoted events first and unfiltered
    if (listing === 'all' && !isLanding) {
      const promoted = (promotedEvents || []).map(e => ({ ...e, isPromoted: true }));
      // Remove these promoted events from the regular list if they appear there to avoid duplicates
      const regular = orderedEvents.filter(e => !promoted.some(p => p.eventId === e.eventId));
      return [...promoted, ...regular];
    }

    return orderedEvents;
  }, [isLandingAllListing, orderedEvents, promotedEvents, listing, isLanding]);

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const showPagination = !isLanding && !isSpecialListing && orderedEvents.length > 0 && totalPages > 1;
  const showViewAllButton = isLandingAllListing && Number(pagination.total || 0) > displayEvents.length;
  const marqueeCategories = useMemo(() => [...EVENT_CATEGORIES, ...EVENT_CATEGORIES], []);
  const sectionTitle = isLandingAllListing
    ? 'Trending Events'
    : listing === 'liked'
      ? 'Liked Events'
      : listing === 'followings'
        ? 'Followed Organizations'
        : 'Available Events';

  const sectionSubtitle = isLandingAllListing
    ? 'The most liked and anticipated sessions happening now.'
    : listing === 'liked'
      ? 'Events you marked with a like.'
      : listing === 'followings'
        ? 'Latest events from organizations you follow.'
        : !isLanding
          ? 'Discover curated sessions highlighted by organizers as part of their elite plan features.'
          : 'Browse and register for upcoming business seminars and workshops.';

  if (loading) return (
    <PageLoader label="Loading events..." />
  );

  return (
    <div className={`max-w-[88rem] mx-auto px-4 sm:px-6 pb-16 ${isLanding ? 'pt-6 sm:pt-10' : 'pt-4 sm:pt-8'}`}>
      {isLanding && (
        <>
          {/* Premium Hero Section */}
          <div className="flex flex-col lg:flex-row items-center lg:items-stretch justify-between gap-8 lg:gap-14 mb-16 lg:mb-20">
            {/* Left Column: Content */}
            <div className="flex-1 min-w-0 flex flex-col items-start justify-center text-left w-full">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E8E8E8] border border-[#2E2E2F]/10 text-[10px] font-bold text-[#2E2E2F] mb-7 shadow-sm">
                  <span role="img" aria-label="megaphone">📢</span>
                  <span className="opacity-80">New: Advanced QR Ticketing & Analytics Launched!</span>
                </div>

                <h1 className="text-[2.5rem] sm:text-5xl lg:text-[64px] font-[900] text-[#0B1A2E] tracking-tight leading-[1.1] mb-8">
                  Smart Events for<br />
                  Growing Philippine<br />
                  Organizers
                </h1>

                <p className="text-[#0B1A2E]/75 text-base sm:text-lg font-medium leading-relaxed max-w-[550px] mb-12">
                  Manage registrations, tickets, attendee check-ins, and performance in one simple, compliance-ready event platform — built for organizers in the Philippines.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <Button
                    onClick={() => navigate('/signup')}
                    className="px-8 py-3.5 bg-[#38BDF2] border-2 border-[#38BDF2] text-white font-bold tracking-wide text-[15px] h-auto rounded-[14px] shadow-[0_4px_20px_rgba(56,189,242,0.2)] hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all flex items-center gap-2 active:scale-95 group"
                  >
                    Get Started
                    <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Button>
                  <Button
                    onClick={() => navigate('/pricing')}
                    className="px-8 py-3.5 !bg-transparent !border-2 !border-solid !border-[#38BDF2] !text-[#38BDF2] font-bold tracking-wide text-[15px] h-auto rounded-[14px] hover:!bg-[#38BDF2] hover:!text-white transition-colors duration-300 flex items-center gap-2 active:scale-95 group"
                  >
                    <ICONS.CreditCard className="w-5 h-5 !text-[#38BDF2] group-hover:!text-white transition-colors duration-300" />
                    Pricing
                  </Button>
                </div>
              </div>

              {/* Stats Block - Tucked tightly under the buttons */}
              <div className="mt-16 w-full grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-6 lg:mt-auto pt-4 border-t border-[#2E2E2F]/5">
                <div className="flex flex-col items-start w-full pr-4">
                  <h4 className="text-[32px] lg:text-[42px] leading-[1.05] font-[900] text-[#0B1A2E] tracking-tighter text-left mb-2">
                    6+ Core<br />Event<br />Modules
                  </h4>
                  <p className="text-[14px] text-[#0B1A2E]/80 font-medium text-left leading-relaxed">
                    Ticketing, Registration,<br />Check-in, Analytics,<br />Seats, Reports
                  </p>
                </div>

                <div className="flex flex-col items-start w-full pr-4">
                  <h4 className="text-[32px] lg:text-[42px] leading-[1.05] font-[900] text-[#0B1A2E] tracking-tighter text-left mb-2">
                    {organizerCount > 3 ? organizerCount : '3'}+ Active<br />Event<br />Organizers
                  </h4>
                  <p className="text-[14px] text-[#0B1A2E]/80 font-medium text-left leading-relaxed">
                    Built with real-world<br />organizer experience
                  </p>
                </div>

                <div className="flex flex-col items-start w-full col-span-2 sm:col-span-1 pr-4">
                  <h4 className="text-[32px] lg:text-[42px] leading-[1.05] font-[900] text-[#0B1A2E] tracking-tighter text-left mb-2">
                    {(pagination?.total || 0) > 8 ? pagination.total : '8'}+ Hosted<br />Event<br />Workflows
                  </h4>
                  <p className="text-[14px] text-[#0B1A2E]/80 font-medium text-left leading-relaxed">
                    From event planning to<br />secure payouts
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Visual */}
            <div className="flex-1 relative w-full mt-10 lg:mt-0">
              <div className="absolute -inset-8 bg-gradient-to-tr from-[#38BDF2]/10 to-transparent blur-3xl opacity-50"></div>
              <div className="relative bg-[#F2F2F2] p-1.5 rounded-[2.2rem] shadow-[0_28px_56px_-16px_rgba(46,46,47,0.15)] overflow-hidden transform lg:rotate-2 hover:rotate-0 transition-transform duration-700">
                <img
                  src="/hero-analytics.png"
                  alt="Event Management Dashboard"
                  className="w-full h-auto rounded-[1.8rem]"
                />
              </div>
              {/* Floating badge */}
              {/* Floating badge: Organizer Tally */}
              <div
                className="absolute -bottom-8 -left-8 bg-[#F2F2F2] p-4 rounded-[1.8rem] border border-[#2E2E2F]/10 shadow-[0_20px_40px_-15px_rgba(46,46,47,0.15)] flex flex-col items-start gap-3 animate-float group/badge cursor-pointer z-40"
                onMouseEnter={() => setShowOrgDropdown(true)}
                onMouseLeave={() => setShowOrgDropdown(false)}
              >
                <div className="flex -space-x-3">
                  {organizerLogos.length > 0 ? (
                    organizerLogos.map((logo, i) => (
                      <div key={i} className="w-9 h-9 rounded-full border-2 border-[#F2F2F2] overflow-hidden shadow-sm ring-1 ring-black/5 bg-white">
                        <img src={logo} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-full border-2 border-[#F2F2F2] bg-[#38BDF2] flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-1 ring-black/5">SL</div>
                      <div className="w-9 h-9 rounded-full border-2 border-[#F2F2F2] bg-[#003E86] flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-1 ring-black/5">EV</div>
                      <div className="w-9 h-9 rounded-full border-2 border-[#F2F2F2] bg-[#3768A2] flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-1 ring-black/5">BC</div>
                    </>
                  )}
                  <div className="w-9 h-9 rounded-full border-2 border-[#F2F2F2] bg-[#E8E8E8] flex items-center justify-center text-[10px] font-black text-[#2E2E2F] shadow-sm ring-1 ring-black/5">
                    +{organizerCount > 3 ? organizerCount - 3 : 3}
                  </div>
                </div>
                <div className="space-y-0.5" onClick={() => navigate('/organizers')}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/40 leading-none">Active Organizers</p>
                  <p className="text-sm font-black text-[#2E2E2F] leading-tight hover:text-[#38BDF2] transition-colors">
                    {organizerCount > 0 ? `${organizerCount}+ Trusted Leaders` : '3+ Trusted Leaders'}
                  </p>
                </div>

                {/* Dropdown list of organizers */}
                <div className={`absolute bottom-[calc(100%-10px)] left-0 w-64 bg-[#F2F2F2] border border-[#2E2E2F]/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] rounded-[2rem] overflow-hidden transition-all duration-300 origin-bottom-left pb-4 ${showOrgDropdown ? 'opacity-100 scale-100 translate-y-[-10px]' : 'opacity-0 scale-95 pointer-events-none translate-y-0'}`}>
                  <div className="p-4 border-b border-[#2E2E2F]/5 bg-[#2E2E2F]/5">
                    <h5 className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em]">Our Partners</h5>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {organizers.map((org) => (
                      <button
                        key={org.organizerId}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/organizer/${org.organizerId}`);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#38BDF2]/10 transition-colors text-left group/item"
                      >
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#2E2E2F]/5 shadow-sm bg-white">
                          {org.profileImageUrl ? (
                            <img src={getImageUrl(org.profileImageUrl)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#2E2E2F] text-white text-[10px] font-black uppercase">
                              {(org.organizerName || 'O').charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-[#2E2E2F] truncate group-hover/item:text-[#38BDF2] transition-colors">
                            {org.organizerName}
                          </p>
                          <p className="text-[9px] font-bold text-[#2E2E2F]/40 uppercase tracking-wider">
                            {org.followersCount || 0} Followers
                          </p>
                        </div>
                        <ICONS.ChevronRight className="w-3.5 h-3.5 text-[#2E2E2F]/20 group-hover/item:text-[#38BDF2] group-hover/item:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                    {organizers.length === 0 && (
                      <p className="p-4 text-center text-xs font-bold text-[#2E2E2F]/40">No organizers yet.</p>
                    )}
                  </div>
                  <div className="p-3 bg-[#F2F2F2] border-t border-[#2E2E2F]/5 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Navigate to a dedicated organizers page if exists, or act as an anchor
                      }}
                      className="text-[9px] font-black text-[#38BDF2] uppercase tracking-[0.1em] hover:text-[#003E86] transition-colors"
                    >
                      Verified Community
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Rail (Top of Available Events) */}
          <div className="mt-4 mb-10 overflow-visible relative z-10">
            <div className="rounded-[1.8rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] px-4 py-6 md:px-7">
              <div className="flex items-center gap-4 mb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/60">Event Smart Categories.</p>
              </div>
              <div className="category-marquee py-2">
                <div className="category-marquee__track flex items-center">
                  {marqueeCategories.map((category, index) => (
                    <button
                      key={`${category.key}-${index}`}
                      type="button"
                      onClick={() => navigate(`/categories/${category.key.toLowerCase()}`)}
                      className="shrink-0 w-[128px] flex flex-col items-center gap-3 text-center group px-2 py-4 hover:z-50 hover:-translate-y-1 transition-transform relative"
                    >
                      <span className="w-[72px] h-[72px] rounded-full border border-transparent flex items-center justify-center text-[#2E2E2F]/70 bg-transparent group-hover:bg-[#38BDF2]/10 group-hover:border-[#38BDF2]/40 group-hover:text-[#2E2E2F] transition-all duration-300 group-hover:scale-125 group-hover:shadow-[0_10px_25px_-5px_rgba(56,189,242,0.4)] group-focus-visible:scale-125 relative z-20">
                        <category.Icon className="w-7 h-7 transition-all duration-300 group-hover:scale-110" />
                      </span>
                      <span className="text-[13px] font-bold text-[#2E2E2F] leading-tight min-h-[32px] flex items-center justify-center pt-2 group-hover:text-[#38BDF2] transition-colors">{category.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Promoted Events Carousel Section */}
          {promotedEvents.length > 0 && (
            <div className="mt-16 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Header Section */}
              <div className="mb-8 text-center flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tighter uppercase leading-none">Promoted Events</h2>
                  <div className="group/info relative">
                    <ICONS.Info className="w-5 h-5 text-black cursor-help" strokeWidth={1.5} />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-64 p-4 bg-[#2E2E2F] text-white text-[11px] font-bold rounded-2xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/info:opacity-100 group-hover/info:translate-y-0 transition-all z-50 leading-relaxed text-center">
                      These events are highlighted because the organizer has subscribed to a premium plan with promotion features.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#2E2E2F]"></div>
                    </div>
                  </div>
                </div>
                <p className="text-[#2E2E2F]/40 text-[11px] font-black uppercase tracking-[0.2em]">
                  Discover curated sessions highlighted by organizers as part of their elite plan features.
                </p>
              </div>

              {!loadingPromoted && promotedEvents.length > 0 ? (
                <div className="relative">
                  {/* Carousel Container */}
                  <div className="rounded-[2.5rem] overflow-hidden border border-[#2E2E2F]/10 bg-white shadow-lg group">
                    <div className="relative h-[300px] sm:h-[400px] overflow-hidden bg-[#F2F2F2] flex">
                      {/* Carousel Images */}
                      {promotedEvents.map((event, idx) => {
                        const imageUrl = getImageUrl(event.imageUrl);
                        return (
                          <div
                            key={event.eventId}
                            className={`absolute inset-0 transition-opacity duration-700 ease-in-out cursor-pointer ${idx === currentPromotedIndex ? 'opacity-100' : 'opacity-0'
                              }`}
                            onClick={() => navigate(`/events/${event.slug || event.eventId}`)}
                          >
                            <img
                              src={getImageUrl(event.imageUrl)}
                              alt={event.eventName}
                              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                            />
                            {/* Overlay - dark on left, lighter on right */}
                            <div className="absolute inset-0 bg-gradient-to-r from-[#2E2E2F]/70 via-[#2E2E2F]/30 to-transparent" />
                          </div>
                        );
                      })}

                      {/* Navigation Arrows - Hidden by default, show on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (promotedCarouselInterval) clearInterval(promotedCarouselInterval);
                          setCurrentPromotedIndex((prev) => (prev - 1 + promotedEvents.length) % promotedEvents.length);
                        }}
                        className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/50 bg-[#2E2E2F]/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[#38BDF2] hover:border-[#38BDF2] transition-all opacity-0 hover:opacity-100 z-10 group-hover:opacity-100"
                      >
                        <ICONS.ChevronLeft className="w-5 h-5" strokeWidth={3} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (promotedCarouselInterval) clearInterval(promotedCarouselInterval);
                          setCurrentPromotedIndex((prev) => (prev + 1) % promotedEvents.length);
                        }}
                        className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/50 bg-[#2E2E2F]/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[#38BDF2] hover:border-[#38BDF2] transition-all opacity-0 hover:opacity-100 z-10 group-hover:opacity-100"
                      >
                        <ICONS.ChevronRight className="w-5 h-5" />
                      </button>

                      <div
                        className="absolute inset-0 flex flex-col justify-between p-4 pb-6 pl-6 sm:pt-6 sm:pr-6 sm:pb-8 sm:pl-10 cursor-pointer"
                        onClick={() => {
                          const event = promotedEvents[currentPromotedIndex];
                          if (event) navigate(`/events/${event.slug || event.eventId}`);
                        }}
                      >
                        {/* Top Left: Organizer Profile */}
                        <div className="flex items-center justify-between w-full">
                          {(() => {
                            const event = promotedEvents[currentPromotedIndex];
                            // Try to get organizer from event object first, then fallback to looking up by ID in the global organizers list
                            const organizer = event?.organizer || organizers.find(o => o.organizerId === event?.organizerId);

                            if (!organizer) return null;

                            return (
                              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-1000">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-white/50 overflow-hidden shadow-xl bg-white/20 backdrop-blur-sm">
                                  {organizer.profileImageUrl ? (
                                    <img src={getImageUrl(organizer.profileImageUrl)} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#2E2E2F] text-white text-[12px] font-black">
                                      {(organizer.organizerName || 'O').charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] leading-none mb-1">Presented by</span>
                                  <span className="text-sm sm:text-base font-black text-white tracking-tight drop-shadow-md">
                                    {organizer.organizerName}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Bottom Left: Event Details */}
                        <div className="flex flex-col gap-6 max-w-md">
                          {/* Event Title */}
                          <div>
                            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight mb-2">
                              {promotedEvents[currentPromotedIndex]?.eventName}
                            </h3>
                          </div>

                          {/* Event Details */}
                          <div className="space-y-2 text-white/95 text-sm sm:text-base">
                            <p className="flex items-center gap-2">
                              <ICONS.Calendar className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                              {formatStartForCard(promotedEvents[currentPromotedIndex]?.startAt || '', promotedEvents[currentPromotedIndex]?.timezone)}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                              <p className="flex items-center gap-2">
                                <ICONS.MapPin className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                                <span>{promotedEvents[currentPromotedIndex]?.locationText || 'Location TBA'}</span>
                              </p>
                              <p className="flex items-center gap-2">
                                <ICONS.Ticket className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                                <span className="font-bold">
                                  {(() => {
                                    const event = promotedEvents[currentPromotedIndex];
                                    const minPrice = (event?.ticketTypes || []).length > 0
                                      ? Math.min(...event!.ticketTypes!.map((t: any) => Number(t.priceAmount || 0)))
                                      : 0;
                                    return minPrice === 0 ? 'Free Entry' : `Starting at ₱${minPrice.toLocaleString()}`;
                                  })()}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* CTA Area Removed per user request - slide is now clickable */}
                          <div className="pt-2 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}

      {!isLanding && (
        <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 h-[260px] sm:h-[300px] lg:h-[350px] overflow-hidden mb-8">
          <div className="absolute inset-0 bg-[linear-gradient(116deg,#38BDF2_0%,#38BDF2_44%,#F2F2F2_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,62,134,0.45)_0%,rgba(0,62,134,0.2)_34%,rgba(0,62,134,0)_72%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_32%,rgba(255,255,255,0.34),transparent_46%),linear-gradient(90deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.06)_26%,rgba(255,255,255,0)_52%)]" />
          <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl items-center px-5 sm:px-8">
            <div className="max-w-[720px]">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 mb-3">Event Marketplace</p>
              <h1 className="text-[2.1rem] font-black leading-none tracking-tight text-white sm:text-5xl">All Events</h1>
              <p className="mt-4 max-w-[680px] text-base leading-relaxed text-white/95 sm:text-[1.05rem]">
                Explore all published events and use the sorting controls to narrow by relevance, timing, and location context.
              </p>
            </div>
          </div>
        </section>
      )}

      {isLanding && !isSpecialListing && (
        <section className="mb-0 px-0 pt-0 pb-4">
          <BrowseEventsNavigator
            activeTab={activeBrowseTab}
            onTabChange={setActiveBrowseTab}
            selectedLocation={selectedLocation}
            onLocationSelect={setSelectedLocation}
            onLocationClear={() => {
              setSearchTerm('');
              setDebouncedSearch('');
              setSelectedLocation(DEFAULT_LOCATION);
              setActiveBrowseTab('ALL');
            }}
            isLoading={isFetching}
            className="mt-0 mb-2 mx-0 sm:mx-0 lg:mx-0"
          />

          {/* Events Listing Section Header */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pt-4 mb-2 pb-0 px-0">
            <div className="flex-1 space-y-2">
              <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tighter uppercase leading-none">{sectionTitle}</h2>
              <p className="text-[#2E2E2F]/40 text-[11px] font-black uppercase tracking-[0.2em]">{sectionSubtitle}</p>
            </div>
          </div>
        </section>
      )}

      <div className={`flex flex-col sm:flex-row items-center justify-between gap-6 px-0 ${isLanding ? 'mb-6 mt-0 !justify-start' : 'mb-8 mt-2'}`}>
        {!isLanding && !isSpecialListing && (
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {/* Hide Sidebar Toggle */}
            <button
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              className="flex items-center gap-2 bg-[#F2F2F2] px-4 py-2.5 rounded-2xl border border-[#2E2E2F]/10 shadow-sm text-[10px] font-black uppercase tracking-widest text-[#2E2E2F] hover:bg-[#38BDF2]/10 hover:border-[#38BDF2]/30 transition-all"
            >
              <ICONS.Filter className="w-4 h-4" />
              {isSidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
            </button>

            {/* Sort By Dropdown */}
            <div className="flex items-center gap-3 bg-[#F2F2F2] px-5 py-2.5 rounded-2xl border border-[#2E2E2F]/10 shadow-sm justify-between sm:justify-start">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/40">Sort By</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#2E2E2F] outline-none cursor-pointer"
              >
                <option value="relevance">Relevance</option>
                <option value="newest">Newest</option>
                <option value="date_soon">Soonest</option>
              </select>
            </div>
          </div>
        )}

        <div className="w-full sm:w-[320px]">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#2E2E2F]/30 group-focus-within:text-[#38BDF2] transition-colors">
              <ICONS.Search className="h-4 w-4" strokeWidth={3} />
            </div>
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-9 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-2xl text-[12px] font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/20 focus:border-[#38BDF2] placeholder:text-[#2E2E2F]/30"
            />
          </div>
        </div>
      </div>

      {interactionNotice && (
        <div className="mb-6 rounded-2xl border border-[#38BDF2]/30 bg-[#38BDF2]/10 px-4 py-3 text-sm font-semibold text-[#2E2E2F]">
          {interactionNotice}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Sidebar Filter - Eventbrite style */}
        {!isLanding && !isSpecialListing && isSidebarVisible && (
          <aside className="w-full lg:w-72 shrink-0 space-y-10 lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-4 lg:custom-scrollbar animate-in fade-in slide-in-from-left-4 duration-700">
            {/* Active Filters Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#2E2E2F]/5">
              <h3 className="text-xl font-black text-[#2E2E2F] tracking-tight">Filters</h3>
              {(selectedCategory !== 'all' || selectedDate !== 'all' || selectedPrice !== 'all' || selectedFormat !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedDate('all');
                    setSelectedPrice('all');
                    setSelectedFormat('all');
                    setSearchTerm('');
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-[#38BDF2] hover:text-[#2E2E2F] transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Category Section */}
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40">Category</h4>
              <div className="space-y-3.5">
                {(showCategoriesFull ? EVENT_CATEGORIES : EVENT_CATEGORIES.slice(0, 6)).map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(selectedCategory === cat.key ? 'all' : cat.key)}
                    className={`flex items-center gap-3.5 w-full text-left group transition-all ${selectedCategory === cat.key ? 'text-[#38BDF2]' : 'text-[#2E2E2F]/70 hover:text-[#38BDF2]'}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${selectedCategory === cat.key ? 'bg-[#38BDF2] text-[#F2F2F2]' : 'bg-[#F2F2F2] border border-[#2E2E2F]/5 group-hover:bg-[#38BDF2]/10'}`}>
                      <cat.Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[13px] font-bold tracking-tight ${selectedCategory === cat.key ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>{cat.label}</span>
                  </button>
                ))}
                <button
                  onClick={() => setShowCategoriesFull(!showCategoriesFull)}
                  className="text-xs font-black text-[#38BDF2] pt-2 hover:underline transition-all flex items-center gap-1"
                >
                  {showCategoriesFull ? 'View less' : 'View more'}
                  <ICONS.ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCategoriesFull ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Date Section */}
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40">Date</h4>
              <div className="space-y-4">
                {[
                  { id: 'all', label: 'Any time' },
                  { id: 'today', label: 'Today' },
                  { id: 'tomorrow', label: 'Tomorrow' },
                  { id: 'weekend', label: 'This weekend' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedDate(opt.id)}
                    className="flex items-center gap-3 w-full group"
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedDate === opt.id ? 'border-[#38BDF2]' : 'border-[#2E2E2F]/10 group-hover:border-[#38BDF2]/40'}`}>
                      {selectedDate === opt.id && <div className="w-2 h-2 bg-[#38BDF2] rounded-full" />}
                    </div>
                    <span className={`text-[13px] font-bold tracking-tight ${selectedDate === opt.id ? 'text-[#2E2E2F]' : 'text-[#2E2E2F]/60 group-hover:text-[#2E2E2F]'}`}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Price Section */}
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40">Price</h4>
              <div className="space-y-4">
                {[
                  { id: 'all', label: 'All Prices' },
                  { id: 'free', label: 'Free' },
                  { id: 'paid', label: 'Paid' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedPrice(opt.id as any)}
                    className="flex items-center gap-3 w-full group"
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedPrice === opt.id ? 'border-[#38BDF2]' : 'border-[#2E2E2F]/10 group-hover:border-[#38BDF2]/40'}`}>
                      {selectedPrice === opt.id && <div className="w-2 h-2 bg-[#38BDF2] rounded-full" />}
                    </div>
                    <span className={`text-[13px] font-bold tracking-tight ${selectedPrice === opt.id ? 'text-[#2E2E2F]' : 'text-[#2E2E2F]/60 group-hover:text-[#2E2E2F]'}`}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Format Section */}
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40">Format</h4>
              <div className="space-y-4">
                {[
                  { id: 'all', label: 'All Formats' },
                  { id: 'online', label: 'Online' },
                  { id: 'in-person', label: 'In-person' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedFormat(opt.id as any)}
                    className="flex items-center gap-3 w-full group"
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedFormat === opt.id ? 'border-[#38BDF2]' : 'border-[#2E2E2F]/10 group-hover:border-[#38BDF2]/40'}`}>
                      {selectedFormat === opt.id && <div className="w-2 h-2 bg-[#38BDF2] rounded-full" />}
                    </div>
                    <span className={`text-[13px] font-bold tracking-tight ${selectedFormat === opt.id ? 'text-[#2E2E2F]' : 'text-[#2E2E2F]/60 group-hover:text-[#2E2E2F]'}`}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0 space-y-10">
          {/* Grid Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7 lg:gap-8 min-h-[400px]">
            {displayEvents.map((event) => (
              <div key={event.eventId} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <EventCard
                  event={event}
                  onActionNotice={setInteractionNotice}
                  trendingRank={trendingRankByEventId.get(event.eventId) ?? null}
                  organizers={organizers}
                  isLanding={isLanding}
                  listing={listing}
                />
              </div>
            ))}
          </div>

          {/* Empty State */}
          {displayEvents.length === 0 && (
            <div className="py-24 px-6 text-center bg-[#F2F2F2] rounded-[2.5rem] border border-[#2E2E2F]/10 animate-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-[#F2F2F2] border border-[#2E2E2F]/5 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <ICONS.Search className="w-8 h-8 text-[#2E2E2F]/20" />
              </div>
              <h3 className="text-2xl font-black text-[#2E2E2F] tracking-tighter mb-4 uppercase">
                {isLandingAllListing
                  ? 'No Trending Events Yet'
                  : listing === 'liked'
                    ? 'No liked events yet'
                    : listing === 'followings'
                      ? 'No events from followed organizations yet'
                      : activeBrowseTab === 'FOR_YOU'
                        ? 'No recommended events yet'
                        : 'No matches found'}
              </h3>
              <p className="text-sm font-bold text-[#2E2E2F]/50 mb-10 max-w-[340px] mx-auto leading-relaxed">
                {isLandingAllListing
                  ? 'Be the first to like a session to see it trending here, or explore our full catalog below.'
                  : listing === 'all'
                    ? 'Try adjusting your filters or search terms to discover more exciting sessions.'
                    : 'Like events or follow organizations to build your personalized feed.'}
              </p>
              {isLandingAllListing ? (
                <Button
                  className="px-8 py-3.5 rounded-2xl bg-[#2E2E2F] text-white font-black uppercase tracking-widest text-[10px] hover:bg-[#38BDF2] transition-colors"
                  onClick={() => navigate('/browse-events')}
                >
                  Discover All Sessions
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="px-8 py-3.5 rounded-2xl border-2 border-[#2E2E2F]/10 text-[#2E2E2F] font-black uppercase tracking-widest text-[10px]"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedLocation(DEFAULT_LOCATION);
                    setActiveBrowseTab('ALL');
                    setSelectedCategory('all');
                    setSelectedDate('all');
                    setSelectedPrice('all');
                    setSelectedFormat('all');
                  }}
                >
                  Reset All Filters
                </Button>
              )}
            </div>
          )}

          {/* View All Button for Landing Page */}
          {isLandingAllListing && displayEvents.length > 0 && (
            <div className="pt-4 flex justify-center">
              <Button
                variant="outline"
                className="px-10 py-4 rounded-2xl border-2 border-[#2E2E2F]/5 text-[#2E2E2F] font-black uppercase tracking-widest text-[11px] hover:bg-[#2E2E2F] hover:text-white transition-all group"
                onClick={() => navigate('/browse-events')}
              >
                <span>Explore Full Catalog</span>
                <ICONS.ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {isLanding && <PricingSection />}
      {isLanding && <FeaturedOrganizers />}
      {isLanding && <FAQSection />}
    </div>
  );
};

const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How can I maximize visibility for my event listing?",
      answer: "Utilize our built-in SEO tools, share your event on social media, and leverage our follower notification system to alert your audience as soon as you publish."
    },
    {
      question: "What's included when I use StartupLab?",
      answer: "StartupLab provides a comprehensive suite of tools including QR-based ticketing, real-time analytics, attendee management, and seamless payment processing via HitPay."
    },
    {
      question: "Is it free to use StartupLab?",
      answer: "We offer a flexible pricing structure including a 14-day free trial on most plans, allowing you to explore all premium features before committing."
    },
    {
      question: "How do I track the performance of my event ticket sales?",
      answer: "Our Advanced Reports module gives you real-time insights into ticket sales, registration trends, and attendee demographics through a clean, intuitive dashboard."
    },
    {
      question: "How to sell more event tickets?",
      answer: "Use our Discount Codes feature to run early-bird promotions and flash sales, and encourage your followers to share event links with their network."
    },
    {
      question: "What strategy should I use when pricing my event tickets?",
      answer: "Consider a tiered pricing strategy (Early Bird, Regular, Last Minute) to drive early registrations and maximize revenue based on demand."
    }
  ];

  return (
    <section className="mt-20 mb-20 animate-in fade-in slide-in-from-bottom-10 duration-1000">
      <div className="text-center mb-16">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#38BDF2] mb-4">FAQs</p>
        <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tighter uppercase leading-none mb-2">
          Frequently Asked Questions
        </h2>
        <p className="text-[#2E2E2F]/40 text-[11px] font-black uppercase tracking-[0.2em]">
          Everything you need to know about StartupLab Event SaaS.
        </p>
      </div>
      <div className="max-w-4xl mx-auto space-y-4">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className={`group rounded-[2rem] overflow-hidden transition-all duration-500 border-2 ${openIndex === index
              ? 'bg-white border-[#38BDF2] shadow-[0_20px_50px_-12px_rgba(56,189,242,0.2)]'
              : 'bg-[#F2F2F2] border-[#2E2E2F]/5 hover:border-[#38BDF2]/30'
              }`}
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-8 py-7 flex items-center justify-between text-left focus:outline-none"
            >
              <span className={`text-lg font-black tracking-tight transition-colors duration-300 ${openIndex === index ? 'text-[#38BDF2]' : 'text-[#2E2E2F]'}`}>
                {faq.question}
              </span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${openIndex === index ? 'bg-[#38BDF2] text-white rotate-180' : 'bg-[#2E2E2F]/5 text-[#2E2E2F]/40 group-hover:bg-[#38BDF2]/10 group-hover:text-[#38BDF2]'
                }`}>
                <ICONS.ChevronDown className="w-6 h-6" strokeWidth={3} />
              </div>
            </button>
            <div
              className={`px-8 overflow-hidden transition-all duration-500 ease-in-out ${openIndex === index ? 'max-h-[500px] pb-8 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
              <div className="pt-2 border-t border-[#2E2E2F]/5 mt-2">
                <p className="text-[#2E2E2F]/60 text-base font-medium leading-relaxed mt-4">
                  {faq.answer}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const FeaturedOrganizers: React.FC = () => {
  const [organizers, setOrganizers] = useState<OrganizerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { followedOrganizerIds, toggleFollowing, canLikeFollow } = useEngagement();
  const { isAuthenticated } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const data = await apiService.getOrganizers();
        setOrganizers(data);
      } catch (error) {
        console.error('Failed to fetch organizers:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  if (loading || organizers.length === 0) return null;

  return (
    <section className="mt-20 mb-20 rounded-[1.8rem] bg-[#F2F2F2] px-4 sm:px-6 lg:px-10 py-12 border border-[#2E2E2F]/5">
      <div className="flex flex-col mb-10">
        <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tighter uppercase leading-none mb-2">Featured Organisers</h2>
        <p className="text-[#2E2E2F]/40 text-[11px] font-black uppercase tracking-[0.2em]">Follow the organisers from these events and get notified when they create new ones.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {organizers.map((org) => {
          const isFollowing = (followedOrganizerIds || []).includes(org.organizerId);
          return (
            <div
              key={org.organizerId}
              className="bg-[#F2F2F2] rounded-[2.5rem] p-8 border border-[#2E2E2F]/5 shadow-sm hover:shadow-2xl hover:shadow-[#38BDF2]/10 transition-all duration-300 group flex flex-col items-center text-center cursor-pointer"
              onClick={() => navigate(`/organizer/${org.organizerId}`)}
            >
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md group-hover:border-[#38BDF2]/40 transition-all duration-300">
                  <img
                    src={getImageUrl(org.profileImageUrl)}
                    alt={org.organizerName}
                    className="w-full h-full object-cover transition-all duration-300"
                  />
                </div>
              </div>

              <h3 className="text-lg font-black text-[#2E2E2F] mb-1 line-clamp-1 group-hover:text-[#38BDF2] transition-colors">{org.organizerName}</h3>
              <p className="text-[#2E2E2F]/50 text-xs font-bold uppercase tracking-widest mb-8">{org.followersCount || 0} followers</p>

              <Button
                variant={isFollowing ? 'outline' : 'primary'}
                className={`w-full rounded-2xl py-3.5 font-black text-[11px] uppercase tracking-[0.2em] transition-all duration-300 ${isFollowing
                  ? 'bg-[#38BDF2] border-2 border-[#38BDF2] text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F]'
                  : 'bg-[#38BDF2] border-2 border-[#38BDF2] text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F] shadow-lg shadow-[#38BDF2]/10 hover:shadow-xl active:scale-95'
                  }`}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!isAuthenticated) {
                    navigate('/signup');
                    return;
                  }
                  if (!canLikeFollow) return;
                  await toggleFollowing(org.organizerId);
                }}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
