import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PageLoader } from '../../components/Shared';
import { apiService } from '../../services/apiService';
import { Event, OrganizerProfile } from '../../types';
import { ICONS } from '../../constants';
import { useUser } from '../../context/UserContext';
import { useEngagement } from '../../context/EngagementContext';
import { EventCard } from './EventList';

const REFRESH_INTERVAL_MS = 15000;
const EVENTS_PAGE_SIZE = 80;
const EVENTS_MAX_PAGES = 20;

const getOrganizerIdFromEvent = (event: Event): string => (
  event.organizerId || event.organizer?.organizerId || ''
);

const getProfileImageUrl = (value?: string | null): string => {
  if (!value) return '';
  const url = String(value).trim();
  return url.length ? url : '';
};

const buildFacebookLink = (facebookId?: string | null): string => {
  if (!facebookId) return '';
  const normalized = String(facebookId)
    .replace(/^https?:\/\/(www\.)?facebook\.com\//i, '')
    .replace(/^@/, '')
    .trim();
  return normalized ? `https://facebook.com/${normalized}` : '';
};

const buildTwitterLink = (twitterHandle?: string | null): string => {
  if (!twitterHandle) return '';
  const normalized = String(twitterHandle)
    .replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, '')
    .replace(/^@/, '')
    .trim();
  return normalized ? `https://x.com/${normalized}` : '';
};

const fetchAllPublishedEvents = async (): Promise<Event[]> => {
  let page = 1;
  let totalPages = 1;
  const allEvents: Event[] = [];

  while (page <= totalPages && page <= EVENTS_MAX_PAGES) {
    const payload = await apiService.getEvents(page, EVENTS_PAGE_SIZE, '');
    const pageEvents = Array.isArray(payload?.events) ? payload.events : [];
    allEvents.push(...pageEvents);

    const parsedTotalPages = Number(payload?.pagination?.totalPages || 1);
    totalPages = Number.isFinite(parsedTotalPages) && parsedTotalPages > 0
      ? parsedTotalPages
      : 1;

    page += 1;
  }

  return allEvents;
};

