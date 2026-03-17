
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { EventList } from './views/Public/EventList';
import { CategoryEvents } from './views/Public/CategoryEvents';
import { EventDetails } from './views/Public/EventDetails';
import { RegistrationForm } from './views/Public/RegistrationForm';
import { PaymentStatusView } from './views/Public/PaymentStatus';
import { TicketView } from './views/Public/TicketView';
import { AboutUsPage } from './views/Public/AboutUsPage';
import { ContactUsPage } from './views/Public/ContactUsPage';
import { PublicEventsPage } from './views/Public/PublicEventsPage';
import { LikedEventsPage } from './views/Public/LikedEventsPage';
import { FollowingsEventsPage } from './views/Public/FollowingsEventsPage';
import MyTicketsPage from './views/Public/MyTicketsPage';
import { OrganizerProfilePage } from './views/Public/OrganizerProfile';
import { PricingPage } from './views/Public/PricingPage';
import {
  PrivacyPolicyPage,
  TermsOfServicePage,
  FaqPage,
  RefundPolicyPage
} from './views/Public/InfoPages';
import { LivePage } from './views/Public/LivePage';
import { AdminDashboard } from './views/Admin/Dashboard';
import { EventsManagement } from './views/Admin/EventsManagement';
import { RegistrationsList } from './views/Admin/RegistrationsList';
import { CheckIn } from './views/Admin/CheckIn';
import { ArchiveEvents } from './views/User/ArchiveEvents';
import { OrganizerReports } from './views/User/OrganizerReports';
import { SettingsView } from './views/Admin/Settings';
import { SubscriptionPlans } from './views/Admin/SubscriptionPlans';
import { LoginPerspective } from './views/Auth/Login';
import { SignUpView } from './views/Auth/SignUp';
import { AcceptInvite } from './views/Auth/AcceptInvite';
import { ForgotPassword } from './views/Auth/ForgotPassword';
import { ResetPassword } from './views/Auth/ResetPassword';
import { UserSettings } from './views/User/UserSettings';
import { UserEvents } from './views/User/UserEvents';
import { UserHome } from './views/User/UserHome';
import { OrganizerSubscription } from './views/User/OrganizerSubscription';
import { OrganizerSupport } from './views/User/OrganizerSupport';
import WelcomeView from './views/User/WelcomeView';
import { SubscriptionSuccess } from './views/User/SubscriptionSuccess';
import { ONLINE_LOCATION_VALUE } from './components/BrowseEventsNavigator';
import { ICONS } from './constants';
import { Button, Input, Modal, PageLoader } from './components/Shared';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ToastContainer';
import { apiService } from './services/apiService';
import { UserRole, normalizeUserRole } from './types';
import { supabase } from "./supabase/supabaseClient.js";
import { useUser } from './context/UserContext';
import { useEngagement } from './context/EngagementContext';
const API = import.meta.env.VITE_API_BASE;
const DEFAULT_HEADER_LOCATION = 'Your Location';
const BROWSE_LOCATION_STORAGE_KEY = 'browse_events_location';
const Branding: React.FC<{ className?: string, light?: boolean }> = ({ className = '', light = false }) => (
  <img
    src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg"
    alt="StartupLab Business Ticketing Logo"
    className={`w-40 h-auto drop-shadow-md transform transition-all duration-300 hover:scale-[1.03] cursor-pointer ${className}`}
    style={{ filter: light ? 'invert(1) grayscale(1) brightness(2)' : undefined }}
  />
);


const getRoleLabel = (roleValue: unknown): string => {
  const normalized = String(roleValue || '').toUpperCase();
  if (normalized === UserRole.ADMIN) return 'Admin';
  if (normalized === UserRole.STAFF) return 'Staff';
  if (normalized === 'ATTENDEE') return 'Attendee';
  if (normalized === UserRole.ORGANIZER || normalized === 'USER') return 'Organizer';
  return 'User';
};

/**
 * Enhanced reverse lookup with faster response and better error handling
 */
const reverseLookupCity = async (lat: number, lon: number): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      {
        headers: { 'Accept': 'application/json', 'User-Agent': 'StartupLab-Business-Ticketing' },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const address = payload?.address || {};

    // Prioritize city-like fields
    return (
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.suburb ||
      address.city_district ||
      address.state ||
      payload?.display_name?.split(',')[0] ||
      null
    );
  } catch (err) {
    console.error('GPS Reverse Lookup Error:', err);
    return null;
  }
};

const CrownBadge = () => (
  <div className="absolute -top-1 -right-2 text-[#F59E0B] drop-shadow-sm">
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" />
    </svg>
  </div>
);

const PortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, email, name, imageUrl, isAuthenticated, clearUser, setUser, canViewEvents, canEditEvents, canManualCheckIn, canReceiveNotifications } = useUser();
  const isStaff = role === UserRole.STAFF;
  const [organizerSidebarLogoUrl, setOrganizerSidebarLogoUrl] = React.useState('');
  const [organizerSidebarName, setOrganizerSidebarName] = React.useState('');
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);
  const [nameInput, setNameInput] = React.useState('');
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [profileError, setProfileError] = React.useState('');
  const [profileSuccess, setProfileSuccess] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [notificationOpen, setNotificationOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notificationsLoading, setNotificationsLoading] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = React.useState(true);

  // Fetch notifications for the notification bell
  const fetchNotifications = React.useCallback(async () => {
    if (!isAuthenticated) return;
    // Only fetch for staff if they have permission
    if (role === UserRole.STAFF && canReceiveNotifications === false) return;

    try {
      setNotificationsLoading(true);
      const data = await apiService.getMyNotifications(25);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: any) {
      console.error('Failed to fetch notifications:', err);
      if (err?.message?.includes('401')) {
        clearUser();
        navigate('/login', { replace: true });
      }
    } finally {
      setNotificationsLoading(false);
    }
  }, [isAuthenticated, role, canReceiveNotifications, clearUser, navigate]);

  // Mark a single notification as read
  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await apiService.markNotificationRead(notificationId);
      setNotifications(prev => prev.map(n =>
        n.notificationId === notificationId ? { ...n, isRead: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  // Real-time polling for new notifications (every 30 seconds)
  React.useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch immediately on mount
    fetchNotifications();

    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications]);

  // Also fetch when notification panel opens
  React.useEffect(() => {
    if (notificationOpen && isAuthenticated) {
      fetchNotifications();
    }
  }, [notificationOpen, isAuthenticated, fetchNotifications]);

  const displayName = email?.trim() || name?.trim() || (isStaff ? 'Staff Operative' : 'System Admin');
  const roleLabel = getRoleLabel(role);
  const initials = (email?.split('@')[0] || name?.trim() || displayName || (isStaff ? 'ST' : 'AD'))
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const fetchProfile = async () => {
    try {
      setProfileError('');
      setProfileSuccess('');
      const res = await fetch(`${API}/api/whoAmI`, { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setNameInput(data.name || '');
        setAvatarPreview(data.imageUrl || null);
        setAvatarFile(null);
        const normalizedRole = normalizeUserRole(data?.role);
        if (normalizedRole && data?.email) {
          setUser({
            role: normalizedRole,
            email: data.email,
            name: data.name ?? null,
            imageUrl: data.imageUrl ?? null,
            canViewEvents: data.canViewEvents,
            canEditEvents: data.canEditEvents,
            canManualCheckIn: data.canManualCheckIn,
          });
        }
      }
    } catch { }
  };

  React.useEffect(() => {
    if (profileModalOpen) fetchProfile();
  }, [profileModalOpen]);

  React.useEffect(() => {
    let isMounted = true;
    const loadOrganizerSidebarBrand = async () => {
      if (role !== UserRole.STAFF) {
        if (isMounted) {
          setOrganizerSidebarLogoUrl('');
          setOrganizerSidebarName('');
        }
        return;
      }
      try {
        const organizer = await apiService.getMyOrganizer();
        if (!isMounted) return;
        setOrganizerSidebarLogoUrl(organizer?.profileImageUrl || '');
        setOrganizerSidebarName((organizer?.organizerName || '').trim());
      } catch {
        if (isMounted) {
          setOrganizerSidebarLogoUrl('');
          setOrganizerSidebarName('');
        }
      }
    };
    loadOrganizerSidebarBrand();
    return () => { isMounted = false; };
  }, [role, location.pathname]);

  React.useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    setProfileError(''); setProfileSuccess(''); setProfileLoading(true);
    try {
      const trimmedName = nameInput.trim();
      if (!trimmedName) throw new Error('Name is required.');
      let nextName = trimmedName;
      let nextImageUrl = avatarPreview || imageUrl || null;

      if (avatarFile) {
        const formData = new FormData();
        formData.append('image', avatarFile);
        const res = await fetch(`${API}/api/user/avatar`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to update avatar.');
        }
        const payload = await res.json().catch(() => ({}));
        nextImageUrl = payload.imageUrl || payload.user?.imageUrl || nextImageUrl;
        setAvatarFile(null);
        setAvatarPreview(nextImageUrl || null);
      }

      if (trimmedName !== (name || '')) {
        const res = await fetch(`${API}/api/user/name`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: trimmedName })
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to update name.');
        }
        const payload = await res.json().catch(() => ({}));
        nextName = payload?.name || trimmedName;
        if (!nextImageUrl && payload?.imageUrl) nextImageUrl = payload.imageUrl;
      }

      if (role && email) {
        setUser({
          role,
          email,
          name: nextName,
          imageUrl: nextImageUrl,
          canViewEvents,
          canEditEvents,
          canManualCheckIn,
        });
      }

      setProfileSuccess('Profile updated successfully.');
      setTimeout(() => setProfileModalOpen(false), 800);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const syncSession = async () => {
      const isPortalRoute = ['/dashboard', '/events', '/attendees', '/checkin', '/settings'].includes(location.pathname);
      if (!isPortalRoute) return;

      try {
        const res = await fetch(`${API}/api/whoAmI`, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) {
          clearUser();
          navigate('/login', { replace: true });
          return;
        }
        const me = await res.json().catch(() => null);
        const normalizedRole = normalizeUserRole(me?.role);
        if (!normalizedRole || !me?.email) {
          clearUser();
          navigate('/login', { replace: true });
          return;
        }
        setUser({
          role: normalizedRole,
          email: me.email,
          name: me.name ?? null,
          imageUrl: me.imageUrl ?? null,
          canViewEvents: me.canViewEvents,
          canEditEvents: me.canEditEvents,
          canManualCheckIn: me.canManualCheckIn,
        });
      } catch {
        clearUser();
        navigate('/login', { replace: true });
      }
    };

    syncSession();
  }, [clearUser, location.pathname, navigate, setUser]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!role) return;
    const staffAllowed = ['/events', '/attendees', '/checkin', '/settings'];
    const adminAllowed = ['/dashboard', '/events', '/attendees', '/checkin', '/settings'];
    const userAllowed = ['/user-home', '/my-events', '/user-settings', '/organizer-settings', '/account-settings', '/user/attendees', '/user/checkin', '/user/archive', '/user/reports', '/dashboard', '/organizer-support', '/subscription'];

    if (role === UserRole.ORGANIZER) {
      if (!userAllowed.includes(location.pathname)) {
        navigate('/user-home', { replace: true });
      }
      return;
    }

    const allowed = isStaff ? staffAllowed : adminAllowed;
    if (!allowed.includes(location.pathname)) {
      navigate(isStaff ? '/events' : '/dashboard', { replace: true });
      return;
    }
    if (isStaff) {
      if (location.pathname === '/events' && canViewEvents === false) {
        navigate('/attendees', { replace: true });
      }
      if (location.pathname === '/checkin' && canManualCheckIn === false) {
        navigate('/attendees', { replace: true });
      }
    }
  }, [isAuthenticated, isStaff, location.pathname, navigate, role, canViewEvents, canManualCheckIn]);

  const staffPermsLoaded = role !== UserRole.STAFF || (
    typeof canViewEvents === 'boolean' && typeof canManualCheckIn === 'boolean'
  );
  const noStaffPerms = role === UserRole.STAFF && canViewEvents === false && canManualCheckIn === false;
  const menuItems = (
    !isAuthenticated || !role || !staffPermsLoaded
      ? []
      : role === UserRole.STAFF && canViewEvents === false && canManualCheckIn === false
        ? [
          { label: 'Users', path: '/attendees', icon: <ICONS.Users className="w-6 h-6" /> },
        ]
        : role === UserRole.STAFF
          ? [
            ...(canViewEvents !== false ? [{ label: 'Events', path: '/events', icon: <ICONS.Calendar className="w-6 h-6" /> }] : []),
            { label: 'Users', path: '/attendees', icon: <ICONS.Users className="w-6 h-6" /> },
            ...(canManualCheckIn !== false ? [{ label: 'Scan', path: '/checkin', icon: <ICONS.CheckCircle className="w-6 h-6" /> }] : []),
          ]
          : role === UserRole.ADMIN
            ? [
              { label: 'Dashboard', path: '/dashboard', icon: <ICONS.Layout className="w-6 h-6" /> },
              { label: 'Plans', path: '/settings?tab=plans', icon: <ICONS.Layout className="w-6 h-6" /> },
              { label: 'Team and Access', path: '/settings?tab=team', icon: <ICONS.Users className="w-6 h-6" /> },
              { label: 'Email Settings', path: '/settings?tab=email', icon: <ICONS.Mail className="w-6 h-6" /> },
              { label: 'Payment Settings', path: '/settings?tab=payments', icon: <ICONS.CreditCard className="w-6 h-6" /> },
              { label: 'Support', path: '/settings?tab=support', icon: <ICONS.MessageSquare className="w-6 h-6" /> },
              { label: 'Account Settings', path: '/settings?tab=profile', icon: <ICONS.Settings className="w-6 h-6" />, separator: true },
            ]
            : [
              { label: 'Dashboard', path: '/dashboard', icon: <ICONS.Layout className="w-6 h-6" /> },
              { label: 'Events', path: '/events', icon: <ICONS.Calendar className="w-6 h-6" /> },
              { label: 'Users', path: '/attendees', icon: <ICONS.Users className="w-6 h-6" /> },
              { label: 'Scan', path: '/checkin', icon: <ICONS.CheckCircle className="w-6 h-6" /> },
              { label: 'Charts', path: '/user/reports', icon: <ICONS.BarChart className="w-6 h-6" /> },
              { label: 'Archive', path: '/user/archive', icon: <ICONS.Archive className="w-6 h-6" />, separator: true },
              { label: 'Plans', path: '/settings?tab=plans', icon: <ICONS.Layout className="w-6 h-6" /> },
              { label: 'Team and Access', path: '/settings?tab=team', icon: <ICONS.Users className="w-6 h-6" /> },
              { label: 'Email Settings', path: '/settings?tab=email', icon: <ICONS.Mail className="w-6 h-6" /> },
              { label: 'Payment Settings', path: '/settings?tab=payments', icon: <ICONS.CreditCard className="w-6 h-6" /> },
              { label: 'Support', path: '/organizer-support', icon: <ICONS.MessageSquare className="w-6 h-6" /> },
              { label: 'Account Settings', path: '/settings?tab=profile', icon: <ICONS.Settings className="w-6 h-6" />, separator: true },
            ]
  );

  const checkIsActiveAdmin = (itemPath: string) => {
    if (itemPath.includes('?')) {
      const [base, query] = itemPath.split('?');
      if (location.pathname !== base) return false;
      const tab = new URLSearchParams(query).get('tab');
      const currentTab = new URLSearchParams(location.search).get('tab');
      if (!currentTab && tab === 'team') return true;
      return currentTab === tab;
    }
    return location.pathname === itemPath;
  };


  const handleLogout = async () => {
    try {
      // 1. Call backend logout to clear cookies
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      }).catch(() => {});

      // 2. Sign out from Supabase
      await supabase.auth.signOut().catch(() => {});

      // 3. Clear any local tokens/storage
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (e) {}
      
      clearUser();

      // 4. Navigate to login
      navigate('/');
    } catch {
      // Still navigate to login even if there was an error
      clearUser();
      navigate('/');
    }
  };

  // Bottom Navigation Items for Mobile
  const bottomNavItems = (
    !isAuthenticated || !role || !staffPermsLoaded
      ? []
      : role === UserRole.STAFF && canViewEvents === false && canManualCheckIn === false
        ? [
          { label: 'Attendees', path: '/attendees', icon: <ICONS.Users className="w-5 h-5" /> },
          { label: 'Settings', path: '/settings?tab=profile', icon: <ICONS.Settings className="w-5 h-5" /> },
        ]
        : role === UserRole.STAFF
          ? [
            ...(canViewEvents !== false ? [{ label: 'Events', path: '/events', icon: <ICONS.Calendar className="w-5 h-5" /> }] : []),
            { label: 'Attendees', path: '/attendees', icon: <ICONS.Users className="w-5 h-5" /> },
            ...(canManualCheckIn !== false ? [{ label: 'Check-In', path: '/checkin', icon: <ICONS.CheckCircle className="w-5 h-5" /> }] : []),
            { label: 'Settings', path: '/settings?tab=profile', icon: <ICONS.Settings className="w-5 h-5" /> },
          ]
          : [
            { label: 'Home', path: '/dashboard', icon: <ICONS.Layout className="w-5 h-5" /> },
            { label: 'Events', path: '/events', icon: <ICONS.Calendar className="w-5 h-5" /> },
            { label: 'Attendees', path: '/attendees', icon: <ICONS.Users className="w-5 h-5" /> },
            { label: 'Settings', path: '/settings?tab=profile', icon: <ICONS.Settings className="w-5 h-5" /> },
          ]
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F2F2F2] font-sans selection:bg-[#38BDF2]/30 portal-fast">
      {/* Sidebar for desktop */}
      <aside
        className={`bg-[#F2F2F2] border-r border-[#2E2E2F]/10 hidden md:flex flex-col fixed inset-y-0 left-0 z-30 transition-all duration-300 ease-in-out ${desktopSidebarOpen ? 'w-64' : 'w-20'}`}
        style={{ overflow: desktopSidebarOpen ? 'hidden' : 'visible' }}
      >
        <div className={`py-6 px-4 flex items-center justify-center border-b border-[#2E2E2F]/5 shrink-0 ${desktopSidebarOpen ? 'h-24' : 'h-20'}`}>
          <Link to="/dashboard" className="flex items-center justify-center group transition-all duration-500 transform hover:scale-[1.05] active:scale-[0.95]">
            {organizerSidebarLogoUrl ? (
              <img
                src={organizerSidebarLogoUrl}
                alt={organizerSidebarName || 'Logo'}
                className={desktopSidebarOpen ? "h-14 w-auto max-w-full object-contain" : "h-10 w-10 object-contain rounded-lg shadow-sm border border-[#2E2E2F]/10"}
              />
            ) : desktopSidebarOpen ? (
              <Branding className={role === UserRole.ADMIN ? "h-16 w-auto" : "h-14 w-auto"} />
            ) : (
              <img src="/lgo.webp" alt="Logo" className="h-10 w-10 object-contain" />
            )}
          </Link>
        </div>
        <nav className={`flex-1 py-6 ${desktopSidebarOpen ? 'px-4' : 'px-2'} flex flex-col gap-1 overflow-y-auto overflow-x-visible scrollbar-none scroll-smooth`}
          style={{ width: desktopSidebarOpen ? '100%' : '260px', paddingRight: desktopSidebarOpen ? '0' : '180px' }}>
          {menuItems.map((item: any, idx) => {
            const isActive = checkIsActiveAdmin(item.path);

            return (
              <React.Fragment key={item.path || idx}>
                {item.separator && (
                  <div className={`mx-4 my-3 h-[1px] bg-[#2E2E2F]/5 shrink-0 ${!desktopSidebarOpen ? 'mx-2' : ''}`} />
                )}
                <Link
                  to={item.path}
                  className={`flex transition-all duration-300 group relative shrink-0 ${desktopSidebarOpen
                    ? 'flex-row items-center gap-3 px-4 py-3 rounded-2xl'
                    : 'flex-col items-center justify-center gap-1 py-4 px-1 rounded-xl'
                    } ${isActive
                      ? 'bg-[#38BDF2] text-white shadow-lg shadow-[#38BDF2]/20'
                      : 'text-[#2E2E2F] hover:bg-[#38BDF2]/10 hover:text-[#38BDF2]'
                    }`}
                  title={!desktopSidebarOpen ? item.label : undefined}
                >
                  <div className="relative shrink-0">
                    {React.cloneElement(item.icon as React.ReactElement<any>, {
                      className: `transition-transform duration-300 ${desktopSidebarOpen ? 'w-5 h-5' : 'w-6 h-6 group-hover:scale-110'} ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`
                    })}
                    {item.premium && <CrownBadge />}
                  </div>

                  {desktopSidebarOpen ? (
                    <span className="text-sm font-medium tracking-tight truncate">
                      {item.label}
                    </span>
                  ) : (
                    <div className="absolute left-full ml-5 px-3.5 py-2.5 bg-[#38BDF2] text-white text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 translate-x-[-10px] pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 z-[999] whitespace-nowrap shadow-[10px_0_30px_-10px_rgba(56,189,242,0.5)] flex items-center">
                      <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 border-[6px] border-transparent border-r-[#38BDF2]" />
                      {item.label}
                    </div>
                  )}
                </Link>
              </React.Fragment>
            );
          })}
        </nav>
      </aside>

      <main
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out md:pb-0 ${desktopSidebarOpen ? 'md:pl-64' : 'md:pl-20'} ${bottomNavItems.length > 0 ? 'pb-24' : ''}`}
      >
        <header className="h-20 bg-[#F2F2F2] border-b border-[#2E2E2F]/10 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20 w-full">
          <div className="flex items-center gap-3">
            {/* Desktop Sidebar Toggle */}
            <button
              onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
              className="hidden md:flex p-2.5 rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-all group active:scale-95"
              aria-label="Toggle Sidebar"
            >
              <svg className={`w-5 h-5 transition-transform duration-500 ${!desktopSidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2.5 rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-all group active:scale-95 lg:hidden"
              aria-label="Toggle Navigation Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="hidden sm:block">
              <p className="text-[10px] uppercase font-black text-[#2E2E2F]/50 tracking-[0.2em]">
                {isStaff ? 'Staff Panel' : role === UserRole.ADMIN ? 'Admin Center' : 'Organizer Portal'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 min-w-0">
            {(!(role === UserRole.STAFF && canReceiveNotifications === false)) && (
              <div className="relative group">
                <button
                  className="w-11 h-11 flex items-center justify-center rounded-2xl border border-[#38BDF2]/20 bg-transparent hover:bg-[#38BDF2]/10 hover:border-[#38BDF2]/40 hover:scale-105 active:scale-95 transition-all shadow-sm relative"
                  onClick={() => setNotificationOpen(!notificationOpen)}
                >
                  <ICONS.Bell className="w-5 h-5 text-[#2E2E2F] group-hover:text-[#38BDF2] transition-colors" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 border-2 border-[#F2F2F2] shadow-lg animate-in zoom-in duration-300">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationOpen && (
                  <>
                    <div className="fixed inset-0 z-[100] bg-[#2E2E2F]/10 backdrop-blur-[2px]" onClick={() => setNotificationOpen(false)} />
                    <div className="fixed right-6 top-24 bottom-6 w-full max-w-[420px] bg-[#F2F2F2] rounded-[2.5rem] border border-[#2E2E2F]/5 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.15)] z-[101] flex flex-col overflow-hidden animate-in slide-in-from-right-8 fade-in duration-500">
                      <div className="p-8 border-b border-[#2E2E2F]/5 flex items-start justify-between bg-[#F2F2F2]/80 backdrop-blur-xl sticky top-0 z-10">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-2xl font-black tracking-tight text-[#2E2E2F]">Updates</h2>
                            {unreadCount > 0 && (
                              <span className="bg-red-500/10 text-red-500 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                                {unreadCount} New
                              </span>
                            )}
                          </div>
                          <p className="text-[#2E2E2F]/40 text-xs font-bold uppercase tracking-widest">Stay synchronized with your team</p>
                        </div>
                        <button onClick={() => setNotificationOpen(false)} className="w-10 h-10 rounded-2xl bg-[#F2F2F2] flex items-center justify-center text-[#2E2E2F]/40 hover:text-[#2E2E2F] hover:bg-[#2E2E2F]/5 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto scrollbar-hide py-4">
                        {notificationsLoading && notifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                            <div className="w-12 h-12 border-4 border-[#38BDF2]/20 border-t-[#38BDF2] rounded-full animate-spin mb-4" />
                            <p className="text-[#2E2E2F]/40 text-xs font-black uppercase tracking-widest">Syncing notifications...</p>
                          </div>
                        ) : notifications.length > 0 ? (
                          <div className="px-4 space-y-2">
                            <div className="px-4 py-2 flex justify-between items-center mb-4">
                              <span className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em]">RECENT ACTIVITY</span>
                              <button
                                onClick={handleMarkAllRead}
                                className="text-[10px] font-black text-[#38BDF2] hover:text-[#2E2E2F] uppercase tracking-[0.2em] transition-colors"
                              >
                                Mark all read
                              </button>
                            </div>
                            {notifications.map((n) => (
                              <div
                                key={n.notificationId || Math.random()}
                                className={`p-5 rounded-[2rem] transition-all group relative border ${n.isRead
                                  ? 'bg-transparent border-transparent opacity-60'
                                  : 'bg-[#F2F2F2] border-[#2E2E2F]/5 hover:border-[#38BDF2]/30 shadow-sm'
                                  }`}
                              >
                                <div className="flex items-start gap-4">
                                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${n.isRead ? 'bg-[#2E2E2F]/5 text-[#2E2E2F]/30' : 'bg-[#38BDF2]/10 text-[#38BDF2]'
                                    }`}>
                                    <ICONS.Bell className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <h4 className="text-sm font-black text-[#2E2E2F] tracking-tight truncate">{n.title}</h4>
                                      <span className="text-[9px] text-[#2E2E2F]/30 font-black uppercase tracking-widest whitespace-nowrap ml-2">
                                        {n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Now'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-[#2E2E2F]/60 font-medium leading-relaxed line-clamp-2 mb-3">{n.message}</p>
                                    {!n.isRead && (
                                      <button
                                        onClick={() => handleMarkNotificationRead(n.notificationId)}
                                        className="text-[10px] font-black text-[#38BDF2] uppercase tracking-widest hover:text-[#2E2E2F] transition-colors"
                                      >
                                        Mark as read
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                            <div className="w-24 h-24 bg-[#F2F2F2] rounded-[2rem] flex items-center justify-center mb-8">
                              <ICONS.Bell className="w-10 h-10 text-[#2E2E2F]/10" />
                            </div>
                            <h3 className="text-xl font-black text-[#2E2E2F] tracking-tighter uppercase mb-2">Clean Slate</h3>
                            <p className="text-sm font-medium text-[#2E2E2F]/40 max-w-[240px] leading-relaxed">
                              You're all caught up. We'll alert you when there's news.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Profile Dropdown */}
            <div className="relative">
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] hover:bg-[#38BDF2]/10 transition-colors"
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#38BDF2]/20 text-[#2E2E2F] flex items-center justify-center">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-semibold text-xs text-[#2E2E2F]">{initials}</span>
                  )}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="text-xs font-semibold text-[#2E2E2F] truncate max-w-[120px]">{displayName}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#2E2E2F]/45 mt-0.5">{roleLabel}</p>
                </div>
                <svg className="w-4 h-4 text-[#2E2E2F]/50" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+8px)] w-56 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-2xl shadow-[0_10px_40px_-10px_rgba(46,46,47,0.1)] z-50 p-2 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                    <div className="px-4 py-3 border-b border-[#2E2E2F]/5 mb-1">
                      <p className="text-[10px] font-medium text-[#2E2E2F]/40 uppercase tracking-widest mb-0.5">Account</p>
                      <p className="text-xs font-semibold text-[#2E2E2F] truncate">{displayName}</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#2E2E2F]/45 mt-1">{roleLabel}</p>
                    </div>
                    {role !== UserRole.STAFF && (
                      <>
                        <button
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                          onClick={() => {
                            navigate('/settings?tab=team');
                            setUserMenuOpen(false);
                          }}
                        >
                          <ICONS.Users className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                          <span>Teams & Access</span>
                        </button>
                        <button
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                          onClick={() => {
                            navigate('/settings?tab=plans');
                            setUserMenuOpen(false);
                          }}
                        >
                          <ICONS.Layout className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                          <span>Subscription Plans</span>
                        </button>
                        <button
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                          onClick={() => {
                            navigate('/settings?tab=email');
                            setUserMenuOpen(false);
                          }}
                        >
                          <ICONS.Mail className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                          <span>Email Setup</span>
                        </button>
                        <button
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                          onClick={() => {
                            navigate('/settings?tab=support');
                            setUserMenuOpen(false);
                          }}
                        >
                          <ICONS.MessageSquare className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                          <span>Support Tickets</span>
                        </button>
                      </>
                    )}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                      onClick={() => {
                        navigate('/settings?tab=profile');
                        setUserMenuOpen(false);
                      }}
                    >
                      <ICONS.Settings className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                      <span>Profile & Security</span>
                    </button>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#2E2E2F]/70 hover:bg-red-50 hover:text-red-500 transition-colors text-left group"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                    >
                      <svg className="w-4 h-4 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        {/* Mobile Navigation Drawer - Hamburger Menu Items */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-[100] flex md:hidden">
            <div className="fixed inset-0 bg-[#2E2E2F]/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-72 bg-[#F2F2F2] flex flex-col h-full z-[110] animate-in slide-in-from-left duration-300 border-r border-[#2E2E2F]/10">
              <div className="p-6 flex items-center justify-between border-b border-[#2E2E2F]/5">
                <Link to="/dashboard" className="flex items-center justify-center group transition-all duration-500">
                  {organizerSidebarLogoUrl ? (
                    <img src={organizerSidebarLogoUrl} alt={organizerSidebarName || 'Logo'} className="h-10 w-auto max-w-full object-contain" />
                  ) : (
                    <img src="/lgo.webp" alt="Logo" className="h-10 w-10 object-contain" />
                  )}
                </Link>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#2E2E2F]/5 text-[#2E2E2F] hover:bg-[#2E2E2F]/10 transition-colors"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close navigation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                  const isActive = checkIsActiveAdmin(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${isActive
                        ? 'bg-[#38BDF2] text-white shadow-lg shadow-[#38BDF2]/20'
                        : 'text-[#2E2E2F] hover:bg-[#38BDF2]/10 hover:text-[#38BDF2]'
                        }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <div className={isActive ? 'text-white' : 'text-[#2E2E2F]'}>
                        {React.cloneElement(item.icon as React.ReactElement<any>, {
                          className: `w-5 h-5 transition-transform duration-300 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`
                        })}
                      </div>
                      <span className="text-sm font-medium tracking-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Removed: Mobile Bottom Navigation Bar - Now using drawer instead */}

        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {(noStaffPerms && location.pathname !== '/attendees') ? (
              <div className="flex flex-col items-center justify-center min-h-[40vh]">
                <div className="text-2xl font-black text-[#2E2E2F] mb-4">No Access</div>
                <div className="text-[#2E2E2F]/70 text-lg font-medium text-center">You do not have access to any features. Please contact your administrator.</div>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
        <Modal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          title="Edit Profile"
          subtitle="Update your profile"
          size="sm"
        >
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#2E2E2F]/10 bg-[#F2F2F2] flex items-center justify-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-black text-sm text-[#2E2E2F]">{initials}</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="px-4 py-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? 'Change Photo' : 'Upload Photo'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>
            <Input
              label="Your Name"
              value={nameInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNameInput(e.target.value)}
            />
            {profileError && <p className="text-xs text-[#2E2E2F] font-bold">{profileError}</p>}
            {profileSuccess && <p className="text-xs text-[#2E2E2F] font-bold">{profileSuccess}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setProfileModalOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSaveProfile} disabled={profileLoading || !nameInput.trim()}>
                {profileLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
};

const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { role, email, name, imageUrl, isAuthenticated, clearUser, setUser, canReceiveNotifications } = useUser();
  const {
    publicMode,
    isAttendingView,
    setPublicMode,
  } = useEngagement();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);
  const [headerSearchTerm, setHeaderSearchTerm] = React.useState('');
  const [animatedPlaceholder, setAnimatedPlaceholder] = React.useState('');
  const fullPlaceholder = 'Find your events';
  const [headerLocationTerm, setHeaderLocationTerm] = React.useState(DEFAULT_HEADER_LOCATION);
  const [headerLocationMenuOpen, setHeaderLocationMenuOpen] = React.useState(false);
  const [headerLocating, setHeaderLocating] = React.useState(false);
  const [headerLocationError, setHeaderLocationError] = React.useState('');
  const headerLocationMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [hasLiveEvents, setHasLiveEvents] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    const isEmbeddableVideo = (url: string) => {
      if (!url || !url.trim()) return false;
      const n = url.startsWith('http') ? url : `https://${url}`;
      return /youtube\.com|youtu\.be/.test(n) || /facebook\.com|fb\.watch|fb\.com/.test(n) || /vimeo\.com/.test(n);
    };
    const checkLive = async () => {
      try {
        const live = await apiService.getLiveEvents();
        const now = new Date();
        const videoLive = (live || []).filter(e => {
          if (!isEmbeddableVideo(e.streaming_url || '')) return false;
          const start = new Date(e.startAt);
          const end = e.endAt ? new Date(e.endAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
          return now >= start && now <= end;
        });
        setHasLiveEvents(videoLive.length > 0);
      } catch (err) {
        console.error('Failed to check live status:', err);
      }
    };
    checkLive();
    const interval = setInterval(checkLive, 60000);
    return () => clearInterval(interval);
  }, []);
  const isOrganizer = isAuthenticated && role === UserRole.ORGANIZER;
  const publicMenuMode = isOrganizer ? publicMode : 'attending';
  const showHeaderSearchBar = !isAuthenticated || !isOrganizer || isAttendingView;

  // Typing animation for search placeholder
  React.useEffect(() => {
    const text = 'Find your events';
    let index = 0;
    let isDeleting = false;
    let timer: NodeJS.Timeout;

    const type = () => {
      if (isDeleting) {
        setAnimatedPlaceholder(text.substring(0, index - 1));
        index--;
        if (index === 0) {
          isDeleting = false;
          timer = setTimeout(type, 500);
        } else {
          timer = setTimeout(type, 50);
        }
      } else {
        setAnimatedPlaceholder(text.substring(0, index + 1));
        index++;
        if (index === text.length) {
          isDeleting = true;
          timer = setTimeout(type, 2000);
        } else {
          timer = setTimeout(type, 100);
        }
      }
    };

    type();
    return () => clearTimeout(timer);
  }, []);

  const displayName = email?.trim() || name?.trim() || 'User';
  const roleLabel = isOrganizer && isAttendingView ? 'Attending' : getRoleLabel(role);
  const publicUserMenuActionClass = 'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium tracking-tight text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group';
  const landingLoginButtonClass = 'px-4 text-[11px] font-black uppercase tracking-widest !bg-transparent !text-[#2E2E2F] hover:!text-[#38BDF2] transition-colors';
  const landingGetStartedButtonClass = 'px-6 text-[11px] font-black uppercase tracking-widest border border-[#66DBFF] bg-[#00AEEF] text-white shadow-[0_0_16px_rgba(0,174,239,0.45)] hover:bg-black hover:border-black hover:text-white hover:shadow-[0_0_22px_rgba(0,174,239,0.5)] focus-visible:bg-black focus-visible:border-black focus-visible:shadow-[0_0_22px_rgba(0,174,239,0.5)] transition-all duration-300 ease-out active:scale-95';
  const initials = (email?.split('@')[0] || name?.trim() || displayName || 'U')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Sync session for logged-in users visiting public pages
  React.useEffect(() => {
    const syncPublicSession = async () => {
      try {
        const res = await fetch(`${API}/api/whoAmI`, { credentials: 'include', cache: 'no-store' });
        if (res.ok) {
          const me = await res.json().catch(() => null);
          const normalizedRole = normalizeUserRole(me?.role);
          if (normalizedRole && me?.email) {
            setUser({
              role: normalizedRole,
              email: me.email,
              name: me.name ?? null,
              imageUrl: me.imageUrl ?? null,
              canViewEvents: me.canViewEvents,
              canEditEvents: me.canEditEvents,
              canManualCheckIn: me.canManualCheckIn,
            });
          }
        }
      } catch { }
    };
    syncPublicSession();
  }, []);

  React.useEffect(() => {
  }, [location.pathname]);

  React.useEffect(() => {
    if (!headerLocationMenuOpen) return;

    const handleOutside = (event: MouseEvent) => {
      if (!headerLocationMenuRef.current) return;
      if (!headerLocationMenuRef.current.contains(event.target as Node)) {
        setHeaderLocationMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHeaderLocationMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [headerLocationMenuOpen]);

  React.useEffect(() => {
    if (!headerLocationMenuOpen) return;
  }, [headerLocationMenuOpen, headerLocationTerm]);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryLocation = (params.get('location') || '').trim();
    const storedLocation =
      typeof window === 'undefined'
        ? ''
        : (localStorage.getItem(BROWSE_LOCATION_STORAGE_KEY) || '').trim();

    setHeaderSearchTerm(params.get('search') || '');
    setHeaderLocationTerm(queryLocation || storedLocation || DEFAULT_HEADER_LOCATION);
  }, [location.search]);

  const handleLogout = async () => {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
      await supabase.auth.signOut();
      localStorage.removeItem('sb-ddkkbtijqrgpitncxylx-auth-token');
      clearUser();
      navigate('/');
    } catch {
      clearUser();
      navigate('/');
    }
  };

  const handleHeaderSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedSearch = headerSearchTerm.trim();
    const trimmedLocation = headerLocationTerm.trim();
    const hasExplicitLocation =
      trimmedLocation &&
      trimmedLocation.toLowerCase() !== DEFAULT_HEADER_LOCATION.toLowerCase();

    const params = new URLSearchParams();

    if (trimmedSearch) params.set('search', trimmedSearch);
    if (hasExplicitLocation) {
      params.set('location', trimmedLocation);
    }

    const query = params.toString();
    navigate(`/browse-events${query ? `?${query}` : ''}`);
  };

  const handleSelectHeaderLocation = (value: string) => {
    setHeaderLocationTerm(value);
    setHeaderLocationError('');
    setHeaderLocationMenuOpen(false);

    // If we're on browse-events or if user picks a specific location, trigger search
    const trimmedSearch = headerSearchTerm.trim();
    const hasExplicitLocation = value && value !== DEFAULT_HEADER_LOCATION && value !== ONLINE_LOCATION_VALUE;

    const params = new URLSearchParams();
    if (trimmedSearch) params.set('search', trimmedSearch);
    if (hasExplicitLocation) params.set('location', value);
    else if (value === ONLINE_LOCATION_VALUE) params.set('location', ONLINE_LOCATION_VALUE);

    const query = params.toString();
    navigate(`/browse-events${query ? `?${query}` : ''}`);
  };


  const handleUseCurrentLocationInHeader = async () => {
    if (!navigator.geolocation) {
      setHeaderLocationError('Geolocation is not supported on this browser.');
      setHeaderLocationMenuOpen(true);
      return;
    }

    setHeaderLocating(true);
    setHeaderLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const city = await reverseLookupCity(position.coords.latitude, position.coords.longitude);
          if (!city) {
            setHeaderLocationError('Could not detect city. Please try again.');
            setHeaderLocationMenuOpen(true);
            return;
          }
          handleSelectHeaderLocation(city);
        } finally {
          setHeaderLocating(false);
        }
      },
      (error) => {
        setHeaderLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setHeaderLocationError('Location permission denied.');
          setHeaderLocationMenuOpen(true);
          return;
        }
        setHeaderLocationError('Unable to get your location.');
        setHeaderLocationMenuOpen(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const secondaryLinks: any[] = [];
  const navLinks = secondaryLinks;
  const trimmedHeaderSearch = headerSearchTerm.trim();
  const trimmedHeaderLocation = headerLocationTerm.trim();
  const hasHeaderExplicitLocation = Boolean(
    trimmedHeaderLocation &&
    trimmedHeaderLocation.toLowerCase() !== DEFAULT_HEADER_LOCATION.toLowerCase()
  );
  const canSubmitHeaderSearch = Boolean(trimmedHeaderSearch || hasHeaderExplicitLocation);

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F2]">
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-[#F2F2F2] shadow-[0_10px_30px_-10px_rgba(46,46,47,0.1)] border-b border-[#2E2E2F]/5' 
          : 'bg-transparent border-b border-transparent'
      }`}>
        {/* Top Row Container - Logo + Menu Button */}
        <div className="max-w-[88rem] mx-auto w-full px-2 sm:px-6 flex flex-col lg:flex-row items-center gap-2 sm:gap-4">
          {/* Mobile Row - Logo (left) + Burger Menu (right) */}
          <div className="h-16 sm:h-20 lg:hidden w-full flex items-center justify-between">
            {/* Left: Logo */}
            <Link to="/" className="shrink-0 flex items-center gap-3">
              <Branding />
            </Link>

            {/* Right: Mobile Menu Button */}
            <button
              className="p-2 rounded-lg text-[#2E2E2F] hover:bg-[#38BDF2]/10 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Desktop Row - Logo (left) + Search (center) + Auth (right) */}
          <div className="hidden lg:flex h-20 w-full items-center lg:gap-4">
            {/* Left: Logo */}
            <div className="flex flex-none items-center">
              <Link to="/" className="shrink-0 flex items-center gap-3">
                <span>
                  <Branding />
                </span>
              </Link>
            </div>

            {/* Center: Search bar (hidden on mobile, shown on lg) - Expands to push login right */}
            <div className="hidden lg:flex flex-1 min-w-0 px-1 sm:px-4">
              {showHeaderSearchBar && (
                <form onSubmit={handleHeaderSearchSubmit} className="w-full">
                  <div className="flex items-center h-12 rounded-2xl border border-[#2E2E2F]/10 bg-[#F2F2F2] overflow-hidden shadow-[0_10px_30px_-15px_rgba(46,46,47,0.1)] focus-within:border-[#38BDF2]/50 focus-within:shadow-[0_15px_35px_-12px_rgba(56,189,242,0.15)] transition-all duration-300">
                    <label className="flex items-center gap-3 px-5 py-3 min-w-0 flex-1 border-r border-[#2E2E2F]/5 hover:bg-[#38BDF2]/5 transition-colors">
                      <ICONS.Search className="w-4 h-4 text-[#2E2E2F] shrink-0" />
                      <input
                        type="text"
                        value={headerSearchTerm}
                        onChange={(event) => setHeaderSearchTerm(event.target.value)}
                        placeholder={animatedPlaceholder || 'Find your events'}
                        className="w-full bg-transparent text-[12px] font-bold text-[#2E2E2F] placeholder:text-[#2E2E2F]/40 outline-none"
                      />
                    </label>
                    <div
                      className="relative min-w-0 flex-1 border-r border-[#2E2E2F]/5 bg-[#F2F2F2] hover:bg-[#38BDF2]/5 transition-colors"
                      ref={headerLocationMenuRef}
                    >
                      <div className="w-full h-full flex items-center">
                        <div className="flex-1 min-w-0 flex items-center gap-3 px-5 py-3 cursor-text" onClick={() => setHeaderLocationMenuOpen(true)}>
                          <ICONS.MapPin className="w-4 h-4 text-[#2E2E2F] shrink-0" />
                          <input
                            type="text"
                            value={hasHeaderExplicitLocation ? headerLocationTerm : ''}
                            onChange={(event) => {
                              const next = event.target.value;
                              setHeaderLocationTerm(next || DEFAULT_HEADER_LOCATION);
                              setHeaderLocationError('');
                            }}
                            onFocus={() => setHeaderLocationMenuOpen(true)}
                            placeholder="Your Location"
                            className="w-full bg-transparent text-[12px] font-bold text-[#2E2E2F] placeholder:text-[#2E2E2F]/40 outline-none"
                            aria-label="Search location"
                          />
                        </div>
                        <button
                          type="button"
                          className={`w-11 h-11 flex items-center justify-center transition-all ${headerLocating
                            ? 'text-[#38BDF2] animate-pulse'
                            : 'text-[#2E2E2F]/40 hover:text-[#38BDF2] hover:bg-[#38BDF2]/8'
                            } rounded-xl mr-1 group/gps`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUseCurrentLocationInHeader();
                          }}
                          disabled={headerLocating}
                          title="Search near me"
                        >
                          {headerLocating ? (
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full inline-block animate-spin" />
                          ) : (
                            <div className="relative">
                              <svg fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" className="w-5 h-5 group-hover/gps:scale-110 transition-transform">
                                <circle cx="12" cy="12" r="3" />
                                <path strokeLinecap="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                              </svg>
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#38BDF2] rounded-full opacity-0 group-hover/gps:opacity-100 transition-opacity animate-ping" />
                            </div>
                          )}
                        </button>
                      </div>

                      {headerLocationMenuOpen && (
                        <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-50 w-[320px] rounded-2xl border border-[#2E2E2F]/10 bg-white shadow-[0_24px_48px_-20px_rgba(46,46,47,0.35)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <button
                            type="button"
                            className="w-full px-5 py-4 flex items-center gap-4 text-left text-[#2E2E2F] hover:bg-[#38BDF2]/5 transition-colors border-b border-[#2E2E2F]/5 disabled:opacity-60 group/btn"
                            onClick={(e) => {
                              e.preventDefault();
                              handleUseCurrentLocationInHeader();
                            }}
                            disabled={headerLocating}
                          >
                            <div className={`w-10 h-10 rounded-full border border-[#38BDF2]/30 flex items-center justify-center text-[#38BDF2] group-hover/btn:bg-[#38BDF2] group-hover/btn:text-[#F2F2F2] transition-all shadow-sm ${headerLocating ? 'animate-pulse' : ''}`}>
                              {headerLocating ? (
                                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full inline-block animate-spin" />
                              ) : (
                                <svg fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" className="w-5 h-5">
                                  <circle cx="12" cy="12" r="3" />
                                  <path strokeLinecap="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                                </svg>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-[#2E2E2F]">Detect My Location</span>
                              <span className="text-[10px] text-[#2E2E2F]/40 font-bold uppercase tracking-wider">Fast GPS Search</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            className="w-full px-5 py-3 flex items-center gap-4 text-left text-[#2E2E2F]/60 hover:bg-[#38BDF2]/5 transition-colors border-b border-[#2E2E2F]/5"
                            onClick={() => handleSelectHeaderLocation('online')}
                          >
                            <div className="w-10 h-10 rounded-full border border-[#38BDF2]/30 flex items-center justify-center text-[#38BDF2]">
                              <ICONS.Globe className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-[#2E2E2F]">Online Events</span>
                              <span className="text-[10px] text-[#2E2E2F]/40 font-bold uppercase tracking-wider">Virtual Experiences</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            className="w-full px-5 py-3 flex items-center gap-4 text-left text-[#2E2E2F]/60 hover:bg-red-50 hover:text-red-500 transition-colors group/reset"
                            onClick={() => handleSelectHeaderLocation(DEFAULT_HEADER_LOCATION)}
                          >
                            <div className="w-10 h-10 rounded-full border border-current opacity-20 flex items-center justify-center transition-opacity group-hover/reset:opacity-100">
                              <ICONS.Trash className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black uppercase tracking-widest">Clear Location</span>
                              <span className="text-[9px] font-bold opacity-70">Reset to all areas</span>
                            </div>
                          </button>

                          {headerLocationError && (
                            <div className="px-5 py-3 text-[11px] font-bold text-red-500 bg-red-50 border-t border-red-100 flex items-center gap-2">
                              <ICONS.AlertTriangle className="w-3.5 h-3.5" />
                              {headerLocationError}
                            </div>
                          )}

                          <div className="px-5 py-4 bg-[#F8F9FA] border-t border-[#2E2E2F]/5">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#2E2E2F]/30 italic leading-relaxed">Tip: Type any city name in the input field above for custom filtering.</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="w-12 h-11 flex items-center justify-center transition-colors text-[#2E2E2F] hover:bg-[#38BDF2]/12 hover:text-[#38BDF2]"
                      aria-label="Find events"
                    >
                      <ICONS.Search className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Right Segment: Nav Links, Mobile Menu Button, and Auth Actions - Top Row */}
            <div className="flex items-center justify-end gap-4 lg:gap-6 ml-auto flex-none">
              {/* Nav Links */}
              <div className="hidden lg:flex items-center gap-8">
                {navLinks.map((link: any) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="text-[11px] font-black uppercase tracking-[0.15em] text-[#2E2E2F]/60 hover:text-[#38BDF2] transition-colors relative group whitespace-nowrap"
                  >
                    {link.label}
                    {link.isLive && (
                      <span className="relative flex h-2 w-2 ml-1 inline-block -top-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    )}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#38BDF2] transition-all group-hover:w-full" />
                  </Link>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0">
              {isAuthenticated ? (
                <>
                  <Link to="/live" className="hidden lg:flex items-center gap-2 px-6 py-2.5 bg-[#38BDF2] border border-[#38BDF2] text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-[#38BDF2]/20">
                    Watch Live
                    {hasLiveEvents && (
                      <span className="relative flex h-2 w-2 ml-0.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                      </span>
                    )}
                  </Link>

                  <div className="relative">
                    <button
                      className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] hover:bg-[#38BDF2]/10 transition-colors"
                      onClick={() => setUserMenuOpen((v) => !v)}
                    >
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#38BDF2]/20 text-[#2E2E2F] flex items-center justify-center">
                        {imageUrl ? (
                          <img src={imageUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-medium tracking-tight text-[#2E2E2F]">{initials}</span>
                        )}
                      </div>
                      <div className="hidden sm:block text-left leading-tight">
                        <p className="text-xs font-medium tracking-tight text-[#2E2E2F] truncate max-w-[120px]">{displayName}</p>
                        <p className="text-[10px] font-medium tracking-tight text-[#2E2E2F]/45 mt-0.5">{roleLabel}</p>
                      </div>
                      <svg className="w-4 h-4 text-[#2E2E2F]/50" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {userMenuOpen && (
                      <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-[calc(100%+8px)] w-56 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-2xl shadow-xl z-50 p-2 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                        <div className="px-4 py-3 border-b border-[#2E2E2F]/5 mb-1">
                          <p className="text-[10px] font-medium tracking-tight text-[#2E2E2F]/40 mb-0.5">Account</p>
                          <p className="text-xs font-medium tracking-tight text-[#2E2E2F] truncate">{displayName}</p>
                          <p className="text-[10px] font-medium tracking-tight text-[#2E2E2F]/45 mt-1">{roleLabel}</p>
                        </div>
                        {isOrganizer ? (
                          isAttendingView ? (
                            <>
                              <button
                                className={publicUserMenuActionClass}
                                onClick={() => {
                                  setPublicMode('attending');
                                  setUserMenuOpen(false);
                                  navigate('/browse-events');
                                }}
                              >
                                <ICONS.Calendar className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                <span>Browse Events</span>
                              </button>
                              <button
                                className={publicUserMenuActionClass}
                                onClick={() => {
                                  setPublicMode('attending');
                                  setUserMenuOpen(false);
                                  navigate('/my-tickets');
                                }}
                              >
                                <ICONS.Ticket className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                <span>My Tickets</span>
                              </button>
                              <button
                                className={publicUserMenuActionClass}
                                onClick={() => {
                                  setPublicMode('organizer');
                                  setUserMenuOpen(false);
                                  navigate('/my-events');
                                }}
                              >
                                <ICONS.Users className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                <span>Organize Events</span>
                              </button>
                              <button
                                className={publicUserMenuActionClass}
                                onClick={() => {
                                  setPublicMode('attending');
                                  setUserMenuOpen(false);
                                  navigate('/liked');
                                }}
                              >
                                <ICONS.Heart className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                <span>Liked</span>
                              </button>
                              <button
                                className={publicUserMenuActionClass}
                                onClick={() => {
                                  setPublicMode('attending');
                                  setUserMenuOpen(false);
                                  navigate('/followings');
                                }}
                              >
                                <ICONS.Users className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                <span>Followings</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className={publicUserMenuActionClass}
                                onClick={() => {
                                  setPublicMode('organizer');
                                  setUserMenuOpen(false);
                                  navigate('/user-settings?tab=organizer');
                                }}
                              >
                                <ICONS.Users className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                <span>Organizer Profile</span>
                              </button>
                              <button
                                className={publicUserMenuActionClass}
                                onClick={() => {
                                  setPublicMode('organizer');
                                  setUserMenuOpen(false);
                                  navigate('/user-settings?tab=team');
                                }}
                              >
                                <ICONS.Shield className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                <span>Team & Access</span>
                              </button>
                              <button
                                className={publicUserMenuActionClass}
                                onClick={() => {
                                  setPublicMode('organizer');
                                  setUserMenuOpen(false);
                                  navigate('/user-settings?tab=email');
                                }}
                              >
                                <ICONS.Mail className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                <span>Email Settings</span>
                              </button>
                              <button
                                className={publicUserMenuActionClass}
                                onClick={() => {
                                  setPublicMode('organizer');
                                  setUserMenuOpen(false);
                                  navigate('/user-settings?tab=payments');
                                }}
                              >
                                <ICONS.CreditCard className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                <span>Payment Gateway</span>
                              </button>
                              <button
                                className={publicUserMenuActionClass}
                                onClick={() => {
                                  setPublicMode('organizer');
                                  setUserMenuOpen(false);
                                  navigate('/user-settings?tab=account');
                                }}
                              >
                                <ICONS.Settings className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                <span>Account</span>
                              </button>
                            </>
                          )
                        ) : (
                          <>
                            <button
                              className={publicUserMenuActionClass}
                              onClick={() => { setUserMenuOpen(false); navigate('/browse-events'); }}
                            >
                              <ICONS.Calendar className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                              <span>Browse Events</span>
                            </button>
                            <button
                              className={publicUserMenuActionClass}
                              onClick={() => { setUserMenuOpen(false); navigate('/my-tickets'); }}
                            >
                              <ICONS.Ticket className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                              <span>My Tickets</span>
                            </button>
                            <button
                              className={publicUserMenuActionClass}
                              onClick={() => { setUserMenuOpen(false); navigate('/liked'); }}
                            >
                              <ICONS.Heart className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                              <span>Liked</span>
                            </button>
                            <button
                              className={publicUserMenuActionClass}
                              onClick={() => { setUserMenuOpen(false); navigate('/followings'); }}
                            >
                              <ICONS.Users className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                              <span>Followings</span>
                            </button>
                          </>
                        )}
                        <div className="border-t border-[#2E2E2F]/5 mt-1 pt-1">
                          <button
                            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium tracking-tight text-[#2E2E2F]/70 hover:bg-red-50 hover:text-red-500 transition-colors text-left group"
                            onClick={() => {
                              setUserMenuOpen(false);
                              handleLogout();
                            }}
                          >
                            <svg className="w-4 h-4 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Logout</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className={`hidden lg:flex ${landingLoginButtonClass}`}>
                  Login
                </Link>
                <Link to="/live" className="hidden lg:flex items-center gap-2 px-6 py-2.5 bg-[#38BDF2] border border-[#38BDF2] text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-[#38BDF2]/20">
                  Watch Live
                  {hasLiveEvents && (
                    <span className="relative flex h-2 w-2 ml-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                    </span>
                  )}
                </Link>
              </>
            )}
            </div>
          </div>
        </div>

          {/* Bottom Row: Mobile Search (only visible on mobile) */}
          <div className="lg:hidden w-full px-2 sm:px-6 py-3 border-t border-[#2E2E2F]/5">
            {showHeaderSearchBar && (
              <form onSubmit={handleHeaderSearchSubmit} className="w-full">
                <div className="flex items-center h-12 rounded-full border border-[#2E2E2F]/10 bg-[#F2F2F2] overflow-hidden shadow-sm focus-within:border-[#38BDF2]/50 focus-within:shadow-[0_0_0_3px_rgba(56,189,242,0.1)] transition-all">
                  <label className="flex items-center gap-3 px-4 py-3 min-w-0 flex-1">
                    <ICONS.Search className="w-4 h-4 text-[#2E2E2F] shrink-0" />
                    <input
                      type="text"
                      value={headerSearchTerm}
                      onChange={(event) => setHeaderSearchTerm(event.target.value)}
                      placeholder={animatedPlaceholder || 'Find your events'}
                      className="w-full bg-transparent text-sm font-semibold text-[#2E2E2F] placeholder:text-[#2E2E2F]/40 outline-none"
                    />
                  </label>
                  <button
                    type="submit"
                    className="px-3 py-3 flex items-center justify-center transition-colors text-[#2E2E2F] hover:text-[#38BDF2]"
                    aria-label="Search"
                  >
                    <ICONS.Search className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </header>
      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/30 z-[95]" onClick={() => setMobileMenuOpen(false)} />
          <div className="lg:hidden fixed top-20 right-0 w-64 bg-[#F2F2F2] border-none shadow-sm z-[100] animate-in slide-in-from-top-2 duration-200 max-h-[calc(100vh-80px)] overflow-y-auto">
            
            {/* Mobile Search Bar - Hidden */}
            {showHeaderSearchBar && (
              <form onSubmit={handleHeaderSearchSubmit} className="w-full hidden">
              <div className="flex items-center h-12 rounded-xl border border-[#2E2E2F]/10 bg-white overflow-hidden">
                <label className="flex items-center gap-2 px-3 min-w-0 flex-1">
                  <ICONS.Search className="w-4 h-4 text-[#2E2E2F]/50 shrink-0" />
                  <input
                    type="text"
                    value={headerSearchTerm}
                    onChange={(event) => setHeaderSearchTerm(event.target.value)}
                    placeholder="Find your events"
                    className="w-full bg-transparent text-sm text-[#2E2E2F] placeholder:text-[#2E2E2F]/40 outline-none"
                  />
                </label>
                <button
                  type="submit"
                  className="w-10 h-10 flex items-center justify-center text-[#2E2E2F]/50 hover:text-[#38BDF2] transition-colors"
                  aria-label="Search"
                >
                  <ICONS.Search className="w-4 h-4" />
                </button>
              </div>
            </form>
            )}

            {/* Mobile Nav Links - Hidden */}
            <nav className="hidden flex flex-col gap-1">
            {navLinks.map((link: any) => (
              <Link
                key={link.path}
                to={link.path}
                className="px-4 py-3 text-sm font-semibold text-[#2E2E2F] hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] rounded-xl transition-colors flex items-center justify-between"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
                {link.isLive && (
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Mobile Auth Buttons Dropdown */}
          <div className="flex flex-col gap-0 py-0 px-0 bg-transparent overflow-hidden">
            {!isAuthenticated ? (
              <>
                <Link 
                  to="/live" 
                  className="flex items-center gap-3 px-4 py-3 text-[#38BDF2] hover:bg-white transition-colors text-xs font-semibold w-full"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>▶</span>
                  <span>Watch Live</span>
                  {hasLiveEvents && (
                    <span className="relative flex h-2 w-2 ml-auto">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                    </span>
                  )}
                </Link>
                <Link 
                  to="/login" 
                  className="flex items-center gap-3 px-4 py-3 text-[#2E2E2F] hover:bg-white transition-colors text-xs font-semibold w-full border-t border-[#2E2E2F]/5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Login</span>
                </Link>
              </>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-[#2E2E2F]/5">
                  <p className="text-[9px] font-medium text-[#2E2E2F]/40 uppercase tracking-wider mb-0.5">Account</p>
                  <p className="text-xs font-semibold text-[#2E2E2F] truncate">{displayName}</p>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#2E2E2F]/45 mt-1">Attending</p>
                </div>
                
                <Link 
                  to="/browse-events"
                  className="flex items-center gap-3 px-4 py-3 text-[#2E2E2F]/70 hover:bg-white hover:text-[#2E2E2F] transition-colors text-left group text-xs font-semibold w-full border-t border-[#2E2E2F]/5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ICONS.Calendar className="w-4 h-4 opacity-70 group-hover:opacity-100 shrink-0" />
                  <span>Browse Events</span>
                </Link>
                <Link 
                  to="/my-tickets"
                  className="flex items-center gap-3 px-4 py-3 text-[#2E2E2F]/70 hover:bg-white hover:text-[#2E2E2F] transition-colors text-left group text-xs font-semibold w-full border-t border-[#2E2E2F]/5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ICONS.Ticket className="w-4 h-4 opacity-70 group-hover:opacity-100 shrink-0" />
                  <span>My Tickets</span>
                </Link>
                
                {isOrganizer && (
                  <Link 
                    to="/user-settings?tab=events"
                    className="flex items-center gap-3 px-4 py-3 text-[#2E2E2F]/70 hover:bg-white hover:text-[#2E2E2F] transition-colors text-left group text-xs font-semibold w-full border-t border-[#2E2E2F]/5"
                    onClick={() => {
                      setPublicMode('organizer');
                      setMobileMenuOpen(false);
                    }}
                  >
                    <ICONS.Zap className="w-4 h-4 opacity-70 group-hover:opacity-100 shrink-0" />
                    <span>Organize Events</span>
                  </Link>
                )}
                
                <Link 
                  to="/liked"
                  className="flex items-center gap-3 px-4 py-3 text-[#2E2E2F]/70 hover:bg-white hover:text-[#2E2E2F] transition-colors text-left group text-xs font-semibold w-full border-t border-[#2E2E2F]/5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ICONS.Heart className="w-4 h-4 opacity-70 group-hover:opacity-100 shrink-0" />
                  <span>Liked</span>
                </Link>
                
                <Link 
                  to="/followings"
                  className="flex items-center gap-3 px-4 py-3 text-[#2E2E2F]/70 hover:bg-white hover:text-[#2E2E2F] transition-colors text-left group text-xs font-semibold w-full border-t border-[#2E2E2F]/5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <ICONS.Users className="w-4 h-4 opacity-70 group-hover:opacity-100 shrink-0" />
                  <span>Followings</span>
                </Link>
                
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-[#2E2E2F]/70 hover:bg-red-50 hover:text-red-500 transition-colors text-left group text-xs font-semibold border-t border-[#2E2E2F]/5"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                >
                  <svg className="w-4 h-4 opacity-70 group-hover:opacity-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout</span>
                </button>

                {/* Mobile Search at Bottom */}
                {showHeaderSearchBar && (
                  <div className="border-t border-[#2E2E2F]/5 mt-2">
                    <button
                      onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left text-xs font-semibold"
                    >
                      <ICONS.Search className="w-4 h-4 opacity-70" />
                      <span>Search Events</span>
                      <svg className={`w-3 h-3 ml-auto transition-transform ${mobileSearchOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>
                    {mobileSearchOpen && (
                      <div className="p-3 bg-[#F2F2F2] border-t border-[#2E2E2F]/5">
                        <form onSubmit={handleHeaderSearchSubmit} className="w-full">
                          <div className="flex items-center h-10 rounded-xl border border-[#2E2E2F]/10 bg-white overflow-hidden">
                            <label className="flex items-center gap-2 px-3 min-w-0 flex-1">
                              <ICONS.Search className="w-4 h-4 text-[#2E2E2F]/50 shrink-0" />
                              <input
                                type="text"
                                value={headerSearchTerm}
                                onChange={(event) => setHeaderSearchTerm(event.target.value)}
                                placeholder="Find your events"
                                className="w-full bg-transparent text-sm text-[#2E2E2F] placeholder:text-[#2E2E2F]/40 outline-none"
                              />
                            </label>
                            <button
                              type="submit"
                              className="w-10 h-10 flex items-center justify-center text-[#2E2E2F]/50 hover:text-[#38BDF2] transition-colors"
                              aria-label="Search"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                              </svg>
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          </div>
        </>
      )}
      <main className="flex-1">{children}</main>
      <footer className="bg-[#F2F2F2] text-[#2E2E2F]/70 py-16 px-8 border-t border-[#2E2E2F]/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
            <div>
              <Branding className="text-2xl" />
              <p className="mt-4 text-sm font-medium max-w-sm text-[#2E2E2F]/70 leading-relaxed">
                Your gateway to StartupLab events.<br />
                From internal workshops to public showcases, this platform delivers seamless, secure registration for every StartupLab gathering.
              </p>

              {/* Social Links */}
              <div className="mt-8 flex items-center gap-4">
                <a href="https://www.facebook.com/StartupLabAI/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2E2E2F]/10 text-[#2E2E2F]/60 hover:bg-[#1877F2] hover:text-white transition-all duration-300 hover:scale-110">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
                <a href="https://discord.com/invite/abt3dkaYTr" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2E2E2F]/10 text-[#2E2E2F]/60 hover:bg-[#5865F2] hover:text-white transition-all duration-300 hover:scale-110">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" /></svg>
                </a>
                <a href="https://www.linkedin.com/in/startup-lab-center-36a15734b/" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2E2E2F]/10 text-[#2E2E2F]/60 hover:bg-[#0A66C2] hover:text-white transition-all duration-300 hover:scale-110">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                </a>
                <a href="mailto:hello@startuplab.ph" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2E2E2F]/10 text-[#2E2E2F]/60 hover:bg-[#EA4335] hover:text-white transition-all duration-300 hover:scale-110">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.573l8.073-6.08c1.618-1.214 3.927-.059 3.927 1.964z" /></svg>
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8 lg:text-right uppercase tracking-[0.2em] font-black text-[9px]">
              <div className="space-y-4">
                <p className="text-[#2E2E2F]/50 mb-4">Platform</p>
                <Link to="/" className="block text-[#2E2E2F]/70 hover:text-[#38BDF2]">Events List</Link>
                <Link to="/live" className="block text-[#2E2E2F]/70 hover:text-[#38BDF2]">Live Broadcasts</Link>
              </div>
              <div className="space-y-4">
                <Link to="/" className="block text-[#2E2E2F]/70 hover:text-[#38BDF2]">Home</Link>
                <Link to="/about-us" className="block text-[#2E2E2F]/70 hover:text-[#38BDF2]">About Us</Link>
                <Link to="/browse-events" className="block text-[#2E2E2F]/70 hover:text-[#38BDF2]">Events</Link>
                <Link to="/pricing" className="block text-[#2E2E2F]/70 hover:text-[#38BDF2]">Pricing</Link>
                <Link to="/contact-us" className="block text-[#2E2E2F]/70 hover:text-[#38BDF2]">Contact Us</Link>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-[#2E2E2F]/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-[9px] uppercase tracking-[0.3em] font-black text-[#2E2E2F]/60">
              © 2026 StartupLab Business Center
            </div>
            <div className="flex items-center gap-6 opacity-60 grayscale">
              <img src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/images/hitpay.png" alt="HitPay" className="h-3" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

// â”€â”€â”€ USER PORTAL LAYOUT (icon sidebar only, no header bar) â”€â”€â”€
// ─── USER DASHBOARD WRAPPER ───
const DashboardWrapper: React.FC = () => {
  const { role, canReceiveNotifications } = useUser();
  if (role === UserRole.ADMIN) return <PortalLayout><AdminDashboard /></PortalLayout>;
  return <UserPortalLayout><AdminDashboard /></UserPortalLayout>;
};

// ─── USER PORTAL LAYOUT (Synced with Admin PortalLayout) ───
const UserPortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, email, name, imageUrl, isAuthenticated, clearUser, setUser, canViewEvents, canEditEvents, canManualCheckIn, canReceiveNotifications } = useUser();
  const { isAttendingView, setPublicMode } = useEngagement();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = React.useState(true);
  const [settingsOpen, setSettingsOpen] = React.useState(location.pathname === '/user-settings');
  const [notificationOpen, setNotificationOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notificationsLoading, setNotificationsLoading] = React.useState(false);

  // Fetch notifications for the notification bell
  const fetchNotifications = React.useCallback(async () => {
    const isAuthenticated = Boolean(email);
    if (!isAuthenticated) return;
    // Only fetch for staff if they have permission
    if (role === UserRole.STAFF && canReceiveNotifications === false) return;

    try {
      setNotificationsLoading(true);
      const data = await apiService.getMyNotifications(25);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: any) {
      console.error('Failed to fetch notifications:', err);
      if (err?.message?.includes('401')) {
        clearUser();
        navigate('/login', { replace: true });
      }
    } finally {
      setNotificationsLoading(false);
    }
  }, [email, role, canReceiveNotifications, clearUser, navigate]);

  // Mark a single notification as read
  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await apiService.markNotificationRead(notificationId);
      setNotifications(prev => prev.map(n =>
        n.notificationId === notificationId ? { ...n, isRead: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  // Real-time polling for new notifications (every 30 seconds)
  React.useEffect(() => {
    const isAuthenticated = Boolean(email);
    if (!isAuthenticated) return;

    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [email, fetchNotifications]);

  // Also fetch when notification panel opens
  React.useEffect(() => {
    const isAuthenticated = Boolean(email);
    if (notificationOpen && isAuthenticated) {
      fetchNotifications();
    }
  }, [notificationOpen, email, fetchNotifications]);

  React.useEffect(() => {
    if (location.pathname === '/user-settings') setSettingsOpen(true);
  }, [location.pathname]);
  const [organizerSidebarLogoUrl, setOrganizerSidebarLogoUrl] = React.useState('');
  const [organizerSidebarName, setOrganizerSidebarName] = React.useState('');
  const [hasPrioritySupport, setHasPrioritySupport] = React.useState<boolean | null>(null);

  const displayName = email?.trim() || name?.trim() || 'User';
  const roleLabel = getRoleLabel(role);
  const initials = (email?.split('@')[0] || name?.trim() || displayName || 'U').split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const hasOrganizerSidebarLogo = Boolean(organizerSidebarLogoUrl);
  const organizerSidebarLogoAlt = organizerSidebarName || 'Organizer logo';

  React.useEffect(() => {
    const syncSession = async () => {
      const isUserPortalRoute = [
        '/user-home', '/my-events', '/user-settings', '/organizer-settings',
        '/account-settings', '/user/attendees', '/user/checkin', '/user/archive',
        '/user/reports', '/dashboard', '/subscription'
      ].includes(location.pathname);
      if (!isUserPortalRoute) return;

      try {
        const res = await fetch(`${API}/api/whoAmI`, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) {
          clearUser();
          navigate('/login', { replace: true });
          return;
        }
        const me = await res.json().catch(() => null);
        const normalizedRole = normalizeUserRole(me?.role);
        if (!normalizedRole || !me?.email) {
          clearUser();
          navigate('/login', { replace: true });
          return;
        }
        setUser({
          role: normalizedRole,
          email: me.email,
          name: me.name ?? null,
          imageUrl: me.imageUrl ?? null,
          canViewEvents: me.canViewEvents ?? true,
          canEditEvents: me.canEditEvents ?? true,
          canManualCheckIn: me.canManualCheckIn ?? true,
          canReceiveNotifications: me.canReceiveNotifications ?? true,
          isOnboarded: !!me.isOnboarded
        });
      } catch {
        // clearUser(); // Don't clear on every error to avoid flashes
        // navigate('/login', { replace: true });
      }
    };
    syncSession();
  }, [clearUser, location.pathname, navigate, setUser]);

  React.useEffect(() => {
    let isMounted = true;

    const loadOrganizerSidebarBrand = async () => {
      if (role !== UserRole.ORGANIZER && role !== UserRole.STAFF) {
        if (isMounted) {
          setOrganizerSidebarLogoUrl('');
          setOrganizerSidebarName('');
        }
        return;
      }

      try {
        const organizer = await apiService.getMyOrganizer();
        if (!isMounted) return;
        setOrganizerSidebarLogoUrl(organizer?.profileImageUrl || '');
        setOrganizerSidebarName((organizer?.organizerName || '').trim());
        setHasPrioritySupport(!!(organizer?.plan?.features?.priority_support || organizer?.plan?.features?.enable_priority_support));
      } catch {
        if (isMounted) {
          setOrganizerSidebarLogoUrl('');
          setOrganizerSidebarName('');
          setHasPrioritySupport(null);
        }
      }
    };

    loadOrganizerSidebarBrand();
    return () => {
      isMounted = false;
    };
  }, [role, location.pathname]);

  // No longer needed as handled by RequireRoleRoute
  /*
  React.useEffect(() => {
    const checkOnboarding = async () => { ... }
    checkOnboarding();
  }, [role, location.pathname, navigate]);
  */

  const handleLogout = async () => {
    try {
      await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" });
      await supabase.auth.signOut();
      clearUser(); navigate('/');
    } catch { clearUser(); navigate('/'); }
  };

  const [expandedSections, setExpandedSections] = React.useState<string[]>(['Main', 'Events Records', 'Communication', 'Settings']);

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  const menuItems = (
    !isAuthenticated || !role
      ? []
      : role === UserRole.STAFF && canViewEvents === false && canManualCheckIn === false
        ? [
          { label: 'Users', path: '/user/attendees', icon: <ICONS.Users className="w-6 h-6" /> },
        ]
        : role === UserRole.STAFF
          ? [
            ...(canViewEvents !== false ? [{ label: 'Events', path: '/my-events', icon: <ICONS.Calendar className="w-6 h-6" /> }] : []),
            { label: 'Users', path: '/user/attendees', icon: <ICONS.Users className="w-6 h-6" /> },
            ...(canManualCheckIn !== false ? [{ label: 'Scan', path: '/user/checkin', icon: <ICONS.CheckCircle className="w-6 h-6" /> }] : []),
          ]
          : [
            { label: 'Home', path: '/user-home', icon: <ICONS.Home className="w-6 h-6" /> },
            { label: 'Dashboard', path: '/dashboard', icon: <ICONS.Layout className="w-6 h-6" /> },
            { label: 'Events Management', path: '/my-events', icon: <ICONS.Calendar className="w-6 h-6" /> },
            { label: 'Attendees', path: '/user/attendees', icon: <ICONS.Users className="w-6 h-6" /> },
            { label: 'Check In', path: '/user/checkin', icon: <ICONS.CheckCircle className="w-6 h-6" /> },
            { label: 'Reports', path: '/user/reports', icon: <ICONS.BarChart className="w-6 h-6" /> },
            { label: 'Archive', path: '/user/archive', icon: <ICONS.Archive className="w-6 h-6" />, separator: true },
            { label: 'Plans', path: '/subscription', icon: <ICONS.Layout className="w-6 h-6" /> },
            { label: 'Organization Profile', path: '/user-settings?tab=organizer', icon: <ICONS.Users className="w-6 h-6" /> },
            { label: 'Team and Access', path: '/user-settings?tab=team', icon: <ICONS.Users className="w-6 h-6" /> },
            { label: 'Email Settings', path: '/user-settings?tab=email', icon: <ICONS.Mail className="w-6 h-6" /> },
            { label: 'Payment Settings', path: '/user-settings?tab=payments', icon: <ICONS.CreditCard className="w-6 h-6" /> },
            { label: 'Support', path: '/organizer-support', icon: <ICONS.MessageSquare className="w-6 h-6" /> },
            { label: 'Account Settings', path: '/user-settings?tab=account', icon: <ICONS.Settings className="w-6 h-6" />, separator: true },
          ]
  );

  const checkIsActive = (itemPath: string) => {
    if (itemPath.includes('?')) {
      const [base, query] = itemPath.split('?');
      if (location.pathname !== base) return false;
      const tab = new URLSearchParams(query).get('tab');
      const currentTab = new URLSearchParams(location.search).get('tab');
      if (!currentTab && tab === 'organizer') return true;
      return currentTab === tab;
    }
    return location.pathname === itemPath;
  };

  const handleToggleAttendingMode = () => {
    if (isAttendingView) {
      setPublicMode('organizer');
      navigate('/my-events');
    } else {
      setPublicMode('attending');
      navigate('/browse-events');
    }
    setSidebarOpen(false);
    setUserMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-[#F2F2F2] portal-fast">
      {/* Sidebar for desktop */}
      <aside
        className={`bg-[#F2F2F2] border-r border-[#2E2E2F]/10 hidden md:flex flex-col fixed inset-y-0 left-0 z-30 transition-all duration-300 ease-in-out ${desktopSidebarOpen ? 'w-64' : 'w-20'}`}
        style={{ overflow: desktopSidebarOpen ? 'hidden' : 'visible' }}
      >
        <div className={`py-6 px-4 flex items-center justify-center border-b border-[#2E2E2F]/5 shrink-0 ${desktopSidebarOpen ? 'min-h-[160px]' : 'min-h-[120px]'}`}>
          <Link to="/user-home" className="flex items-center justify-center group transition-all duration-500 transform hover:scale-[1.05] active:scale-[0.95]">
            {organizerSidebarLogoUrl ? (
              <img
                src={organizerSidebarLogoUrl}
                alt={organizerSidebarLogoAlt}
                className={desktopSidebarOpen ? "h-20 w-auto max-w-full object-contain group-hover:rotate-1 transition-transform" : "h-14 w-14 object-contain group-hover:rotate-6 transition-transform rounded-xl border-2 border-[#38BDF2]/20"}
              />
            ) : (
              desktopSidebarOpen ? (
                <Branding className="h-16 w-auto" />
              ) : (
                <img src="/lgo.webp" alt="Logo" className="h-12 w-12 object-contain group-hover:rotate-6 transition-transform" />
              )
            )}
          </Link>
        </div>
        <nav className={`flex-1 py-6 ${desktopSidebarOpen ? 'px-4' : 'px-2'} flex flex-col gap-1 overflow-y-auto overflow-x-visible ${desktopSidebarOpen ? 'custom-scrollbar' : 'scrollbar-none'} scroll-smooth`}
          style={{ width: desktopSidebarOpen ? '100%' : '260px', paddingRight: desktopSidebarOpen ? '0' : '180px' }}>
          {menuItems.map((item: any, idx) => {
            const isActive = checkIsActive(item.path);

            return (
              <React.Fragment key={item.path || idx}>
                {item.separator && (
                  <div className={`mx-4 my-3 h-[1px] bg-[#2E2E2F]/5 shrink-0 ${!desktopSidebarOpen ? 'mx-2' : ''}`} />
                )}
                <Link
                  to={item.path}
                  className={`flex items-center transition-all duration-300 group relative shrink-0 ${desktopSidebarOpen
                    ? 'flex-row gap-3 px-4 py-3 rounded-2xl mx-1'
                    : 'flex-row justify-center p-3 rounded-xl mx-2'
                    } ${isActive
                      ? 'bg-[#38BDF2] text-white shadow-lg shadow-[#38BDF2]/20'
                      : 'text-[#2E2E2F] hover:bg-[#38BDF2]/10 hover:text-[#38BDF2]'
                    }`}
                  title={!desktopSidebarOpen ? item.label : undefined}
                >
                  <div className="relative shrink-0">
                    {React.cloneElement(item.icon as React.ReactElement<any>, {
                      className: `transition-transform duration-300 ${desktopSidebarOpen ? 'w-5 h-5' : 'w-6 h-6 group-hover:scale-110'} ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`
                    })}
                    {item.premium && <CrownBadge />}
                  </div>

                  {desktopSidebarOpen && (
                    <span className="text-sm font-medium tracking-tight truncate">
                      {item.label}
                    </span>
                  )}
                  {!desktopSidebarOpen && (
                    <div className="absolute left-full ml-5 px-3.5 py-2.5 bg-[#38BDF2] text-white text-[10px] font-black uppercase tracking-widest rounded-xl opacity-0 translate-x-[-10px] pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 z-[999] whitespace-nowrap shadow-[10px_0_30px_-10px_rgba(56,189,242,0.5)] flex items-center">
                      <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 border-[6px] border-transparent border-r-[#38BDF2]" />
                      {item.label}
                    </div>
                  )}
                </Link>
              </React.Fragment>
            );
          })}
        </nav>
      </aside>

      <main
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${desktopSidebarOpen ? 'md:pl-64' : 'md:pl-20'}`}
      >
        <header className="h-20 bg-[#F2F2F2] border-b border-[#2E2E2F]/10 px-4 sm:px-8 flex items-center justify-between gap-4 sm:gap-6 sticky top-0 z-40 w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setSidebarOpen(true);
                } else {
                  setDesktopSidebarOpen(!desktopSidebarOpen);
                }
              }}
              className="p-2.5 rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-all group active:scale-95"
              aria-label="Toggle Sidebar"
            >
              <svg className={`w-5 h-5 transition-transform duration-500 ${!desktopSidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="ml-1 hidden sm:block">
              <p className="text-base font-medium tracking-tight text-[#2E2E2F]/50">
                Organizer Portal
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-6">
            {(!(role === UserRole.STAFF && canReceiveNotifications === false)) && (
              <div className="relative group">
                <button
                  className="w-11 h-11 flex items-center justify-center rounded-2xl border border-[#38BDF2]/20 bg-transparent hover:bg-[#38BDF2]/10 hover:border-[#38BDF2]/40 hover:scale-105 active:scale-95 transition-all shadow-sm relative"
                  onClick={() => setNotificationOpen(!notificationOpen)}
                >
                  <ICONS.Bell className="w-5 h-5 text-[#2E2E2F] group-hover:text-[#38BDF2] transition-colors" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 border-2 border-[#F2F2F2] shadow-lg animate-in zoom-in duration-300">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationOpen && (
                  <>
                    <div className="fixed inset-0 z-[100] bg-[#2E2E2F]/10 backdrop-blur-[2px]" onClick={() => setNotificationOpen(false)} />
                    <div className="fixed right-6 top-24 bottom-6 w-full max-w-[420px] bg-[#F2F2F2] rounded-[2.5rem] border border-[#2E2E2F]/5 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.15)] z-[101] flex flex-col overflow-hidden animate-in slide-in-from-right-8 fade-in duration-500">
                      <div className="p-8 border-b border-[#2E2E2F]/5 flex items-start justify-between bg-[#F2F2F2]/80 backdrop-blur-xl sticky top-0 z-10">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-2xl font-black tracking-tight text-[#2E2E2F]">Notifications</h2>
                            {unreadCount > 0 && (
                              <span className="bg-red-500/10 text-red-500 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                                {unreadCount} New
                              </span>
                            )}
                          </div>
                          <p className="text-[#2E2E2F]/40 text-xs font-bold uppercase tracking-widest">Stay up to date on important information</p>
                        </div>
                        <button onClick={() => setNotificationOpen(false)} className="w-10 h-10 rounded-2xl bg-[#F2F2F2] flex items-center justify-center text-[#2E2E2F]/40 hover:text-[#2E2E2F] hover:bg-[#2E2E2F]/5 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto scrollbar-hide py-4">
                        {notificationsLoading && notifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                            <div className="w-12 h-12 border-4 border-[#38BDF2]/20 border-t-[#38BDF2] rounded-full animate-spin mb-4" />
                            <p className="text-[#2E2E2F]/40 text-xs font-black uppercase tracking-widest">Syncing notifications...</p>
                          </div>
                        ) : notifications.length > 0 ? (
                          <div className="px-4 space-y-2">
                            <div className="px-4 py-2 flex justify-between items-center mb-4">
                              <span className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em]">RECENT ACTIVITY</span>
                              <button
                                onClick={handleMarkAllRead}
                                className="text-[10px] font-black text-[#38BDF2] hover:text-[#2E2E2F] uppercase tracking-[0.2em] transition-colors"
                              >
                                Mark all read
                              </button>
                            </div>
                            {notifications.map((n) => (
                              <div
                                key={n.notificationId || Math.random()}
                                className={`p-5 rounded-[2rem] transition-all group relative border ${n.isRead
                                  ? 'bg-transparent border-transparent opacity-60'
                                  : 'bg-[#F2F2F2] border-[#2E2E2F]/5 hover:border-[#38BDF2]/30 shadow-sm'
                                  }`}
                              >
                                <div className="flex items-start gap-4">
                                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${n.isRead ? 'bg-[#2E2E2F]/5 text-[#2E2E2F]/30' : 'bg-[#38BDF2]/10 text-[#38BDF2]'
                                    }`}>
                                    <ICONS.Bell className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <h4 className="text-sm font-black text-[#2E2E2F] tracking-tight truncate">{n.title}</h4>
                                      <span className="text-[9px] text-[#2E2E2F]/30 font-black uppercase tracking-widest whitespace-nowrap ml-2">
                                        {n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Now'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-[#2E2E2F]/60 font-medium leading-relaxed line-clamp-2 mb-3">{n.message}</p>
                                    {!n.isRead && (
                                      <button
                                        onClick={() => handleMarkNotificationRead(n.notificationId)}
                                        className="text-[10px] font-black text-[#38BDF2] uppercase tracking-widest hover:text-[#2E2E2F] transition-colors"
                                      >
                                        Mark as read
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                            <div className="w-24 h-24 bg-[#F2F2F2] rounded-[2rem] flex items-center justify-center mb-8">
                              <ICONS.Bell className="w-10 h-10 text-[#2E2E2F]/10" />
                            </div>
                            <h3 className="text-xl font-black text-[#2E2E2F] tracking-tighter uppercase mb-2">Clean Slate</h3>
                            <p className="text-sm font-medium text-[#2E2E2F]/40 max-w-[240px] leading-relaxed">
                              You're all caught up. We'll alert you when there's news.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          <div className="relative">
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] hover:bg-[#38BDF2]/10 transition-colors"
              onClick={() => setUserMenuOpen((v) => !v)}
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#38BDF2]/20 text-[#2E2E2F] flex items-center justify-center">
                {imageUrl ? (
                  <img src={imageUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-semibold text-xs text-[#2E2E2F]">{initials}</span>
                )}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-xs font-medium tracking-tight text-[#2E2E2F] truncate max-w-[120px]">{displayName}</p>
                <p className="text-xs font-medium tracking-tight text-[#2E2E2F]/45 mt-0.5">{roleLabel}</p>
              </div>
              <svg className="w-4 h-4 text-[#2E2E2F]/50" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-[calc(100%+8px)] w-60 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-2xl shadow-xl z-50 p-2 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                  <div className="px-4 py-3 border-b border-[#2E2E2F]/5 mb-1">
                    <p className="text-[10px] font-medium tracking-tight text-[#2E2E2F]/40 mb-0.5">Account</p>
                    <p className="text-xs font-medium tracking-tight text-[#2E2E2F] truncate">{displayName}</p>
                    <p className="text-xs font-medium tracking-tight text-[#2E2E2F]/45 mt-1">{roleLabel}</p>
                  </div>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium tracking-tight text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                    onClick={() => {
                      setPublicMode('organizer');
                      navigate('/my-events');
                      setUserMenuOpen(false);
                    }}
                  >
                    <ICONS.Calendar className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                    <span>Manage My Events</span>
                  </button>
                  {role === UserRole.ORGANIZER && (
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium tracking-tight text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                      onClick={handleToggleAttendingMode}
                    >
                      <ICONS.Users className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                      <span>{isAttendingView ? 'Organize Events' : 'Switch to Attending'}</span>
                    </button>
                  )}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium tracking-tight text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                    onClick={() => {
                      navigate('/user-settings?tab=organizer');
                      setUserMenuOpen(false);
                    }}
                  >
                    <ICONS.Users className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                    <span>Org Profile</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium tracking-tight text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                    onClick={() => {
                      navigate('/user-settings?tab=team');
                      setUserMenuOpen(false);
                    }}
                  >
                    <ICONS.Shield className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                    <span>Teams & Access</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium tracking-tight text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                    onClick={() => {
                      navigate('/user-settings?tab=email');
                      setUserMenuOpen(false);
                    }}
                  >
                    <ICONS.Mail className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                    <span>Email Setup</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium tracking-tight text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                    onClick={() => {
                      navigate('/user-settings?tab=payments');
                      setUserMenuOpen(false);
                    }}
                  >
                    <ICONS.CreditCard className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                    <span>Payment Gateway</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium tracking-tight text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                    onClick={() => {
                      navigate('/user-settings?tab=account');
                      setUserMenuOpen(false);
                    }}
                  >
                    <ICONS.Settings className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                    <span>Account Settings</span>
                  </button>
                  {hasPrioritySupport === true && (
                    <button
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium tracking-tight text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] transition-colors text-left group"
                      onClick={() => {
                        navigate('/organizer-support');
                        setUserMenuOpen(false);
                      }}
                    >
                      <ICONS.MessageSquare className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                      <span>Support</span>
                    </button>
                  )}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium tracking-tight text-[#2E2E2F]/70 hover:bg-red-50 hover:text-red-500 transition-colors text-left group"
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <svg className="w-4 h-4 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

        {sidebarOpen && (
          <div className="fixed inset-0 z-[100] flex lg:hidden">
            <div className="fixed inset-0 bg-[#2E2E2F]/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-72 bg-[#F2F2F2] border-r border-[#2E2E2F]/10 flex flex-col h-full z-50 animate-in slide-in-from-left duration-300">
              <div className="p-8 pb-4 flex items-center justify-between">
                <Link to="/user-home" onClick={() => setSidebarOpen(false)} className="flex flex-col items-start gap-2 group transition-all duration-500">
                  {organizerSidebarLogoUrl ? (
                    <img
                      src={organizerSidebarLogoUrl}
                      alt={organizerSidebarLogoAlt}
                      className="h-12 w-auto max-w-[140px] object-contain"
                    />
                  ) : (
                    <img
                      src="/lgo.webp"
                      alt="Logo"
                      className="h-10 w-10 object-contain"
                    />
                  )}
                  {organizerSidebarName && (
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40 ml-0.5">
                      {organizerSidebarName}
                    </span>
                  )}
                </Link>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#2E2E2F]/5 text-[#2E2E2F] hover:bg-[#2E2E2F]/10 transition-colors"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close navigation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
                {menuItems.map((item: any) => {
                  const isActive = checkIsActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${isActive
                        ? 'bg-[#38BDF2] text-white shadow-lg shadow-[#38BDF2]/20'
                        : 'text-[#2E2E2F] hover:bg-[#38BDF2]/10 hover:text-[#38BDF2]'
                        }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <div className={isActive ? 'text-white' : 'text-[#2E2E2F]'}>
                        {React.cloneElement(item.icon as React.ReactElement<any>, {
                          className: `w-5 h-5 transition-transform duration-300 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`
                        })}
                      </div>
                      <span className="text-sm font-medium tracking-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

const roleHomePath = (role: UserRole): string => {
  if (role === UserRole.ORGANIZER) return '/user-home';
  if (role === UserRole.STAFF) return '/events';
  if (role === UserRole.ATTENDEE) return '/browse-events';
  return '/dashboard';
};

const RequireRoleRoute: React.FC<{ allow: UserRole[]; children: React.ReactElement }> = ({ allow, children }) => {
  const { role: currentRole, isOnboarded: currentOnboarded, setUser, clearUser } = useUser();
  const [checking, setChecking] = React.useState(true);
  const [resolvedRole, setResolvedRole] = React.useState<UserRole | null>(null);
  const [shouldRedirectToOnboarding, setShouldRedirectToOnboarding] = React.useState(false);
  const location = useLocation();

  // Fast-path: If we already have a session and know they need onboarding, redirect immediately
  if (currentRole === UserRole.ORGANIZER && currentOnboarded === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  React.useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      setChecking(true);
      try {
        const res = await fetch(`${API}/api/whoAmI`, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error('Unauthorized');
        const me = await res.json().catch(() => null);
        const role = normalizeUserRole(me?.role);
        if (!role || !me?.email) throw new Error('Invalid session');
        
        const isOnboarded = !!me.isOnboarded;
        
        setUser({
          role,
          email: me.email,
          name: me.name ?? null,
          imageUrl: me.imageUrl ?? null,
          canViewEvents: me.canViewEvents ?? true,
          canEditEvents: me.canEditEvents ?? true,
          canManualCheckIn: me.canManualCheckIn ?? true,
          canReceiveNotifications: me.canReceiveNotifications ?? true,
          isOnboarded
        });

        if (!cancelled) {
          setResolvedRole(role);
          // Only redirect if organizer is NOT onboarded AND NOT currently on the onboarding page
          if (role === UserRole.ORGANIZER && !isOnboarded && location.pathname !== '/onboarding') {
            setShouldRedirectToOnboarding(true);
          }
        }
      } catch (err) {
        console.error('Access check error:', err);
        clearUser();
        if (!cancelled) setResolvedRole(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    checkAccess();
    return () => { cancelled = true; };
  }, [setUser, clearUser, location.pathname]);

  if (checking) return <PageLoader label="Checking access..." variant="page" />;
  if (!resolvedRole) return <Navigate to="/login" replace />;
  if (shouldRedirectToOnboarding) return <Navigate to="/onboarding" replace />;
  if (!allow.includes(resolvedRole)) return <Navigate to={roleHomePath(resolvedRole)} replace />;
  return children;
};

const ScrollToTop: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Scroll to top whenever the path changes
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }, [location.pathname]);

  return null;
};

const HashBypassBridge: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // If the browser lands on a non-hash path that matches our success route
    // (This happens when HitPay/Browsers strip the # part or misinterpret the redirect)
    if (window.location.pathname === '/subscription/success') {
      console.log('🔀 [App] Redirecting clean URL to Hash route...');
      const search = window.location.search;
      navigate(`/subscription/success${search}`, { replace: true });
    }
  }, [navigate]);

  return null;
};

const GlobalOnboardingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, isOnboarded, isAuthenticated, setUser } = useUser();
  const location = useLocation();
  const [synced, setSynced] = React.useState(false);

  React.useEffect(() => {
    const sync = async () => {
      // If we already know their onboarded status, we're good
      if (typeof isOnboarded !== 'undefined') {
        setSynced(true);
        return;
      }
      try {
        const res = await fetch(`${API}/api/whoAmI`, { credentials: 'include', cache: 'no-store' });
        if (res.ok) {
          const me = await res.json();
          setUser({
            role: normalizeUserRole(me.role),
            email: me.email,
            name: me.name,
            imageUrl: me.imageUrl,
            isOnboarded: !!me.isOnboarded,
            canViewEvents: me.canViewEvents ?? true,
            canEditEvents: me.canEditEvents ?? true,
            canManualCheckIn: me.canManualCheckIn ?? true,
            canReceiveNotifications: me.canReceiveNotifications ?? true,
          });
        }
      } catch {
        // Silent fail for guest
      } finally {
        setSynced(true);
      }
    };
    sync();
  }, [setUser, isOnboarded]);

  if (!synced) return <PageLoader label="Initializing..." variant="page" />;

  const isAuthPage = ['/login', '/signup', '/forgot-password', '/reset-password', '/accept-invite'].includes(location.pathname);
  const isOnboardingPage = location.pathname === '/onboarding';

  // Force redirection if organizer is not onboarded and tries to access anything else
  if (isAuthenticated && role === UserRole.ORGANIZER && isOnboarded === false && !isOnboardingPage && !isAuthPage) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => (
  <ToastProvider>
    <ToastContainer />
    <Router>
    <ScrollToTop />
    <HashBypassBridge />
    <GlobalOnboardingGuard>
    <Routes>
      <Route path="/login" element={<LoginPerspective />} />
      <Route path="/signup" element={<SignUpView />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/" element={<PublicLayout><EventList /></PublicLayout>} />
      <Route path="/live" element={<PublicLayout><LivePage /></PublicLayout>} />
      <Route path="/categories/:categoryKey" element={<PublicLayout><CategoryEvents /></PublicLayout>} />
      <Route path="/events/:slug" element={<PublicLayout><EventDetails /></PublicLayout>} />
      <Route path="/organizer/:id" element={<PublicLayout><OrganizerProfilePage /></PublicLayout>} />
      <Route path="/events/:slug/register" element={<PublicLayout><RegistrationForm /></PublicLayout>} />
      <Route path="/payment/status" element={<PublicLayout><PaymentStatusView /></PublicLayout>} />
      <Route path="/tickets/:ticketId" element={<PublicLayout><TicketView /></PublicLayout>} />
      <Route path="/about-us" element={<PublicLayout><AboutUsPage /></PublicLayout>} />
      <Route path="/browse-events" element={<PublicLayout><PublicEventsPage /></PublicLayout>} />
      <Route path="/liked" element={<PublicLayout><LikedEventsPage /></PublicLayout>} />
      <Route path="/followings" element={<PublicLayout><FollowingsEventsPage /></PublicLayout>} />
      <Route path="/my-tickets" element={<PublicLayout><MyTicketsPage /></PublicLayout>} />
      <Route path="/privacy-policy" element={<PublicLayout><PrivacyPolicyPage /></PublicLayout>} />
      <Route path="/terms-of-service" element={<PublicLayout><TermsOfServicePage /></PublicLayout>} />
      <Route path="/contact-us" element={<PublicLayout><ContactUsPage /></PublicLayout>} />
      <Route path="/pricing" element={<PublicLayout><PricingPage /></PublicLayout>} />
      <Route path="/faq" element={<PublicLayout><FaqPage /></PublicLayout>} />
      <Route path="/refund-policy" element={<PublicLayout><RefundPolicyPage /></PublicLayout>} />
      <Route path="/onboarding" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><WelcomeView /></RequireRoleRoute>} />

      {/* User Portal Routes */}
      <Route path="/user-home" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><UserPortalLayout><UserHome /></UserPortalLayout></RequireRoleRoute>} />
      <Route path="/my-events" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><UserPortalLayout><UserEvents /></UserPortalLayout></RequireRoleRoute>} />
      <Route path="/user-settings" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><UserPortalLayout><UserSettings /></UserPortalLayout></RequireRoleRoute>} />
      <Route path="/organizer-settings" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><Navigate to="/user-settings?tab=organizer" replace /></RequireRoleRoute>} />
      <Route path="/payment-settings" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><Navigate to="/user-settings?tab=payments" replace /></RequireRoleRoute>} />
      <Route path="/account-settings" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><Navigate to="/user-settings?tab=account" replace /></RequireRoleRoute>} />
      <Route path="/user/attendees" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><UserPortalLayout><RegistrationsList /></UserPortalLayout></RequireRoleRoute>} />
      <Route path="/user/checkin" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><UserPortalLayout><CheckIn /></UserPortalLayout></RequireRoleRoute>} />
      <Route path="/user/archive" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><UserPortalLayout><ArchiveEvents /></UserPortalLayout></RequireRoleRoute>} />
        <Route path="/user/reports" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><UserPortalLayout><OrganizerReports /></UserPortalLayout></RequireRoleRoute>} />
      <Route path="/subscription" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><UserPortalLayout><OrganizerSubscription /></UserPortalLayout></RequireRoleRoute>} />
      <Route path="/organizer-support" element={<RequireRoleRoute allow={[UserRole.ORGANIZER]}><UserPortalLayout><OrganizerSupport /></UserPortalLayout></RequireRoleRoute>} />
      <Route path="/subscription/success" element={<PublicLayout><SubscriptionSuccess /></PublicLayout>} />

      {/* Admin Portal Routes */}
      <Route path="/dashboard" element={<RequireRoleRoute allow={[UserRole.ADMIN, UserRole.ORGANIZER]}><DashboardWrapper /></RequireRoleRoute>} />
      <Route path="/events" element={<RequireRoleRoute allow={[UserRole.ADMIN, UserRole.STAFF]}><PortalLayout><EventsManagement /></PortalLayout></RequireRoleRoute>} />
      <Route path="/attendees" element={<RequireRoleRoute allow={[UserRole.ADMIN, UserRole.STAFF]}><PortalLayout><RegistrationsList /></PortalLayout></RequireRoleRoute>} />
      <Route path="/checkin" element={<RequireRoleRoute allow={[UserRole.ADMIN, UserRole.STAFF]}><PortalLayout><CheckIn /></PortalLayout></RequireRoleRoute>} />
      <Route path="/settings" element={<RequireRoleRoute allow={[UserRole.ADMIN, UserRole.STAFF]}><PortalLayout><SettingsView /></PortalLayout></RequireRoleRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </GlobalOnboardingGuard>
  </Router>
  </ToastProvider>
);
export default App;

