
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Event, UserRole, TicketType, RegistrationView, EventStatus, Ticket } from '../../types';
import { Card, Badge, Button, Modal, Input, PageLoader } from '../../components/Shared';
import { ICONS } from '../../constants';
import { useUser } from '../../context/UserContext';

// Helper to handle JSONB image format
const getImageUrl = (img: any): string => {
  if (!img) return 'https://via.placeholder.com/800x400';
  if (typeof img === 'string') return img;
  return img.url || img.path || img.publicUrl || 'https://via.placeholder.com/800x400';
};

export const EventsManagement: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isTicketCreateModalOpen, setIsTicketCreateModalOpen] = useState(false);
  const [isAttendeeModalOpen, setIsAttendeeModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<RegistrationView[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialLoadRef = useRef(true);
  const requestIdRef = useRef(0);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role } = useUser();
  const isStaff = role === UserRole.STAFF;

  const initialFormData = {
    eventName: '',
    description: '',
    eventDate: '',
    eventTime: '09:00',
    endDate: '',
    endTime: '17:00',
    timezone: 'Asia/Manila',
    locationType: 'ONSITE' as Event['locationType'],
    location: '',
    capacityTotal: 100,
    imageUrl: 'https://images.unsplash.com/photo-1540575861501-7ad0582373f3?auto=format&fit=crop&q=80&w=800',
    status: 'PUBLISHED' as EventStatus,
    regOpenDate: new Date().toISOString().split('T')[0],
    regOpenTime: '00:00',
    regCloseDate: '',
    regCloseTime: '',
    ticketTypes: [] as TicketType[]
  };

  const [formData, setFormData] = useState(initialFormData);

  // Stats calculation
  const eventStats = useMemo(() => {
    if (!currentEventId) return { registrations: 0, revenue: 0 };
    const eventRegs = attendees.filter(r => r.eventId === currentEventId && (r.status === 'ISSUED' || r.status === 'USED'));
    const revenue = eventRegs.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);
    return { registrations: eventRegs.length, revenue };
  }, [currentEventId, attendees]);

  const itemsPerPage = 6;
  const totalPages = Math.ceil(events.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return events.slice(start, start + itemsPerPage);
  }, [events, currentPage]);

  const fetchEvents = async (searchValue = debouncedSearch) => {
    const requestId = ++requestIdRef.current;
    if (initialLoadRef.current) {
      setLoading(true);
    } else {
      setIsFetching(true);
    }
    try {
      const data = await apiService.getAdminEvents(searchValue);
      if (requestId !== requestIdRef.current) return;
      setEvents(data);

      const allRegsPromises = data.map(e => apiService.getEventRegistrations(e.eventId));
      const allRegsResults = await Promise.all(allRegsPromises);
      if (requestId !== requestIdRef.current) return;
      setAttendees(allRegsResults.flat());
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to load admin events:', err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setIsFetching(false);
        initialLoadRef.current = false;
      }
    }
  };

  const handleOpenCreate = () => {
    if (isStaff) return;
    setFormData(initialFormData);
    setCurrentEventId(null);
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 350);
    return () => window.clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    fetchEvents(debouncedSearch);
  }, [debouncedSearch]);

  useEffect(() => {
    if (searchParams.get('openModal') === 'true' && !isStaff) {
      handleOpenCreate();
    }
  }, [searchParams, isStaff]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  if (loading) return <PageLoader label="Loading event management..." variant="section" />;

  const formatDateForInput = (value: string) => {
    if (!value) return { date: '', time: '' };
    const normalized = value.replace(' ', 'T');
    const [datePart, timePart] = normalized.split('T');
    const time = timePart ? timePart.substring(0, 5) : '';
    return { date: datePart, time };
  };

  const handleOpenEdit = (event: Event) => {
    const mainDT = formatDateForInput(event.startAt);
    const endDT = formatDateForInput(event.endAt || '');
    const openDT = formatDateForInput(event.regOpenAt || '');
    const closeDT = formatDateForInput(event.regCloseAt || '');

    setFormData({
      eventName: event.eventName,
      description: event.description,
      eventDate: mainDT.date,
      eventTime: mainDT.time,
      endDate: endDT.date,
      endTime: endDT.time,
      timezone: event.timezone || 'Asia/Manila',
      locationType: event.locationType || 'ONSITE',
      location: event.locationText,
      capacityTotal: event.capacityTotal,
      imageUrl: getImageUrl(event.imageUrl),
      status: event.status,
      regOpenDate: openDT.date,
      regOpenTime: openDT.time,
      regCloseDate: closeDT.date,
      regCloseTime: closeDT.time,
      ticketTypes: event.ticketTypes
    });
    setCurrentEventId(event.eventId);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleOpenTickets = (event: Event) => {
    setSelectedEvent(event);
    setIsTicketModalOpen(true);
  };


  const handleOpenAttendeePop = async (event: Event) => {
    setSelectedEvent(event);
    setIsAttendeeModalOpen(true);
    const data = await apiService.getEventRegistrations(event.eventId);
    const confirmedGuests = data.filter(reg => reg.status === 'ISSUED' || reg.status === 'USED');
    setAttendees(prev => {
        const otherRegs = prev.filter(r => r.eventId !== event.eventId);
        return [...otherRegs, ...confirmedGuests];
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitting(true);
    try {
      const { publicUrl } = await apiService.uploadEventImage(file, currentEventId || undefined);
      setFormData(prev => ({ ...prev, imageUrl: publicUrl }));
    } catch (err) {
      setNotification({ message: 'Image upload failed. Please retry.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode && isStaff) return;

    setSubmitting(true);
    try {
      const mergeDateTime = (date: string, time: string) => {
        if (!date) return null;
        const normalizedTime = time || '09:00';
        return `${date}T${normalizedTime}:00`;
      };

      const payload = {
        eventName: formData.eventName,
        description: formData.description,
        startAt: mergeDateTime(formData.eventDate, formData.eventTime),
        endAt: formData.endDate ? mergeDateTime(formData.endDate, formData.endTime) : null,
        timezone: formData.timezone,
        locationType: formData.locationType,
        locationText: formData.location,
        capacityTotal: formData.capacityTotal,
        imageUrl: formData.imageUrl,
        status: formData.status,
        regOpenAt: formData.regOpenDate || null,
        regCloseAt: formData.regCloseDate || null
      };

      if (isEditMode && currentEventId) {
        await apiService.updateEvent(currentEventId, payload);
        setNotification({ message: 'Changes synchronized successfully.', type: 'success' });
      } else {
        await apiService.createEvent(payload);
        setNotification({ message: 'Event successfully launched.', type: 'success' });
      }
      
      setIsModalOpen(false);
      fetchEvents();
    } catch (err) {
      setNotification({ message: 'Sync failed. Please retry.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveTickets = async (updatedTickets: TicketType[]) => {
    if (!selectedEvent) return;
    setSubmitting(true);
    try {
      // Save all tickets (create or update)
      for (const ticket of updatedTickets) {
        if (ticket.ticketTypeId.startsWith('tk-')) {
          // New ticket (local id)
          const { ticketTypeId, quantitySold, ...cleanTicket } = ticket;
          await apiService.createTicketType({ ...cleanTicket, eventId: selectedEvent.eventId });
        } else {
          // Existing ticket
          await apiService.updateTicketType(ticket.ticketTypeId, ticket);
        }
      }
      // Refresh tickets from backend
      const ticketTypes = await apiService.getTicketTypes(selectedEvent.eventId);
      setSelectedEvent(ev => ev ? { ...ev, ticketTypes } : ev);
      setNotification({ message: 'Ticket inventory updated.', type: 'success' });
    } catch (err) {
      setNotification({ message: 'Failed to update ticket inventory.', type: 'error' });
    } finally {
      setSubmitting(false);
      setIsTicketModalOpen(false);
    }
  };


  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {notification && (
        <div className="fixed top-24 right-8 z-[120] animate-in slide-in-from-right-10">
          <Card className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border ${
            notification.type === 'success' ? 'bg-[#56CCF2]/20 border-[#56CCF2]/40 text-[#1F3A5F]' : 'bg-[#1F3A5F]/10 border-[#1F3A5F]/20 text-[#1F3A5F]'
          }`}>
            <div className={`p-2 rounded-xl ${notification.type === 'success' ? 'bg-[#56CCF2]/10 text-[#2F80ED]' : 'bg-[#1F3A5F]/20 text-[#1F3A5F]'}`}>
              {notification.type === 'success' ? <ICONS.CheckCircle className="w-5 h-5" /> : <ICONS.Layout className="w-5 h-5" />}
            </div>
            <p className="font-bold text-sm tracking-tight">{notification.message}</p>
          </Card>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 px-2">
        <div>
          <h1 className="text-3xl font-black text-[#1F3A5F] tracking-tighter">Events Management</h1>
          <p className="text-[#F4F6F8] font-medium text-sm mt-1">Configure and manage your organization's event lifecycle.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#1F3A5F]/30">
              <ICONS.Search className="h-4 w-4" strokeWidth={3} />
            </div>
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-10 py-3 bg-white border border-[#F4F6F8] rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#2F80ED]/10 focus:border-[#2F80ED] transition-all"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#2F80ED]/70">
              {(isFetching || searchTerm.trim() !== debouncedSearch) && (
                <div className="w-4 h-4 border-2 border-[#2F80ED]/60 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
          {!isStaff && (
            <Button onClick={handleOpenCreate} className="rounded-xl px-6 py-3 shadow-lg shadow-[#34C759]/10 transition-transform active:scale-95">
              <span className="flex items-center gap-2 font-bold text-sm">
                <ICONS.Calendar className="w-4 h-4" />
                Launch Event
              </span>
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden border-[#F4F6F8] shadow-[0_8px_30px_rgb(0,0,0,0.02)] rounded-[2.5rem]">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F4F6F8]/50 border-b border-[#F4F6F8]">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.25em]">Event Identity</th>
                <th className="px-8 py-5 text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.25em]">Date & Location</th>
                <th className="px-8 py-5 text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.25em]">Lifecycle</th>
                <th className="px-8 py-5 text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.25em] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F6F8]">
              {currentItems.map(event => (
                <tr key={event.eventId} className="hover:bg-[#F4F6F8]/30 transition-all group">
                  <td className="px-8 py-7">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-[#F4F6F8] shadow-sm">
                        <img 
                          src={getImageUrl(event.imageUrl)} 
                          alt="" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div>
                        <div className="font-black text-[#1F3A5F] text-[16px] tracking-tight group-hover:text-[#34C759] transition-colors">{event.eventName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-7">
                    <div className="text-[14px] font-bold text-[#1F3A5F] tracking-tight">
                      {new Date(event.startAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="text-[11px] text-[#1F3A5F]/50 font-bold mt-1.5 flex items-center gap-2">
                       <ICONS.MapPin className="w-3 h-3 text-[#1F3A5F]/20" />
                       <span className="truncate max-w-[200px]">{event.locationText}</span>
                    </div>
                  </td>
                  <td className="px-8 py-7">
                    <div className={`inline-flex px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] ${
                      event.status === 'PUBLISHED' 
                        ? 'bg-[#34C759]/20 text-[#34C759]' 
                        : event.status === 'DRAFT' 
                          ? 'bg-[#F4F6F8] text-[#1F3A5F]/60' 
                          : 'bg-[#1F3A5F]/10 text-[#1F3A5F]'
                    }`}>
                      {event.status}
                    </div>
                  </td>
                  <td className="px-8 py-7 text-center">
                    <div className="flex justify-center items-center gap-10 opacity-40 group-hover:opacity-100 transition-all duration-300">
                      <button 
                        onClick={() => handleOpenTickets(event)}
                        className="text-[#1F3A5F] hover:text-[#34C759] transition-all transform hover:scale-125 p-1"
                        title="Manage Tickets"
                      >
                        <ICONS.CreditCard className="w-[1.2rem] h-[1.2rem]" strokeWidth={2.2} />
                      </button>
                      <button 
                        onClick={() => handleOpenAttendeePop(event)} 
                        className="text-[#1F3A5F] hover:text-[#34C759] transition-all transform hover:scale-125 p-1"
                        title="View Confirmed Guests"
                      >
                        <ICONS.Users className="w-[1.2rem] h-[1.2rem]" strokeWidth={2.2} />
                      </button>
                      <button 
                        onClick={() => handleOpenEdit(event)}
                        className="text-[#1F3A5F] hover:text-[#34C759] transition-all transform hover:scale-125 p-1"
                        title="Edit Session"
                      >
                        <svg className="w-[1.2rem] h-[1.2rem]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-[1.5rem] border border-[#F4F6F8] shadow-sm">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i + 1)}
                className={`w-10 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  currentPage === i + 1
                    ? 'bg-[#1F3A5F] text-white shadow-lg shadow-[#34C759]/10'
                    : 'text-[#1F3A5F]/50 hover:text-[#1F3A5F] hover:bg-[#F4F6F8]'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Re-architected Event Config Modal with Live Preview */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={isEditMode ? 'Modify Session' : 'Launch New Session'}
        size="lg"
      >
        <div className="space-y-12">
          {/* HIGH-FIDELITY LIVE PREVIEW SECTION */}
          <div className="bg-white rounded-[2.5rem] p-4 animate-in fade-in duration-1000">
            <div className="space-y-8">
              {/* Event Identity Group */}
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-black text-[#1F3A5F] tracking-tighter leading-tight transition-all">
                  {formData.eventName || 'Untitled Session'}
                </h1>
                
                {/* Performance & Status Summary Row */}
                <div className="flex flex-wrap items-center gap-3">
                   <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border ${
                      formData.status === 'PUBLISHED' 
                        ? 'bg-[#34C759]/20 border-[#34C759]/40 text-[#34C759]' 
                        : 'bg-[#F4F6F8] border-[#F4F6F8] text-[#1F3A5F]/50'
                    }`}>
                      {formData.status}
                   </div>
                   {isEditMode && (
                     <>
                        <div className="px-4 py-1.5 rounded-xl bg-[#34C759]/10 border border-[#34C759]/40 text-[#34C759] text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                           <ICONS.Users className="w-3 h-3" strokeWidth={3} />
                           {eventStats.registrations} REGISTRATIONS
                        </div>
                        <div className="px-4 py-1.5 rounded-xl bg-[#1F3A5F] text-white text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                           <ICONS.CreditCard className="w-3 h-3" strokeWidth={3} />
                           PHP {eventStats.revenue.toLocaleString()} REVENUE
                        </div>
                     </>
                   )}
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-[#F4F6F8] shadow-[0_4px_15px_rgba(0,0,0,0.03)] group transition-all hover:border-[#34C759]/40">
                    <div className="w-8 h-8 bg-[#34C759]/10 text-[#34C759] rounded-lg flex items-center justify-center">
                       <ICONS.Calendar className="w-4 h-4" strokeWidth={2.5} />
                    </div>
                    <span className="text-[13px] font-black text-[#1F3A5F] uppercase tracking-tight">
                      {formData.eventDate ? new Date(`${formData.eventDate}T${formData.eventTime}`).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Set Date & Time'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-[#F4F6F8] shadow-[0_4px_15px_rgba(0,0,0,0.03)] group transition-all hover:border-[#34C759]/40">
                    <div className="w-8 h-8 bg-[#34C759]/10 text-[#34C759] rounded-lg flex items-center justify-center">
                       <ICONS.MapPin className="w-4 h-4" strokeWidth={2.5} />
                    </div>
                    <span className="text-[13px] font-black text-[#1F3A5F] uppercase tracking-tight truncate max-w-[200px]">
                      {formData.location || 'Set Venue / Connection'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description Block */}
              <div className="p-8 bg-[#F4F6F8]/50 rounded-[2rem] border border-[#F4F6F8]">
                <h4 className="text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.4em] mb-4">Event Overview</h4>
                <p className="text-[#1F3A5F]/60 text-[15px] font-medium leading-relaxed italic line-clamp-4">
                  {formData.description || 'Provide an executive summary of this event session...'}
                </p>
              </div>
            </div>
          </div>

          {/* CONFIGURATION FORM SECTION */}
          <form onSubmit={handleSubmit} className="space-y-10 px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em] mb-3 ml-1">Identity & Status</label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input placeholder="Session Name" value={formData.eventName} onChange={(e: any) => setFormData({...formData, eventName: e.target.value})} />
                  </div>
                  <select 
                    className="px-4 py-3 bg-white border border-[#F4F6F8] rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-[#34C759]/5 focus:border-[#34C759]"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as EventStatus})}
                  >
                    <option value="PUBLISHED">Live / Published</option>
                    <option value="DRAFT">Draft / Private</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em] mb-3 ml-1">Abstract / Description</label>
                <textarea 
                  className="w-full px-5 py-4 bg-white border border-[#F4F6F8] rounded-[1.5rem] text-sm min-h-[120px] focus:ring-8 focus:ring-[#34C759]/5 focus:border-[#34C759] transition-all outline-none"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex flex-col gap-2 mb-3 px-1">
  <label className="text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em]">Visual Media</label>
  <div className="relative group w-full h-40 rounded-[1.5rem] border-2 border-dashed border-[#56CCF2]/40 bg-[#F4F6F8] flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#2F80ED] hover:bg-[#56CCF2]/10 transition-all" onClick={() => fileInputRef.current?.click()}>
    {formData.imageUrl ? (
      <img src={getImageUrl(formData.imageUrl)} alt="Preview" className="w-full h-full object-cover rounded-[1.5rem] transition-all group-hover:brightness-90" />
    ) : (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <svg className="w-10 h-10 text-[#2F80ED]/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="2.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <span className="text-[11px] font-black text-[#1F3A5F]/40 uppercase tracking-widest">Upload Event Image</span>
      </div>
    )}
    <div className="absolute bottom-3 right-3 bg-white/80 rounded-lg px-3 py-1 text-[10px] font-black text-[#2F80ED] uppercase tracking-widest shadow group-hover:bg-[#2F80ED]/90 group-hover:text-white transition-colors pointer-events-none">Browse</div>
  </div>
  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
</div>
              </div>

              <Input label="Session Date" type="date" value={formData.eventDate} onChange={(e: any) => setFormData({...formData, eventDate: e.target.value})} />
              <Input label="Start Time" type="time" value={formData.eventTime} onChange={(e: any) => setFormData({...formData, eventTime: e.target.value})} />
              <Input label="End Date" type="date" value={formData.endDate} onChange={(e: any) => setFormData({...formData, endDate: e.target.value})} />
              <Input label="End Time" type="time" value={formData.endTime} onChange={(e: any) => setFormData({...formData, endTime: e.target.value})} />
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em] mb-2 ml-1">Location Type</label>
                  <select
                    className="w-full px-4 py-3 bg-white border border-[#F4F6F8] rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-[#34C759]/5 focus:border-[#34C759]"
                    value={formData.locationType}
                    onChange={(e) => setFormData({ ...formData, locationType: e.target.value as Event['locationType'] })}
                  >
                    <option value="ONSITE">Onsite</option>
                    <option value="ONLINE">Online</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em] mb-2 ml-1">Timezone</label>
                  <Input value={formData.timezone} onChange={(e: any) => setFormData({ ...formData, timezone: e.target.value })} />
                </div>
              </div>
              <div className="md:col-span-2">
                <Input label="Location / Connection Link" placeholder="e.g. Global Tech Center" value={formData.location} onChange={(e: any) => setFormData({...formData, location: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-4 pt-8 border-t border-[#F4F6F8]">
              <Button variant="outline" className="flex-1 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest" onClick={() => setIsModalOpen(false)}>Discard</Button>
              <Button type="submit" className="flex-[2] py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-[#34C759]/10" disabled={submitting}>
                {submitting ? 'Synchronizing...' : (isEditMode ? 'Commit Configuration' : 'Deploy Session')}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Ticket Management Pop-up */}
      <Modal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        title="Ticket Inventory Config"
        size="lg"
      >
        <TicketManager
          event={selectedEvent}
          onSave={handleSaveTickets}
          submitting={submitting}
          setNotification={setNotification}
        />
      </Modal>


      {/* Attendee Quick-View Modal */}
      <Modal
        isOpen={isAttendeeModalOpen}
        onClose={() => setIsAttendeeModalOpen(false)}
        title={`Guest List: ${selectedEvent?.eventName || ''}`}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.4em]">Confirmed Registrations</span>
            <Badge type="info" className="px-3 py-1 font-black text-[9px] tracking-widest">{attendees.filter(r => r.eventId === selectedEvent?.eventId).length} GUESTS</Badge>
          </div>
          
          <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
            {attendees.filter(r => r.eventId === selectedEvent?.eventId).map((reg) => (
              <div key={reg.id} className="flex items-center justify-between p-5 bg-white border border-[#F4F6F8] rounded-[1.75rem] shadow-sm hover:border-[#34C759]/40 hover:shadow-md transition-all group">
                <div className="flex items-center gap-5">
                  <div className="w-11 h-11 rounded-2xl bg-[#F4F6F8] flex items-center justify-center text-[#34C759] font-black text-sm border border-[#F4F6F8] group-hover:bg-[#34C759] group-hover:text-white transition-all">
                    {reg.attendeeName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-[#1F3A5F] text-[15px] tracking-tight">{reg.attendeeName}</p>
                    <p className="text-[11px] text-[#1F3A5F]/50 font-bold uppercase tracking-tight mt-0.5">{reg.attendeeEmail}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-[#1F3A5F] uppercase tracking-widest mb-1.5">{reg.ticketName}</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    reg.status === 'USED' ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-[#1F3A5F]/20 text-[#1F3A5F]'
                  }`}>
                    {reg.status}
                  </span>
                </div>
              </div>
            ))}
            {attendees.filter(r => r.eventId === selectedEvent?.eventId).length === 0 && (
              <div className="py-24 text-center text-[#1F3A5F]/20">
                <ICONS.Users className="w-14 h-14 mx-auto mb-5 opacity-20" />
                <p className="font-black uppercase tracking-[0.25em] text-[10px]">No confirmed guests detected</p>
              </div>
            )}
          </div>
          <Button 
            variant="outline" 
            className="w-full py-4.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] border-2 border-[#F4F6F8] hover:bg-[#F4F6F8]"
            onClick={() => navigate('/attendees')}
          >
            Open Full Directory
          </Button>
        </div>
      </Modal>
    </div>
  );
};

interface TicketManagerProps {
  event: Event | null;
  onSave: (tickets: TicketType[]) => void;
  submitting: boolean;
  setNotification: (n: { message: string; type: 'success' | 'error' }) => void;
}

const TicketManager: React.FC<TicketManagerProps> = ({ event, onSave, submitting, setNotification }) => {
  const [tickets, setTickets] = useState<TicketType[]>([]);

  useEffect(() => {
    const fetchTickets = async () => {
      if (event?.eventId) {
        const fetched = await apiService.getTicketTypes(event.eventId);
        setTickets(fetched);
      } else {
        setTickets([]);
      }
    };
    fetchTickets();
  }, [event?.eventId]);
  const [newTicket, setNewTicket] = useState({
    name: '',
    description: '',
    priceAmount: 0, // Default FREE
    currency: 'PHP',
    quantityTotal: 100,
    salesStartAt: '',
    salesEndAt: '',
    status: true
  });

  const addTicket = () => {
    if (!newTicket.name) return;
    const item: TicketType = {
      ticketTypeId: `tk-${Math.random().toString(36).substr(2, 9)}`,
      eventId: event?.eventId || '',
      name: newTicket.name,
      description: newTicket.description || undefined,
      priceAmount: newTicket.priceAmount,
      currency: newTicket.currency || 'PHP',
      quantityTotal: newTicket.quantityTotal,
      quantitySold: 0,
      salesStartAt: newTicket.salesStartAt || undefined,
      salesEndAt: newTicket.salesEndAt || undefined,
      status: newTicket.status
    };
    setTickets([...tickets, item]);
    setNewTicket({
      name: '',
      description: '',
      priceAmount: 0,
      currency: 'PHP',
      quantityTotal: 100,
      salesStartAt: '',
      salesEndAt: '',
      status: true
    });
  };

  const removeTicket = async (id: string) => {
    const ticket = tickets.find(t => t.ticketTypeId === id);
    if (ticket && !id.startsWith('tk-')) {
      try {
        await apiService.deleteTicketType(id);
        if (event?.eventId) {
          const updated = await apiService.getTicketTypes(event.eventId);
          setTickets(updated);
        }
      } catch (err) {
        setNotification({ message: 'Failed to delete ticket type.', type: 'error' });
      }
    } else {
      setTickets(tickets.filter(t => t.ticketTypeId !== id));
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-3xl border border-[#F4F6F8] shadow-sm">
        <h4 className="text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.3em] mb-4">Add Ticket Tier</h4>
        <div className="space-y-4">
          <Input 
            placeholder="Tier Name (e.g. VIP Access)" 
            value={newTicket.name} 
            onChange={(e: any) => setNewTicket({...newTicket, name: e.target.value})} 
          />
          <textarea
            className="w-full px-4 py-3 bg-white border border-[#F4F6F8] rounded-xl text-sm outline-none focus:border-[#34C759]"
            placeholder="Description (optional)"
            value={newTicket.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewTicket({ ...newTicket, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-widest">Type</label>
              <select
                className="w-full px-4 py-3 bg-white border border-[#F4F6F8] rounded-xl text-sm outline-none focus:border-[#34C759]"
                value={newTicket.priceAmount === 0 ? 'FREE' : 'PAID'}
                onChange={(e) => setNewTicket({
                  ...newTicket,
                  priceAmount: e.target.value === 'FREE' ? 0 : 100,
                })}
              >
                <option value="FREE">Free</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-widest">Status</label>
              <select
                className="w-full px-4 py-3 bg-white border border-[#F4F6F8] rounded-xl text-sm outline-none focus:border-[#34C759]"
                value={newTicket.status ? 'ACTIVE' : 'INACTIVE'}
                onChange={(e) => setNewTicket({ ...newTicket, status: e.target.value === 'ACTIVE' })}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
          {newTicket.priceAmount > 0 && (
            <Input 
              label={`Price (${newTicket.currency})`}
              type="number" 
              value={newTicket.priceAmount} 
              onChange={(e: any) => setNewTicket({...newTicket, priceAmount: parseFloat(e.target.value)})} 
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity Total"
              type="number"
              value={newTicket.quantityTotal}
              onChange={(e: any) => setNewTicket({ ...newTicket, quantityTotal: parseInt(e.target.value, 10) || 0 })}
            />
            <Input
              label="Currency"
              value={newTicket.currency}
              onChange={(e: any) => setNewTicket({ ...newTicket, currency: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Sales Start"
              type="datetime-local"
              value={newTicket.salesStartAt}
              onChange={(e: any) => setNewTicket({ ...newTicket, salesStartAt: e.target.value })}
            />
            <Input
              label="Sales End"
              type="datetime-local"
              value={newTicket.salesEndAt}
              onChange={(e: any) => setNewTicket({ ...newTicket, salesEndAt: e.target.value })}
            />
          </div>
          <Button
            onClick={() => {
              // Keep new ticket in local state; creation happens on commit
              addTicket();
            }}
            className="w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            Add to Inventory
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.3em]">Current Inventory</h4>
        {tickets.map((t) => (
          <div key={t.ticketTypeId} className="flex items-center justify-between p-4 bg-white border border-[#F4F6F8] rounded-xl shadow-sm">
            <div>
              <p className="font-bold text-[#1F3A5F] text-sm">{t.name}</p>
              <p className="text-[10px] font-black text-[#2F80ED] uppercase tracking-widest">
                {t.priceAmount === 0 ? 'Complimentary' : `PHP ${t.priceAmount.toLocaleString()}`}
              </p>
            </div>
            <button onClick={() => removeTicket(t.ticketTypeId)} className="text-[#1F3A5F] hover:bg-[#1F3A5F]/10 p-2 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        ))}
        {tickets.length === 0 && <p className="text-center py-6 text-[#1F3A5F]/20 text-xs font-bold uppercase tracking-widest">No tickets configured</p>}
      </div>

      <Button 
        onClick={() => onSave(tickets)} 
        disabled={submitting}
        className="w-full py-5 rounded-2xl bg-[#1F3A5F] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl"
      >
        {submitting ? 'Updating...' : 'Commit Inventory Changes'}
      </Button>
    </div>
  );
};
