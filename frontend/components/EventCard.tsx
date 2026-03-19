import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../constants';

export type EventCardData = {
  eventId: string;
  eventName: string;
  image_url?: string;
  startAt: string;
  locationText: string;
  organizerName: string;
  price_min?: number;
  is_promoted?: boolean;
  promotionEndDate?: string;
  likesCount?: number;
  ticketsAvailable?: number;
  totalTickets?: number;
  avgRating?: number;
  reviewCount?: number;
};

type EventCardProps = {
  event: EventCardData;
  onEventClick?: (eventId: string) => void;
};

const BRAND_LOGO_URL = 'https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg';

export const EventCard: React.FC<EventCardProps> = ({ event, onEventClick }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onEventClick) {
      onEventClick(event.eventId);
    } else {
      navigate(`/events/${event.eventId}`);
    }
  };

  const eventDate = event.startAt ? new Date(event.startAt) : null;
  const dateStr = eventDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || '';
  const timeStr = eventDate?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) || '';

  const ticketPercentage = event.totalTickets && event.ticketsAvailable
    ? ((event.totalTickets - event.ticketsAvailable) / event.totalTickets) * 100
    : 0;

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer group rounded-xl overflow-hidden border border-transparent hover:border-[#2E2E2F]/10 bg-[#F2F2F2] transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
    >
      {/* Image Container */}
      <div className="relative overflow-hidden h-64 md:h-72 bg-[#F2F2F2]">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.eventName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-[#38BDF2] to-[#2E2E2F]">
            <img
              src={BRAND_LOGO_URL}
              alt="StartupLab"
              className="w-20 h-20 object-contain opacity-40 brightness-0 invert drop-shadow-2xl"
            />
          </div>
        )}

        {/* Promoted Badge - Top Right */}
        {event.is_promoted && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl text-xs font-black text-[#2E2E2F] flex items-center gap-1.5 shadow-md animate-in fade-in slide-in-from-top-2 duration-500">
            <ICONS.Info className="w-4 h-4 text-[#38BDF2]" strokeWidth={2.5} />
            <span>PROMOTED</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 space-y-3">
        {/* Title */}
        <h3 className="font-black text-[#2E2E2F] text-2xl line-clamp-2 group-hover:text-[#38BDF2] transition-colors leading-tight">
          {event.eventName}
        </h3>

        {/* Organizer */}
        <p className="text-xs text-[#2E2E2F]/60 font-bold uppercase tracking-widest">
          {event.organizerName}
        </p>

        {/* Date & Location */}
        <div className="space-y-1.5 text-sm text-[#2E2E2F]/70 font-bold">
          <div className="flex items-center gap-2">
            <ICONS.Calendar className="w-4 h-4 text-[#38BDF2]" strokeWidth={2.5} />
            <span>{dateStr}</span>
            {timeStr && <span className="text-[#2E2E2F]/50">•</span>}
            {timeStr && <span>{timeStr}</span>}
          </div>
          <div className="flex items-center gap-2">
            <ICONS.MapPin className="w-4 h-4 text-[#38BDF2]" strokeWidth={2.5} />
            <span className="line-clamp-1">{event.locationText}</span>
          </div>
        </div>

        {/* Strict Hover-only Divider */}
        <div className="h-[1px] w-full bg-[#2E2E2F]/10 invisible group-hover:visible group-hover:opacity-100 transition-all duration-300" />

        {/* Rating & Price */}
        <div className="flex items-center justify-between text-sm font-bold">
          <div className="flex items-center gap-1.5">
            {event.avgRating && event.avgRating > 0 ? (
              <>
                <span className="text-warn">⭐</span>
                <span className="text-[#2E2E2F]">{event.avgRating.toFixed(1)}</span>
                <span className="text-[#2E2E2F]/60 text-xs">({event.reviewCount || 0})</span>
              </>
            ) : (
              <span className="text-[#2E2E2F]/50 text-xs">No ratings yet</span>
            )}
          </div>
          <div className="font-black text-[#38BDF2]">
            {(() => {
              const now = new Date();
              const eventStart = event.startAt ? new Date(event.startAt) : null;
              const eventEnd = eventStart ? new Date(eventStart.getTime() + 2 * 60 * 60 * 1000) : null; // Fallback to 2h window
              const isDone = eventEnd && now > eventEnd;

              if (isDone) return <span className="text-xs text-[#2E2E2F]/40 uppercase tracking-widest">Event Ended</span>;

              return event.price_min === 0 ? (
                <span className="text-[11px] uppercase tracking-[0.15em] font-semibold">FREE</span>
              ) : typeof event.price_min === 'number' ? (
                <span className="text-[11px] uppercase tracking-[0.15em] font-semibold">₱{event.price_min?.toLocaleString()}</span>
              ) : (
                <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[#2E2E2F]/60">Check pricing</span>
              );
            })()}
          </div>
        </div>

        {/* Ticket Progress (if available) */}
        {event.ticketsAvailable !== undefined && event.totalTickets !== undefined && (
          <div className="space-y-1">
            <div className="w-full bg-[#F2F2F2] rounded-full h-1.5">
              <div
                className="bg-[#38BDF2] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(ticketPercentage, 100)}%` }}
              />
            </div>
            <p className="text-[8px] font-black uppercase tracking-widest text-[#2E2E2F]/50">
              {event.ticketsAvailable} of {event.totalTickets} available
            </p>
          </div>
        )}

        {/* Promoted Duration (if promoted) */}
        {event.is_promoted && event.promotionEndDate && (
          <div className="pt-2">
            <p className="text-[8px] text-[#38BDF2] font-black uppercase tracking-widest flex items-center gap-1">
              <ICONS.Info className="w-3 h-3" strokeWidth={2.5} />
              {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
                new Date(event.promotionEndDate)
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

