
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { EventList } from './views/Public/EventList';
import { EventDetails } from './views/Public/EventDetails';
import { RegistrationForm } from './views/Public/RegistrationForm';
import { PaymentStatusView } from './views/Public/PaymentStatus';
import { TicketView } from './views/Public/TicketView';
import { AdminDashboard } from './views/Admin/Dashboard';
import { EventsManagement } from './views/Admin/EventsManagement';
import { RegistrationsList } from './views/Admin/RegistrationsList';
import { CheckIn } from './views/Admin/CheckIn';
import { SettingsView } from './views/Admin/Settings';
import { LoginPerspective } from './views/Auth/Login';
import { SignUpView } from './views/Auth/SignUp';
import { AcceptInvite } from './views/Auth/AcceptInvite';
import { ICONS } from './constants';
import { UserRole } from './types';
import { supabase } from "./supabase/supabaseClient.js";
import { useUser } from './context/UserContext';
const API = import.meta.env.VITE_API_BASE;
const Branding: React.FC<{ className?: string, light?: boolean }> = ({ className = '', light = false }) => (
  <span className={`font-black tracking-tighter ${className} ${light ? 'text-white' : 'text-[#1F3A5F]'}`}>
    StartupLab <span className="text-[#2F80ED] font-bold italic">Business Ticketing</span>
  </span>
);
const PortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, isAuthenticated, clearUser, setUser, canViewEvents, canEditEvents, canManualCheckIn } = useUser();
  const isStaff = role === UserRole.STAFF;
  // Unified URLs for both roles

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
        if (!me?.role || !me?.email) {
          clearUser();
          navigate('/login', { replace: true });
          return;
        }
        setUser({ 
          role: me.role, 
          email: me.email,
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
    const staffAllowed = ['/events', '/attendees', '/checkin'];
    const adminAllowed = ['/dashboard', '/events', '/attendees', '/checkin', '/settings'];
    const allowed = isStaff ? staffAllowed : adminAllowed;
    if (!allowed.includes(location.pathname)) {
      navigate('/events', { replace: true });
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

  const menuItems = (
    role === UserRole.STAFF
      ? [
          { label: 'Events', path: '/events', icon: <ICONS.Calendar className="w-5 h-5" /> },
          { label: 'Attendees', path: '/attendees', icon: <ICONS.Users className="w-5 h-5" /> },
          { label: 'Check-In', path: '/checkin', icon: <ICONS.CheckCircle className="w-5 h-5" /> },
        ]
      : [
          { label: 'Dashboard', path: '/dashboard', icon: <ICONS.Layout className="w-5 h-5" /> },
          { label: 'Events', path: '/events', icon: <ICONS.Calendar className="w-5 h-5" /> },
          { label: 'Attendees', path: '/attendees', icon: <ICONS.Users className="w-5 h-5" /> },
          { label: 'Check-In', path: '/checkin', icon: <ICONS.CheckCircle className="w-5 h-5" /> },
          { label: 'Settings', path: '/settings', icon: <ICONS.Settings className="w-5 h-5" /> },
        ]
  );

  const handleLogout = async () => {
    try {
      // 1. Call backend logout to clear cookies
      await fetch(`${API}/api/auth/logout`, { 
        method: "POST", 
        credentials: "include" 
      });
  
      // 2. Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Supabase sign out error:", error);
      }
  
      // 3. Clear any local tokens/storage
      localStorage.removeItem('sb-ddkkbtijqrgpitncxylx-auth-token');
      clearUser();
      
      // 4. Navigate to login
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
      // Still navigate to login even if there was an error
      navigate('/');
    }
  };

  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = React.useState(true);
  return (
    <div className="min-h-screen flex bg-[#F4F6F8]">
      {/* Sidebar for desktop */}
      <aside
        className={`w-72 bg-white border-r border-[#F4F6F8] hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 transition-transform duration-300 overflow-y-auto ${
          desktopSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >

        <div className="p-8">
          <Link to="/" className="text-lg">
            <Branding className="text-base" />
          </Link>
          <div className="mt-4 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isStaff ? 'bg-[#56CCF2]' : 'bg-[#2F80ED]'} animate-pulse`}></span>
            <p className="text-[9px] uppercase font-black text-[#1F3A5F]/50 tracking-[0.2em]">
              {isStaff ? 'Operations Hub' : 'Enterprise Admin'}
            </p>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                location.pathname === item.path
                  ? (isStaff ? 'bg-[#56CCF2] text-[#1F3A5F] shadow-xl shadow-[#56CCF2]/20' : 'bg-[#2F80ED] text-white shadow-xl shadow-[#2F80ED]/20')
                  : 'text-[#1F3A5F]/60 hover:bg-[#F4F6F8] hover:text-[#2F80ED]'
              }`}
            >
              {item.icon}
              <span className="font-bold text-sm tracking-tight">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-6 mt-auto">
          <div className="bg-[#F4F6F8] rounded-2xl p-4 flex items-center gap-3 border border-[#F4F6F8]">
            <div className={`w-10 h-10 rounded-xl ${isStaff ? 'bg-[#56CCF2]/20 text-[#1F3A5F]' : 'bg-[#2F80ED]/15 text-[#2F80ED]'} flex items-center justify-center font-black text-xs`}>
              {isStaff ? 'ST' : 'AD'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-black text-[#1F3A5F] truncate">{isStaff ? 'Staff Operative' : 'System Admin'}</p>
              <p className="text-[9px] text-[#1F3A5F]/50 font-bold uppercase tracking-widest truncate">StartupLab Global</p>
            </div>
          </div>
        </div>
      </aside>

      <main
        className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ${
          desktopSidebarOpen ? 'lg:pl-72' : 'lg:pl-0'
        }`}
      >
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-[#F4F6F8] px-4 sm:px-8 flex items-center justify-between lg:justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Desktop sidebar hamburger (now left) */}
            <button
              className="hidden lg:inline-flex p-2 rounded-lg bg-[#F4F6F8] text-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/40"
              onClick={() => setDesktopSidebarOpen((prev) => !prev)}
              aria-label={desktopSidebarOpen ? 'Collapse navigation' : 'Expand navigation'}
              aria-pressed={desktopSidebarOpen}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Mobile hamburger */}
            <button
              className="p-2 rounded-lg bg-[#F4F6F8] text-[#2F80ED] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/40 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <Branding className="text-xs" />
          </div>
          <div className="flex items-center gap-6">
             <div className="hidden md:flex flex-col items-end">
               <span className="text-[8px] font-black text-[#1F3A5F]/50 uppercase tracking-widest">System Status</span>
               <span className="text-[9px] font-bold text-[#2F80ED] flex items-center gap-1.5">
                 <span className="w-1 h-1 bg-[#2F80ED] rounded-full"></span>
                 Encrypted & Live
               </span>
             </div>
             <button onClick={handleLogout} className="text-[9px] font-black uppercase tracking-widest text-[#1F3A5F]/50 hover:text-[#1F3A5F] transition-colors border border-[#F4F6F8] px-3 py-1.5 rounded-lg">
               Logout
             </button>
          </div>
        </header>
        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="fixed inset-0 bg-[#1F3A5F]/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-64 bg-white border-r border-[#F4F6F8] flex flex-col h-full z-50 animate-in slide-in-from-left-12 fade-in duration-300">
              <div className="p-8 flex items-center justify-between">
                <Branding className="text-base" />
                <button
                  className="p-2 rounded-full text-[#1F3A5F]/50 hover:text-[#2F80ED] hover:bg-[#F4F6F8] transition-colors"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close navigation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <nav className="flex-1 px-4 py-4 space-y-1">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                      location.pathname === item.path
                        ? (isStaff ? 'bg-[#56CCF2] text-[#1F3A5F] shadow-xl shadow-[#56CCF2]/20' : 'bg-[#2F80ED] text-white shadow-xl shadow-[#2F80ED]/20')
                        : 'text-[#1F3A5F]/60 hover:bg-[#F4F6F8] hover:text-[#2F80ED]'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    {item.icon}
                    <span className="font-bold text-sm tracking-tight">{item.label}</span>
                  </Link>
                ))}
              </nav>
              <div className="p-6 mt-auto">
                <div className="bg-[#F4F6F8] rounded-2xl p-4 flex items-center gap-3 border border-[#F4F6F8]">
                  <div className={`w-10 h-10 rounded-xl ${isStaff ? 'bg-[#56CCF2]/20 text-[#1F3A5F]' : 'bg-[#2F80ED]/15 text-[#2F80ED]'} flex items-center justify-center font-black text-xs`}>
                    {isStaff ? 'ST' : 'AD'}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-black text-[#1F3A5F] truncate">{isStaff ? 'Staff Operative' : 'System Admin'}</p>
                    <p className="text-[9px] text-[#1F3A5F]/50 font-bold uppercase tracking-widest truncate">StartupLab Global</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-white">
    <header className="h-20 bg-white border-b border-[#F4F6F8] px-8 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
        <Link to="/" className="transition-transform hover:scale-[0.98] active:scale-95">
          <Branding className="text-xl lg:text-2xl" />
        </Link>
        <nav className="flex items-center gap-10">
          <Link to="/" className="text-[11px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/60 hover:text-[#2F80ED] transition-colors hidden sm:block">
            EVENTS
          </Link>
          <Link to="/login" className="bg-[#2F80ED] text-white px-9 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-[0_10px_30px_-5px_rgba(47,128,237,0.3)] hover:bg-[#1F3A5F] transition-all">
            PORTAL LOGIN
          </Link>
        </nav>
      </div>
    </header>
    <main className="flex-1">{children}</main>
    <footer className="bg-[#F4F6F8] text-[#1F3A5F]/70 py-16 px-8 border-t border-white/80">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
          <div>
            <Branding className="text-2xl" />
            <p className="mt-4 text-sm font-medium max-w-sm text-[#1F3A5F]/60 leading-relaxed">
              Global-standard ticketing solutions for modern gatherings. Powered by StartupLab.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 lg:text-right uppercase tracking-[0.2em] font-black text-[9px]">
            <div className="space-y-4">
              <p className="text-[#1F3A5F]/40 mb-4">Platform</p>
              <Link to="/" className="block text-[#1F3A5F]/70 hover:text-[#2F80ED]">Events List</Link>
              <Link to="/login" className="block text-[#1F3A5F]/70 hover:text-[#2F80ED]">Admin Login</Link>
            </div>
            <div className="space-y-4">
              <p className="text-[#1F3A5F]/40 mb-4">Legal</p>
              <a href="#" className="block text-[#1F3A5F]/70 hover:text-[#2F80ED]">Privacy</a>
              <a href="#" className="block text-[#1F3A5F]/70 hover:text-[#2F80ED]">Terms</a>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-white/70 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-[9px] uppercase tracking-[0.3em] font-black text-[#1F3A5F]/50">
            © 2024 StartupLab Systems International
          </div>
          <div className="flex items-center gap-6 opacity-60 grayscale">
             <img src="https://www.hitpayapp.com/static/media/hitpay-logo.0f074558.png" alt="HitPay" className="h-3" />
          </div>
        </div>
      </div>
    </footer>
  </div>
);

const App: React.FC = () => (
  <Router>
    <Routes>
      <Route path="/login" element={<LoginPerspective />} />
      <Route path="/signup" element={<SignUpView />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/" element={<PublicLayout><EventList /></PublicLayout>} />
      <Route path="/events/:slug" element={<PublicLayout><EventDetails /></PublicLayout>} />
      <Route path="/events/:slug/register" element={<PublicLayout><RegistrationForm /></PublicLayout>} />
      <Route path="/payment/status" element={<PublicLayout><PaymentStatusView /></PublicLayout>} />
      <Route path="/tickets/:ticketId" element={<PublicLayout><TicketView /></PublicLayout>} />

      <Route path="/dashboard" element={<PortalLayout><AdminDashboard /></PortalLayout>} />
      <Route path="/events" element={<PortalLayout><EventsManagement /></PortalLayout>} />
      <Route path="/attendees" element={<PortalLayout><RegistrationsList /></PortalLayout>} />
      <Route path="/checkin" element={<PortalLayout><CheckIn /></PortalLayout>} />
      <Route path="/settings" element={<PortalLayout><SettingsView /></PortalLayout>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Router>
);
export default App;
