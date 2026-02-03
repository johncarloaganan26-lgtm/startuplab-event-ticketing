import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Event } from '../../types';
import { Card, Button, PageLoader } from '../../components/Shared';
import { ICONS } from '../../constants';

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

const EventCard: React.FC<{ event: Event }> = ({ event }) => {
  const navigate = useNavigate();
  // Safe calculation for minPrice if ticketTypes exist
  const minPrice = event.ticketTypes?.length 
    ? Math.min(...event.ticketTypes.map(t => t.priceAmount)) 
    : 0;
  
  // Registration window label
  const now = new Date();
  const regOpen = event.regOpenAt ? new Date(event.regOpenAt) : null;
  const regClose = event.regCloseAt ? new Date(event.regCloseAt) : null;
  const regLabel = regOpen && now < regOpen
    ? `Opens ${formatDate(regOpen.toISOString(), event.timezone, { year: 'numeric', month: 'short', day: 'numeric' })}`
    : regClose
      ? `Closes ${formatDate(regClose.toISOString(), event.timezone, { year: 'numeric', month: 'short', day: 'numeric' })}`
      : '';
  
  return (
    <Card 
      className="flex flex-col h-full group cursor-pointer border-none shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12)] transition-all duration-700 rounded-[1.5rem] overflow-hidden bg-white"
      onClick={() => navigate(`/events/${event.slug}`)}
    >
      {/* Image Section */}
      <div className="relative h-52 overflow-hidden">
        <img 
          src={getImageUrl(event.imageUrl)}
          alt={event.eventName} 
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1F3A5F]/90 via-[#1F3A5F]/25 to-transparent opacity-80"></div>
        
        <div className="absolute top-5 right-5">
          <div className="bg-[#56CCF2]/15 backdrop-blur-md px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-[#56CCF2]/30 text-[#2F80ED]">
            {event.status}
          </div>
        </div>
        <div className="absolute top-5 left-5">
          <div className="bg-white/70 backdrop-blur-md px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/40 text-[#1F3A5F]">
            {event.locationType}
          </div>
        </div>

        <div className="absolute bottom-6 left-8 right-8">
           <h4 className="text-white text-lg font-black tracking-tight leading-tight line-clamp-2 drop-shadow-sm">
            {event.eventName}
          </h4>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-5">
           <div className="text-[10px] font-bold text-[#1F3A5F]/60 uppercase tracking-[0.15em] flex items-center gap-1.5">
            <span className="w-1 h-1 bg-[#56CCF2] rounded-full"></span>
             {event.registrationCount ?? 0} REGISTERED / {event.capacityTotal} SLOTS
           </div>
        </div>
        
        <p className="text-[#1F3A5F]/70 text-[13px] font-medium line-clamp-2 mb-6 leading-relaxed opacity-90">
          {event.description}
        </p>
        
        <div className="mt-auto space-y-4 mb-8">
          <div className="flex items-center text-[10px] font-black text-[#1F3A5F]/80 uppercase tracking-[0.25em]">
            <ICONS.Calendar className="w-4 h-4 mr-3 text-[#2F80ED] shrink-0" />
            {formatStartForCard(event.startAt, event.timezone)}
          </div>
          <div className="flex items-center text-[10px] font-black text-[#1F3A5F]/60 uppercase tracking-[0.2em]">
            <ICONS.MapPin className="w-4 h-4 mr-3 text-[#56CCF2] shrink-0" />
            <span className="truncate">{event.locationText || 'Location TBA'}</span>
          </div>
          {regLabel && (
            <div className="flex items-center text-[10px] font-black text-[#1F3A5F]/60 uppercase tracking-[0.2em]">
              <span className="w-1 h-1 bg-[#56CCF2] rounded-full mr-3"></span>
              {regLabel}
            </div>
          )}
        </div>

        {/* Pricing Area */}
        <div className="flex items-center justify-between pt-5 mt-auto border-t border-[#F4F6F8]">
          <div>
            <span className="text-[9px] text-[#1F3A5F]/40 uppercase tracking-[0.3em] font-black block mb-1">STARTING FROM</span>
            <p className="text-xl font-black text-[#1F3A5F] tracking-tighter">
              {minPrice === 0 ? <span className="text-[#2F80ED]">FREE</span> : `PHP ${minPrice.toLocaleString()}`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#2F80ED] text-white flex items-center justify-center transition-all hover:bg-[#1F3A5F] shadow-[0_10px_25px_-5px_rgba(47,128,237,0.35)] hover:shadow-[0_15px_30px_-5px_rgba(31,58,95,0.25)] hover:scale-105 active:scale-95">
            <ICONS.ChevronRight className="w-5 h-5" strokeWidth={3} />
          </div>
        </div>
      </div>
    </Card>
  );
};

export const EventList: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 6, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const initialLoadRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 350);
    return () => window.clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const fetchData = async () => {
      const requestId = ++requestIdRef.current;
      if (initialLoadRef.current) {
        setLoading(true);
      } else {
        setIsFetching(true);
      }
      try {
        const data = await apiService.getEvents(currentPage, 6, debouncedSearch);
        if (requestId !== requestIdRef.current) return;
        setEvents(data.events || []);
        setPagination(data.pagination || { page: 1, limit: 6, total: 0, totalPages: 1 });
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error('Failed to load events:', error);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setIsFetching(false);
          initialLoadRef.current = false;
        }
      }
    };
    fetchData();
  }, [currentPage, debouncedSearch]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const paginatedEvents = useMemo(() => events, [events]);

  if (loading) return (
    <PageLoader label="Syncing Executive Portal..." />
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 lg:py-10 animate-in fade-in duration-1000">
      {/* Landing Experience Hero Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 gap-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#2F80ED] text-[10px] text-white font-black uppercase tracking-[0.2em] mb-4 shadow-[0_12px_30px_-16px_rgba(47,128,237,0.5)]">
             <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
             ACTIVE REGISTRATION PORTAL
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-[#1F3A5F] tracking-tighter leading-tight mb-5">
            Curated Industry <br />
            <span className="text-[#2F80ED] italic">Excellence</span>
          </h1>
          <p className="text-[#1F3A5F]/70 text-sm lg:text-base font-medium leading-relaxed max-w-lg">
            Access world-class summits, masterclasses, and executive networking sessions curated for innovators.
          </p>
        </div>
        
        <div className="w-full lg:w-[360px] shrink-0 lg:pb-2">
           <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-[#56CCF2] group-focus-within:text-[#2F80ED] transition-colors">
               <ICONS.Search className="h-4 w-4" strokeWidth={3} />
             </div>
             <input 
              type="text" 
              placeholder="Search active sessions..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-12 pr-12 py-3.5 bg-white border border-[#F4F6F8] rounded-[1.5rem] text-[13px] font-bold shadow-[0_12px_30px_-12px_rgba(31,58,95,0.08)] transition-all focus:outline-none focus:ring-4 focus:ring-[#2F80ED]/15 focus:border-[#2F80ED] placeholder:text-[#1F3A5F]/40 placeholder:font-black placeholder:uppercase placeholder:tracking-widest placeholder:text-[10px]"
             />
             <div className="absolute inset-y-0 right-0 pr-5 flex items-center text-[#2F80ED]/70">
               {(isFetching || searchTerm.trim() !== debouncedSearch) && (
                 <div className="w-4 h-4 border-2 border-[#2F80ED]/60 border-t-transparent rounded-full animate-spin" />
               )}
             </div>
           </div>
        </div>
      </div>

      {/* Grid Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
        {paginatedEvents.map((event, idx) => (
          <div key={event.eventId} className="animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both" style={{ animationDelay: `${(idx % (pagination.limit || 6)) * 100}ms` }}>
            <EventCard event={event} />
          </div>
        ))}
      </div>
      
      {/* Pagination Controller */}
      {totalPages > 1 && (
        <div className="mt-20 flex items-center justify-center gap-2">
           <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-[1.5rem] border border-[#F4F6F8] shadow-sm">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => handlePageChange(i + 1)}
                  className={`w-10 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                    currentPage === i + 1 
                    ? 'bg-[#1F3A5F] text-white shadow-[0_10px_25px_-15px_rgba(31,58,95,0.35)]' 
                    : 'text-[#1F3A5F]/50 hover:text-[#1F3A5F] hover:bg-[#F4F6F8]'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
           </div>
        </div>
      )}
      
      {/* Empty State */}
      {events.length === 0 && (
        <div className="py-20 px-8 text-center bg-white rounded-[2.5rem] border border-[#F4F6F8] shadow-sm">
          <div className="w-14 h-14 bg-[#F4F6F8] rounded-full flex items-center justify-center mx-auto mb-6">
            <ICONS.Search className="w-7 h-7 text-[#56CCF2]/60" />
          </div>
          <h3 className="text-2xl font-black text-[#1F3A5F] tracking-tighter mb-4">No active sessions found</h3>
          <Button 
            variant="outline" 
            className="px-8 py-3 rounded-xl font-black uppercase tracking-[0.3em] text-[9px] border-2 border-[#2F80ED]/30 transition-all hover:bg-[#F4F6F8]"
            onClick={() => setSearchTerm('')}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
};