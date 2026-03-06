import React from 'react';
import { useUser } from './UserContext';
import { UserRole } from '../types';
import { apiService } from '../services/apiService';

type PublicMode = 'organizer' | 'attending';

interface EngagementContextValue {
  publicMode: PublicMode;
  isAttendingView: boolean;
  canLikeFollow: boolean;
  likedEventIds: string[];
  followedOrganizerIds: string[];
  likedCount: number;
  followingCount: number;
  setPublicMode: (mode: PublicMode) => void;
  toggleLike: (eventId: string) => Promise<boolean>;
  isLiked: (eventId: string) => boolean;
  toggleFollowing: (organizerId: string) => Promise<{ following: boolean; confirmationEmailSent: boolean }>;
  isFollowing: (organizerId: string) => boolean;
}

const EngagementContext = React.createContext<EngagementContextValue | undefined>(undefined);

const MODE_PREFIX = 'engagement:mode:';
const LIKES_PREFIX = 'engagement:likes:';
const FOLLOWS_PREFIX = 'engagement:follows:';

const parseJsonArray = (value: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const getIdentityKey = (email: string | null): string => {
  const identity = String(email || '').trim().toLowerCase();
  return identity || 'anonymous';
};

export const EngagementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, role, email } = useUser();
  const identityKey = React.useMemo(() => getIdentityKey(email), [email]);
  const isOrganizer = role === UserRole.ORGANIZER;

  const [publicMode, setPublicModeState] = React.useState<PublicMode>('organizer');
  const [likedEventIds, setLikedEventIds] = React.useState<string[]>([]);
  const [followedOrganizerIds, setFollowedOrganizerIds] = React.useState<string[]>([]);
  const [hasRemoteFollowings, setHasRemoteFollowings] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const modeKey = `${MODE_PREFIX}${identityKey}`;
    const likesKey = `${LIKES_PREFIX}${identityKey}`;
    const followsKey = `${FOLLOWS_PREFIX}${identityKey}`;

    const storedMode = localStorage.getItem(modeKey);
    const storedLikes = parseJsonArray(localStorage.getItem(likesKey));
    const storedFollows = parseJsonArray(localStorage.getItem(followsKey));

    if (storedMode === 'attending' || storedMode === 'organizer') {
      setPublicModeState(storedMode);
    } else {
      setPublicModeState('organizer');
    }
    setLikedEventIds(storedLikes);
    setFollowedOrganizerIds(storedFollows);
    setHasRemoteFollowings(false);
  }, [identityKey]);

  React.useEffect(() => {
    let active = true;

    const hydrateRemoteLikes = async () => {
      if (!isAuthenticated || !email) return;
      try {
        const eventIds = await apiService.getMyLikedEventIds();
        if (!active) return;
        const normalizedRemote = Array.isArray(eventIds)
          ? [...new Set(eventIds.filter((id) => typeof id === 'string' && id.trim().length > 0))]
          : [];
        setLikedEventIds(normalizedRemote);
      } catch {
        if (!active) return;
      }
    };

    hydrateRemoteLikes();
    return () => {
      active = false;
    };
  }, [isAuthenticated, email, identityKey]);

  React.useEffect(() => {
    let active = true;

    const hydrateRemoteFollowings = async () => {
      if (!isAuthenticated || !email) return;
      try {
        const organizerIds = await apiService.getMyFollowingOrganizerIds();
        if (!active) return;
        const normalizedRemote = Array.isArray(organizerIds)
          ? [...new Set(organizerIds.filter((id) => typeof id === 'string' && id.trim().length > 0))]
          : [];
        setFollowedOrganizerIds((current) => (
          normalizedRemote.length > 0 ? normalizedRemote : current
        ));
        setHasRemoteFollowings(true);
      } catch {
        if (!active) return;
        setHasRemoteFollowings(false);
      }
    };

    hydrateRemoteFollowings();
    return () => {
      active = false;
    };
  }, [isAuthenticated, email, identityKey]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${MODE_PREFIX}${identityKey}`, publicMode);
  }, [identityKey, publicMode]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${LIKES_PREFIX}${identityKey}`, JSON.stringify(likedEventIds));
  }, [identityKey, likedEventIds]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${FOLLOWS_PREFIX}${identityKey}`, JSON.stringify(followedOrganizerIds));
  }, [identityKey, followedOrganizerIds]);

  const setPublicMode = React.useCallback((mode: PublicMode) => {
    setPublicModeState(mode);
  }, []);

  const isAttendingView = isOrganizer ? publicMode === 'attending' : true;
  const canLikeFollow = isAuthenticated && (!isOrganizer || isAttendingView);

  const toggleLike = React.useCallback(async (eventId: string) => {
    if (!eventId) return false;

    const currentlyLiked = likedEventIds.includes(eventId);
    const nextLiked = !currentlyLiked;

    setLikedEventIds((prev) => (
      currentlyLiked
        ? prev.filter((id) => id !== eventId)
        : prev.includes(eventId)
          ? prev
          : [...prev, eventId]
    ));

    if (!isAuthenticated) return nextLiked;

    try {
      if (currentlyLiked) {
        await apiService.unlikeEvent(eventId);
      } else {
        await apiService.likeEvent(eventId);
      }
      return nextLiked;
    } catch (error) {
      setLikedEventIds((prev) => (
        currentlyLiked
          ? (prev.includes(eventId) ? prev : [...prev, eventId])
          : prev.filter((id) => id !== eventId)
      ));
      throw error;
    }
  }, [likedEventIds, isAuthenticated]);

  const isLiked = React.useCallback((eventId: string) => likedEventIds.includes(eventId), [likedEventIds]);

  const toggleFollowing = React.useCallback(async (organizerId: string) => {
    if (!organizerId) return { following: false, confirmationEmailSent: false };

    const currentlyFollowing = followedOrganizerIds.includes(organizerId);
    const nextFollowing = !currentlyFollowing;

    setFollowedOrganizerIds((prev) => (
      currentlyFollowing
        ? prev.filter((id) => id !== organizerId)
        : [...prev, organizerId]
    ));

    try {
      if (isAuthenticated) {
        if (currentlyFollowing) {
          await apiService.unfollowOrganizer(organizerId);
        } else {
          const res = await apiService.followOrganizer(organizerId);
          return {
            following: nextFollowing,
            confirmationEmailSent: !!res.confirmationEmailSent
          };
        }
      }
      return { following: nextFollowing, confirmationEmailSent: false };
    } catch (error) {
      setFollowedOrganizerIds((prev) => (
        currentlyFollowing
          ? [...prev, organizerId]
          : prev.filter((id) => id !== organizerId)
      ));
      throw error;
    }
  }, [followedOrganizerIds, isAuthenticated, hasRemoteFollowings]);

  const isFollowing = React.useCallback(
    (organizerId: string) => followedOrganizerIds.includes(organizerId),
    [followedOrganizerIds]
  );

  const value = React.useMemo<EngagementContextValue>(() => ({
    publicMode,
    isAttendingView,
    canLikeFollow,
    likedEventIds,
    followedOrganizerIds,
    likedCount: likedEventIds.length,
    followingCount: followedOrganizerIds.length,
    setPublicMode,
    toggleLike,
    isLiked,
    toggleFollowing,
    isFollowing,
  }), [
    publicMode,
    isAttendingView,
    canLikeFollow,
    likedEventIds,
    followedOrganizerIds,
    setPublicMode,
    toggleLike,
    isLiked,
    toggleFollowing,
    isFollowing,
  ]);

  return (
    <EngagementContext.Provider value={value}>
      {children}
    </EngagementContext.Provider>
  );
};

export const useEngagement = () => {
  const context = React.useContext(EngagementContext);
  if (!context) {
    throw new Error('useEngagement must be used within EngagementProvider');
  }
  return context;
};
