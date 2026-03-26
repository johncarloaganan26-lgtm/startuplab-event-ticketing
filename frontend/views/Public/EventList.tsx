import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Event, UserRole, OrganizerProfile } from '../../types';
import { Card, Button, PageLoader } from '../../components/Shared';
import { OrganizerCard } from '../../components/OrganizerCard';
import { BrowseEventsNavigator, BrowseTabKey, ONLINE_LOCATION_VALUE } from '../../components/BrowseEventsNavigator';
import { ICONS } from '../../constants';
import { EVENT_CATEGORIES } from '../../utils/eventCategories';
import { useUser } from '../../context/UserContext';
import { useEngagement } from '../../context/EngagementContext';
import { PricingSection } from '../../components/PricingSection';


const BRAND_LOGO_URL = 'https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg';

// Helper to handle JSONB image format
const getImageUrl = (img: any): string => {
  if (!img) return BRAND_LOGO_URL;
  if (typeof img === 'string') return img;
  return img.url || img.path || img.publicUrl || BRAND_LOGO_URL;
};

const generateDefaultAvatarDataUri = (initials: string, bgColor: string = '#38BDF2'): string => {
  const safeInitials = (initials || 'SL').slice(0, 2).toUpperCase();
  const svg = `
    <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="18" fill="${bgColor}"/>
      <text x="18" y="21" font-size="12" font-weight="900" font-family="Helvetica, Arial, sans-serif" fill="white" text-anchor="middle">${safeInitials}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
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


const AttendeeFacepile: React.FC<{ count: number; realAvatars?: string[]; size?: string; className?: string }> = ({
  count,
  realAvatars = [],
  size = 'w-7 h-7',
  className = ''
}) => {
  if (count <= 0) return null;

  const maxToDisplay = Math.min(count, 4);
  let displayAvatars = [...realAvatars];

  // If we have less real avatars than the count (e.g. mocked tickets with no attendee rows), pad with fallback initials so the UI looks complete
  if (displayAvatars.length < maxToDisplay) {
    const mockNames = ['John', 'Alice', 'Mark', 'Sarah', 'James', 'Emily', 'Chris', 'Luna'];
    for (let i = displayAvatars.length; i < maxToDisplay; i++) {
        const seed = mockNames[(count + i) % mockNames.length];
        displayAvatars.push(`https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=38BDF2&textColor=ffffff`);
    }
  }

  // Ensure we never display more than 4 individual faces
  displayAvatars = displayAvatars.slice(0, 4);

  return (
    <div className={`flex -space-x-3 items-center ${className}`}>
      {displayAvatars.map((src, i) => (
        <div key={i} className={`${size} rounded-full border-[2.5px] border-white overflow-hidden shadow-sm bg-[#F2F2F2] transition-transform hover:scale-110 hover:z-40 relative`} style={{ zIndex: 30 - i }}>
          <img src={src} className="w-full h-full object-cover" alt="" loading="lazy" />
        </div>
      ))}
      {count > displayAvatars.length && (
        <div className={`${size} rounded-full border-[2.5px] border-white bg-[#F2F2F2] flex items-center justify-center text-[10px] font-black text-[#2E2E2F] shadow-sm z-10 relative`}>
          +{count - displayAvatars.length}
        </div>
      )}
    </div>
  );
};

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
  const { isAuthenticated, role } = useUser();
  const {
    canLikeFollow,
    isAttendingView,
    isLiked,
    toggleLike
  } = useEngagement();
  const [likeCount, setLikeCount] = useState<number>(Number(event.likesCount || 0));

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
  const liked = isLiked(event.eventId);
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

  const likeLabel = liked
    ? (likeCount <= 1
      ? 'You liked this'
      : `You and ${formatCompactCount(likeCount - 1)} others`)
    : `${formatCompactCount(likeCount)} likes`;

  // Completion calculation
  const eventStart = event.startAt ? new Date(event.startAt) : null;
  const eventEnd = event.endAt ? new Date(event.endAt) : (eventStart ? new Date(eventStart.getTime() + 2 * 60 * 60 * 1000) : null);
  const isDone = eventEnd && now > eventEnd;

  // Branding Restriction for Trending Landing Cards
  const isTrendingLanding = isLanding && listing === 'all';
  return (
    <Card
      className={`group flex flex-col h-full border rounded-3xl overflow-hidden bg-[#F2F2F2] transition-all duration-500 cursor-pointer 
        ${(event.isPromoted || (event as any).is_promoted)
          ? 'border-[#38BDF2]/40 shadow-[0_20px_50px_rgba(56,189,242,0.12)] scale-[1.01] ring-1 ring-[#38BDF2]/20'
          : 'border-[#2E2E2F]/10 hover:border-[#38BDF2]/30 shadow-sm'} 
        hover:shadow-2xl hover:scale-[1.02]`}
      onClick={() => navigate(`/events/${event.slug || event.eventId}`)}
    >
      {/* Image Section - Keep phone-like proportions through tablet widths */}
      <div className="relative h-40 sm:h-48 lg:h-64 overflow-hidden">
        {event.imageUrl ? (
          <img
            src={getImageUrl(event.imageUrl)}
            alt={event.eventName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#38BDF2] to-[#2E2E2F]">
            <img
              src={BRAND_LOGO_URL}
              alt="StartupLab"
              className="w-24 h-24 object-contain opacity-40 brightness-0 invert drop-shadow-2xl"
            />
          </div>
        )}
        {/* Top Left: Badges */}
        <div className="absolute top-6 left-6 sm:left-7 z-10">
          {trendingRank && (isLanding && listing === 'all') ? (
            <div
              className="inline-flex items-center rounded-full px-3.5 py-1.5 bg-[#38BDF2] text-white text-[10px] font-bold uppercase tracking-[0.15em] shadow-lg shadow-black/10 transition-transform active:scale-95"
            >
              #{trendingRank} Trending
            </div>
          ) : (event.isPromoted || (event as any).is_promoted) ? (
            <div className="group/promoted relative">
                <div 
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-[#38BDF2] animate-in fade-in zoom-in duration-700 cursor-help shadow-lg shadow-[#38BDF2]/20"
                >
                  <ICONS.Info className="w-3.5 h-3.5 text-white" strokeWidth={5} />
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white">
                    Promoted
                  </span>
                </div>
              <div className="absolute left-0 top-full mt-4 w-72 p-6 bg-[#2E2E2F] text-white text-[11px] font-bold rounded-3xl shadow-2xl opacity-0 translate-y-3 pointer-events-none group-hover/promoted:opacity-100 group-hover/promoted:translate-y-0 transition-all z-50 leading-relaxed ring-1 ring-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-3 text-[#38BDF2]">
                  <ICONS.Zap className="w-5 h-5" />
                  <span className="uppercase tracking-[0.3em] font-black text-[10px]">Platform Highlight</span>
                </div>
                This event is highlighted by the organizer as a premium featured session on StartupLab for max visibility and engagement.
                <div className="absolute bottom-full left-6 border-8 border-transparent border-b-[#2E2E2F]"></div>
              </div>
            </div>
          ) : trendingRank ? (
            <div
              className="inline-flex items-center rounded-full px-3.5 py-1.5 bg-[#38BDF2] text-white text-[10px] font-bold uppercase tracking-[0.15em] shadow-lg shadow-black/10 transition-transform active:scale-95"
            >
              #{trendingRank} Trending
            </div>
          ) : null}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity pointer-events-none">
          <button
            type="button"
            onClick={handleLike}
            className={`pointer-events-auto w-10 h-10 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-sm flex items-center justify-center transition-colors active:scale-95 ${liked
              ? 'bg-[#38BDF2] text-white border-[#38BDF2]'
              : 'bg-white/90 text-[#2E2E2F] border-[#2E2E2F]/20 hover:bg-[#38BDF2]/20'
              }`}
            title={organizerRestricted ? 'Switch to Attending to like events' : 'Like event'}
            aria-label={liked ? 'Unlike event' : 'Like event'}
          >
            <ICONS.Heart className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className={`pointer-events-auto w-10 h-10 sm:w-9 sm:h-9 rounded-xl border bg-white/90 text-[#2E2E2F] border-[#2E2E2F]/20 backdrop-blur-sm flex items-center justify-center ${isTrendingLanding ? 'hover:bg-[#2E2E2F]/10' : 'hover:bg-[#38BDF2]/20'} transition-colors active:scale-95`}
            title="Share event"
            aria-label="Share event"
          >
            <ICONS.Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Content Section */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">


        {/* Organizer Profile Summary */}
        <div
          className="flex items-center gap-3 mb-5 p-2 rounded-xl transition-colors hover:bg-black/5 -ml-2"
          onClick={(e) => {
            e.stopPropagation();
            if (organizerId) navigate(`/organizer/${organizerId}`);
          }}
        >
            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 flex items-center justify-center border-2 border-white shadow-sm bg-gradient-to-br from-[#38BDF2] to-[#A5E1FF]">
              {resolvedOrganizer?.profileImageUrl ? (
                <img src={getImageUrl(resolvedOrganizer.profileImageUrl)} alt={organizerName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-black text-[10px] drop-shadow-sm">
                  {organizerName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-[11px] font-semibold text-[#2E2E2F]/60 truncate">
              {organizerName}
            </span>
          </div>

        <h4 className="text-[#2E2E2F] text-xl sm:text-2xl font-bold tracking-tighter leading-tight mb-3 line-clamp-2">
          {event.eventName}
        </h4>
        <div className={`flex items-center gap-3 text-[12px] sm:text-[13px] font-semibold mb-3 ${event.isPromoted || (event as any).is_promoted ? 'bg-[#38BDF2]/5 px-3 py-1.5 rounded-xl border border-[#38BDF2]/10 w-fit' : ''}`}>
          <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center transition-all ${liked ? 'bg-[#38BDF2] text-white shadow-lg shadow-[#38BDF2]/30' : 'bg-[#2E2E2F]/10 text-[#2E2E2F]/65 group-hover:bg-[#38BDF2]/20 group-hover:text-[#38BDF2]'}`}>
            <ICONS.Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
          </span>
          <span className={`${event.isPromoted || (event as any).is_promoted ? 'text-[#2E2E2F] font-black' : 'text-[#2E2E2F]/70'}`}>{likeLabel}</span>
        </div>
        <div className="flex flex-col gap-2.5 text-[12px] sm:text-[13px] font-medium text-[#2E2E2F]/70 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-6 shrink-0 flex items-center justify-center text-[#2E2E2F]/40">
              <ICONS.Users className="w-4 h-4" />
            </div>
            <span className="text-[#38BDF2] font-bold">
              {(event as any).registrationCount ?? (event.ticketTypes || []).reduce((sum, t) => sum + (t.quantitySold || 0), 0)} registered / {(event.ticketTypes || []).reduce((sum, t) => sum + (t.quantityTotal || 0), 0)} slots
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 shrink-0 flex items-center justify-center text-[#2E2E2F]/40">
              <ICONS.MapPin className="w-4 h-4" />
            </div>
            <span className="line-clamp-1">{event.locationText}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 shrink-0 flex items-center justify-center text-[#2E2E2F]/40">
              <ICONS.Calendar className="w-4 h-4" />
            </div>
            <span>{formatDate(event.startAt, event.timezone, { day: 'numeric', month: 'short', year: 'numeric' })} · {formatTime(event.startAt, event.timezone)}</span>
          </div>
        </div>

        {/* Price / Fee section */}
        <div className="mt-auto w-full">
          <div className="h-[1px] w-full bg-[#2E2E2F]/10 invisible group-hover:visible group-hover:opacity-100 transition-all duration-300" />
          {isDone ? (
            <div className="pt-5 flex flex-col items-start">
              <p className="text-[10px] sm:text-[12px] font-bold text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-1">Status</p>
              <p className="text-lg sm:text-xl font-bold text-[#2E2E2F]">Event Ended</p>
            </div>
          ) : (
            <div className="pt-5 flex flex-col items-start">
              <p className="text-[10px] sm:text-[12px] font-bold text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-1">Tickets From</p>
              <p className="text-lg sm:text-xl font-bold text-[#2E2E2F]">
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
  const { role, isAuthenticated, isOnboarded, openAuthModal } = useUser();
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
  const [isMarqueePaused, setIsMarqueePaused] = useState(false);

  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLanding) return;
    let animationFrameId: number;
    const step = () => {
      if (categoriesScrollRef.current && !isMarqueePaused) {
        const el = categoriesScrollRef.current;
        if (el.scrollLeft >= (el.scrollWidth / 2)) {
          el.scrollLeft = 0;
        } else {
          el.scrollLeft += 0.5;
        }
      }
      animationFrameId = requestAnimationFrame(step);
    };
    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isLanding, isMarqueePaused]);

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

  const organizerBadgeItems = useMemo(() => {
    if (organizers.length === 0) {
      return [
        { key: 'fallback-sl', src: generateDefaultAvatarDataUri('SL'), alt: 'StartupLab' },
        { key: 'fallback-ev', src: generateDefaultAvatarDataUri('EV'), alt: 'Events' },
        { key: 'fallback-bc', src: generateDefaultAvatarDataUri('BC'), alt: 'Business Center' },
      ];
    }

    return organizers.slice(0, 3).map((org, index) => {
      const initials = (org.organizerName || `O${index + 1}`)
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      return {
        key: org.organizerId || `${org.organizerName || 'organizer'}-${index}`,
        src: org.profileImageUrl ? getImageUrl(org.profileImageUrl) : generateDefaultAvatarDataUri(initials),
        alt: org.organizerName || 'Organizer',
      };
    });
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
    <div className={`max-w-[88rem] mx-auto px-4 sm:px-10 pb-16 ${isLanding ? 'pt-6 sm:pt-12' : 'pt-0'}`}>
      {isLanding && (
        <>
          {/* Premium Hero Section */}
          <div className="flex flex-col lg:flex-row items-center lg:items-stretch justify-between gap-8 lg:gap-14 mb-20 lg:mb-24">
            {/* Left Column: Content */}
            <div className="flex-1 min-w-0 flex flex-col items-start justify-center text-left w-full">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E8E8E8] border border-[#2E2E2F]/10 text-[10px] font-bold text-[#2E2E2F] mb-7 shadow-sm">
                  <span role="img" aria-label="megaphone">📢</span>
                  <span className="opacity-80">New: Advanced QR Ticketing & Analytics Launched!</span>
                </div>

                <h1 className="text-[2.5rem] sm:text-5xl lg:text-[60px] font-bold text-[#0B1A2E] tracking-tight leading-[1.1] mb-[5px]">
                  Smart Events for<br />
                  Growing Philippine<br />
                  Organizers
                </h1>

                <p className="text-sm sm:text-base lg:text-lg font-normal text-[#0B1A2E]/75 leading-relaxed max-w-[550px] mb-8">
                  Manage registrations, tickets, attendee check-ins, and performance in one simple, compliance-ready event platform — built for organizers in the Philippines.
                </p>

                <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
                  {isAuthenticated && role === UserRole.ORGANIZER && !isOnboarded ? (
                    <Button
                      onClick={() => navigate('/onboarding')}
                      className="w-full sm:w-auto px-8 bg-[#38BDF2] border-2 border-[#38BDF2] text-white font-bold tracking-wide text-[15px] h-[52px] rounded-xl shadow-[0_4px_20px_rgba(56,189,242,0.2)] hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all flex items-center justify-center gap-2 active:scale-95 group"
                    >
                      Complete Setup
                      <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        if (isAuthenticated) {
                          navigate(role === UserRole.ORGANIZER ? '/user-home' : '/browse-events');
                        } else {
                          openAuthModal('signup');
                        }
                      }}
                      className="w-full sm:w-auto px-8 bg-[#38BDF2] border-2 border-[#38BDF2] text-white font-bold tracking-wide text-[15px] h-[52px] rounded-xl shadow-[0_4px_20px_rgba(56,189,242,0.2)] hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all flex items-center justify-center gap-2 active:scale-95 group"
                    >
                      {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
                      <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      const pricingSection = document.getElementById('pricing');
                      if (pricingSection) {
                        pricingSection.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        navigate('/pricing');
                      }
                    }}
                    className="w-full sm:w-auto px-8 !bg-transparent !border-2 !border-solid !border-[#38BDF2] !text-[#38BDF2] font-bold tracking-wide text-[15px] h-[52px] rounded-xl hover:!bg-[#38BDF2] hover:!text-white transition-colors duration-300 flex items-center justify-center gap-2 active:scale-95 group"
                  >
                    <ICONS.CreditCard className="w-5 h-5 !text-[#38BDF2] group-hover:!text-white transition-colors duration-300" />
                    Pricing
                  </Button>
                </div>
              </div>

              {/* Stats Block - Tucked tightly under the buttons */}
              <div className="mt-10 sm:mt-12 w-full grid grid-cols-2 sm:grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-8 sm:gap-y-12">
                <div className="flex flex-col items-start w-full">
                  <h4 className="text-lg sm:text-2xl md:text-[32px] lg:text-[42px] leading-[1.3] font-semibold text-[#0B1A2E] tracking-tighter text-left mb-2 sm:mb-3">
                    6+ Core<br />Event<br />Modules
                  </h4>
                  <p className="text-[11px] sm:text-[14px] text-[#0B1A2E]/80 font-normal text-left leading-relaxed">
                    Ticketing, Registration,<br />Check-in, Analytics,<br />Seats, Reports
                  </p>
                </div>

                <div className="flex flex-col items-start w-full">
                  <h4 className="text-lg sm:text-2xl md:text-[32px] lg:text-[42px] leading-[1.3] font-semibold text-[#0B1A2E] tracking-tighter text-left mb-2 sm:mb-3">
                    {organizerCount > 3 ? organizerCount : '3'}+ Active<br />Event<br />Organizers
                  </h4>
                  <p className="text-[11px] sm:text-[14px] text-[#0B1A2E]/80 font-normal text-left leading-relaxed">
                    Built with real-world<br />organizer experience
                  </p>
                </div>

                <div className="flex flex-col items-start w-full col-span-2 sm:col-span-1">
                  <h4 className="text-lg sm:text-2xl md:text-[32px] lg:text-[42px] leading-[1.3] font-semibold text-[#0B1A2E] tracking-tighter text-left mb-2 sm:mb-3">
                    {(pagination?.total || 0) > 8 ? pagination.total : '8'}+ Hosted<br />Event<br />Workflows
                  </h4>
                  <p className="text-[11px] sm:text-[14px] text-[#0B1A2E]/80 font-normal text-left leading-relaxed">
                    From event planning to<br />secure payouts
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Visual */}
            <div className="flex-1 relative w-full mt-10 lg:mt-0">
              <div className="absolute -inset-8 bg-gradient-to-tr from-[#38BDF2]/10 to-transparent blur-3xl opacity-50"></div>
              <div className="relative bg-[#F2F2F2] p-1.5 rounded-xl shadow-[0_28px_56px_-16px_rgba(46,46,47,0.15)] overflow-hidden transform lg:rotate-2 hover:rotate-0 transition-transform duration-700">
                <img
                  src="/hero-analytics.png"
                  alt="Event Management Dashboard"
                  className="w-full h-auto rounded-xl"
                />
              </div>
              {/* Floating badge */}
              {/* Floating badge: Organizer Tally */}
              <div
                className="absolute -bottom-6 sm:-bottom-8 -left-4 sm:-left-8 bg-[#F2F2F2] p-3 sm:p-4 rounded-xl border border-[#2E2E2F]/10 shadow-[0_20px_40px_-15px_rgba(46,46,47,0.15)] flex flex-col items-start gap-3 animate-float group/badge cursor-pointer z-40"
                onMouseEnter={() => setShowOrgDropdown(true)}
                onMouseLeave={() => setShowOrgDropdown(false)}
              >
                <div className="flex -space-x-3">
                  {organizerBadgeItems.map((organizer) => (
                    <div key={organizer.key} className="w-9 h-9 rounded-full border-2 border-[#F2F2F2] overflow-hidden shadow-sm ring-1 ring-black/5 bg-[#38BDF2]/10">
                      <img src={organizer.src} alt={organizer.alt} className="w-full h-full object-cover" />
                    </div>
                  ))}
                  <div className="w-9 h-9 rounded-full border-2 border-[#F2F2F2] bg-[#E8E8E8] flex items-center justify-center text-[10px] font-black text-[#2E2E2F] shadow-sm ring-1 ring-black/5">
                    +{organizerCount > 3 ? organizerCount - 3 : 3}
                  </div>
                </div>
                <div className="space-y-0.5" onClick={() => navigate('/organizers/discover')}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/40 leading-none">Active Organizers</p>
                  <p className="text-sm font-black text-[#2E2E2F] leading-tight hover:text-[#38BDF2] transition-colors">
                    {organizerCount > 0 ? `${organizerCount}+ Trusted Leaders` : '6+ Trusted Leaders'}
                  </p>
                </div>

                {/* Dropdown list of organizers */}
                <div className={`absolute bottom-[calc(100%-10px)] left-0 w-64 bg-[#F2F2F2] border border-[#2E2E2F]/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] rounded-xl overflow-hidden transition-all duration-300 origin-bottom-left pb-3 ${showOrgDropdown ? 'opacity-100 scale-100 translate-y-[-10px]' : 'opacity-0 scale-95 pointer-events-none translate-y-0'}`}>
                  <div className="p-5 border-b border-[#2E2E2F]/5 bg-[#2E2E2F]/[0.02]">
                    <h5 className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.25em]">Our Partners</h5>
                  </div>
                  <div className="max-h-[238px] overflow-y-auto custom-scrollbar p-2.5 space-y-1">
                    {organizers.map((org) => (
                      <button
                        key={org.organizerId}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/organizer/${org.organizerId}`);
                        }}
                        className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-300 text-left group/item border border-transparent hover:border-[#2E2E2F]/5"
                      >
                        <div className="w-9 h-9 rounded-xl overflow-hidden border-2 border-white shadow-sm bg-gradient-to-br from-[#38BDF2] to-[#A5E1FF] flex items-center justify-center shrink-0">
                          {org.profileImageUrl ? (
                            <img src={getImageUrl(org.profileImageUrl)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-[11px] font-black uppercase drop-shadow-sm">
                              {(org.organizerName || 'O').charAt(0)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-[#2E2E2F] truncate group-hover/item:text-[#38BDF2] transition-colors tracking-tight">
                            {org.organizerName}
                          </p>
                          <p className="text-[9px] font-bold text-[#2E2E2F]/30 uppercase tracking-[0.1em]">
                            {org.followersCount || 0} Followers
                          </p>
                        </div>
                        <ICONS.ChevronRight className="w-3.5 h-3.5 text-[#2E2E2F]/20 group-hover/item:text-[#38BDF2] group-hover/item:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                    {organizers.length === 0 && (
                      <div className="p-8 text-center bg-[#2E2E2F]/[0.02] rounded-xl mx-1">
                        <p className="text-[10px] font-black text-[#2E2E2F]/20 uppercase tracking-[0.1em]">No verified partners yet.</p>
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3 bg-[#F2F2F2] border-t border-[#2E2E2F]/5 text-center">
                    <div className="flex items-center justify-center gap-2 text-[9px] font-black text-[#38BDF2] uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity cursor-default">
                      <div className="w-1 h-1 rounded-full bg-[#38BDF2] animate-pulse" />
                      Verified Community
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Rail (Top of Available Events) */}
          <div className="mt-44 mb-28 overflow-visible relative z-10">
            <div className="rounded-2xl border border-[#2E2E2F]/10 bg-[#F2F2F2] px-6 py-8 md:px-8 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-8">
                <p className="text-[11px] font-bold tracking-tight text-[#2E2E2F]/60">Event smart categories</p>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                        if (categoriesScrollRef.current) {
                            categoriesScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                        }
                    }}
                    className="p-2 rounded-full bg-[#2E2E2F]/5 hover:bg-[#38BDF2]/10 text-[#2E2E2F]/40 hover:text-[#38BDF2] transition-colors"
                  >
                    <ICONS.ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => {
                        if (categoriesScrollRef.current) {
                            categoriesScrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
                        }
                    }}
                    className="p-2 rounded-full bg-[#2E2E2F]/5 hover:bg-[#38BDF2]/10 text-[#2E2E2F]/40 hover:text-[#38BDF2] transition-colors"
                  >
                    <ICONS.ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div 
                className="py-2 relative group-categories outline-none"
                tabIndex={0}
                onMouseEnter={() => setIsMarqueePaused(true)}
                onMouseLeave={() => setIsMarqueePaused(false)}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') {
                        categoriesScrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
                    } else if (e.key === 'ArrowRight') {
                        categoriesScrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
                    }
                }}
              >
                <div
                  ref={categoriesScrollRef}
                  className="flex items-center gap-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
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
            <div className="w-full mt-44 mb-44 animate-in fade-in slide-in-from-bottom-4 duration-700 px-1">
              {/* Header Section */}
              <div className="mb-12 text-center flex flex-col items-center">
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-3xl md:text-4xl font-black text-[#2E2E2F] tracking-tight leading-none">Promoted Events</h2>
                  <div className="group/info relative">
                    <ICONS.Info className="w-6 h-6 text-[#2E2E2F]/30 cursor-help hover:text-[#38BDF2] transition-colors" strokeWidth={2} />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-64 p-4 bg-[#2E2E2F] text-white text-[11px] font-bold rounded-xl shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover/info:opacity-100 group-hover/info:translate-y-0 transition-all z-50 leading-relaxed text-center">
                      These events are highlighted because the organizer has subscribed to a premium plan with promotion features.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#2E2E2F]"></div>
                    </div>
                  </div>
                </div>
                <p className="text-[#2E2E2F]/50 text-sm md:text-base font-medium max-w-2xl leading-relaxed">
                  Discover curated sessions highlighted by organizers as part of their elite plan features.
                </p>
              </div>

              {!loadingPromoted && promotedEvents.length > 0 ? (
                <div className="relative">
                  {/* Carousel Container - More visible border and rounded corners */}
                  <div className="rounded-2xl overflow-hidden border border-[#2E2E2F]/15 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] group">
                    <div className="relative h-[280px] sm:h-[400px] lg:h-[500px] overflow-hidden bg-white">
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
                            {/* Main Image - Full width with hover scale */}
                            <img
                              src={imageUrl}
                              alt={event.eventName}
                              className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.05] z-10"
                            />

                            {/* Info Overlay Panel */}
                            <div className="absolute inset-0 z-20 flex flex-col justify-center">
                              {/* Refined Gradient Overlay for higher image visibility */}
                              <div className="absolute inset-0 z-[1] bg-gradient-to-r from-white via-white/90 via-white/30 to-transparent w-full lg:w-[45%]" />

                              {/* Content Area */}
                              <div className="relative z-30 p-8 sm:p-12 animate-in fade-in slide-in-from-left-4 duration-700">
                                {(() => {
                                  const totalSlots = (event.ticketTypes || []).reduce((sum, t) => sum + (t.quantityTotal || 0), 0);
                                  const soldSlots = (event as any).registrationCount ?? (event.ticketTypes || []).reduce((sum, t) => sum + (t.quantitySold || 0), 0);
                                  const isDone = new Date(event.endAt) < new Date();
                                  const minPrice = (event?.ticketTypes || []).length > 0
                                    ? Math.min(...event!.ticketTypes!.map((t: any) => Number(t.priceAmount || 0)))
                                    : 0;
                                  const org = event.organizer || organizers.find((o: any) => o.organizerId === event.organizerId);

                                  return (
                                    <div className="flex flex-col gap-5 sm:gap-7 text-[#2E2E2F] max-w-xl">
                                      {/* Category Badge - Reduced Size */}
                                      <div className="flex items-center gap-3 mb-6 group/badge shrink-0">
                                        <div className="w-8 h-8 rounded-full bg-[#38BDF2] flex items-center justify-center text-[#F2F2F2] shadow-xl shadow-[#38BDF2]/20 ring-2 ring-white animate-in zoom-in duration-1000">
                                          <ICONS.Check className="w-4 h-4" strokeWidth={5} />
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-xs font-black tracking-[0.15em] text-[#38BDF2] uppercase leading-none">
                                            Featured Session
                                          </span>
                                        </div>
                                      </div>

                                      {/* Event Title */}
                                      <h3 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-[1.05] text-[#2E2E2F] drop-shadow-sm animate-in fade-in slide-in-from-left-6 duration-1000 delay-100">
                                        {event.eventName}
                                      </h3>

                                        {/* Event Details Grid - Refined Weight & Black Color */}
                                        <div className="space-y-3 sm:space-y-4 pt-3 animate-in fade-in slide-in-from-left-8 duration-1000 delay-200">
                                          <div className="flex items-center gap-4 text-base sm:text-lg font-medium text-black">
                                            <div className="w-8 h-8 flex items-center justify-center text-black bg-[#2E2E2F]/5 rounded-lg">
                                              <ICONS.Heart className="w-5 h-5" />
                                            </div>
                                            <span>3 likes</span>
                                          </div>

                                          <div className="flex items-center gap-4 text-base sm:text-lg font-medium text-black">
                                            <div className="w-8 h-8 flex items-center justify-center text-black bg-[#2E2E2F]/5 rounded-lg">
                                              <ICONS.Users className="w-5 h-5" />
                                            </div>
                                            <span>{soldSlots} registered <span className="opacity-40 mx-1">•</span> {totalSlots} available</span>
                                          </div>
  
                                          <div className="flex items-center gap-4 text-base sm:text-lg font-medium text-black">
                                            <div className="w-8 h-8 flex items-center justify-center text-black bg-[#2E2E2F]/5 rounded-lg">
                                              <ICONS.MapPin className="w-5 h-5" />
                                            </div>
                                            <span className="line-clamp-1">{event.locationText || 'Location TBA'}</span>
                                          </div>
  
                                          <div className="flex items-center gap-4 text-base sm:text-lg font-medium text-black">
                                            <div className="w-8 h-8 flex items-center justify-center text-black bg-[#2E2E2F]/5 rounded-lg">
                                              <ICONS.Calendar className="w-5 h-5" />
                                            </div>
                                            <span>{formatStartForCard(event.startAt || '', event.timezone)}</span>
                                          </div>
                                        </div>

                                      {/* Action Button */}
                                      <div className="pt-6 sm:pt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/events/${event.slug || event.eventId}`);
                                          }}
                                          className="px-6 py-2.5 bg-[#38BDF2] text-white text-[12px] font-black rounded-[5px] shadow-lg shadow-[#38BDF2]/20 hover:bg-[#2E2E2F] hover:shadow-none transition-all transform active:scale-95 uppercase tracking-[0.1em] flex items-center justify-center gap-2 group/btn w-fit"
                                        >
                                          Get Ticket
                                          <ICONS.ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" strokeWidth={4} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Navigation Arrows - Using a darker, more defined style for visibility on white */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (promotedCarouselInterval) clearInterval(promotedCarouselInterval);
                          setCurrentPromotedIndex((prev) => (prev - 1 + promotedEvents.length) % promotedEvents.length);
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg border border-[#2E2E2F]/5 flex items-center justify-center text-[#2E2E2F] hover:bg-[#38BDF2] hover:text-white transition-all opacity-0 group-hover:opacity-100 z-20"
                      >
                        <ICONS.ChevronLeft className="w-5 h-5" strokeWidth={3} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (promotedCarouselInterval) clearInterval(promotedCarouselInterval);
                          setCurrentPromotedIndex((prev) => (prev + 1) % promotedEvents.length);
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg border border-[#2E2E2F]/5 flex items-center justify-center text-[#2E2E2F] hover:bg-[#38BDF2] hover:text-white transition-all opacity-0 group-hover:opacity-100 z-20"
                      >
                        <ICONS.ChevronRight className="w-5 h-5" />
                      </button>
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
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/90 mb-3">Event Marketplace</p>
              <h1 className="text-[2.1rem] font-extrabold leading-none tracking-tight text-white sm:text-5xl">All Events</h1>
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
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-8 mb-6 pb-0 px-0">
            <div className="flex-1 space-y-1.5">
              <h2 className="text-2xl md:text-3xl font-black text-[#2E2E2F] tracking-tight leading-none uppercase">{sectionTitle}</h2>
              <p className="text-[#2E2E2F]/50 text-xs md:text-sm font-medium leading-relaxed">{sectionSubtitle}</p>
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
              className="flex items-center gap-2 bg-[#F2F2F2] px-4 py-2.5 rounded-xl border border-[#2E2E2F]/10 shadow-sm text-[10px] font-black uppercase tracking-widest text-[#2E2E2F] hover:bg-[#38BDF2]/10 hover:border-[#38BDF2]/30 transition-all"
            >
              <ICONS.Filter className="w-4 h-4" />
              {isSidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
            </button>

            {/* Sort By Dropdown */}
            <div className="flex items-center gap-3 bg-[#F2F2F2] px-5 py-2.5 rounded-xl border border-[#2E2E2F]/10 shadow-sm justify-between sm:justify-start">
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

        <div className="w-full sm:w-[280px] md:w-[320px]">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#2E2E2F]/30 group-focus-within:text-[#38BDF2] transition-colors">
              <ICONS.Search className="h-4 w-4" strokeWidth={3} />
            </div>
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-9 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl text-[12px] font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/20 focus:border-[#38BDF2] placeholder:text-[#2E2E2F]/30"
            />
          </div>
        </div>
      </div>

      {interactionNotice && (
        <div className="mb-6 rounded-xl border border-[#38BDF2]/30 bg-[#38BDF2]/10 px-4 py-3 text-sm font-semibold text-[#2E2E2F]">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-7 lg:gap-8 min-h-[400px]">
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

          {isLandingAllListing && (
            <div className="flex justify-center mt-12 px-4">
              <button
                onClick={() => navigate('/browse-events')}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 bg-[#38BDF2] rounded-xl text-[12px] font-black uppercase tracking-widest text-[#F2F2F2] hover:bg-[#2E2E2F] transition-all active:scale-95 shadow-lg shadow-[#38BDF2]/20"
              >
                Explore All Events
                <ICONS.ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Empty State */}
          {displayEvents.length === 0 && (
            <div className="py-24 px-6 text-center bg-[#F2F2F2] rounded-xl border border-[#2E2E2F]/10 animate-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-[#F2F2F2] border border-[#2E2E2F]/5 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-sm">
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
                  className="px-8 py-3.5 rounded-xl bg-[#2E2E2F] text-white font-black uppercase tracking-widest text-[10px] hover:bg-[#38BDF2] transition-colors"
                  onClick={() => navigate('/browse-events')}
                >
                  Discover All Sessions
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="px-8 py-3.5 rounded-xl border-2 border-[#2E2E2F]/10 text-[#2E2E2F] font-black uppercase tracking-widest text-[10px]"
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


        </div>
      </div>


      {isLanding && <PricingSection />}
      <div className="mt-12">
        {isLanding && <FeaturedOrganizers />}
      </div>
      <div className="mt-20">
        {isLanding && <FAQSection />}
      </div>
    </div>
  );
};

const FAQSection: React.FC = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How do I create an event?",
      answer: "Sign in as an organizer, create a draft event, configure ticket classes and order form fields, then publish when ready."
    },
    {
      question: "How do attendees receive tickets?",
      answer: "After successful checkout, attendees receive confirmation and ticket records tied to their order, including QR-enabled check-in details where configured."
    },
    {
      question: "Can my team have different access levels?",
      answer: "Yes. Organizer access can be scoped by role so teams can separate event editing, finance, marketing, and check-in responsibilities."
    },
    {
      question: "What should I do if payment fails at checkout?",
      answer: "Retry within the checkout flow. If the issue persists, use support with your order reference and timestamp for transaction review."
    },
    {
      question: "How are refunds processed?",
      answer: "Refunds follow organizer rules, event status, and platform safeguards. Duplicate refund attempts are blocked by transaction controls."
    }
  ];

  return (
    <section className="mt-44 mb-44 animate-in fade-in slide-in-from-bottom-10 duration-1000">
      <div className="text-center mb-16">
        <p className="text-xs font-bold text-[#38BDF2] mb-3 tracking-tight">Help & Support</p>
        <h2 className="text-3xl md:text-4xl font-black text-[#2E2E2F] tracking-tight leading-none mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-[#2E2E2F]/50 text-sm md:text-base font-medium max-w-2xl mx-auto leading-relaxed">
          Quick guidance for the most common organizer and attendee workflows in StartupLab Ticketing.
        </p>
      </div>
      <div className="max-w-4xl mx-auto space-y-4">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className={`group rounded-xl overflow-hidden transition-all duration-300 border-2 ${openIndex === index
              ? 'bg-[#F2F2F2] border-[#38BDF2] shadow-[0_10px_30px_-10px_rgba(56,189,242,0.1)]'
              : 'bg-[#F2F2F2] border-[#2E2E2F]/10 shadow-none'
              }`}
          >
            <button
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full px-4 sm:px-8 py-5 sm:py-7 flex items-center justify-between text-left focus:outline-none"
            >
              <span className={`text-sm sm:text-lg font-black tracking-tight transition-colors duration-300 ${openIndex === index ? 'text-[#38BDF2]' : 'text-[#2E2E2F]'}`}>
                {faq.question}
              </span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${openIndex === index ? 'bg-[#38BDF2] text-white rotate-180' : 'bg-[#2E2E2F]/5 text-[#2E2E2F]/30'
                }`}>
                <ICONS.ChevronDown className="w-5 h-5" strokeWidth={3} />
              </div>
            </button>
            <div
              className={`grid transition-all duration-300 ease-in-out ${openIndex === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
            >
              <div className="overflow-hidden">
                <div className="px-8 pb-6 border-t border-[#2E2E2F]/5 mt-2">
                  <p className="text-[#2E2E2F]/60 text-base font-medium leading-relaxed mt-4">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center mt-16">
        <button
          onClick={() => navigate('/faq')}
          className="flex items-center gap-3 px-10 py-4 bg-[#38BDF2] text-white rounded-xl text-[12px] font-black uppercase tracking-widest hover:bg-[#2E2E2F] transition-all active:scale-95 shadow-lg shadow-[#38BDF2]/20"
        >
          Go to FAQ
          <ICONS.MessageSquare className="w-5 h-5" />
        </button>
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
  const carouselRef = React.useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const data = await apiService.getOrganizers();
        setOrganizers(data || []);
      } catch (error) {
        console.error('Failed to fetch organizers:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);



  const handleScroll = () => {
    if (carouselRef.current) {
      const scrollLeft = carouselRef.current.scrollLeft;
      const card = carouselRef.current.firstElementChild as HTMLElement;
      if (!card) return;
      const cardWidth = card.offsetWidth + 24; // Width + gap-6 (1.5rem/24px)
      const newIndex = Math['round'](scrollLeft / cardWidth);
      if (newIndex !== currentIndex) setCurrentIndex(newIndex);
    }
  };

  if (loading || !organizers || organizers.length === 0) return null;
  const dotsCount = Math.min(5, organizers.length);
  const activeDot = Math.min(currentIndex, 4);

  return (
    <section className="mt-10 mb-20 px-4 sm:px-6 lg:px-10 py-12 bg-transparent">
      <div className="flex flex-col mb-8 text-center items-center justify-center">
        <p className="text-xs font-bold text-[#38BDF2] mb-3 tracking-tight uppercase">Verified Showcase</p>
        <h2 className="text-2xl md:text-3xl font-black text-[#2E2E2F] tracking-tight leading-none mb-3 uppercase">Featured Organizers</h2>
        <p className="text-[#2E2E2F]/40 text-xs md:text-sm font-medium max-w-lg leading-relaxed">Stay connected with our top event creators and never miss a highlight session.</p>
      </div>

      <div
        ref={carouselRef}
        onScroll={handleScroll}
        className="flex gap-6 overflow-x-auto pb-8 pt-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth snap-x snap-mandatory flex-nowrap w-fit max-w-full mx-auto px-2"
      >
        {organizers.map((org) => {
          const isFollowing = (followedOrganizerIds || []).includes(org.organizerId);
          return (
            <OrganizerCard
              key={org.organizerId}
              organizer={org}
              isFollowing={isFollowing}
              onFollow={async (e) => {
                e.stopPropagation();
                if (!isAuthenticated) {
                  navigate('/signup');
                  return;
                }
                if (!canLikeFollow) return;
                await toggleFollowing(org.organizerId);
              }}
              onClick={() => navigate(`/organizer/${org.organizerId}`)}
              className="w-[300px] sm:w-[360px] shrink-0 snap-center"
            />
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 mt-2">
        {Array.from({ length: dotsCount }).map((_, i) => (
          <div key={i} className={`w-[7px] h-[7px] rounded-full transition-all duration-300 ${i === activeDot ? 'bg-[#38BDF2] scale-110' : 'bg-[#2E2E2F]/15'}`} />
        ))}
      </div>

      <div className="flex justify-center mt-10">
        <button
          onClick={() => navigate('/organizers/discover')}
          className="flex items-center gap-3 px-8 py-3 bg-[#38BDF2] border border-[#38BDF2] rounded-xl text-[13px] font-black uppercase tracking-widest text-[#F2F2F2] hover:bg-black hover:border-black transition-all hover:shadow-xl hover:shadow-[#38BDF2]/20 active:scale-95"
        >
          See organizers
          <ICONS.ChevronRight className="w-4 h-4 text-white" />
        </button>
      </div>
    </section>
  );
};