export const FollowingsEventsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useUser();
  const {
    canLikeFollow,
    followedOrganizerIds,
    isFollowing,
    toggleFollowing
  } = useEngagement();

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [organizers, setOrganizers] = React.useState<OrganizerProfile[]>([]);
  const [events, setEvents] = React.useState<Event[]>([]);
  const [selectedOrganizerId, setSelectedOrganizerId] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [interactionNotice, setInteractionNotice] = React.useState('');

  const requestIdRef = React.useRef(0);

  const followedIds = React.useMemo(
    () => [...new Set(followedOrganizerIds.filter(Boolean))],
    [followedOrganizerIds]
  );

  const loadFollowingsData = React.useCallback(async (isInitial: boolean) => {
    const requestId = ++requestIdRef.current;

    if (isInitial) setLoading(true);
    else setRefreshing(true);

    setErrorMessage('');

    if (!isAuthenticated) {
      if (requestId === requestIdRef.current) {
        setOrganizers([]);
        setEvents([]);
        setSelectedOrganizerId(null);
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    if (followedIds.length === 0) {
      if (requestId === requestIdRef.current) {
        setOrganizers([]);
        setEvents([]);
        setSelectedOrganizerId(null);
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    try {
      const organizerResults = await Promise.all(
        followedIds.map(async (organizerId) => {
          try {
            return await apiService.getOrganizerById(organizerId);
          } catch {
            return null;
          }
        })
      );

      if (requestId !== requestIdRef.current) return;

      const existingOrganizers = organizerResults
        .filter((organizer): organizer is OrganizerProfile => !!organizer)
        .sort((left, right) => left.organizerName.localeCompare(right.organizerName));

      const organizerIdSet = new Set(existingOrganizers.map((organizer) => organizer.organizerId));
      const allPublishedEvents = await fetchAllPublishedEvents();
      if (requestId !== requestIdRef.current) return;

      const followedEvents = allPublishedEvents
        .filter((event) => organizerIdSet.has(getOrganizerIdFromEvent(event)))
        .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());

      setOrganizers(existingOrganizers);
      setEvents(followedEvents);
      setSelectedOrganizerId((current) => {
        if (current && organizerIdSet.has(current)) return current;
        return null;
      });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      const message = error instanceof Error && error.message
        ? error.message
        : 'Unable to load followings right now.';
      setErrorMessage(message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isAuthenticated, followedIds]);

  React.useEffect(() => {
    loadFollowingsData(true);
    const intervalId = window.setInterval(() => {
      loadFollowingsData(false);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadFollowingsData]);

  React.useEffect(() => {
    if (!interactionNotice) return;
    const timerId = window.setTimeout(() => setInteractionNotice(''), 2400);
    return () => window.clearTimeout(timerId);
  }, [interactionNotice]);

  const eventsCountByOrganizer = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      const organizerId = getOrganizerIdFromEvent(event);
      if (!organizerId) continue;
      counts.set(organizerId, (counts.get(organizerId) || 0) + 1);
    }
    return counts;
  }, [events]);

  const selectedOrganizer = React.useMemo(
    () => organizers.find((organizer) => organizer.organizerId === selectedOrganizerId) || null,
    [organizers, selectedOrganizerId]
  );

  const selectedOrganizerEvents = React.useMemo(() => {
    if (!selectedOrganizerId) return [];
    return events.filter((event) => getOrganizerIdFromEvent(event) === selectedOrganizerId);
  }, [events, selectedOrganizerId]);

  const handleFollowToggle = async () => {
    if (!selectedOrganizer) return;

    if (!isAuthenticated) {
      navigate('/signup');
      return;
    }

    if (!canLikeFollow) {
      setInteractionNotice('Switch to Attending mode to manage followings.');
      return;
    }

    try {
      const { following: nextFollowing, confirmationEmailSent } = await toggleFollowing(selectedOrganizer.organizerId);
      setOrganizers((current) => current.map((organizer) => {
        if (organizer.organizerId !== selectedOrganizer.organizerId) return organizer;
        const delta = nextFollowing ? 1 : -1;
        const nextFollowersCount = Math.max(0, Number(organizer.followersCount || 0) + delta);
        return { ...organizer, followersCount: nextFollowersCount };
      }));
      if (!nextFollowing) {
        const remainingIds = followedIds.filter((id) => id !== selectedOrganizer.organizerId);
        setSelectedOrganizerId(remainingIds[0] || null);
      }
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

  if (loading) return <PageLoader label="Loading followings..." />;

  if (!isAuthenticated) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="rounded-[2rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-8 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/45 mb-3">Followings</p>
          <h1 className="text-3xl font-black text-[#2E2E2F] tracking-tight mb-4">Sign in to view organizations you follow</h1>
          <p className="text-sm text-[#2E2E2F]/65 max-w-xl mx-auto mb-6">
            Your followed organizations and their latest events are available after login.
          </p>
          <Button onClick={() => navigate('/signup')}>Sign Up</Button>
        </div>
      </div>
    );
  }

  if (followedIds.length === 0 || organizers.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="rounded-[2rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-8 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/45 mb-3">Followings</p>
          <h1 className="text-3xl font-black text-[#2E2E2F] tracking-tight mb-4">No organizations followed yet</h1>
          <p className="text-sm text-[#2E2E2F]/65 max-w-xl mx-auto mb-6">
            Follow an organization from an event card to see that organization profile here, with all events listed below it.
          </p>
          <Button onClick={() => navigate('/browse-events')}>Browse Events</Button>
        </div>
      </div>
    );
  }

  const organizerImage = getProfileImageUrl(selectedOrganizer?.profileImageUrl);
  const organizerInitial = (selectedOrganizer?.organizerName || 'O').charAt(0).toUpperCase();
  const organizerDescription = selectedOrganizer?.eventPageDescription || selectedOrganizer?.bio || '';
  const organizerWebsite = selectedOrganizer?.websiteUrl || '';
  const organizerFacebook = buildFacebookLink(selectedOrganizer?.facebookId || '');
  const organizerTwitter = buildTwitterLink(selectedOrganizer?.twitterHandle || '');
  const following = selectedOrganizer ? isFollowing(selectedOrganizer.organizerId) : false;
  const hasSelectedOrganizer = !!selectedOrganizer;
  const selectedEventsCount = selectedOrganizer
    ? Number(selectedOrganizer.eventsHostedCount || eventsCountByOrganizer.get(selectedOrganizer.organizerId) || 0)
    : 0;

  return (
    <div className="max-w-[88rem] mx-auto px-6 pb-16 pt-8">
      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 h-[260px] sm:h-[300px] overflow-hidden mb-8">
        <div className="absolute inset-0 bg-[linear-gradient(116deg,#38BDF2_0%,#38BDF2_45%,#F2F2F2_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,62,134,0.45)_0%,rgba(0,62,134,0.2)_34%,rgba(0,62,134,0)_72%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_32%,rgba(255,255,255,0.34),transparent_46%),linear-gradient(90deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.06)_26%,rgba(255,255,255,0)_52%)]" />
        <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl items-center px-5 sm:px-8">
          <div className="max-w-[760px]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 mb-3">Followings</p>
            <h1 className="text-[2.1rem] font-black leading-none tracking-tight text-white sm:text-5xl">Organizations You Follow</h1>
            <p className="mt-4 max-w-[680px] text-base leading-relaxed text-white/95 sm:text-[1.05rem]">
              Select an organization card to open its profile and view all events from that organization.
            </p>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="mb-6 rounded-2xl border border-[#2E2E2F]/20 bg-[#2E2E2F]/5 px-4 py-3 text-sm font-semibold text-[#2E2E2F]">
          {errorMessage}
        </div>
      )}

      {interactionNotice && (
        <div className="mb-6 rounded-2xl border border-[#38BDF2]/30 bg-[#38BDF2]/10 px-4 py-3 text-sm font-semibold text-[#2E2E2F]">
          {interactionNotice}
        </div>
      )}

      {!hasSelectedOrganizer && (
        <section className="mb-8 rounded-[1.8rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/45">Followed Organizations</p>
            <span className="text-[11px] font-semibold text-[#2E2E2F]/55">{organizers.length} organization(s)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {organizers.map((organizer) => {
              const image = getProfileImageUrl(organizer.profileImageUrl);
              const initial = (organizer.organizerName || 'O').charAt(0).toUpperCase();
              return (
                <button
                  key={organizer.organizerId}
                  type="button"
                  onClick={() => setSelectedOrganizerId(organizer.organizerId)}
                  className="group text-left rounded-2xl border border-[#2E2E2F]/10 bg-[#F2F2F2] overflow-hidden hover:border-[#38BDF2]/45 transition-colors"
                >
                  <div className="aspect-[4/3] bg-[#2E2E2F]/5">
                    {image ? (
                      <img
                        src={image}
                        alt={organizer.organizerName}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#2E2E2F] text-[#F2F2F2] text-4xl font-black">
                        {initial}
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm font-bold text-[#2E2E2F] truncate">{organizer.organizerName}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {selectedOrganizer && (
        <>
          <section className="mb-6 rounded-[1.5rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <button
                type="button"
                onClick={() => setSelectedOrganizerId(null)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#2E2E2F]/20 text-[11px] font-black uppercase tracking-wider text-[#2E2E2F] hover:bg-[#38BDF2]/10 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                </svg>
                All Organizations
              </button>
              <span className="text-[11px] font-semibold text-[#2E2E2F]/55">
                {refreshing ? 'Refreshing...' : `${selectedOrganizerEvents.length} event(s)`}
              </span>
            </div>

            {organizers.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {organizers.map((organizer) => {
                  const selected = organizer.organizerId === selectedOrganizer.organizerId;
                  const image = getProfileImageUrl(organizer.profileImageUrl);
                  const initial = (organizer.organizerName || 'O').charAt(0).toUpperCase();
                  return (
                    <button
                      key={organizer.organizerId}
                      type="button"
                      className={`min-w-[220px] rounded-2xl border px-4 py-3 text-left transition-colors ${selected
                        ? 'border-[#38BDF2] bg-[#38BDF2]/10'
                        : 'border-[#2E2E2F]/10 bg-[#F2F2F2] hover:border-[#38BDF2]/40 hover:bg-[#38BDF2]/5'
                        }`}
                      onClick={() => setSelectedOrganizerId(organizer.organizerId)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2E2E2F] text-[#F2F2F2] flex items-center justify-center font-bold text-sm">
                          {image ? <img src={image} alt={organizer.organizerName} className="w-full h-full object-cover" /> : initial}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#2E2E2F] leading-tight">{organizer.organizerName}</p>
                          <p className="text-[11px] text-[#2E2E2F]/60">
                            {(eventsCountByOrganizer.get(organizer.organizerId) || 0).toLocaleString()} event(s)
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mb-8 rounded-[1.8rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-5 md:p-6">
            <div className="rounded-[1.5rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-5 flex flex-col md:flex-row md:items-center gap-5">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[#2E2E2F] text-[#F2F2F2] flex items-center justify-center text-xl font-bold shrink-0">
                {organizerImage ? (
                  <img src={organizerImage} alt={selectedOrganizer.organizerName} className="w-full h-full object-cover" />
                ) : (
                  organizerInitial
                )}
              </div>

              <div className="flex-1">
                <p className="text-2xl font-black text-[#2E2E2F] tracking-tight">
                  {selectedOrganizer.organizerName}
                </p>
                <div className="flex flex-wrap items-center gap-6 mt-2 text-[#2E2E2F]/80">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest font-black text-[#2E2E2F]/50">Followers</p>
                    <p className="text-2xl font-black">{selectedOrganizer.followersCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest font-black text-[#2E2E2F]/50">Events</p>
                    <p className="text-2xl font-black">{selectedEventsCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-widest font-black text-[#2E2E2F]/50">Visible Here</p>
                    <p className="text-2xl font-black">{selectedOrganizerEvents.length}</p>
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
                  onClick={handleFollowToggle}
                  className={`px-8 py-3 rounded-xl font-black text-sm transition-colors ${following
                    ? 'bg-[#00E6FF] text-white shadow-[0_0_0_1px_rgba(0,230,255,0.75),0_0_24px_rgba(0,230,255,0.6)]'
                    : 'bg-[#00D4FF] text-white shadow-[0_0_0_1px_rgba(0,212,255,0.65),0_0_18px_rgba(0,212,255,0.45)] hover:bg-[#00E6FF]'
                    }`}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              </div>
            </div>
          </section>

          {(organizerDescription || organizerWebsite || organizerFacebook || organizerTwitter) && (
            <section className="mb-8 rounded-[1.8rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-5 md:p-6">
              <div className="space-y-3">
                {organizerDescription && (
                  <p className="text-sm text-[#2E2E2F]/70 leading-relaxed whitespace-pre-wrap">{organizerDescription}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide">
                  {organizerWebsite && (
                    <a href={organizerWebsite} target="_blank" rel="noreferrer" className="text-[#38BDF2] hover:text-[#2E2E2F]">
                      Website
                    </a>
                  )}
                  {organizerFacebook && (
                    <a href={organizerFacebook} target="_blank" rel="noreferrer" className="text-[#38BDF2] hover:text-[#2E2E2F]">
                      Facebook
                    </a>
                  )}
                  {organizerTwitter && (
                    <a href={organizerTwitter} target="_blank" rel="noreferrer" className="text-[#38BDF2] hover:text-[#2E2E2F]">
                      Twitter
                    </a>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="mb-6 rounded-[1.8rem] bg-[#F2F2F2] px-4 sm:px-5 lg:px-6 py-5 sm:py-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h2 className="text-lg lg:text-xl font-extrabold text-[#2E2E2F] tracking-tight mb-1.5">
                  Events by {selectedOrganizer.organizerName}
                </h2>
                <p className="text-[#2E2E2F]/50 text-[13px] font-medium">
                  New events from this organizer appear automatically here.
                </p>
              </div>
              <div className="text-xs font-semibold text-[#2E2E2F]/55 flex items-center gap-2">
                {refreshing && <ICONS.CheckCircle className="w-4 h-4 text-[#38BDF2]" />}
                <span>{refreshing ? 'Refreshing...' : `${selectedOrganizerEvents.length} event(s)`}</span>
              </div>
            </div>
          </section>

          {selectedOrganizerEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 lg:gap-8">
              {selectedOrganizerEvents.map((event) => (
                <div key={event.eventId}>
                  <EventCard event={event} onActionNotice={setInteractionNotice} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-14 px-6 text-center bg-[#F2F2F2] rounded-[2.2rem] border border-[#2E2E2F]/10">
              <div className="w-12 h-12 bg-[#F2F2F2] rounded-full flex items-center justify-center mx-auto mb-5 border border-[#2E2E2F]/10">
                <ICONS.Calendar className="w-6 h-6 text-[#2E2E2F]/60" />
              </div>
              <h3 className="text-xl font-bold text-[#2E2E2F] tracking-tight mb-3">
                No published events from this organization yet
              </h3>
              <p className="text-[13px] font-medium text-[#2E2E2F]/55 mb-5">
                Once the organizer publishes events, they will appear here automatically.
              </p>
              <Button variant="outline" className="px-3" onClick={() => loadFollowingsData(false)}>
                Refresh
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
