import React from 'react';

export type BrowseTabKey = 'ALL' | 'FOR_YOU' | 'TODAY' | 'THIS_WEEKEND';
export const ONLINE_LOCATION_VALUE = 'Online Events';

type BrowseEventsNavigatorProps = {
  activeTab: BrowseTabKey;
  onTabChange: (tab: BrowseTabKey) => void;
  selectedLocation: string;
  onLocationSelect: (location: string) => void;
  onLocationClear?: () => void;
  isLoading?: boolean;
  className?: string;
};

const TABS: Array<{ key: BrowseTabKey; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'FOR_YOU', label: 'For you' },
  { key: 'TODAY', label: 'Today' },
  { key: 'THIS_WEEKEND', label: 'This weekend' }
];

const reverseLookupCity = async (lat: number, lon: number): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

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

export const BrowseEventsNavigator: React.FC<BrowseEventsNavigatorProps> = ({
  activeTab,
  onTabChange,
  selectedLocation,
  onLocationSelect,
  onLocationClear,
  isLoading = false,
  className = ''
}) => {
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [locationError, setLocationError] = React.useState('');
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isLocationDropdownOpen) return;

    const handleOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLocationDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isLocationDropdownOpen]);

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported on this browser.');
      return;
    }

    setLocating(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const city = await reverseLookupCity(position.coords.latitude, position.coords.longitude);
          if (!city) {
            setLocationError('Could not detect city. Please search manually.');
            return;
          }
          onLocationSelect(city);
          setIsLocationDropdownOpen(false);
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Please allow location or search manually.');
          return;
        }
        setLocationError('Unable to get your current location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleBrowseOnlineEvents = () => {
    onLocationSelect(ONLINE_LOCATION_VALUE);
    setLocationError('');
    setIsLocationDropdownOpen(false);
  };

  const handleClearLocation = () => {
    if (onLocationClear) {
      onLocationClear();
    } else {
      onLocationSelect('');
    }
    setLocationError('');
    setIsLocationDropdownOpen(false);
  };

  return (
    <section className={`px-0 ${className}`}>
      <div>
        <p className="text-[22px] sm:text-[25px] md:text-[28px] font-black text-[#2E2E2F] tracking-tight leading-tight">
          Browsing events in{' '}
          <span className="relative inline-block" ref={dropdownRef}>
            <button
              type="button"
              className="inline-flex max-w-full items-center gap-1.5 text-left text-[#38BDF2] transition-colors duration-200 ease-in-out hover:text-[#2E2E2F]"
              onClick={() => {
                setIsLocationDropdownOpen((prev) => !prev);
                setLocationError('');
              }}
              aria-label="Choose location"
              aria-expanded={isLocationDropdownOpen}
            >
              <span className="truncate">{selectedLocation || 'Your Location'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isLocationDropdownOpen && (
              <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[300px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] shadow-[0_24px_50px_-20px_rgba(0,0,0,0.2)]">
                <button
                  type="button"
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left text-[#2E2E2F] hover:bg-[#38BDF2]/10 transition-colors border-b border-[#2E2E2F]/10 disabled:opacity-60"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                >
                  <span className="w-6 h-6 rounded-full border border-[#38BDF2]/50 flex items-center justify-center text-[#38BDF2]">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="3.2" />
                      <path strokeLinecap="round" d="M12 2.5v3m0 13v3M2.5 12h3m13 0h3M5 5l2.1 2.1m9.8 9.8L19 19M19 5l-2.1 2.1M7.1 16.9L5 19" />
                    </svg>
                  </span>
                  <span className="text-base font-medium">
                    {locating ? 'Detecting location...' : 'Use my current location'}
                  </span>
                </button>

                <button
                  type="button"
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left text-[#2E2E2F] hover:bg-[#38BDF2]/10 transition-colors border-b border-[#2E2E2F]/10"
                  onClick={handleBrowseOnlineEvents}
                >
                  <span className="w-6 h-6 rounded-xl border border-[#38BDF2]/50 flex items-center justify-center text-[#38BDF2]">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9l5 3-5 3V9z" />
                    </svg>
                  </span>
                  <span className="text-base font-medium">Browse online events</span>
                </button>

                <button
                  type="button"
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left text-red-500 hover:bg-red-500/5 transition-colors group/reset"
                  onClick={handleClearLocation}
                >
                  <span className="w-6 h-6 rounded-full border border-red-200 flex items-center justify-center text-red-400 group-hover/reset:text-red-500 group-hover/reset:border-red-400 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold uppercase tracking-wider">Clear Location</span>
                    <span className="text-[10px] opacity-70">Reset to all areas</span>
                  </div>
                </button>

                {locationError && (
                  <div className="px-4 py-3 text-xs font-semibold text-[#2E2E2F] bg-[#F2F2F2] border-t border-[#2E2E2F]/10">
                    {locationError}
                  </div>
                )}
              </div>
            )}
          </span>
        </p>
      </div>

      <div className="mt-5 border-b border-[#2E2E2F]/10">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 md:gap-7">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`relative pb-3 text-lg sm:text-xl font-semibold tracking-tight transition-all duration-300 ease-in-out ${isActive ? 'text-[#38BDF2] font-bold' : 'text-[#2E2E2F]/65 hover:text-[#38BDF2]'}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
                <span
                  className={`absolute left-0 -bottom-px h-[2px] bg-[#38BDF2] transition-all duration-300 ease-in-out ${isActive ? 'w-full opacity-100' : 'w-0 opacity-0'}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className={isLoading ? 'mt-2 min-h-[20px]' : 'mt-0 min-h-0'}>
        {isLoading && (
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#2E2E2F]/60">
            <span className="w-3 h-3 border-2 border-[#2E2E2F]/40 border-t-transparent rounded-full animate-spin" />
            Updating event list...
          </div>
        )}
      </div>
    </section>
  );
};

