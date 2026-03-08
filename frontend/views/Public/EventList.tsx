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

export const EventCard: React.FC<{
  event: Event;
  onActionNotice?: (message: string) => void;
  trendingRank?: number | null;
}> = ({ event, onActionNotice, trendingRank = null }) => {
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
  const organizerName = event.organizer?.organizerName || 'Organization';
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

  return (
    <Card className="group flex flex-col h-full border border-[#2E2E2F]/10 rounded-[1.35rem] overflow-hidden bg-[#F2F2F2] hover:border-[#38BDF2]/40 transition-colors cursor-pointer" onClick={() => navigate(`/events/${event.slug}`)}>
      {/* Image Section */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={getImageUrl(event.imageUrl)}
          alt={event.eventName}
          className="w-full h-full object-cover"
        />
        {trendingRank ? (
          <div className="absolute top-3 left-3 rounded-full px-2.5 py-1 bg-[#38BDF2] text-white text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-[#38BDF2]/30 z-10">
            #{trendingRank} Trending
          </div>
        ) : null}
        <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">
          <button
            type="button"
            onClick={handleLike}
            className={`pointer-events-auto w-9 h-9 rounded-xl border backdrop-blur-sm flex items-center justify-center transition-colors ${liked
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-white/90 text-[#2E2E2F] border-[#2E2E2F]/20 hover:bg-[#38BDF2]/20'
              }`}
            title={organizerRestricted ? 'Switch to Attending to like events' : 'Like event'}
          >
            <ICONS.Heart className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="pointer-events-auto w-9 h-9 rounded-xl border bg-white/90 text-[#2E2E2F] border-[#2E2E2F]/20 backdrop-blur-sm flex items-center justify-center hover:bg-[#38BDF2]/20 transition-colors"
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
              className="w-9 h-9 rounded-xl border bg-white/90 text-[#2E2E2F] border-[#2E2E2F]/20 backdrop-blur-sm flex items-center justify-center hover:bg-[#38BDF2]/20 transition-colors"
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
      {/* Content Section */}
      <div className="p-5 flex-1 flex flex-col">
        <h4 className="text-[#2E2E2F] text-lg font-bold tracking-tight leading-tight mb-2 line-clamp-2">
          {event.eventName}
        </h4>
        <div className="text-[#2E2E2F]/70 text-[12px] font-medium mb-2.5 line-clamp-2">
          {(event as any).summaryLine || 'Explore our latest projects, network with StartupLab founders and learn about future initiatives.'}
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#2E2E2F]/70 mb-2">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${liked ? 'bg-red-500 text-white' : 'bg-[#2E2E2F]/10 text-[#2E2E2F]/65'}`}>
            <ICONS.Heart className="w-3 h-3" />
          </span>
          <span>{likeLabel}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-medium text-[#2E2E2F]/70 mb-2.5">
          <span className="text-[#38BDF2]">{(event as any).registrationCount ?? 0} registered / {(event.ticketTypes || []).reduce((sum, t) => sum + (t.quantityTotal || 0), 0)} slots</span>
          <span className="text-[#2E2E2F]/60">•</span>
          <span>{event.locationText}</span>
          <span className="text-[#2E2E2F]/60">•</span>
          <span>{formatDate(event.startAt, event.timezone, { day: 'numeric', month: 'short', year: 'numeric' })} · {formatTime(event.startAt, event.timezone)}</span>
        </div>
        <div className="text-[#2E2E2F]/70 text-[12px] font-medium mb-5 leading-relaxed">
          {(event.description || '').length > 120 ? `${event.description.slice(0, 120)}...` : event.description}
        </div>
      </div>
    </Card>
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
  const initialLoadRef = useRef(true);
  const requestIdRef = useRef(0);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPrice, setSelectedPrice] = useState<'all' | 'free' | 'paid'>('all');
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'online' | 'in-person'>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [showCategoriesFull, setShowCategoriesFull] = useState(false);
  const [sortBy, setSortBy] = useState<string>('relevance');

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

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
    const nextLocation = locationFromQuery || DEFAULT_LOCATION;

    setSearchTerm(nextSearch);
    setDebouncedSearch(nextSearch);
    setSelectedLocation(nextLocation);
    setActiveBrowseTab('ALL');
    setCurrentPage(1);
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      const requestId = ++requestIdRef.current;
      const pageSize = isSpecialListing ? 200 : (isLandingAllListing ? 3 : 6);
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
          sortBy
        };

        if (selectedDate !== 'all') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate === 'today') {
            filters.startDate = today.toISOString();
            const tonight = new Date(today);
            tonight.setHours(23, 59, 59, 999);
            filters.endDate = tonight.toISOString();
          } else if (selectedDate === 'tomorrow') {
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            filters.startDate = tomorrow.toISOString();
            const tomorrowNight = new Date(tomorrow);
            tomorrowNight.setHours(23, 59, 59, 999);
            filters.endDate = tomorrowNight.toISOString();
          } else if (selectedDate === 'weekend') {
            const day = today.getDay();
            const diff = day === 0 ? 0 : 6 - day;
            const sat = new Date(today);
            sat.setDate(today.getDate() + diff);
            filters.startDate = sat.toISOString();
            const sun = new Date(sat);
            sun.setDate(sat.getDate() + 1);
            sun.setHours(23, 59, 59, 999);
            filters.endDate = sun.toISOString();
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
  }, [currentPage, isSpecialListing, isLandingAllListing, serverSearchTerm, selectedCategory, selectedPrice, selectedFormat, selectedDate, sortBy]);

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
      const likeDiff = Number(b.likesCount || 0) - Number(a.likesCount || 0);
      if (likeDiff !== 0) return likeDiff;
      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    });
    return ranked;
  }, [filteredEvents]);

  const trendingRankByEventId = useMemo(() => {
    const map = new Map<string, number>();
    if (listing !== 'all') return map;
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
    if (isLandingAllListing) return orderedEvents.slice(0, 3);
    return orderedEvents;
  }, [isLandingAllListing, orderedEvents]);

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const showPagination = !isLanding && !isSpecialListing && activeBrowseTab === 'ALL' && orderedEvents.length > 0 && totalPages > 1;
  const showViewAllButton = isLandingAllListing && Number(pagination.total || 0) > displayEvents.length;
  const marqueeCategories = useMemo(() => [...EVENT_CATEGORIES, ...EVENT_CATEGORIES], []);
  const sectionTitle = listing === 'liked' ? 'Liked Events' : listing === 'followings' ? 'Followed Organizations' : 'Available Events';
  const sectionSubtitle = listing === 'liked'
    ? 'Events you marked with a like.'
    : listing === 'followings'
      ? 'Latest events from organizations you follow.'
      : 'Browse and register for upcoming business seminars and workshops.';

  if (loading) return (
    <PageLoader label="Loading events..." />
  );

  return (
    <div className={`max-w-[88rem] mx-auto px-4 sm:px-6 pb-16 ${isLanding ? 'pt-6 sm:pt-10' : 'pt-4 sm:pt-8'}`}>
      {isLanding && (
        <>
          {/* Premium Hero Section */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-14 mb-16 lg:mb-20">
            {/* Left Column: Content */}
            <div className="flex-1 min-w-0 flex flex-col items-start text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAFAFA] border border-[#2E2E2F]/5 text-[10px] font-bold text-[#2E2E2F] mb-7 shadow-sm">
                <span role="img" aria-label="megaphone">📢</span>
                <span className="opacity-80">New: Advanced QR Ticketing & Analytics Launched!</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black text-[#2E2E2F] tracking-tighter leading-[1.05] mb-7">
                Smart Events for<br />
                Growing Philippine<br />
                Organizers
              </h1>

              <p className="text-[#2E2E2F]/60 text-base lg:text-lg font-medium leading-relaxed mb-8 max-w-xl">
                Manage registrations, tickets, attendee check-ins, and performance in one simple, compliance-ready event platform — built for organizers in the Philippines.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => navigate('/signup')}
                  className="px-7 py-3 bg-[#00AEEF] border border-[#66DBFF] text-white font-black uppercase tracking-widest text-[10px] h-auto rounded-xl shadow-[0_0_16px_rgba(0,174,239,0.45)] hover:bg-black hover:border-black hover:shadow-[0_0_22px_rgba(0,174,239,0.5)] transition-all flex items-center gap-2 active:scale-95 group"
                >
                  Start Free Trial
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Button>
                <Button
                  onClick={() => navigate('/pricing')}
                  className="px-7 py-3 bg-[#2E2E2F] text-white font-black uppercase tracking-widest text-[10px] h-auto rounded-xl hover:bg-[#38BDF2] hover:shadow-xl hover:shadow-[#38BDF2]/40 transition-all flex items-center gap-2 active:scale-95"
                >
                  <ICONS.CreditCard className="w-4 h-4" />
                  Pricing
                </Button>
              </div>

              <div className="mt-10 w-full max-w-[42rem] grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: 'Core Event Modules', value: '8+', sub: 'Ticketing, QR Check-in, Guest Lists, Analytics, Scheduling, CRM' },
                  { label: 'Event Expertise', value: '15+ Years', sub: 'Built with real-world event management experience' },
                  { label: 'Event Workflows', value: '30+', sub: 'From initial setup to post-event data extraction' },
                ].map((stat, i) => (
                  <div key={i} className="flex flex-col items-start">
                    <h2 className="text-4xl font-black text-[#2E2E2F] tracking-tighter mb-2">{stat.value}</h2>
                    <p className="text-xl font-bold text-[#2E2E2F] leading-tight mb-1.5">{stat.label}</p>
                    <p className="text-[#2E2E2F]/50 text-[13px] font-medium leading-relaxed">{stat.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Visual */}
            <div className="flex-1 relative">
              <div className="absolute -inset-8 bg-gradient-to-tr from-[#38BDF2]/10 to-transparent blur-3xl opacity-50"></div>
              <div className="relative bg-white p-1.5 rounded-[2.2rem] shadow-[0_28px_56px_-16px_rgba(46,46,47,0.15)] overflow-hidden transform lg:rotate-2 hover:rotate-0 transition-transform duration-700">
                <img
                  src="/hero-dashboard.png"
                  alt="Event Management Dashboard"
                  className="w-full h-auto rounded-[1.8rem]"
                />
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-5 -left-5 bg-white p-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-bounce">
                <div className="w-9 h-9 rounded-full bg-[#38BDF2]/10 flex items-center justify-center">
                  <ICONS.CheckCircle className="w-5 h-5 text-[#38BDF2]" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/40">Compliance</p>
                  <p className="text-xs font-bold text-[#2E2E2F]">Ready for 2026</p>
                </div>
              </div>
            </div>
          </div>

          {/* Category Rail (Top of Available Events) */}
          <div className="mt-12 mb-10">
            <div className="rounded-[1.8rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] px-4 py-5 md:px-7">
              <div className="flex items-center gap-4 mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/60">Event Smart Categories.</p>
              </div>
              <div className="category-marquee">
                <div className="category-marquee__track">
                  {marqueeCategories.map((category, index) => (
                    <button
                      key={`${category.key}-${index}`}
                      type="button"
                      onClick={() => navigate(`/categories/${category.key.toLowerCase()}`)}
                      className="shrink-0 w-[128px] flex flex-col items-center gap-2.5 text-center group px-2"
                    >
                      <span className="w-[72px] h-[72px] rounded-full border border-transparent flex items-center justify-center text-[#2E2E2F]/70 bg-[#F2F2F2] group-hover:bg-[#38BDF2]/20 group-hover:border-[#38BDF2]/40 group-hover:text-[#2E2E2F] transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[#38BDF2]/25 group-focus-visible:scale-110">
                        <category.Icon className="w-7 h-7 transition-transform duration-200 group-hover:scale-125 group-focus-visible:scale-125" />
                      </span>
                      <span className="text-[13px] font-bold text-[#2E2E2F] leading-tight min-h-[32px] flex items-center justify-center">{category.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
        <section className="mb-0 px-4 sm:px-6 lg:px-8 pt-0 pb-4">
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
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pt-4 mb-2 pb-0">
            <div className="flex-1 space-y-2">
              <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tighter uppercase leading-none">{sectionTitle}</h2>
              <p className="text-[#2E2E2F]/40 text-[11px] font-black uppercase tracking-[0.2em]">{sectionSubtitle}</p>
            </div>
          </div>
        </section>
      )}

      <div className={`flex flex-col sm:flex-row items-center justify-between gap-6 ${isLanding ? 'mb-6 mt-0' : 'mb-8 mt-2'}`}>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {/* Hide Sidebar Toggle */}
          {!isLanding && !isSpecialListing && (
            <button
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              className="flex items-center gap-2 bg-[#F2F2F2] px-4 py-2.5 rounded-2xl border border-[#2E2E2F]/10 shadow-sm text-[10px] font-black uppercase tracking-widest text-[#2E2E2F] hover:bg-[#38BDF2]/10 hover:border-[#38BDF2]/30 transition-all"
            >
              <ICONS.Filter className="w-4 h-4" />
              {isSidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
            </button>
          )}

          {/* Sort By Dropdown */}
          {!isLanding && !isSpecialListing && (
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
          )}
        </div>

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
          <aside className="w-full lg:w-72 shrink-0 space-y-10 animate-in fade-in slide-in-from-left-4 duration-700">
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
                    <span className={`text-[13px] font-black tracking-tight ${selectedCategory === cat.key ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>{cat.label}</span>
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
                {listing === 'liked'
                  ? 'No liked events yet'
                  : listing === 'followings'
                    ? 'No events from followed organizations yet'
                    : activeBrowseTab === 'FOR_YOU'
                      ? 'No recommended events yet'
                      : 'No matches found'}
              </h3>
              <p className="text-sm font-bold text-[#2E2E2F]/50 mb-10 max-w-[340px] mx-auto leading-relaxed">
                {listing === 'all'
                  ? 'Try adjusting your filters or search terms to discover more exciting sessions.'
                  : 'Like events or follow organizations to build your personalized feed.'}
              </p>
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
        <h2 className="text-3xl sm:text-4xl font-black text-[#2E2E2F] tracking-tight mb-4">
          Frequently Asked Questions
        </h2>
        <p className="max-w-xl mx-auto text-[#2E2E2F]/60 font-medium">
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
        <h2 className="text-3xl font-black text-[#2E2E2F] tracking-tighter mb-2">Featured Organisers</h2>
        <p className="text-[#2E2E2F]/60 text-lg font-medium leading-tight">Follow the organisers from these events and get notified when they create new ones.</p>
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
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] h-auto transition-all ${isFollowing
                  ? 'border-[#2E2E2F]/10 text-[#2E2E2F] hover:bg-[#2E2E2F] hover:text-white'
                  : 'bg-[#38BDF2] text-white hover:bg-[#2E2E2F] shadow-lg shadow-[#38BDF2]/10 hover:shadow-[#2E2E2F]/10'
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
