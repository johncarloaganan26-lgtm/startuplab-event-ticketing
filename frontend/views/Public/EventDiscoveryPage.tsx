import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Event, UserRole } from '../../types';
import { Button, PageLoader } from '../../components/Shared';
import { ICONS } from '../../constants';
import { EVENT_CATEGORIES, getEventCategoryKeys } from '../../utils/eventCategories';
import { useUser } from '../../context/UserContext';
import { useEngagement } from '../../context/EngagementContext';
import { EventCard } from './EventList';

export const EventDiscoveryPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { role } = useUser();
    const { likedEventIds } = useEngagement();

    // State for search and filters
    const [searchTerm, setSearchTerm] = useState('');
    const [locationTerm, setLocationTerm] = useState('');

    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('all');
    const [selectedPrice, setSelectedPrice] = useState<string>('all');
    const [selectedFormat, setSelectedFormat] = useState<string>('all');
    const [showFollowedOnly, setShowFollowedOnly] = useState(false);
    const [sortBy, setSortBy] = useState<string>('relevance');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const [sectionsOpen, setSectionsOpen] = useState({
        categories: true,
        date: true,
        price: true,
        format: true,
        advanced: true
    });

    const toggleSection = (section: keyof typeof sectionsOpen) => {
        setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Data state
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [interactionNotice, setInteractionNotice] = useState('');

    // Sync state with URL params
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const search = params.get('search') || '';
        const loc = params.get('location') || '';

        setSearchTerm(search);
        setLocationTerm(loc);

        // When URL params change, we fetch new data
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch events from backend with search and location filters
                const data = await apiService.getEvents(1, 100, search, loc);
                setEvents(data.events || []);
            } catch (err) {
                console.error('Failed to fetch discovery events', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [location.search]);

    // Filtering logic (Frontend filters on top of backend results)
    const filteredEvents = useMemo(() => {
        return events.filter(event => {
            if (selectedCategories.length > 0) {
                const eventCats = getEventCategoryKeys(event);
                if (!selectedCategories.some(cat => eventCats.includes(cat as any))) return false;
            }

            if (selectedFormat === 'online' && event.locationType !== 'ONLINE') return false;
            if (selectedFormat === 'in-person' && event.locationType === 'ONLINE') return false;

            const minPrice = event.ticketTypes?.length
                ? Math.min(...event.ticketTypes.map(t => t.priceAmount))
                : 0;
            if (selectedPrice === 'free' && minPrice > 0) return false;
            if (selectedPrice === 'paid' && minPrice === 0) return false;

            const eventDate = new Date(event.startAt);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate === 'today') {
                const tonight = new Date(today);
                tonight.setHours(23, 59, 59, 999);
                if (!(eventDate >= today && eventDate <= tonight)) return false;
            } else if (selectedDate === 'tomorrow') {
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                const tomorrowNight = new Date(tomorrow);
                tomorrowNight.setHours(23, 59, 59, 999);
                if (!(eventDate >= tomorrow && eventDate <= tomorrowNight)) return false;
            } else if (selectedDate === 'weekend') {
                const day = today.getDay();
                const diff = day === 0 ? 0 : 6 - day;
                const sat = new Date(today);
                sat.setDate(today.getDate() + diff);
                const sun = new Date(sat);
                sun.setDate(sat.getDate() + 1);
                sun.setHours(23, 59, 59, 999);
                if (!(eventDate >= sat && eventDate <= sun)) return false;
            }

            if (showFollowedOnly) {
                const organizerId = event.organizerId || event.organizer?.organizerId || '';
                if (!organizerId || !likedEventIds.includes(organizerId)) return false;
            }

            return true;
        }).sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
            }
            if (sortBy === 'price_low') {
                const aPrice = a.ticketTypes?.length ? Math.min(...a.ticketTypes.map(t => t.priceAmount)) : 0;
                const bPrice = b.ticketTypes?.length ? Math.min(...b.ticketTypes.map(t => t.priceAmount)) : 0;
                return aPrice - bPrice;
            }
            if (sortBy === 'date_soon') {
                return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
            }
            return 0; // Default relevance
        });
    }, [events, selectedCategories, selectedDate, selectedPrice, selectedFormat, showFollowedOnly, likedEventIds, sortBy]);

    const toggleCategory = (catKey: string) => {
        setSelectedCategories(prev =>
            prev.includes(catKey) ? prev.filter(k => k !== catKey) : [...prev, catKey]
        );
    };

    if (loading) return <PageLoader label="Discovering events..." variant="page" />;

    return (
        <div className="flex min-h-screen bg-[#F2F2F2]">
            {/* Edge Left Filter Sidebar */}
            <aside
                className={`hidden lg:block bg-white/40 backdrop-blur-xl border-r border-[#2E2E2F]/5 sticky top-0 h-screen overflow-y-auto transition-all duration-500 ease-in-out z-20 ${isSidebarCollapsed ? 'w-20' : 'w-[340px]'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Header for Filter */}
                    <div className="p-8 border-b border-[#2E2E2F]/5 flex items-center justify-between">
                        {!isSidebarCollapsed && (
                            <div>
                                <h1 className="text-[22px] font-black text-[#2E2E2F] tracking-tighter uppercase leading-none">Filters</h1>
                                <p className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mt-2">Personalize Feed</p>
                            </div>
                        )}
                        <button
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                            className={`w-10 h-10 rounded-2xl bg-[#F2F2F2] border border-[#2E2E2F]/10 flex items-center justify-center text-[#2E2E2F] hover:bg-[#38BDF2] hover:text-white transition-all transform active:scale-90 ${isSidebarCollapsed ? 'mx-auto' : ''}`}
                        >
                            <svg className={`w-5 h-5 transition-transform duration-500 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>

                    {!isSidebarCollapsed && (
                        <div className="flex-1 p-8 space-y-12 scrollbar-hide">
                            {/* Category Area */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-[0.1em] text-[#2E2E2F]">Category</h3>
                                    {selectedCategories.length > 0 && (
                                        <button
                                            onClick={() => setSelectedCategories([])}
                                            className="text-[10px] font-bold text-[#38BDF2] hover:text-[#2E2E2F] transition-colors"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    {EVENT_CATEGORIES.slice(0, 15).map(cat => {
                                        const isChecked = selectedCategories.includes(cat.key);
                                        return (
                                            <button
                                                key={cat.key}
                                                onClick={() => toggleCategory(cat.key)}
                                                className={`flex items-center gap-4 w-full group transition-all ${isChecked ? 'text-[#38BDF2]' : 'text-[#2E2E2F]/70 hover:text-[#38BDF2]'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isChecked ? 'bg-[#38BDF2]/10' : 'bg-[#F2F2F2] group-hover:bg-[#38BDF2]/5'
                                                    }`}>
                                                    <cat.Icon className="w-4 h-4" />
                                                </div>
                                                <span className="font-bold text-sm tracking-tight">{cat.label}</span>
                                            </button>
                                        );
                                    })}
                                    <button className="text-xs font-bold text-[#38BDF2] pt-2 hover:underline">View more</button>
                                </div>
                            </div>

                            {/* Occurrence Area */}
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-[0.1em] text-[#2E2E2F]">Occurrence</h3>
                                <div className="space-y-3">
                                    {[
                                        { id: 'all', label: 'Any time' },
                                        { id: 'today', label: 'Today' },
                                        { id: 'tomorrow', label: 'Tomorrow' },
                                        { id: 'weekend', label: 'Weekend' },
                                    ].map(date => (
                                        <button
                                            key={date.id}
                                            onClick={() => setSelectedDate(date.id)}
                                            className={`flex items-center gap-3 w-full group transition-all ${selectedDate === date.id ? 'text-[#38BDF2]' : 'text-[#2E2E2F]/70 hover:text-[#38BDF2]'
                                                }`}
                                        >
                                            <div className={`w-2 h-2 rounded-full transition-all ${selectedDate === date.id ? 'bg-[#38BDF2] scale-125' : 'bg-[#2E2E2F]/10'}`} />
                                            <span className="font-bold text-sm tracking-tight">{date.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Price Area */}
                            <div className="space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-[0.1em] text-[#2E2E2F]">Price Format</h3>
                                <div className="flex flex-col gap-3">
                                    {[
                                        { id: 'all', label: 'All', icon: ICONS.Layout },
                                        { id: 'free', label: 'Free', icon: ICONS.Check },
                                        { id: 'paid', label: 'Paid', icon: ICONS.CreditCard },
                                    ].map(price => (
                                        <button
                                            key={price.id}
                                            onClick={() => setSelectedPrice(price.id)}
                                            className={`flex items-center gap-4 w-full group transition-all ${selectedPrice === price.id ? 'text-[#38BDF2]' : 'text-[#2E2E2F]/70 hover:text-[#38BDF2]'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${selectedPrice === price.id ? 'bg-[#38BDF2]/10' : 'bg-[#F2F2F2] group-hover:bg-[#38BDF2]/5'}`}>
                                                <price.icon className="w-4 h-4" />
                                            </div>
                                            <span className="font-bold text-sm tracking-tight">{price.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 h-screen overflow-y-auto scrollbar-hide">
                {/* Modern Banner */}
                <section className="relative w-full h-[400px] overflow-hidden">
                    <div className="absolute inset-0 bg-[#2E2E2F]" />
                    {/* Animated Gradient Background */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,#38BDF2_0%,transparent_50%),radial-gradient(circle_at_0%_100%,#38BDF2_0%,transparent_50%)] opacity-30 animate-pulse" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#2E2E2F]/50 to-[#F2F2F2]" />

                    <div className="relative z-10 h-full flex flex-col justify-center px-8 sm:px-16 max-w-[1400px]">
                        <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 w-fit mb-8 animate-in slide-in-from-left duration-700">
                            <span className="w-2 h-2 rounded-full bg-[#38BDF2] animate-ping" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Live Discovery Mode</p>
                        </div>
                        <h1 className="text-6xl sm:text-8xl font-black text-white tracking-tighter leading-[0.85] uppercase mb-8 animate-in slide-in-from-left duration-1000">
                            Find Your <br />
                            <span className="text-[#38BDF2]">Perspective.</span>
                        </h1>
                        <p className="max-w-[580px] text-lg font-medium text-white/60 leading-relaxed mb-10 animate-in slide-in-from-left duration-700 delay-200">
                            Explore hundreds of professional sessions curated for the next generation of industry leaders. Use the edge filters to narrow down your search.
                        </p>
                    </div>
                </section>

                <div className="px-8 sm:px-16 py-12 max-w-[1400px]">
                    {/* Results Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 pb-8 border-b border-[#2E2E2F]/5">
                        <div className="space-y-2">
                            <h2 className="text-4xl font-black text-[#2E2E2F] tracking-tighter uppercase leading-none">
                                {locationTerm ? `Events in ${locationTerm}` : 'Explore All Sessions'}
                            </h2>
                            <p className="text-[11px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em]">
                                {filteredEvents.length} Sessions detected based on your criteria
                            </p>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border border-[#2E2E2F]/5 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/40">Sort By</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-[#2E2E2F] outline-none cursor-pointer"
                                >
                                    <option value="relevance">Relevance</option>
                                    <option value="newest">Newest Arrivals</option>
                                    <option value="date_soon">Soonest Date</option>
                                    <option value="price_low">Price: Low to High</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Event Grid */}
                    {filteredEvents.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
                            {filteredEvents.map((event, idx) => (
                                <div key={event.eventId} className="animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${idx * 50}ms` }}>
                                    <EventCard event={event} onActionNotice={setInteractionNotice} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-32 flex flex-col items-center text-center">
                            <div className="w-24 h-24 bg-[#F2F2F2] rounded-[2rem] border-2 border-[#2E2E2F]/5 flex items-center justify-center mb-8">
                                <ICONS.Search className="w-10 h-10 text-[#2E2E2F]/10" />
                            </div>
                            <h3 className="text-2xl font-black text-[#2E2E2F] uppercase tracking-tighter mb-4">No Sessions Matching Selection</h3>
                            <p className="text-[#2E2E2F]/40 text-sm font-medium max-w-[320px] mb-10 leading-relaxed">
                                We couldn't find any results specifically for these filters. Try broadening your date or category selection.
                            </p>
                            <Button
                                className="px-12 py-5 rounded-2xl font-black uppercase tracking-widest bg-[#2E2E2F] text-white hover:bg-[#38BDF2] transition-colors"
                                onClick={() => {
                                    navigate('/browse-events');
                                    setSelectedCategories([]);
                                    setSelectedDate('all');
                                    setSelectedPrice('all');
                                    setSelectedFormat('all');
                                }}
                            >
                                Reset All Parameters
                            </Button>
                        </div>
                    )}
                </div>
            </main>

            {/* Interaction Notification Toast */}
            {interactionNotice && (
                <div className="fixed bottom-12 right-12 z-[100] animate-in slide-in-from-bottom-6 duration-500">
                    <div className="bg-[#2E2E2F] text-white px-8 py-6 rounded-[2.5rem] shadow-2xl flex items-center gap-5 border border-white/10 backdrop-blur-xl">
                        <div className="w-10 h-10 rounded-2xl bg-[#38BDF2] flex items-center justify-center">
                            <ICONS.Check className="w-5 h-5 text-white" strokeWidth={4} />
                        </div>
                        <div className="pr-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#38BDF2] mb-1">System Update</p>
                            <p className="text-sm font-bold tracking-tight">{interactionNotice}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
