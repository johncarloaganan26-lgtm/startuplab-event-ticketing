import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageLoader } from '../../components/Shared';
import { useUser } from '../../context/UserContext';
import { useEngagement } from '../../context/EngagementContext';
import { OrganizerProfile, UserRole } from '../../types';

const LazyOrganizerSettings = React.lazy(async () => {
  const mod = await import('./OrganizerSettings');
  return { default: mod.OrganizerSettings };
});

const getRoleHomePath = (role: UserRole): string => {
  if (role === UserRole.ADMIN) return '/dashboard';
  if (role === UserRole.STAFF) return '/events';
  if (role === UserRole.ATTENDEE) return '/browse-events';
  return '/user-home';
};

const resolveImageUrl = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const image = value as Record<string, string>;
    return image.publicUrl || image.url || image.path || null;
  }
  return null;
};

const WelcomeView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, role, email, name, imageUrl, isAuthenticated, isOnboarded, setUser } = useUser();
  const { setPublicMode } = useEngagement();
  const [isProfileStep, setIsProfileStep] = React.useState(false);

  React.useEffect(() => {
    if (!isAuthenticated || !role) return;
    if (role !== UserRole.ORGANIZER) {
      navigate(getRoleHomePath(role), { replace: true });
      return;
    }
    if (isOnboarded) {
      navigate('/user-home', { replace: true });
    }
  }, [isAuthenticated, role, isOnboarded, navigate]);

  const handleOrganizerSaved = React.useCallback((saved: OrganizerProfile) => {
    if (!email || !userId) return;
    setUser({
      userId,
      role: UserRole.ORGANIZER,
      email,
      name: name || saved.organizerName || undefined,
      imageUrl: resolveImageUrl(saved.profileImageUrl) || imageUrl || undefined,
      isOnboarded: true,
    });
    navigate('/user-home', { replace: true });
  }, [userId, email, imageUrl, name, navigate, setUser]);

  if (isAuthenticated && role === UserRole.ORGANIZER && isProfileStep) {
    return (
      <div className="h-screen bg-[#F2F2F2] px-4 py-6 sm:px-6 sm:py-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto" style={{ zoom: '0.8', transformOrigin: 'top center' }}>
          <div className="mb-4">
            <button
              onClick={() => setIsProfileStep(false)}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-widest text-[#2E2E2F]/60 hover:bg-[#2E2E2F]/5 hover:text-[#2E2E2F] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
          <React.Suspense fallback={<PageLoader label="Loading organizer setup..." variant="section" />}>
            <LazyOrganizerSettings onboardingMode onSaved={handleOrganizerSaved} />
          </React.Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#F2F2F2] flex flex-col font-sans selection:bg-[#38BDF2]/20 overflow-hidden">
      {/* Top Left Logo */}
      <div className="absolute top-0 left-8 z-20">
        <img
          src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg"
          alt="StartupLab"
          className="h-16 lg:h-20 w-auto"
        />
      </div>

      {/* Main Content Split - Centered horizontally and vertically */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24 px-10 lg:px-24">
        {/* Left Side: Content */}
        <div className="w-full lg:w-[480px] flex flex-col text-left mb-8 lg:mb-0">
          <h1 className="text-[42px] lg:text-[50px] font-black tracking-tight text-[#2E2E2F] leading-[1.05] mb-4">
            Welcome to <span className="text-[#38BDF2]">Startup</span>Lab!
          </h1>
          
          <p className="text-[20px] lg:text-[24px] font-bold text-[#2E2E2F] leading-tight mb-10 max-w-[400px]">
            Thanks for being here. What can we help you with first?
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Primary Action (matching Get Started style) */}
            <button 
              onClick={() => setIsProfileStep(true)}
              className="px-6 h-[52px] rounded-[12px] bg-[#38BDF2] border-2 border-[#38BDF2] hover:bg-[#2E2E2F] hover:border-[#2E2E2F] text-white text-[14px] font-bold tracking-wide transition-all shadow-[0_4px_20px_rgba(56,189,242,0.2)] active:scale-95 flex items-center justify-center whitespace-nowrap"
            >
              Complete Organization Profile
            </button>
            
            {/* Secondary Action (Pricing style) */}
            <button 
              onClick={() => {
                setPublicMode('attending');
                navigate('/browse-events');
              }}
              className="px-6 h-[52px] !bg-transparent !border-2 !border-solid !border-[#38BDF2] !text-[#38BDF2] hover:!bg-[#38BDF2] hover:!text-white rounded-[12px] text-[14px] font-bold tracking-wide transition-all active:scale-95 flex items-center justify-center whitespace-nowrap"
            >
              Browse Events
            </button>
          </div>
        </div>

        {/* Right Side: Hero Image - Respecting max height to prevent scroll */}
        <div className="w-full max-w-[400px] lg:max-w-none lg:w-[480px] xl:w-[540px] aspect-square relative group">
          <div className="absolute -inset-4 bg-[#38BDF2]/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          <div className="relative w-full h-full rounded-[12px] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.12)] bg-white/40 border border-[#2E2E2F]/5">
            <div className="absolute inset-0 bg-black/5"></div>
            <img
              src="/welcome-hero.png"
              alt="Welcome Hero"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-in-out"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeView;
