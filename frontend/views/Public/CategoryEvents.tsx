import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Event } from '../../types';
import { Card, Button, PageLoader } from '../../components/Shared';
import { ICONS } from '../../constants';
import { getCategoryByKey, getEventCategoryKeys } from '../../utils/eventCategories';

const getImageUrl = (img: any): string => {
  if (!img) return 'https://via.placeholder.com/800x400';
  if (typeof img === 'string') return img;
  return img.url || img.path || img.publicUrl || 'https://via.placeholder.com/800x400';
};

const formatDate = (iso: string, timezone?: string, opts?: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone || 'UTC', ...opts }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
};

function formatTime(dateString: string, timezone?: string) {
  const d = new Date(dateString);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(timezone ? { timeZone: timezone } : {})
  }).replace(':00', '');
}

const CategoryEventCard: React.FC<{ event: Event }> = ({ event }) => {
  const navigate = useNavigate();

  return (
    <Card className="flex flex-col h-full border border-[#2E2E2F]/10 rounded-xl overflow-hidden bg-[#F2F2F2] hover:border-[#38BDF2]/40 transition-colors cursor-pointer" onClick={() => navigate(`/events/${event.slug}`)}>
      <div className="relative h-52 overflow-hidden">
        <img src={getImageUrl(event.imageUrl)} alt={event.eventName} className="w-full h-full object-cover" />
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <h4 className="text-[#2E2E2F] text-xl font-bold tracking-tight leading-tight mb-2 line-clamp-2">{event.eventName}</h4>
        <div className="text-[#2E2E2F]/70 text-[13px] font-medium mb-3 line-clamp-2">
          {(event as any).summaryLine || 'Explore sessions under this category and book your seats instantly.'}
        </div>
        <div className="flex flex-wrap gap-2 text-[12px] font-medium text-[#2E2E2F]/70 mb-3">
          <span>{event.locationText}</span>
          <span className="text-[#2E2E2F]/60">•</span>
          <span>{formatDate(event.startAt, event.timezone, { day: 'numeric', month: 'short', year: 'numeric' })} · {formatTime(event.startAt, event.timezone)}</span>
        </div>
        <div className="text-[#2E2E2F]/70 text-[13px] font-medium mb-6 leading-relaxed">
          {(event.description || '').length > 120 ? `${event.description.slice(0, 120)}...` : event.description}
        </div>
      </div>
    </Card>
  );
};

export const CategoryEvents: React.FC = () => {
  const { categoryKey = '' } = useParams<{ categoryKey: string }>();
  const category = getCategoryByKey(categoryKey);
  const [events, setEvents] = React.useState<Event[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;

    const fetchAllEvents = async () => {
      if (!category) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const pageSize = 50;
        const firstPage = await apiService.getEvents(1, pageSize, '');
        let mergedEvents: Event[] = firstPage.events || [];
        const totalPages = Math.max(1, firstPage.pagination?.totalPages || 1);

        if (totalPages > 1) {
          const fetchers: Promise<{ events: Event[]; pagination: any }>[] = [];
          for (let page = 2; page <= totalPages; page += 1) {
            fetchers.push(apiService.getEvents(page, pageSize, ''));
          }
          const remaining = await Promise.all(fetchers);
          mergedEvents = mergedEvents.concat(...remaining.map((result) => result.events || []));
        }

        const filtered = mergedEvents.filter((event) => getEventCategoryKeys(event).includes(category.key));
        if (!cancelled) setEvents(filtered);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAllEvents();
    return () => { cancelled = true; };
  }, [category?.key]);

  const visibleEvents = React.useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) => {
      const text = `${event.eventName || ''} ${event.description || ''} ${event.locationText || ''}`.toLowerCase();
      return text.includes(needle);
    });
  }, [events, searchTerm]);

  if (loading) return <PageLoader label="Loading category events..." />;

  if (!category) {
    return (
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-20">
        <div className="py-20 px-8 text-center bg-[#F2F2F2] rounded-xl border border-[#2E2E2F]/10">
          <h3 className="text-2xl font-bold text-[#2E2E2F] tracking-tight mb-4">Category not found</h3>
          <Link to="/">
            <Button variant="outline" className="px-4">Back to Events</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-12 pb-20">
      <div className="mb-14">
        <Link
          to="/"
          className="text-[#2E2E2F] hover:text-[#38BDF2] text-[11px] font-black tracking-widest uppercase flex items-center mb-8 gap-2 transition-colors"
        >
          <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
          BACK TO EVENTS
        </Link>

        <div className="rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] p-8 md:p-10">
          <div className="w-20 h-20 rounded-full border border-[#38BDF2]/40 bg-[#38BDF2]/20 flex items-center justify-center text-[#2E2E2F] mb-5">
            <category.Icon className="w-9 h-9" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-[#2E2E2F] tracking-tight leading-tight">{category.label}</h1>
          <p className="mt-3 text-[#2E2E2F]/60 text-base md:text-lg font-medium">All published events under this category.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 gap-8">
        <div className="flex-1">
          <h2 className="text-3xl lg:text-4xl font-black text-[#2E2E2F] tracking-tight mb-2">{visibleEvents.length} Event{visibleEvents.length === 1 ? '' : 's'}</h2>
          <p className="text-[#2E2E2F]/50 font-medium">Refined by category: {category.label}</p>
        </div>
        <div className="w-full md:w-[280px] lg:w-[360px]">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-[#2E2E2F]/30 group-focus-within:text-[#38BDF2] transition-colors">
              <ICONS.Search className="h-4 w-4" strokeWidth={3} />
            </div>
            <input
              type="text"
              placeholder="Search in this category..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="block w-full pl-12 pr-12 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl text-[13px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/20 focus:border-[#38BDF2] placeholder:text-[#2E2E2F]/30"
            />
          </div>
        </div>
      </div>

      {visibleEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          {visibleEvents.map((event) => (
            <div key={event.eventId}>
              <CategoryEventCard event={event} />
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 px-8 text-center bg-[#F2F2F2] rounded-xl border border-[#2E2E2F]/10">
          <div className="w-14 h-14 bg-[#F2F2F2] rounded-full flex items-center justify-center mx-auto mb-6 border border-[#2E2E2F]/10">
            <ICONS.Search className="w-7 h-7 text-[#2E2E2F]/60" />
          </div>
          <h3 className="text-2xl font-bold text-[#2E2E2F] tracking-tight mb-4">No events found in {category.label}</h3>
          <Link to="/">
            <Button variant="outline" className="px-4">Back to Events</Button>
          </Link>
        </div>
      )}
    </div>
  );
};

