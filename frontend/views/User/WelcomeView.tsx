import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, PageLoader } from '../../components/Shared';
import { useUser } from '../../context/UserContext';
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
  const { role, email, name, imageUrl, isAuthenticated, isOnboarded, setUser } = useUser();
  const [isProfileStep, setIsProfileStep] = React.useState(false);

  const isGuestFromSignup = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('newAccount') === '1';
  }, [location.search]);

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
    if (!email) return;
    setUser({
      role: UserRole.ORGANIZER,
      email,
      name: name || saved.organizerName || null,
      imageUrl: resolveImageUrl(saved.profileImageUrl) || imageUrl || null,
      isOnboarded: true,
    });
    navigate('/user-home', { replace: true });
  }, [email, imageUrl, name, navigate, setUser]);

  if (isAuthenticated && role === UserRole.ORGANIZER && isProfileStep) {
    return (
      <div className="min-h-screen bg-[#F2F2F2] px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
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
    <div className="min-h-screen bg-[#F2F2F2] px-4 py-8 lg:px-6 lg:py-12">
      <div className="max-w-3xl mx-auto">
        <Card className="border border-[#2E2E2F]/10 rounded-xl p-6 lg:p-10">
          <img
            src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg"
            alt="StartupLab"
            className="h-10 lg:h-12 w-auto mb-8"
          />
          <p className="text-[10px] lg:text-[11px] font-black uppercase tracking-[0.2em] text-[#38BDF2] mb-4">
            Welcome
          </p>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-[#2E2E2F] leading-tight mb-4">
            Fast setup for your organizer workspace
          </h1>
          <p className="text-sm lg:text-base font-medium leading-relaxed text-[#2E2E2F]/70 mb-8">
            {isGuestFromSignup
              ? 'Your account was created. Check your email for verification, then sign in to continue your organizer setup.'
              : 'Complete your organizer profile to publish events, manage attendees, and unlock your event dashboard.'}
          </p>

          {isAuthenticated && role === UserRole.ORGANIZER ? (
            <div className="flex flex-col lg:flex-row gap-3">
              <Button
                onClick={() => setIsProfileStep(true)}
                className="w-full lg:w-auto px-7 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest"
              >
                Open Organizer Profile Setup
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/user-home')}
                className="w-full lg:w-auto px-7 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest border-[#2E2E2F]/15"
              >
                Continue to Dashboard
              </Button>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-3">
              <Link to="/login" className="w-full lg:w-auto">
                <Button className="w-full lg:w-auto px-7 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest">
                  Sign In to Continue
                </Button>
              </Link>
              <Link to="/" className="w-full lg:w-auto">
                <Button
                  variant="outline"
                  className="w-full lg:w-auto px-7 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest border-[#2E2E2F]/15"
                >
                  Back to Events
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default WelcomeView;

