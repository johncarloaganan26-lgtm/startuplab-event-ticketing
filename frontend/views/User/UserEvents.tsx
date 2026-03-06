
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Event, TicketType, EventStatus, RegistrationView, OrganizerProfile } from '../../types';
import { Card, Badge, Button, Modal, Input, PageLoader } from '../../components/Shared';
import { OnsiteLocationAssistant } from '../../components/OnsiteLocationAssistant';
import { ICONS } from '../../constants';

const getImageUrl = (img: any): string => {
    if (!img) return 'https://via.placeholder.com/800x400';
    if (typeof img === 'string') return img;
    return img.url || img.path || img.publicUrl || 'https://via.placeholder.com/800x400';
};

export const UserEvents: React.FC = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentEventId, setCurrentEventId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const initialLoadRef = useRef(true);
    const requestIdRef = useRef(0);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isAttendeeModalOpen, setIsAttendeeModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [attendees, setAttendees] = useState<RegistrationView[]>([]);
    const [organizerProfile, setOrganizerProfile] = useState<OrganizerProfile | null>(null);
    const [organizerLoading, setOrganizerLoading] = useState(true);

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

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
        regCloseDate: '',
        regCloseTime: '',
        streamingPlatform: '',
        ticketTypes: [] as TicketType[]
    };

    const [formData, setFormData] = useState(initialFormData);

    const fetchEvents = async (searchValue = debouncedSearch) => {
        const requestId = ++requestIdRef.current;
        if (initialLoadRef.current) setLoading(true);
        else setIsFetching(true);
        try {
            const data = await apiService.getUserEvents(searchValue);
            if (requestId !== requestIdRef.current) return;
            setEvents(data);
        } catch {
            if (requestId !== requestIdRef.current) return;
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
                setIsFetching(false);
                initialLoadRef.current = false;
            }
        }
    };

    const handleOpenCreate = () => {
        setFormData(initialFormData);
        setCurrentEventId(null);
        setIsEditMode(false);
        setIsModalOpen(true);
    };

    useEffect(() => {
        const handler = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
        return () => window.clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => { fetchEvents(debouncedSearch); }, [debouncedSearch]);

    useEffect(() => {
        if (searchParams.get('openModal') === 'true') handleOpenCreate();
    }, [searchParams]);

    useEffect(() => {
        if (notification) {
            const t = setTimeout(() => setNotification(null), 4000);
            return () => clearTimeout(t);
        }
    }, [notification]);

    useEffect(() => {
        let isMounted = true;

        const fetchOrganizerProfile = async () => {
            try {
                setOrganizerLoading(true);
                const organizer = await apiService.getMyOrganizer();
                if (isMounted) setOrganizerProfile(organizer);
            } catch {
                if (isMounted) {
                    setOrganizerProfile(null);
                    setNotification({ message: 'Unable to load organizer profile.', type: 'error' });
                }
            } finally {
                if (isMounted) setOrganizerLoading(false);
            }
        };

        fetchOrganizerProfile();
        return () => {
            isMounted = false;
        };
    }, []);

    // Filter events by status
    const filteredEvents = useMemo(() => {
        if (statusFilter === 'ALL') return events;
        return events.filter(e => e.status === statusFilter);
    }, [events, statusFilter]);

    // Calendar helpers
    const calendarDays = useMemo(() => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        return days;
    }, [calendarMonth]);

    const eventsOnDay = (day: number) => {
        return filteredEvents.filter(e => {
            if (!e.startAt) return false;
            const d = new Date(e.startAt);
            return d.getFullYear() === calendarMonth.getFullYear() && d.getMonth() === calendarMonth.getMonth() && d.getDate() === day;
        });
    };

    if (loading) return <PageLoader label="Loading your events..." variant="section" />;

    const formatDateForInput = (value: string) => {
        if (!value) return { date: '', time: '' };
        const normalized = value.replace(' ', 'T');
        const [datePart, timePart] = normalized.split('T');
        return { date: datePart, time: timePart ? timePart.substring(0, 5) : '' };
    };

    const handleOpenEdit = (event: Event) => {
        const mainDT = formatDateForInput(event.startAt);
        const endDT = formatDateForInput(event.endAt || '');
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
            regOpenDate: formatDateForInput(event.regOpenAt || '').date,
            regCloseDate: formatDateForInput(event.regCloseAt || '').date,
            regCloseTime: formatDateForInput(event.regCloseAt || '').time,
            streamingPlatform: event.streamingPlatform || '',
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
        try {
            const data = await apiService.getEventRegistrations(event.eventId);
            const confirmedGuests = data.filter(reg => reg.status === 'ISSUED' || reg.status === 'USED');
            setAttendees(prev => {
                const otherRegs = prev.filter(r => r.eventId !== event.eventId);
                return [...otherRegs, ...confirmedGuests];
            });
        } catch (err) {
            console.error('Failed to fetch registrations:', err);
        }
    };

    const handleSaveTickets = async (updatedTickets: TicketType[]) => {
        if (!selectedEvent) return;
        setSubmitting(true);
        try {
            for (const ticket of updatedTickets) {
                if (ticket.ticketTypeId.startsWith('tk-')) {
                    const { ticketTypeId, quantitySold, ...cleanTicket } = ticket;
                    await apiService.createTicketType({ ...cleanTicket, eventId: selectedEvent.eventId });
                } else {
                    await apiService.updateTicketType(ticket.ticketTypeId, ticket);
                }
            }
            const ticketTypes = await apiService.getTicketTypes(selectedEvent.eventId);
            setSelectedEvent(ev => ev ? { ...ev, ticketTypes } : ev);
            setNotification({ message: 'Ticket inventory updated.', type: 'success' });
            setIsTicketModalOpen(false);
            fetchEvents();
        } catch {
            setNotification({ message: 'Failed to update ticket inventory.', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSubmitting(true);
        try {
            const { publicUrl } = await apiService.uploadUserEventImage(file, currentEventId || undefined);
            setFormData(prev => ({ ...prev, imageUrl: publicUrl }));
        } catch {
            setNotification({ message: 'Image upload failed.', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const mergeDateTime = (date: string, time: string) => {
                if (!date) return null;
                return `${date}T${time || '09:00'}:00`;
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
                regCloseAt: formData.regCloseDate || null,
                streamingPlatform: formData.streamingPlatform,
                organizerId: organizerProfile?.organizerId || null
            };
            if (isEditMode && currentEventId) {
                await apiService.updateUserEvent(currentEventId, payload);
                setNotification({ message: 'Event updated successfully.', type: 'success' });
            } else {
                await apiService.createUserEvent(payload);
                setNotification({ message: 'Event created successfully!', type: 'success' });
            }
            setIsModalOpen(false);
            fetchEvents();
        } catch {
            setNotification({ message: 'Failed to save event.', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const applyLocationValue = (locationValue: string) => {
        const nextData: any = { ...formData, location: locationValue };
        if ((formData.locationType === 'ONLINE' || formData.locationType === 'HYBRID') && !formData.streamingPlatform) {
            const lowUrl = locationValue.toLowerCase();
            if (lowUrl.includes('meet.google.com')) nextData.streamingPlatform = 'Google Meet';
            else if (lowUrl.includes('zoom.us') || lowUrl.includes('zoom.com')) nextData.streamingPlatform = 'Zoom';
            else if (lowUrl.includes('teams.microsoft.com')) nextData.streamingPlatform = 'Microsoft Teams';
        }
        setFormData(nextData);
    };

    return (
        <div className="space-y-0">
            {notification && (
                <div className="fixed top-20 right-8 z-[120]">
                    <Card className={`flex items-center gap-4 px-6 py-4 rounded-2xl border ${notification.type === 'success' ? 'bg-[#38BDF2]/20 border-[#38BDF2]/40 text-[#2E2E2F]' : 'bg-[#2E2E2F]/10 border-[#2E2E2F]/30 text-[#2E2E2F]'}`}>
                        <p className="font-bold text-sm tracking-tight">{notification.message}</p>
                    </Card>
                </div>
            )}            {/* Header section replicated from Admin */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 px-2 mb-8 pt-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#2E2E2F] tracking-tight">Events</h1>
                    <p className="text-[#2E2E2F]/70 font-medium text-sm mt-1">Configure and manage your session lifecycle.</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-72">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#2E2E2F]/60">
                            <ICONS.Search className="h-4 w-4" strokeWidth={3} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search events..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-10 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/30 focus:border-[#38BDF2] transition-colors"
                        />
                    </div>
                    <select
                        className="px-4 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none transition-colors"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="ALL">All Status</option>
                        <option value="PUBLISHED">Published</option>
                        <option value="DRAFT">Draft</option>
                        <option value="CLOSED">Closed</option>
                    </select>

                    <div className="flex items-center bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl p-1">
                        <button
                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#38BDF2] text-white shadow-sm' : 'text-[#2E2E2F]/40 hover:text-[#2E2E2F]'}`}
                            onClick={() => setViewMode('list')}
                        >
                            List
                        </button>
                        <button
                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-[#38BDF2] text-white shadow-sm' : 'text-[#2E2E2F]/40 hover:text-[#2E2E2F]'}`}
                            onClick={() => setViewMode('calendar')}
                        >
                            Calendar
                        </button>
                    </div>

                    <Button
                        onClick={handleOpenCreate}
                        className="rounded-xl px-6 py-3 bg-[#38BDF2] text-[#F2F2F2] hover:text-[#F2F2F2] font-bold transition-colors"
                    >
                        <span className="flex items-center gap-2 font-bold text-sm">
                            <ICONS.Calendar className="w-4 h-4" />
                            Create Event
                        </span>
                    </Button>
                </div>
            </div>

            {/* Events View */}
            {viewMode === 'list' ? (
                /* ─── TABLE VIEW ─── */
                filteredEvents.length === 0 ? (
                    <div className="py-20 text-center text-[#2E2E2F]/50">
                        <div className="w-24 h-24 mx-auto mb-6 bg-[#F2F2F2] rounded-2xl flex items-center justify-center border border-[#2E2E2F]/10">
                            <ICONS.Calendar className="w-12 h-12 opacity-30" />
                        </div>
                        <p className="text-base font-medium text-[#2E2E2F]/60 tracking-tight">No events to show</p>
                    </div>
                ) : (
                    <Card className="overflow-hidden border-[#2E2E2F]/10 rounded-[2.5rem] bg-[#F2F2F2]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#F2F2F2] border-b border-[#2E2E2F]/10">
                                    <tr>
                                        <th className="px-8 py-5 text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Event Identity</th>
                                        <th className="px-8 py-5 text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Date & Location</th>
                                        <th className="px-8 py-5 text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Lifecycle</th>
                                        <th className="px-8 py-5 text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#2E2E2F]/10">
                                    {filteredEvents.map(event => (
                                        <tr key={event.eventId} className="hover:bg-[#38BDF2]/10 transition-colors group cursor-pointer" onClick={() => handleOpenEdit(event)}>
                                            <td className="px-8 py-7">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-[#2E2E2F]/20">
                                                        <img src={getImageUrl(event.imageUrl)} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-[#2E2E2F] text-[16px] tracking-tight group-hover:text-[#2E2E2F] transition-colors">{event.eventName}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-7">
                                                <div className="text-[14px] font-semibold text-[#2E2E2F] tracking-tight">
                                                    {new Date(event.startAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                                <div className="text-[12px] text-[#2E2E2F]/60 font-medium mt-1.5 flex items-center gap-2">
                                                    <ICONS.MapPin className="w-3 h-3 text-[#2E2E2F]/50" />
                                                    <span className="truncate max-w-[200px]">{event.locationText}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-7">
                                                <div className={`inline-flex px-3.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${event.status === 'PUBLISHED'
                                                    ? 'bg-[#38BDF2]/20 text-[#2E2E2F]'
                                                    : event.status === 'DRAFT'
                                                        ? 'bg-[#F2F2F2] text-[#2E2E2F]/60 border border-[#2E2E2F]/20'
                                                        : 'bg-[#2E2E2F]/10 text-[#2E2E2F]'
                                                    }`}>
                                                    {event.status}
                                                </div>
                                            </td>
                                            <td className="px-8 py-7 text-center">
                                                <div className="flex justify-center items-center gap-6 opacity-70 group-hover:opacity-100 transition-colors">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/event/${event.slug || event.eventId}`); }}
                                                        className="text-[#2E2E2F] hover:text-[#2E2E2F] transition-colors p-1"
                                                        title="View Public Page"
                                                    >
                                                        <svg className="w-[1.2rem] h-[1.2rem]" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenTickets(event); }}
                                                        className="text-[#2E2E2F] hover:text-[#2E2E2F] transition-colors p-1"
                                                        title="Manage Tickets"
                                                    >
                                                        <ICONS.CreditCard className="w-[1.2rem] h-[1.2rem]" strokeWidth={2.2} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenAttendeePop(event); }}
                                                        className="text-[#2E2E2F] hover:text-[#2E2E2F] transition-colors p-1"
                                                        title="View Confirmed Guests"
                                                    >
                                                        <ICONS.Users className="w-[1.2rem] h-[1.2rem]" strokeWidth={2.2} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(event); }}
                                                        className="text-[#2E2E2F] hover:text-[#2E2E2F] transition-colors p-1"
                                                        title="Edit Session"
                                                    >
                                                        <svg className="w-[1.2rem] h-[1.2rem]" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )
            ) : (
                /* ─── CALENDAR VIEW ─── */
                <div className="bg-[var(--color-background)] border border-[var(--color-text-10)] rounded-2xl p-6">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--color-primary-10)] text-[#2E2E2F]/60 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <h3 className="text-lg font-bold text-[#2E2E2F] tracking-tight">
                            {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </h3>
                        <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--color-primary-10)] text-[#2E2E2F]/60 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-[#2E2E2F]/40 uppercase tracking-wide py-1">{d}</div>
                        ))}
                    </div>
                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((day, i) => {
                            if (day === null) return <div key={`empty-${i}`} className="h-20" />;
                            const dayEvents = eventsOnDay(day);
                            const isToday = new Date().getDate() === day && new Date().getMonth() === calendarMonth.getMonth() && new Date().getFullYear() === calendarMonth.getFullYear();
                            return (
                                <div
                                    key={day}
                                    className={`h-20 rounded-xl border p-1.5 flex flex-col transition-colors ${isToday ? '' : 'border-[#2E2E2F]/5 hover:border-[#2E2E2F]/15'}`}
                                    style={isToday ? { borderColor: 'var(--color-primary-40)', backgroundColor: 'var(--color-primary-10)' } : undefined}
                                >
                                    <span className={`text-[11px] font-bold ${isToday ? '' : 'text-[#2E2E2F]/60'}`} style={isToday ? { color: 'var(--color-primary)' } : undefined}>{day}</span>
                                    <div className="flex-1 overflow-hidden mt-0.5 space-y-0.5">
                                        {dayEvents.slice(0, 2).map(ev => (
                                            <div
                                                key={ev.eventId}
                                                onClick={() => handleOpenEdit(ev)}
                                                className="text-[8px] font-bold rounded px-1 py-0.5 truncate cursor-pointer hover:opacity-90 transition-opacity"
                                                style={{ backgroundColor: 'var(--color-primary-20)', color: 'var(--color-text)' }}
                                            >
                                                {ev.eventName}
                                            </div>
                                        ))}
                                        {dayEvents.length > 2 && <span className="text-[8px] text-[#2E2E2F]/40 font-bold">+{dayEvents.length - 2} more</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── Create/Edit Event Modal (SAME as Admin side) ─── */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={isEditMode ? 'Edit Event' : 'Add New Event'}
                size="lg"
            >
                <div className="space-y-12">
                    {/* LIVE PREVIEW */}
                    <div className="bg-[#F2F2F2] rounded-[2.5rem] p-4">
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <h1 className="text-4xl md:text-5xl font-black text-[#2E2E2F] tracking-tight leading-tight">
                                    {formData.eventName || 'Untitled Session'}
                                </h1>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className={`px-4 py-1.5 rounded-xl text-[10px] font-semibold uppercase tracking-wide border ${formData.status === 'PUBLISHED' ? 'bg-[#38BDF2]/20 border-[#38BDF2]/40 text-[#2E2E2F]' : 'bg-[#F2F2F2] border-[#2E2E2F]/20 text-[#2E2E2F]/60'}`}>
                                        {formData.status}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-4 pt-2">
                                    <div className="flex items-center gap-3 bg-[#F2F2F2] px-5 py-3 rounded-2xl border border-[#2E2E2F]/20">
                                        <div className="w-8 h-8 bg-[#38BDF2]/10 text-[#2E2E2F] rounded-lg flex items-center justify-center">
                                            <ICONS.Calendar className="w-4 h-4" strokeWidth={2.5} />
                                        </div>
                                        <span className="text-[13px] font-semibold text-[#2E2E2F] uppercase tracking-tight">
                                            {formData.eventDate ? new Date(`${formData.eventDate}T${formData.eventTime}`).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Set Date & Time'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 bg-[#F2F2F2] px-5 py-3 rounded-2xl border border-[#2E2E2F]/20">
                                        <div className="w-8 h-8 bg-[#38BDF2]/10 text-[#2E2E2F] rounded-lg flex items-center justify-center">
                                            <ICONS.MapPin className="w-4 h-4" strokeWidth={2.5} />
                                        </div>
                                        <span className="text-[13px] font-semibold text-[#2E2E2F] uppercase tracking-tight truncate max-w-[200px]">
                                            {formData.location || 'Set Venue / Connection'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 bg-[#F2F2F2] rounded-[2rem] border border-[#2E2E2F]/20">
                                <h4 className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide mb-4">Event Overview</h4>
                                <p className="text-[#2E2E2F]/70 text-[15px] font-medium leading-relaxed line-clamp-4">
                                    {formData.description || 'Provide an executive summary of this event session...'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* FORM (Same as Admin) */}
                    <form onSubmit={handleSubmit} className="space-y-10 px-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="md:col-span-2">
                                <label className="block text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide mb-3 ml-1">Event Details</label>
                                <div className="mb-4">
                                    <label className="block text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide mb-2 ml-1">
                                        Organizer Name
                                    </label>
                                    <select
                                        value={organizerProfile?.organizerId || ''}
                                        disabled
                                        className="w-full px-4 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-[12px] font-semibold tracking-wide outline-none"
                                    >
                                        {organizerProfile?.organizerId ? (
                                            <option value={organizerProfile.organizerId}>{organizerProfile.organizerName}</option>
                                        ) : (
                                            <option value="">No organizer profile set</option>
                                        )}
                                    </select>
                                    {!organizerProfile?.organizerId && (
                                        <p className="text-[11px] text-[#2E2E2F]/60 mt-2">
                                            Optional: set organizer profile in Organizer Settings.
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <Input placeholder="Session Name" value={formData.eventName} onChange={(e: any) => setFormData({ ...formData, eventName: e.target.value })} />
                                    </div>
                                    <select
                                        className="px-4 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-[11px] font-medium uppercase tracking-wide outline-none focus:ring-2 focus:ring-[#38BDF2]/30 focus:border-[#38BDF2]"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
                                    >
                                        <option value="PUBLISHED">Live / Published</option>
                                        <option value="DRAFT">Draft / Private</option>
                                        <option value="CLOSED">Closed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide mb-3 ml-1">Description</label>
                                <textarea
                                    className="w-full px-5 py-4 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-[1.5rem] text-sm min-h-[120px] focus:ring-2 focus:ring-[#38BDF2]/30 focus:border-[#38BDF2] transition-colors outline-none"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <div className="flex flex-col gap-2 mb-3 px-1">
                                    <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Visual Media</label>
                                    <div className="relative group w-full h-40 rounded-[1.5rem] border-2 border-dashed border-[#2E2E2F]/30 bg-[#F2F2F2] flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#38BDF2] hover:bg-[#38BDF2]/10 transition-colors" onClick={() => fileInputRef.current?.click()}>
                                        {formData.imageUrl ? (
                                            <img src={getImageUrl(formData.imageUrl)} alt="Preview" className="w-full h-full object-cover rounded-[1.5rem]" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center w-full h-full">
                                                <svg className="w-10 h-10 text-[#2E2E2F]/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="2.5" /><path d="M21 15l-5-5L5 21" /></svg>
                                                <span className="text-[12px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Upload Event Image</span>
                                            </div>
                                        )}
                                        <div className="absolute bottom-3 right-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-lg px-3 py-1 text-[11px] font-semibold text-[#2E2E2F] uppercase tracking-wide group-hover:bg-[#38BDF2] group-hover:text-[#F2F2F2] transition-colors pointer-events-none">Browse</div>
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                </div>
                            </div>

                            <Input label="Session Date" type="date" value={formData.eventDate} onChange={(e: any) => setFormData({ ...formData, eventDate: e.target.value })} />
                            <Input label="Start Time" type="time" value={formData.eventTime} onChange={(e: any) => setFormData({ ...formData, eventTime: e.target.value })} />
                            <Input label="End Date" type="date" value={formData.endDate} onChange={(e: any) => setFormData({ ...formData, endDate: e.target.value })} />
                            <Input label="End Time" type="time" value={formData.endTime} onChange={(e: any) => setFormData({ ...formData, endTime: e.target.value })} />

                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide mb-2 ml-1">Location Type</label>
                                    <select
                                        className="w-full px-4 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-[11px] font-medium uppercase tracking-wide outline-none focus:ring-2 focus:ring-[#38BDF2]/30 focus:border-[#38BDF2]"
                                        value={formData.locationType}
                                        onChange={(e) => setFormData({ ...formData, locationType: e.target.value as Event['locationType'] })}
                                    >
                                        <option value="ONSITE">Onsite</option>
                                        <option value="ONLINE">Online</option>
                                        <option value="HYBRID">Hybrid</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide mb-2 ml-1">Timezone</label>
                                    <Input value={formData.timezone} onChange={(e: any) => setFormData({ ...formData, timezone: e.target.value })} />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <Input
                                    label="Location / Connection Link"
                                    placeholder="e.g. Global Tech Center"
                                    value={formData.location}
                                    onChange={(e: any) => applyLocationValue(e.target.value)}
                                />
                            </div>

                            {formData.locationType === 'ONSITE' && (
                                <div className="md:col-span-2">
                                    <OnsiteLocationAssistant
                                        value={formData.location}
                                        onChange={applyLocationValue}
                                    />
                                </div>
                            )}

                            {(formData.locationType === 'ONLINE' || formData.locationType === 'HYBRID') && (
                                <div className="md:col-span-2">
                                    <Input
                                        label="Streaming Platform"
                                        placeholder="e.g. Google Meet, Zoom"
                                        value={formData.streamingPlatform}
                                        onChange={(e: any) => setFormData({ ...formData, streamingPlatform: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 pt-8 border-t border-[#2E2E2F]/20">
                            <Button className="flex-1 py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#38BDF2] text-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2] transition-colors min-h-[32px]" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button
                                type="submit"
                                className="flex-[2] py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#38BDF2] text-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2] transition-colors min-h-[32px]"
                                disabled={submitting}
                            >
                                {submitting ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Event')}
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
                <div>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Confirmed Registrations</span>
                            <Badge type="info" className="px-3 py-1 font-semibold text-[10px] tracking-wide">{attendees.filter(r => r.eventId === selectedEvent?.eventId).length} GUESTS</Badge>
                        </div>

                        <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
                            {attendees.filter(r => r.eventId === selectedEvent?.eventId).map((reg) => (
                                <div key={reg.id} className="flex items-center justify-between p-5 bg-[#F8F8F8] border border-[#2E2E2F]/5 rounded-[1.75rem] hover:border-[#38BDF2]/30 transition-colors group">
                                    <div className="flex items-center gap-5">
                                        <div className="w-11 h-11 rounded-2xl bg-white border border-[#2E2E2F]/10 flex items-center justify-center text-[#2E2E2F] font-semibold text-sm group-hover:bg-[#38BDF2] group-hover:text-white transition-colors">
                                            {reg.attendeeName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-[#2E2E2F] text-[15px] tracking-tight">{reg.attendeeName}</p>
                                            <p className="text-[12px] text-[#2E2E2F]/40 font-medium uppercase tracking-tight mt-0.5">{reg.attendeeEmail}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] font-medium text-[#2E2E2F] uppercase tracking-wide mb-1.5">{reg.ticketName}</p>
                                        <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wide ${reg.status === 'USED' ? 'bg-[#38BDF2]/10 text-[#38BDF2]' : 'bg-[#2E2E2F]/5 text-[#2E2E2F]/40'}`}>
                                            {reg.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {attendees.filter(r => r.eventId === selectedEvent?.eventId).length === 0 && (
                                <div className="py-24 text-center text-[#2E2E2F]/20">
                                    <ICONS.Users className="w-14 h-14 mx-auto mb-5" />
                                    <p className="font-bold uppercase tracking-widest text-[11px]">No confirmed guests found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </div >
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
    const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
    const [newTicket, setNewTicket] = useState({
        name: '',
        description: '',
        priceAmount: 0,
        currency: 'PHP',
        quantityTotal: 100,
        salesStartAt: '',
        salesEndAt: '',
        status: true
    });

    useEffect(() => {
        const fetchTickets = async () => {
            if (event?.eventId) {
                const fetched = await apiService.getTicketTypes(event.eventId);
                setTickets(fetched);
                setExpandedTicketId(null);
            }
        };
        fetchTickets();
    }, [event?.eventId]);

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
        setNewTicket({ name: '', description: '', priceAmount: 0, currency: 'PHP', quantityTotal: 100, salesStartAt: '', salesEndAt: '', status: true });
    };

    const removeTicket = async (id: string) => {
        if (!id.startsWith('tk-')) {
            try {
                await apiService.deleteTicketType(id);
            } catch {
                setNotification({ message: 'Failed to delete ticket type.', type: 'error' });
                return;
            }
        }
        setTickets(tickets.filter(t => t.ticketTypeId !== id));
    };

    const updateTicket = (id: string, updates: Partial<TicketType>) => {
        setTickets(prev => prev.map(t => t.ticketTypeId === id ? { ...t, ...updates } : t));
    };

    return (
        <div className="space-y-8">
            <div className="bg-[#F8F8F8] p-6 rounded-3xl border border-[#2E2E2F]/5">
                <h4 className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em] mb-4 ml-1">Add Ticket Tier</h4>
                <div className="space-y-4">
                    <Input
                        label="Tier Name (e.g. VIP Access)"
                        value={newTicket.name}
                        onChange={(e: any) => setNewTicket({ ...newTicket, name: e.target.value })}
                    />
                    <div className="space-y-1.5 w-full">
                        <label className="block text-sm font-medium text-[#2E2E2F]/70">Description (optional)</label>
                        <textarea
                            className="block w-full px-3 py-2 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 transition-colors font-normal text-sm"
                            rows={2}
                            value={newTicket.description}
                            onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 w-full">
                            <label className="block text-sm font-medium text-[#2E2E2F]/70">Type</label>
                            <select
                                className="block w-full px-3 py-2 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 transition-colors font-normal text-sm"
                                value={newTicket.priceAmount === 0 ? 'FREE' : 'PAID'}
                                onChange={(e) => setNewTicket({ ...newTicket, priceAmount: e.target.value === 'FREE' ? 0 : (newTicket.priceAmount || 100) })}
                            >
                                <option value="FREE">Free</option>
                                <option value="PAID">Paid</option>
                            </select>
                        </div>
                        <div className="space-y-1.5 w-full">
                            <label className="block text-sm font-medium text-[#2E2E2F]/70">Status</label>
                            <select
                                className="block w-full px-3 py-2 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 transition-colors font-normal text-sm"
                                value={newTicket.status ? 'ACTIVE' : 'INACTIVE'}
                                onChange={(e) => setNewTicket({ ...newTicket, status: e.target.value === 'ACTIVE' })}
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                    </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Button onClick={addTicket} className="w-full rounded-2xl py-4 text-[10px] font-black uppercase tracking-[0.2em]">Add to Inventory</Button>
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.2em] mb-2 ml-1">Current Inventory</h4>
                {tickets.length === 0 ? (
                    <p className="text-center py-6 text-[#2E2E2F]/30 text-[10px] font-bold uppercase tracking-widest">No tickets configured</p>
                ) : (
                    tickets.map(t => (
                        <div key={t.ticketTypeId} className="p-5 bg-white border border-[#2E2E2F]/10 rounded-2xl flex items-center justify-between group">
                            <div>
                                <p className="font-bold text-[#2E2E2F] text-sm">{t.name}</p>
                                <p className="text-[10px] text-[#2E2E2F]/40 font-bold uppercase tracking-widest mt-0.5">
                                    {t.priceAmount === 0 ? 'Free' : `${t.currency} ${t.priceAmount}`} • Qty {t.quantityTotal}
                                </p>
                            </div>
                            <button onClick={() => removeTicket(t.ticketTypeId)} className="p-2 text-[#2E2E2F]/20 hover:text-red-500 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    ))
                )}
            </div>

            <Button onClick={() => onSave(tickets)} disabled={submitting} className="w-full rounded-2xl py-4 bg-[#2E2E2F] text-white hover:bg-black font-black text-[11px] uppercase tracking-[0.2em]">
                {submitting ? 'Updating...' : 'Commit Inventory Changes'}
            </Button>
        </div>
    );
};
