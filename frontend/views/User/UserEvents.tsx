
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Event, TicketType, EventStatus, RegistrationView, OrganizerProfile } from '../../types';
import { Card, Badge, Button, Modal, Input, PageLoader } from '../../components/Shared';
import { OnsiteLocationAssistant } from '../../components/OnsiteLocationAssistant';
import { ICONS } from '../../constants';
import { useUser } from '../../context/UserContext';

const getImageUrl = (img: any): string => {
    if (!img) return 'https://via.placeholder.com/800x400';
    if (typeof img === 'string') return img;
    return img.url || img.path || img.publicUrl || 'https://via.placeholder.com/800x400';
};

const BRAND_LOGO_URL = 'https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg';

const CommentNoticeIcon: React.FC<any> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

const EyeIcon: React.FC<any> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const MobilePreviewIcon: React.FC<any> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
);

const LaptopPreviewIcon: React.FC<any> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="4" y="4" width="16" height="11" rx="2" />
        <path d="M2 19h20l-2-4H4l-2 4z" />
    </svg>
);

const DesktopPreviewIcon: React.FC<any> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
    </svg>
);

const MoreVerticalIcon: React.FC<any> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </svg>
);

export type EventSetupStep = 1 | 2 | 3 | 4 | 5;

export const EVENT_SETUP_STEPS: { id: EventSetupStep; title: string }[] = [
    { id: 1, title: 'Identity' },
    { id: 2, title: 'Schedule' },
    { id: 3, title: 'Registration' },
    { id: 4, title: 'Promotions' },
    { id: 5, title: 'Publish' },
];

export const EVENT_SETUP_STEP_DETAIL: Record<EventSetupStep, string> = {
    1: 'Name, story, and visual',
    2: 'Date, time, and location',
    3: 'Capacity and access',
    4: 'Create discount codes',
    5: 'Review and go live',
};

export const UserEvents: React.FC = () => {
    const { name } = useUser();
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
    const [hitpaySettings, setHitpaySettings] = useState<any>(null);
    const [hitpayLoading, setHitpayLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<Event | null>(null);
    const [wizardStep, setWizardStep] = useState<EventSetupStep>(1);
    const [initialEventStatus, setInitialEventStatus] = useState<EventStatus>('DRAFT');
    const [activeEventTicketCount, setActiveEventTicketCount] = useState(0);
    const [ticketReadinessLoading, setTicketReadinessLoading] = useState(false);
    const [resumeStatusAfterTicketSetup, setResumeStatusAfterTicketSetup] = useState(false);
    const [isWorkflowNoticeOpen, setIsWorkflowNoticeOpen] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isSidebarHidden, setIsSidebarHidden] = useState(false);

    const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
    const [finalStatusDecision, setFinalStatusDecision] = useState<EventStatus | ''>('');
    const [promotions, setPromotions] = useState<any[]>([]);
    const [promotionsLoading, setPromotionsLoading] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<any | null>(null);
    const [promoForm, setPromoForm] = useState({
        code: '',
        discountType: 'PERCENTAGE',
        discountValue: '10',
        maxUses: '100',
        validFrom: '',
        validUntil: '',
        isActive: true
    });

    const [promotedEventsMap, setPromotedEventsMap] = useState<Record<string, { promoted: boolean; remainingDays?: number }>>({});
    const [promotionQuota, setPromotionQuota] = useState<{ used: number; limit: number; canPromote: boolean } | null>(null);
    const [togglingPromotionId, setTogglingPromotionId] = useState<string | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    useEffect(() => {
        const handleGlobalClick = () => setOpenDropdownId(null);
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, []);

    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

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
        capacityTotal: 50,
        imageUrl: 'https://images.unsplash.com/photo-1540575861501-7ad0582373f3?auto=format&fit=crop&q=80&w=800',
        status: 'DRAFT' as EventStatus,
        regOpenDate: new Date().toISOString().split('T')[0],
        regOpenTime: '00:01',
        regCloseDate: '',
        regCloseTime: '',
        streamingPlatform: '',
        streamingUrl: '',
        brandColor: '#38BDF2',
        enableDiscountCodes: false,
        ticketTypes: [] as TicketType[],
    };
    const [formData, setFormData] = useState(initialFormData);
    const isPersonalProfileReady = !!name?.trim();
    const isOrganizerProfileReady = !!organizerProfile?.organizerId && !!organizerProfile?.organizerName?.trim();
    const isPaymentReady = !!hitpaySettings?.settings?.isConfigured;
    const isSubscriptionReady = !!organizerProfile?.currentPlanId && organizerProfile?.subscriptionStatus !== 'pending';
    const canStartCreation = isPersonalProfileReady && isOrganizerProfileReady;
    const canPublishByTicketRule = initialEventStatus === 'PUBLISHED' || activeEventTicketCount > 0;
    const hasExistingEvents = events.length > 0;
    const hasPublishedEvent = events.some((event) => event.status === 'PUBLISHED');
    const workflowCompletedCount = [
        isPersonalProfileReady,
        isOrganizerProfileReady,
        isPaymentReady,
        hasExistingEvents,
        hasPublishedEvent,
    ].filter(Boolean).length;

    // Plan Limits Logic
    const parseLimit = (limit: number | string | undefined | null, defaultValue: number): number => {
        if (limit === undefined || limit === null) return defaultValue;
        const val = parseInt(String(limit), 10);
        return Number.isNaN(val) ? defaultValue : val;
    };

    const activeEventsCount = events.filter((e) => e.status === 'PUBLISHED' || e.status === 'LIVE').length;
    const maxActiveEvents = parseLimit(organizerProfile?.plan?.limits?.max_active_events || organizerProfile?.plan?.limits?.max_events, 2);
    const isAtActiveLimit = activeEventsCount >= maxActiveEvents && initialEventStatus !== 'PUBLISHED' && initialEventStatus !== 'LIVE';

    const totalEventsCount = events.length;
    const maxTotalEvents = parseLimit(organizerProfile?.plan?.limits?.max_total_events || organizerProfile?.plan?.limits?.max_events, 3);
    const isAtTotalLimit = totalEventsCount >= maxTotalEvents && !isEditMode;

    const maxEventCapacity = parseLimit(organizerProfile?.plan?.limits?.max_attendees_per_event, 50);

    const activeStepMeta = EVENT_SETUP_STEPS.find((step) => step.id === wizardStep) || EVENT_SETUP_STEPS[0];
    const previewDateLabel = (() => {
        if (!formData.eventDate) return 'Date and time not set';
        const date = new Date(`${formData.eventDate}T${formData.eventTime || '09:00'}`);
        if (Number.isNaN(date.getTime())) return 'Date and time not set';
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    })();
    const previewAccentColor = (organizerProfile?.plan?.features?.enable_custom_branding || organizerProfile?.plan?.features?.custom_branding) ? formData.brandColor || '#38BDF2' : '#38BDF2';
    const hasPreviewPhysicalLocation = formData.locationType !== 'ONLINE' && !!formData.location?.trim();
    const previewMapEmbedUrl = (formData.location && import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
        ? `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(formData.location)}`
        : formData.location ? `https://maps.google.com/maps?q=${encodeURIComponent(formData.location.trim())}&z=15&output=embed` : '';
    const previewOpenMapUrl = formData.location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.location.trim())}`
        : '';
    const organizerPreviewInitial = (organizerProfile?.organizerName || name || 'O').charAt(0).toUpperCase();

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

    const loadPromotionMetadata = async () => {
        try {
            const [promoted, quota] = await Promise.all([
                apiService.listMyPromotedEvents(),
                apiService.getPromotionQuota()
            ]);

            const map: Record<string, { promoted: boolean; remainingDays?: number }> = {};
            promoted.forEach((p: any) => {
                map[p.eventId] = { promoted: true, remainingDays: p.remainingDays };
            });
            setPromotedEventsMap(map);
            setPromotionQuota(quota);
        } catch {
            console.error('Failed to load promotion metadata');
        }
    };

    useEffect(() => {
        loadPromotionMetadata();
    }, []);

    const handleToggleEventPromotion = async (eventId: string, currentStatus: boolean) => {
        setTogglingPromotionId(eventId);
        try {
            if (currentStatus) {
                await apiService.demoteEvent(eventId);
                setNotification({ message: 'Event removed from promotions.', type: 'success' });
            } else {
                await apiService.promoteEvent(eventId);
                setNotification({ message: 'Event successfully promoted!', type: 'success' });
            }
            await loadPromotionMetadata();
        } catch (err: any) {
            setNotification({ message: err.message || 'Promotion action failed.', type: 'error' });
        } finally {
            setTogglingPromotionId(null);
        }
    };

    const loadEventPromotions = async (eventId: string) => {
        setPromotionsLoading(true);
        try {
            const data = await apiService.listPromotions(eventId);
            setPromotions(data);
        } catch {
            setNotification({ message: 'Unable to load promotions.', type: 'error' });
        } finally {
            setPromotionsLoading(false);
        }
    };

    const handleSavePromotion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentEventId) return;
        setSubmitting(true);
        try {
            await apiService.upsertPromotion({
                ...promoForm,
                promotionId: editingPromotion?.promotionId,
                eventId: currentEventId
            });
            setNotification({ message: 'Promotion saved.', type: 'success' });
            setEditingPromotion(null);
            setPromoForm({
                code: '',
                discountType: 'PERCENTAGE',
                discountValue: '10',
                maxUses: '100',
                validFrom: '',
                validUntil: '',
                isActive: true
            });
            loadEventPromotions(currentEventId);
        } catch (err: any) {
            setNotification({ message: err.message || 'Failed to save promotion.', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePromotion = async (promotionId: string) => {
        if (!confirm('Are you sure you want to delete this promotion?')) return;
        try {
            await apiService.deletePromotion(promotionId);
            setNotification({ message: 'Promotion deleted.', type: 'success' });
            if (currentEventId) loadEventPromotions(currentEventId);
        } catch {
            setNotification({ message: 'Failed to delete promotion.', type: 'error' });
        }
    };

    const loadEventTicketReadiness = async (eventId: string) => {
        setTicketReadinessLoading(true);
        try {
            const ticketTypes = await apiService.getTicketTypes(eventId);
            setActiveEventTicketCount(ticketTypes.length);
            setFormData((prev) => ({ ...prev, ticketTypes }));
        } catch {
            setActiveEventTicketCount(0);
            setNotification({ message: 'Unable to verify ticket setup for this event.', type: 'error' });
        } finally {
            setTicketReadinessLoading(false);
        }
    };

    const handleCloseEventModal = () => {
        setIsModalOpen(false);
        setWizardStep(1);
        setInitialEventStatus('DRAFT');
        setActiveEventTicketCount(0);
        setTicketReadinessLoading(false);
        setResumeStatusAfterTicketSetup(false);
        setIsPreviewMode(false);
        setIsSidebarHidden(false);

        setPreviewDevice('mobile');
        setFinalStatusDecision('');
    };

    const validateStepBeforeAdvance = (step: EventSetupStep): string | null => {
        if (step === 1 && !formData.eventName.trim()) {
            return 'Step 1: Event name is required.';
        }
        if (step === 2) {
            if (!formData.eventDate) return 'Step 2: Event date is required.';
            if (!formData.location.trim()) return 'Step 2: Event location or access link is required.';
        }
        return null;
    };

    const handleNextWizardStep = () => {
        const errorMessage = validateStepBeforeAdvance(wizardStep);
        if (errorMessage) {
            setNotification({ message: errorMessage, type: 'error' });
            return;
        }
        if (wizardStep === 3 && !isEditMode) {
            void saveDraftAndContinueToTickets();
            return;
        }
        if (wizardStep === 4 && currentEventId) {
            void loadEventPromotions(currentEventId);
        }
        setWizardStep((prev) => (prev < 5 ? ((prev + 1) as EventSetupStep) : prev));
    };

    const handleOpenCreate = () => {
        if (!isPersonalProfileReady) {
            setNotification({ message: 'Complete your account profile first before creating events.', type: 'error' });
            navigate('/user-settings?tab=account');
            return;
        }
        if (!isOrganizerProfileReady) {
            setNotification({ message: 'Set up your organization profile first before creating events.', type: 'error' });
            navigate('/user-settings?tab=organizer');
            return;
        }

        setFormData({
            ...initialFormData,
            brandColor: organizerProfile?.brandColor || '#38BDF2',
            capacityTotal: parseLimit(organizerProfile?.plan?.limits?.max_attendees_per_event, 50)
        });
        setCurrentEventId(null);
        setIsEditMode(false);
        setInitialEventStatus('DRAFT');
        setActiveEventTicketCount(0);
        setResumeStatusAfterTicketSetup(false);
        setWizardStep(1);
        setIsPreviewMode(false);
        setPreviewDevice('mobile');
        setFinalStatusDecision('');
        setIsModalOpen(true);
    };

    useEffect(() => {
        const handler = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
        return () => window.clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => { fetchEvents(debouncedSearch); }, [debouncedSearch]);

    useEffect(() => {
        if (searchParams.get('openModal') !== 'true') return;
        if (organizerLoading) return;
        handleOpenCreate();
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('openModal');
        setSearchParams(nextParams, { replace: true });
    }, [searchParams, setSearchParams, organizerLoading, canStartCreation]);

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

        const fetchHitpaySettings = async () => {
            try {
                setHitpayLoading(true);
                const data = await apiService.getHitPaySettings('organizer');
                if (isMounted) setHitpaySettings(data);
            } catch {
                if (isMounted) setHitpaySettings(null);
            } finally {
                if (isMounted) setHitpayLoading(false);
            }
        };

        fetchOrganizerProfile();
        fetchHitpaySettings();
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
            location: event.locationText || '',
            streamingUrl: event.streaming_url || '',
            capacityTotal: event.capacityTotal,
            imageUrl: getImageUrl(event.imageUrl),
            status: event.status,
            regOpenDate: formatDateForInput(event.regOpenAt || '').date,
            regOpenTime: formatDateForInput(event.regOpenAt || '').time || '00:01',
            regCloseDate: formatDateForInput(event.regCloseAt || '').date,
            regCloseTime: formatDateForInput(event.regCloseAt || '').time,
            streamingPlatform: event.streamingPlatform || '',
            brandColor: event.brandColor || '#38BDF2',
            enableDiscountCodes: !!event.enableDiscountCodes,
            ticketTypes: event.ticketTypes,
        });
        setInitialEventStatus(event.status || 'DRAFT');
        setCurrentEventId(event.eventId);
        setIsEditMode(true);
        setResumeStatusAfterTicketSetup(false);
        setWizardStep(1);
        setIsPreviewMode(false);
        setPreviewDevice('mobile');
        setFinalStatusDecision(event.status || 'DRAFT');
        void loadEventTicketReadiness(event.eventId);
        void loadEventPromotions(event.eventId);
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
            if (currentEventId && selectedEvent.eventId === currentEventId) {
                setActiveEventTicketCount(ticketTypes.length);
                setFormData((prev) => ({ ...prev, ticketTypes }));
            }

            if (resumeStatusAfterTicketSetup) {
                setResumeStatusAfterTicketSetup(false);
                setWizardStep(4);
                setIsTicketModalOpen(false);
                setIsModalOpen(true);
                setNotification({ message: 'Tickets saved. Final step: set the event status.', type: 'success' });
                fetchEvents();
                return;
            }

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

    const handleDeleteEvent = async () => {
        if (!deleteConfirm) return;
        setSubmitting(true);
        try {
            await apiService.deleteUserEvent(deleteConfirm.eventId);
            setNotification({ message: 'Event archived successfully. You can restore it from the Archive page.', type: 'success' });
            setDeleteConfirm(null);
            fetchEvents();
        } catch (err) {
            setNotification({ message: 'Failed to archive event.', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const buildEventPayload = (statusOverride?: EventStatus) => {
        const mergeDateTime = (date: string, time: string) => {
            if (!date) return null;
            return `${date}T${time || '09:00'}:00`;
        };

        return {
            eventName: formData.eventName,
            description: formData.description,
            startAt: mergeDateTime(formData.eventDate, formData.eventTime),
            endAt: formData.endDate ? mergeDateTime(formData.endDate, formData.endTime) : null,
            timezone: formData.timezone,
            locationType: formData.locationType,
            locationText: formData.location,
            capacityTotal: formData.capacityTotal,
            imageUrl: formData.imageUrl,
            status: statusOverride || formData.status,
            regOpenAt: formData.regOpenDate ? mergeDateTime(formData.regOpenDate, formData.regOpenTime || '00:01') : null,
            regCloseAt: formData.regCloseDate ? mergeDateTime(formData.regCloseDate, formData.regCloseTime || '23:59') : null,
            brandColor: formData.brandColor || null,
            enableDiscountCodes: formData.enableDiscountCodes || false,
            streamingPlatform: formData.streamingPlatform,
            streaming_url: formData.streamingUrl || null,
            organizerId: organizerProfile?.organizerId || null,
        };
    };

    const saveDraftAndContinueToTickets = async () => {
        setSubmitting(true);
        try {
            const draftPayload = buildEventPayload('DRAFT');
            let savedEvent: Event;

            if (isEditMode && currentEventId) {
                savedEvent = await apiService.updateUserEvent(currentEventId, draftPayload);
            } else {
                savedEvent = await apiService.createUserEvent(draftPayload);
            }

            setIsEditMode(true);
            setCurrentEventId(savedEvent.eventId);
            setInitialEventStatus(savedEvent.status || 'DRAFT');
            setFormData((prev) => ({
                ...prev,
                status: savedEvent.status || 'DRAFT',
                ticketTypes: savedEvent.ticketTypes || prev.ticketTypes
            }));

            const eventForTickets = { ...savedEvent, ticketTypes: savedEvent.ticketTypes || [] };
            setSelectedEvent(eventForTickets);
            setResumeStatusAfterTicketSetup(true);
            setWizardStep(5);
            setIsPreviewMode(false);
            setFinalStatusDecision('');
            setIsModalOpen(false);
            setIsTicketModalOpen(true);
            setNotification({ message: 'Draft saved. Continue by setting up tickets.', type: 'success' });
            fetchEvents();
        } catch (error: any) {
            setNotification({ message: error?.message || 'Failed to save draft before ticket setup.', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCloseTicketModal = () => {
        setIsTicketModalOpen(false);
        if (!resumeStatusAfterTicketSetup) return;
        setResumeStatusAfterTicketSetup(false);
        setIsModalOpen(true);
        setWizardStep(4);
        setIsPreviewMode(false);
        setNotification({ message: 'Ticket setup cancelled. Complete tickets to continue to Event Status.', type: 'error' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.eventName.trim()) {
            setWizardStep(1);
            setNotification({ message: 'Event name is required.', type: 'error' });
            return;
        }
        if (!formData.eventDate || !formData.location.trim()) {
            setWizardStep(2);
            setNotification({ message: 'Set the event schedule and location before saving.', type: 'error' });
            return;
        }
        const isQuickUpdate = e && (e.target as any)?.dataset?.quickUpdate === 'true';

        if (!finalStatusDecision && !isQuickUpdate) {
            setWizardStep(5);
            setNotification({ message: 'Step 5: choose if this event should stay Draft or be Published.', type: 'error' });
            return;
        }

        const isPublishingTransition = (formData.status === 'PUBLISHED') && (initialEventStatus !== 'PUBLISHED');
        if (isPublishingTransition && !canPublishByTicketRule) {
            setWizardStep(5);
            setNotification({ message: 'Add at least one ticket type before publishing this event.', type: 'error' });
            return;
        }

        setSubmitting(true);
        try {
            const payload = buildEventPayload();
            if (isEditMode && currentEventId) {
                await apiService.updateUserEvent(currentEventId, payload);
                setNotification({ message: 'Event updated successfully.', type: 'success' });
            } else {
                await apiService.createUserEvent(payload);
                setNotification({ message: 'Event created successfully!', type: 'success' });
            }
            handleCloseEventModal();
            fetchEvents();
        } catch (error: any) {
            setNotification({ message: error?.message || 'Failed to save event.', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const applyLocationValue = (locationValue: string) => {
        const nextData: any = { ...formData, location: locationValue };
        const isUrl = locationValue.startsWith('http');
        if (isUrl) {
            nextData.streamingUrl = locationValue;
        }
        if (!formData.streamingPlatform && isUrl) {
            const lowUrl = locationValue.toLowerCase();
            if (lowUrl.includes('youtube.com') || lowUrl.includes('youtu.be')) nextData.streamingPlatform = 'YouTube';
            else if (lowUrl.includes('facebook.com') || lowUrl.includes('fb.watch')) nextData.streamingPlatform = 'Facebook';
            else if (lowUrl.includes('meet.google.com')) nextData.streamingPlatform = 'Google Meet';
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
            )}

            {!isModalOpen && (
                <>
            {/* Header section - Refined with Title/Subtitle aligned to Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2 mb-8 pt-6 border-b border-[#2E2E2F]/15 pb-8">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-black text-[#2E2E2F] tracking-tight">Events</h1>
                        <button
                            type="button"
                            onClick={() => setIsWorkflowNoticeOpen(true)}
                            title="Show Organizer Event Workflow guide"
                            className="h-[38px] w-[38px] shrink-0 rounded-xl border-2 border-[#2E2E2F]/20 bg-[#F2F2F2] text-[#2E2E2F]/70 hover:text-[#2E2E2F] hover:border-[#38BDF2]/40 hover:bg-[#38BDF2]/10 transition-colors flex items-center justify-center"
                        >
                            <ICONS.Info className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-[#2E2E2F]/50 font-bold text-sm">Configure and manage your session lifecycle.</p>
                </div>

                <div className="flex flex-col gap-3 w-full lg:w-auto lg:items-end">
                    {/* Plan Status & Promotions Quota - Top Right */}
                    <div className="flex flex-wrap items-center gap-3 justify-end">

                        {promotionQuota && (
                            <div className="flex items-center gap-2 px-3 py-1.5 border-2 rounded-xl shadow-sm whitespace-nowrap border-[#2E2E2F]/15 bg-[#2E2E2F]/5">
                                <ICONS.Zap className="w-3.5 h-3.5 text-[#2E2E2F]/40" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/60">
                                    Promotions
                                </span>
                                <span className="text-[10px] font-bold text-[#2E2E2F]/30">|</span>
                                <span className={`text-[10px] font-bold ${promotionQuota.used < promotionQuota.limit
                                    ? 'text-[#2E2E2F]/50'
                                    : 'text-red-500'
                                    }`}>
                                    {promotionQuota.used}/{promotionQuota.limit}
                                </span>
                            </div>
                        )}

                        {organizerProfile && (() => {
                            const pricedLimit = Number(organizerProfile?.plan?.limits?.max_priced_events || organizerProfile?.plan?.max_priced_events || organizerProfile?.plan?.maxPricedEvents || 0);
                            const currentPaidCount = events.filter(e => (e.ticketTypes || []).some((t: any) => (t.priceAmount || 0) > 0)).length;

                            return (
                                <div className={`flex items-center gap-2 px-3 py-1.5 bg-[#F2F2F2] border-2 rounded-xl shadow-sm whitespace-nowrap border-[#2E2E2F]/15`}>
                                    <ICONS.CreditCard className="w-3.5 h-3.5 text-[#2E2E2F]/40" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/60">
                                        Paid Events
                                    </span>
                                    <span className="text-[10px] font-bold text-[#2E2E2F]/30">|</span>
                                    <span className={`text-[10px] font-bold ${currentPaidCount >= pricedLimit ? 'text-red-500' : 'text-[#2E2E2F]/40'}`}>
                                        {currentPaidCount}/{pricedLimit}
                                    </span>
                                </div>
                            );
                        })()}


                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full">

                        <div className="relative w-full sm:w-64">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#2E2E2F]/60">
                                <ICONS.Search className="h-4 w-4" strokeWidth={3} />
                            </div>
                            <input
                                type="text"
                                placeholder="Search events..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="block w-full pl-10 pr-10 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/30 focus:border-[#38BDF2] transition-colors"
                            />
                        </div>
                        <select
                            className="px-4 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-[11px] font-bold uppercase tracking-widest outline-none transition-colors"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">All Status</option>
                            <option value="PUBLISHED">Published</option>
                            <option value="DRAFT">Draft</option>
                            <option value="CLOSED">Closed</option>
                        </select>

                        <div className="flex items-center bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl p-1">
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

                        <div className="flex flex-col items-end">
                            <Button
                                onClick={handleOpenCreate}
                                className="rounded-xl px-6 py-3 bg-[#38BDF2] text-[#F2F2F2] hover:text-[#F2F2F2] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!canStartCreation || organizerLoading || isAtTotalLimit}
                            >
                                <span className="flex items-center gap-2 font-bold text-sm">
                                    <ICONS.Calendar className="w-4 h-4" />
                                    {isAtTotalLimit ? 'Limit Reached' : 'Create Event'}
                                </span>
                            </Button>
                            {isAtTotalLimit && (
                                <p className="mt-1.5 text-[10px] text-[#2E2E2F]/50 font-bold uppercase tracking-tight">Upgrade for more events</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Events View */}
            {viewMode === 'list' ? (
                /* ─── TABLE VIEW ─── */
                filteredEvents.length === 0 ? (
                    <div className="py-20 text-center text-[#2E2E2F]/50">
                        <div className="w-24 h-24 mx-auto mb-6 bg-[#F2F2F2] rounded-2xl flex items-center justify-center border-2 border-[#2E2E2F]/15">
                            <ICONS.Calendar className="w-12 h-12 opacity-30" />
                        </div>
                        <p className="text-base font-medium text-[#2E2E2F]/60 tracking-tight">No events to show</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                            {filteredEvents.map(event => (
                                <Card
                                    key={event.eventId}
                                    className="p-5 border-2 border-[#2E2E2F]/15 hover:border-[#38BDF2]/40 transition-colors cursor-pointer"
                                    onClick={() => handleOpenEdit(event)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 border-[#2E2E2F]/15">
                                            <img src={getImageUrl(event.imageUrl)} alt="" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                {(() => {
                                                    const now = new Date();
                                                    const eventEnd = event.endAt ? new Date(event.endAt) : new Date(new Date(event.startAt).getTime() + 2 * 60 * 60 * 1000);
                                                    const isCompleted = now > eventEnd;
                                                    return (
                                                        <Badge
                                                            type={isCompleted ? 'neutral' : (event.status === 'PUBLISHED' ? 'success' : 'neutral')}
                                                            className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5"
                                                        >
                                                            {isCompleted ? 'COMPLETED' : event.status}
                                                        </Badge>
                                                    );
                                                })()}
                                                {promotedEventsMap[event.eventId]?.promoted && (
                                                    <Badge
                                                        type="success"
                                                        className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-[#38BDF2]/20 text-[#38BDF2] border border-[#38BDF2]/30 flex items-center gap-1"
                                                    >
                                                        <ICONS.Zap className="w-2.5 h-2.5" />
                                                        Promoted
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="mb-2">
                                                <span className="text-[10px] font-medium text-[#2E2E2F]/40 truncate group-hover:text-[#2E2E2F]/60 transition-colors">
                                                    ID: {event.eventId.split('-')[0]}
                                                </span>
                                                <h3 className="font-bold text-[#2E2E2F] text-base truncate mt-0.5 group-hover:text-[#38BDF2] transition-colors">
                                                    {event.eventName}
                                                </h3>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-[11px] text-[#2E2E2F]/60 font-medium">
                                                    <ICONS.Calendar className="w-3 h-3 text-[#38BDF2]" />
                                                    {new Date(event.startAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-[#2E2E2F]/60 font-medium">
                                                    <ICONS.MapPin className="w-3 h-3 text-[#38BDF2]" />
                                                    <span className="truncate">{event.locationText}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="relative group/more shrink-0">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === event.eventId ? null : event.eventId); }}
                                                className={`p-1.5 rounded-xl transition-all duration-300 ${openDropdownId === event.eventId ? 'bg-[#38BDF2] text-[#F2F2F2]' : 'hover:bg-[#2E2E2F]/5 text-[#2E2E2F]/40 hover:text-[#2E2E2F]'}`}
                                            >
                                                <MoreVerticalIcon className="w-5 h-5" />
                                            </button>

                                            <div
                                                className={`absolute right-1 top-1/2 -translate-y-1/2 w-48 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-2xl shadow-2xl z-[100] overflow-hidden py-2 transition-all duration-200 origin-right ${openDropdownId === event.eventId ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible group-hover/more:opacity-100 group-hover/more:scale-100 group-hover/more:visible'}`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button onClick={(e) => { e.stopPropagation(); navigate(`/event/${event.slug || event.eventId}`); }} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] flex items-center gap-3 transition-colors">
                                                    <EyeIcon className="w-4 h-4" /> View
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenTickets(event); }} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] flex items-center gap-3 transition-colors">
                                                    <ICONS.CreditCard className="w-4 h-4" /> Tickets
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenAttendeePop(event); }} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] flex items-center gap-3 transition-colors">
                                                    <ICONS.Users className="w-4 h-4" /> Guests
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(event); }} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] flex items-center gap-3 transition-colors">
                                                    <ICONS.Edit className="w-4 h-4" /> Edit
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const isPromoted = promotedEventsMap[event.eventId]?.promoted;
                                                        if (promotionQuota && !isPromoted && !promotionQuota.canPromote) {
                                                            setNotification({ message: 'You have reached your promotion limit.', type: 'error' });
                                                        } else {
                                                            handleToggleEventPromotion(event.eventId, isPromoted || false);
                                                        }
                                                    }}
                                                    className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] flex items-center gap-3 transition-colors"
                                                >
                                                    <ICONS.Zap className="w-4 h-4" fill={promotedEventsMap[event.eventId]?.promoted ? "currentColor" : "none"} /> Promote
                                                </button>
                                                <div className="my-1 border-t border-[#2E2E2F]/5" />
                                                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(event); }} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-red-500/70 hover:bg-red-500/10 hover:text-red-600 flex items-center gap-3 transition-colors">
                                                    <ICONS.Trash className="w-4 h-4" /> Archive
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-5 pt-4 border-t border-[#2E2E2F]/15 flex items-center justify-between text-[11px] font-bold text-[#2E2E2F]/40 uppercase tracking-widest">
                                        <span>Inventory</span>
                                        <span className="text-[#38BDF2]">{event.capacityTotal} Slots</span>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <Card className="hidden md:block !overflow-visible border border-[#2E2E2F]/15 rounded-[2.5rem] bg-[#F2F2F2]">
                            <div className="!overflow-visible">
                                <table className="w-full text-left">
                                    <thead className="bg-[#F2F2F2] border-b border-[#2E2E2F]/15">
                                        <tr>
                                            <th className="px-8 py-5 text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Event Identity</th>
                                            <th className="px-8 py-5 text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Date & Location</th>
                                            <th className="px-8 py-5 text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Lifecycle</th>
                                            <th className="px-8 py-5 text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-[#2E2E2F]/15">
                                        {filteredEvents.map(event => (
                                            <tr key={event.eventId} className="hover:bg-[#38BDF2]/10 transition-colors group cursor-pointer" onClick={() => handleOpenEdit(event)}>
                                                <td className="px-8 py-7">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border-2 border-[#2E2E2F]/15 relative">
                                                            <img src={getImageUrl(event.imageUrl)} alt="" className="w-full h-full object-cover" />

                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-bold text-[#2E2E2F] text-[16px] tracking-tight group-hover:text-[#2E2E2F] transition-colors">{event.eventName}</div>
                                                                {promotedEventsMap[event.eventId]?.promoted && (
                                                                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-[#38BDF2]/20 text-[#38BDF2] border border-[#38BDF2]/30 rounded-full whitespace-nowrap flex items-center gap-1">
                                                                        <ICONS.Zap className="w-2 h-2" />
                                                                        Promoted
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[11px] font-medium text-[#2E2E2F]/40 uppercase tracking-widest">{event.eventId.split('-')[0]}</span>
                                                                <span className="w-1 h-1 rounded-full bg-[#2E2E2F]/10"></span>
                                                                <span className="text-[11px] font-medium text-[#2E2E2F]/60 tracking-tight">/{event.slug}</span>
                                                            </div>
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
                                                    {(() => {
                                                        const now = new Date();
                                                        const eventEnd = event.endAt ? new Date(event.endAt) : new Date(new Date(event.startAt).getTime() + 2 * 60 * 60 * 1000);
                                                        const isCompleted = now > eventEnd;
                                                        return (
                                                            <div className={`inline-flex px-3.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${isCompleted
                                                                ? 'bg-[#2E2E2F]/10 text-[#2E2E2F]'
                                                                : event.status === 'PUBLISHED'
                                                                    ? 'bg-[#38BDF2]/20 text-[#2E2E2F]'
                                                                    : event.status === 'DRAFT'
                                                                        ? 'bg-[#F2F2F2] text-[#2E2E2F]/60 border-2 border-[#2E2E2F]/15'
                                                                        : 'bg-[#2E2E2F]/10 text-[#2E2E2F]'
                                                                }`}>
                                                                {isCompleted ? 'COMPLETED' : event.status}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-8 py-7 !overflow-visible align-middle">
                                                    <div className="flex justify-center items-center relative group/more h-full">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === event.eventId ? null : event.eventId); }}
                                                            className={`p-1.5 rounded-xl transition-all duration-300 ${openDropdownId === event.eventId ? 'bg-[#38BDF2] text-[#F2F2F2]' : 'hover:bg-[#2E2E2F]/5 text-[#2E2E2F]/40 hover:text-[#2E2E2F]'}`}
                                                        >
                                                            <MoreVerticalIcon className="w-5 h-5" />
                                                        </button>

                                                        <div
                                                            className={`absolute right-1 top-1/2 -translate-y-1/2 w-48 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-2xl shadow-2xl z-[100] overflow-hidden py-2 transition-all duration-200 origin-right ${openDropdownId === event.eventId ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible group-hover/more:opacity-100 group-hover/more:scale-100 group-hover/more:visible'}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button onClick={(e) => { e.stopPropagation(); navigate(`/event/${event.slug || event.eventId}`); }} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] flex items-center gap-3 transition-colors">
                                                                <EyeIcon className="w-4 h-4" /> View
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleOpenTickets(event); }} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] flex items-center gap-3 transition-colors">
                                                                <ICONS.CreditCard className="w-4 h-4" /> Tickets
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleOpenAttendeePop(event); }} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] flex items-center gap-3 transition-colors">
                                                                <ICONS.Users className="w-4 h-4" /> Guests
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(event); }} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] flex items-center gap-3 transition-colors">
                                                                <ICONS.Edit className="w-4 h-4" /> Edit
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const isPromoted = promotedEventsMap[event.eventId]?.promoted;
                                                                    if (promotionQuota && !isPromoted && !promotionQuota.canPromote) {
                                                                        setNotification({ message: 'You have reached your promotion limit.', type: 'error' });
                                                                    } else {
                                                                        handleToggleEventPromotion(event.eventId, isPromoted || false);
                                                                    }
                                                                }}
                                                                className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/70 hover:bg-[#38BDF2]/10 hover:text-[#38BDF2] flex items-center gap-3 transition-colors"
                                                            >
                                                                <ICONS.Zap className="w-4 h-4" fill={promotedEventsMap[event.eventId]?.promoted ? "currentColor" : "none"} /> Promote
                                                            </button>
                                                            <div className="my-1 border-t border-[#2E2E2F]/5" />
                                                            <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(event); }} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-red-500/70 hover:bg-red-500/10 hover:text-red-600 flex items-center gap-3 transition-colors">
                                                                <ICONS.Trash className="w-4 h-4" /> Archive
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </>
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
                                    className={`h-20 rounded-xl border p-1.5 flex flex-col transition-colors ${isToday ? 'border-[var(--color-primary-40)] bg-[var(--color-primary-10)]' : 'border-[#2E2E2F]/5 hover:border-[#2E2E2F]/15'}`}
                                >
                                    <span className={`text-[11px] font-bold ${isToday ? 'text-[var(--color-primary)]' : 'text-[#2E2E2F]/60'}`}>{day}</span>
                                    <div className="flex-1 overflow-hidden mt-0.5 space-y-0.5">
                                        {dayEvents.slice(0, 2).map(ev => (
                                            <div
                                                key={ev.eventId}
                                                onClick={() => handleOpenEdit(ev)}
                                                className="text-[8px] font-bold rounded px-1 py-0.5 truncate cursor-pointer hover:opacity-90 transition-opacity bg-[var(--color-primary-20)] text-[var(--color-text)]"
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
                </>
            )}

            <Modal
                isOpen={isWorkflowNoticeOpen}
                onClose={() => setIsWorkflowNoticeOpen(false)}
                title="Organizer Event Workflow"
                subtitle="Step-by-step publishing guide"
            >
                <div className="space-y-5">
                    <div className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">
                        {workflowCompletedCount} / 4 Completed
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <div className={`rounded-2xl border px-4 py-4 ${isPersonalProfileReady ? 'border-[#38BDF2]/40 bg-[#38BDF2]/10' : 'border-[#2E2E2F]/10 bg-[#F2F2F2]'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/45">Step 1</p>
                            <p className="text-sm font-bold text-[#2E2E2F] mt-2">Complete Profile</p>
                            <p className="text-[11px] text-[#2E2E2F]/60 mt-1">Set your account name in Account settings.</p>
                        </div>

                        <div className={`rounded-2xl border px-4 py-4 ${isOrganizerProfileReady ? 'border-[#38BDF2]/40 bg-[#38BDF2]/10' : 'border-[#2E2E2F]/10 bg-[#F2F2F2]'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/45">Step 2</p>
                            <p className="text-sm font-bold text-[#2E2E2F] mt-2">Set Org Profile</p>
                            <p className="text-[11px] text-[#2E2E2F]/60 mt-1">Configure organizer name and branding details.</p>
                        </div>

                        <div className={`rounded-2xl border px-4 py-4 ${isPaymentReady ? 'border-[#38BDF2]/40 bg-[#38BDF2]/10' : 'border-[#2E2E2F]/10 bg-[#F2F2F2]'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/45">Step 3</p>
                            <p className="text-sm font-bold text-[#2E2E2F] mt-2">Payment Gateway</p>
                            <p className="text-[11px] text-[#2E2E2F]/60 mt-1">Connect your HitPay account to receive payouts for paid events.</p>
                        </div>

                        <div className={`rounded-2xl border px-4 py-4 ${hasExistingEvents ? 'border-[#38BDF2]/40 bg-[#38BDF2]/10' : 'border-[#2E2E2F]/10 bg-[#F2F2F2]'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/45">Step 4</p>
                            <p className="text-sm font-bold text-[#2E2E2F] mt-2">Create Draft</p>
                            <p className="text-[11px] text-[#2E2E2F]/60 mt-1">Build your event details and save as draft.</p>
                        </div>

                        <div className={`rounded-2xl border px-4 py-4 ${hasPublishedEvent ? 'border-[#38BDF2]/40 bg-[#38BDF2]/10' : 'border-[#2E2E2F]/10 bg-[#F2F2F2]'}`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/45">Step 5</p>
                            <p className="text-sm font-bold text-[#2E2E2F] mt-2">Tickets then Publish</p>
                            <p className="text-[11px] text-[#2E2E2F]/60 mt-1">Add at least one ticket type before going live.</p>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* ─── Create/Edit Event logic (In-page) ─── */}
            {isModalOpen && (
                <div style={{ zoom: 0.85 }} className="animate-in fade-in duration-200 min-h-[calc(85vh-80px)] mb-0 px-0 pt-0">
                <div className={`grid grid-cols-1 gap-6 ${isSidebarHidden ? 'xl:grid-cols-1' : (!isPreviewMode || previewDevice === 'desktop') ? 'xl:grid-cols-[300px_minmax(0,1fr)]' : 'xl:grid-cols-[300px_minmax(0,1fr)_380px]'}`}>
                    {!isSidebarHidden && (
                        <div className="space-y-5 xl:sticky xl:top-0 self-start xl:max-h-[calc(70vh-1rem)] xl:overflow-y-auto xl:pr-1">
                            <div className="bg-[#F2F2F2] rounded-[2rem] border border-[#2E2E2F]/15 overflow-hidden">
                                <div className="p-4 space-y-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseEventModal}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#F2F2F2] text-[#2E2E2F] rounded-xl hover:bg-[#2E2E2F] hover:text-white transition-colors w-fit"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                        <span className="text-xs font-bold uppercase tracking-wide">Back to Events</span>
                                    </button>
                                    <h1 className="text-3xl font-black text-[#2E2E2F] tracking-tight leading-tight">{formData.eventName || 'Event Title'}</h1>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-semibold uppercase tracking-wide border ${formData.status === 'PUBLISHED' ? 'bg-[#38BDF2]/20 border-[#38BDF2]/40 text-[#2E2E2F]' : 'bg-[#F2F2F2] border-[#2E2E2F]/20 text-[#2E2E2F]/60'}`}>{formData.status}</div>
                                    </div>
                                    <div className="space-y-3 pt-1">
                                        <div className="flex items-center gap-3 bg-[#F2F2F2] px-4 py-3 rounded-2xl border-2 border-[#2E2E2F]/15">
                                            <div className="w-8 h-8 bg-[#38BDF2]/10 text-[#2E2E2F] rounded-lg flex items-center justify-center"><ICONS.Calendar className="w-4 h-4" strokeWidth={2.5} /></div>
                                            <span className="text-[13px] font-semibold text-[#2E2E2F] tracking-tight">{previewDateLabel}</span>
                                        </div>
                                        <div className="flex items-center gap-3 bg-[#F2F2F2] px-4 py-3 rounded-2xl border-2 border-[#2E2E2F]/15">
                                            <div className="w-8 h-8 bg-[#38BDF2]/10 text-[#2E2E2F] rounded-lg flex items-center justify-center"><ICONS.MapPin className="w-4 h-4" strokeWidth={2.5} /></div>
                                            <span className="text-[13px] font-semibold text-[#2E2E2F] tracking-tight truncate max-w-[210px]">{formData.location || 'Set Venue / Connection'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="hidden md:block bg-[#F2F2F2] rounded-[2rem] border border-[#2E2E2F]/15 overflow-hidden">
                                <div className="px-5 py-3 border-b border-[#2E2E2F]/15"><p className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Steps</p></div>
                                {EVENT_SETUP_STEPS.map((step) => (
                                    <button
                                        key={step.id}
                                        type="button"
                                        onClick={() => { setWizardStep(step.id); setIsPreviewMode(false); }}
                                        className={`w-full text-left px-5 py-4 border-b border-[#2E2E2F]/15 last:border-b-0 transition-colors hover:bg-[#38BDF2]/5 ${wizardStep === step.id ? 'bg-[#38BDF2]/10' : ''}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${wizardStep >= step.id ? 'border-[#2563EB]' : 'border-[#2E2E2F]/20'}`}>
                                                {wizardStep >= step.id && <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />}
                                            </span>
                                            <div>
                                                <p className="text-[18px] leading-none font-bold text-[#2E2E2F]">{step.title}</p>
                                                <p className="mt-2 text-[13px] leading-5 text-[#2E2E2F]/70">{EVENT_SETUP_STEP_DETAIL[step.id]}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="hidden md:flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-2xl font-black text-[#2E2E2F] tracking-tight">{activeStepMeta.title}</h3>
                                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2E2E2F]/55 mt-1">{EVENT_SETUP_STEP_DETAIL[wizardStep]}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isPreviewMode && (
                                    <button
                                        type="button"
                                        onClick={() => setIsPreviewMode(true)}
                                        className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-[#2E2E2F]/15 bg-[#F2F2F2] text-[#2E2E2F] hover:bg-[#38BDF2]/10 hover:border-[#38BDF2]/35 transition-colors text-[13px] font-bold"
                                    >
                                        <EyeIcon className="w-4 h-4" />
                                        Show Preview
                                    </button>
                                )}</div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-8 px-1">
                            {wizardStep === 1 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide mb-2 ml-1">Organizer Name</label>
                                        <select value={organizerProfile?.organizerId || ''} disabled className="w-full px-4 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-[12px] font-semibold tracking-wide outline-none">
                                            {organizerProfile?.organizerId ? <option value={organizerProfile.organizerId}>{organizerProfile.organizerName}</option> : <option value="">No organizer profile set</option>}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <Input label="Event Name" placeholder="e.g. Founder Growth Summit 2026" value={formData.eventName} onChange={(e: any) => setFormData({ ...formData, eventName: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide mb-2 ml-1">Description</label>
                                        <textarea className="w-full px-5 py-4 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-[1.5rem] text-sm min-h-[130px] focus:ring-2 focus:ring-[#38BDF2]/30 focus:border-[#38BDF2] transition-colors outline-none" value={formData.description} onChange={(e: any) => setFormData({ ...formData, description: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <div className="flex flex-col gap-2 mb-1 px-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Brand Color</label>
                                                {!(organizerProfile?.plan?.features?.enable_custom_branding || organizerProfile?.plan?.features?.custom_branding) && (
                                                    <Badge type="info" className="text-[8px] px-2 py-0.5 bg-[#2E2E2F] text-white">Premium Feature</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 p-4 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-2xl relative overflow-hidden">
                                                <input
                                                    type="color"
                                                    value={formData.brandColor || '#38BDF2'}
                                                    onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                                                    disabled={!(organizerProfile?.plan?.features?.enable_custom_branding || organizerProfile?.plan?.features?.custom_branding)}
                                                    className={`w-12 h-12 rounded-lg cursor-pointer border-none p-0 bg-transparent ${!(organizerProfile?.plan?.features?.enable_custom_branding || organizerProfile?.plan?.features?.custom_branding) ? 'opacity-30' : ''}`}
                                                />
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-[#2E2E2F]">Primary Accent Color</p>
                                                    <p className="text-[10px] text-[#2E2E2F]/50">Used for buttons, links, and highlights on your event page.</p>
                                                </div>
                                                {!(organizerProfile?.plan?.features?.enable_custom_branding || organizerProfile?.plan?.features?.custom_branding) && (
                                                    <div className="absolute inset-0 bg-[#F2F2F2]/40 backdrop-blur-[1px] flex items-center justify-center">
                                                        <Button variant="outline" className="text-[8px] py-1 px-3 border-[#2E2E2F]/20" onClick={() => navigate('/subscription')}>Upgrade to Unlock</Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <div className="flex flex-col gap-2 mb-1 px-1">
                                            <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Visual Media</label>
                                            <div
                                                className="relative group w-full h-44 rounded-[1.5rem] border-2 border-dashed border-[#2E2E2F]/30 bg-[#F2F2F2] flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#38BDF2] hover:bg-[#38BDF2]/10 transition-colors"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                {formData.imageUrl ? (
                                                    <img src={getImageUrl(formData.imageUrl)} alt="Preview" className="w-full h-full object-cover rounded-[1.5rem]" />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center w-full h-full">
                                                        <svg className="w-10 h-10 text-[#2E2E2F]/40 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="2.5" /><path d="M21 15l-5-5L5 21" /></svg>
                                                        <span className="text-[12px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Upload Event Image</span>
                                                    </div>
                                                )}
                                                <div className="absolute bottom-3 right-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-lg px-3 py-1 text-[11px] font-semibold text-[#2E2E2F] uppercase tracking-wide group-hover:bg-[#38BDF2] group-hover:text-[#F2F2F2] transition-colors pointer-events-none">Browse</div>
                                            </div>
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 2 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                                    <Input label="Session Date" type="date" value={formData.eventDate} onChange={(e: any) => setFormData({ ...formData, eventDate: e.target.value })} />
                                    <Input label="Start Time" type="time" value={formData.eventTime} onChange={(e: any) => setFormData({ ...formData, eventTime: e.target.value })} />
                                    <Input label="End Date" type="date" value={formData.endDate} onChange={(e: any) => setFormData({ ...formData, endDate: e.target.value })} />
                                    <Input label="End Time" type="time" value={formData.endTime} onChange={(e: any) => setFormData({ ...formData, endTime: e.target.value })} />

                                    <div>
                                        <label className="block text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide mb-2 ml-1">Location Type</label>
                                        <select
                                            className="w-full px-4 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-[11px] font-medium uppercase tracking-wide outline-none focus:ring-2 focus:ring-[#38BDF2]/30 focus:border-[#38BDF2]"
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

                                    <div className="md:col-span-2 space-y-8">
                                        {/* Physical Venue Section */}
                                        <div className="p-6 bg-[#F2F2F2] rounded-[1.5rem] border border-[#2E2E2F]/15">
                                            <div className="flex items-center gap-3 mb-5">
                                                <div className="w-8 h-8 rounded-lg bg-[#38BDF2]/10 flex items-center justify-center text-[#38BDF2]">
                                                    <ICONS.MapPin className="w-4 h-4" />
                                                </div>
                                                <h4 className="text-[12px] font-black text-[#2E2E2F] uppercase tracking-widest">Venue Details</h4>
                                            </div>
                                            <Input
                                                label={formData.locationType === 'ONLINE' ? 'Physical Hub (Optional)' : 'Venue Address'}
                                                placeholder="e.g. Global Tech Center"
                                                value={formData.location}
                                                onChange={(e: any) => setFormData({ ...formData, location: e.target.value })}
                                            />
                                            <div className="mt-4">
                                                <OnsiteLocationAssistant
                                                    value={formData.location}
                                                    onChange={applyLocationValue}
                                                />
                                            </div>
                                        </div>

                                        {/* Broadcast Section */}
                                        <div className="p-6 bg-[#F2F2F2] rounded-[1.5rem] border border-[#2E2E2F]/15">
                                            <div className="flex items-center gap-3 mb-5">
                                                <div className="w-8 h-8 rounded-lg bg-[#38BDF2]/10 flex items-center justify-center text-[#38BDF2]">
                                                    <ICONS.Monitor className="w-4 h-4" />
                                                </div>
                                                <h4 className="text-[12px] font-black text-[#2E2E2F] uppercase tracking-widest">Broadcast Settings</h4>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <Input
                                                    label="Platform Name"
                                                    placeholder="e.g. YouTube, Google Meet"
                                                    value={formData.streamingPlatform}
                                                    onChange={(e: any) => setFormData({ ...formData, streamingPlatform: e.target.value })}
                                                />
                                                <Input
                                                    label="Connection URL"
                                                    placeholder="Link to stream or meeting"
                                                    value={formData.streamingUrl}
                                                    onChange={(e: any) => applyLocationValue(e.target.value)}
                                                />
                                            </div>

                                            {formData.streamingUrl && formData.streamingUrl.startsWith('http') && (
                                                <div className="mt-6 p-6 bg-black rounded-3xl border border-[#F2F2F2]/10 overflow-hidden shadow-xl">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h4 className="text-[12px] font-black text-white uppercase tracking-widest">Stream Preview</h4>
                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-red-500/30 bg-red-500/20">
                                                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-white">Live</span>
                                                        </div>
                                                    </div>

                                                    {(formData.streamingUrl.includes('youtube.com') || formData.streamingUrl.includes('youtu.be')) ? (
                                                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#F2F2F2]/5 border border-[#F2F2F2]/5">
                                                            {(() => {
                                                                const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/|live\/)([^#\&\?]*).*/;
                                                                const match = formData.streamingUrl.match(regExp);
                                                                const videoId = (match && match[2].length === 11) ? match[2] : null;

                                                                return videoId ? (
                                                                    <iframe
                                                                        className="absolute inset-0 w-full h-full"
                                                                        src={`https://www.youtube.com/embed/${videoId}`}
                                                                        title="YouTube Preview"
                                                                        frameBorder="0"
                                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                                        allowFullScreen
                                                                    />
                                                                ) : <div className="flex items-center justify-center w-full h-full text-[#F2F2F2]/30 text-xs">Invalid YouTube Link</div>;
                                                            })()}
                                                        </div>
                                                    ) : (formData.streamingUrl.includes('facebook.com') || formData.streamingUrl.includes('fb.watch')) ? (
                                                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#F2F2F2]/5 border border-[#F2F2F2]/5">
                                                            <iframe
                                                                className="absolute inset-0 w-full h-full"
                                                                src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(formData.streamingUrl)}&show_text=0&width=560&t=0`}
                                                                title="Facebook Preview"
                                                                frameBorder="0"
                                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                                allowFullScreen
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center p-10 rounded-2xl bg-[#F2F2F2]/5 border border-[#F2F2F2]/5 border-dashed">
                                                            <ICONS.Monitor className="w-8 h-8 text-[#F2F2F2]/20 mb-3" />
                                                            <p className="text-[#F2F2F2]/40 text-[11px] text-center font-medium">This platform doesn't support direct previews, but the link will be provided to attendees.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 3 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                                    <Input
                                        label={`Capacity Total (${formData.capacityTotal}/${maxEventCapacity})`}
                                        type="number"
                                        min={1}
                                        max={maxEventCapacity}
                                        value={formData.capacityTotal}
                                        onChange={(e: any) => {
                                            const val = parseInt(e.target.value, 10) || 1;
                                            const nextValue = Math.max(1, Math.min(val, maxEventCapacity));
                                            setFormData({ ...formData, capacityTotal: nextValue });
                                        }}
                                        error={formData.capacityTotal > maxEventCapacity ? `Capacity exceeds your plan limit (${maxEventCapacity})` : ''}
                                    />
                                    <Input
                                        label="Registration Open Date"
                                        type="date"
                                        value={formData.regOpenDate}
                                        onChange={(e: any) => setFormData({ ...formData, regOpenDate: e.target.value })}
                                    />
                                    <Input
                                        label="Registration Open Time"
                                        type="time"
                                        value={formData.regOpenTime}
                                        onChange={(e: any) => setFormData({ ...formData, regOpenTime: e.target.value })}
                                    />
                                    <Input
                                        label="Registration Close Date"
                                        type="date"
                                        value={formData.regCloseDate}
                                        onChange={(e: any) => setFormData({ ...formData, regCloseDate: e.target.value })}
                                    />
                                    <Input
                                        label="Registration Close Time"
                                        type="time"
                                        value={formData.regCloseTime}
                                        onChange={(e: any) => setFormData({ ...formData, regCloseTime: e.target.value })}
                                    />

                                    <div className="md:col-span-2 space-y-4">
                                        <div className="p-5 rounded-2xl border border-[#2E2E2F]/15 bg-[#F2F2F2] flex items-center justify-between group relative overflow-hidden">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-[#38BDF2]/10 flex items-center justify-center text-[#38BDF2]">
                                                    <ICONS.CreditCard className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-[#2E2E2F]">Enable Discount Codes</p>
                                                    <p className="text-[10px] text-[#2E2E2F]/50">Allow promotional codes during checkout.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {!(organizerProfile?.plan?.features?.enable_discount_codes || organizerProfile?.plan?.features?.discount_codes) && (
                                                    <Badge type="info" className="text-[8px] font-black bg-[#2E2E2F] text-white">PRO</Badge>
                                                )}
                                                <input
                                                    type="checkbox"
                                                    checked={formData.enableDiscountCodes}
                                                    onChange={(e) => setFormData({ ...formData, enableDiscountCodes: e.target.checked })}
                                                    disabled={!(organizerProfile?.plan?.features?.enable_discount_codes || organizerProfile?.plan?.features?.discount_codes)}
                                                    className="w-6 h-6 accent-[#38BDF2] cursor-pointer disabled:opacity-30"
                                                />
                                            </div>
                                            {!(organizerProfile?.plan?.features?.enable_discount_codes || organizerProfile?.plan?.features?.discount_codes) && (
                                                <div className="absolute inset-0 bg-[#F2F2F2]/40 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="outline" className="text-[8px] py-1 px-3 border-[#2E2E2F]/20 bg-[#F2F2F2]" onClick={() => navigate('/subscription')}>Upgrade to Unlock</Button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="rounded-2xl border border-[#2E2E2F]/15 bg-[#F2F2F2] px-5 py-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2E2E2F]/45">Ticket Setup Rule</p>
                                            <p className="mt-2 text-sm font-semibold text-[#2E2E2F]">
                                                Publishing is locked until at least one ticket type is configured.
                                            </p>
                                            <p className="mt-1 text-[12px] text-[#2E2E2F]/60">
                                                Clicking next will save draft and open ticket setup automatically.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {wizardStep === 4 && (
                                <div className="space-y-6">
                                    {!(organizerProfile?.plan?.features?.enable_discount_codes || organizerProfile?.plan?.features?.discount_codes) ? (
                                        <div className="p-10 text-center bg-[#F2F2F2] rounded-[2rem] border-2 border-[#2E2E2F]/15">
                                            <div className="w-16 h-16 bg-[#2E2E2F] text-white rounded-2xl flex items-center justify-center mx-auto mb-6">
                                                <ICONS.Lock className="w-8 h-8" />
                                            </div>
                                            <h3 className="text-xl font-black text-[#2E2E2F] tracking-tight">Promotions Locked</h3>
                                            <p className="text-[#2E2E2F]/60 text-sm mt-2 max-w-xs mx-auto">Upgrade to a Pro or Enterprise plan to enable discount codes and boost your ticket sales.</p>
                                            <Button className="mt-6 bg-[#38BDF2]" onClick={() => navigate('/subscription')}>View Plans</Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="text-[12px] font-black text-[#2E2E2F] uppercase tracking-widest">Active Promotions</h4>
                                                    <p className="text-[10px] text-[#2E2E2F]/50 mt-1 uppercase tracking-wider">Total: {promotions.length}</p>
                                                </div>
                                                <Button size="sm" onClick={() => {
                                                    setEditingPromotion({ new: true });
                                                    setPromoForm({ code: '', discountType: 'PERCENTAGE', discountValue: '10', maxUses: '100', validFrom: '', validUntil: '', isActive: true });
                                                }}>Add Code</Button>
                                            </div>

                                            {editingPromotion && (
                                                <div className="p-6 bg-[#F2F2F2] rounded-[1.5rem] border-2 border-[#38BDF2]/30 space-y-5">
                                                    <div className="flex items-center justify-between">
                                                        <h5 className="text-[11px] font-black uppercase tracking-widest">{editingPromotion.new ? 'New Promotion' : 'Edit Promotion'}</h5>
                                                        <button onClick={() => setEditingPromotion(null)} className="text-[#2E2E2F]/30 hover:text-red-500 transition-colors"><ICONS.X className="w-4 h-4" /></button>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <Input label="Promo Code" placeholder="SALE20" value={promoForm.code} onChange={(e: any) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} />
                                                        <div className="space-y-2">
                                                            <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide ml-1">Discount Type</label>
                                                            <select
                                                                className="w-full px-4 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-[11px] font-medium uppercase tracking-wide outline-none"
                                                                value={promoForm.discountType}
                                                                onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value })}
                                                            >
                                                                <option value="PERCENTAGE">Percentage (%)</option>
                                                                <option value="FIXED">Fixed Amount (PHP)</option>
                                                            </select>
                                                        </div>
                                                        <Input label="Discount Value" type="number" value={promoForm.discountValue} onChange={(e: any) => setPromoForm({ ...promoForm, discountValue: e.target.value })} />
                                                        <Input label="Max Uses" type="number" value={promoForm.maxUses} onChange={(e: any) => setPromoForm({ ...promoForm, maxUses: e.target.value })} />
                                                        <Input label="Valid From" type="date" value={promoForm.validFrom} onChange={(e: any) => setPromoForm({ ...promoForm, validFrom: e.target.value })} />
                                                        <Input label="Valid Until" type="date" value={promoForm.validUntil} onChange={(e: any) => setPromoForm({ ...promoForm, validUntil: e.target.value })} />
                                                        <div className="md:col-span-2 flex items-center gap-3">
                                                            <input type="checkbox" id="isActive" checked={promoForm.isActive} onChange={(e) => setPromoForm({ ...promoForm, isActive: e.target.checked })} className="w-5 h-5 accent-[#38BDF2]" />
                                                            <label htmlFor="isActive" className="text-xs font-bold text-[#2E2E2F]">Active and usable</label>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3 pt-2">
                                                        <Button className="flex-1" onClick={handleSavePromotion} disabled={submitting}>{submitting ? '...' : 'Save Promotion'}</Button>
                                                        <Button variant="outline" onClick={() => setEditingPromotion(null)}>Cancel</Button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-3">
                                                {promotionsLoading ? (
                                                    <div className="py-10 text-center"><div className="w-6 h-6 border-2 border-[#38BDF2] border-t-transparent rounded-full animate-spin mx-auto"></div></div>
                                                ) : promotions.length === 0 ? (
                                                    <div className="py-10 text-center border-2 border-dashed border-[#2E2E2F]/15 rounded-2xl text-[#2E2E2F]/30 uppercase text-[10px] font-black tracking-widest">No promo codes active</div>
                                                ) : (
                                                    promotions.map(promo => (
                                                        <div key={promo.promotionId} className="flex items-center justify-between p-4 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-2xl group border-l-4 border-l-[#38BDF2]">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-black text-[#2E2E2F] tracking-tight">{promo.code}</span>
                                                                    <Badge type={promo.isActive ? 'success' : 'neutral'} className="text-[8px] px-1.5 py-0">{promo.isActive ? 'Active' : 'Inactive'}</Badge>
                                                                </div>
                                                                <p className="text-[10px] text-[#2E2E2F]/50 mt-1 uppercase tracking-tight font-bold">
                                                                    {promo.discountType === 'PERCENTAGE' ? `${promo.discountValue}% Off` : `PHP ${promo.discountValue} Off`}
                                                                    <span className="mx-2">•</span>
                                                                    {promo.usedCount || 0} / {promo.maxUses} Uses
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => {
                                                                    setEditingPromotion(promo);
                                                                    setPromoForm({
                                                                        code: promo.code,
                                                                        discountType: promo.discountType,
                                                                        discountValue: String(promo.discountValue),
                                                                        maxUses: String(promo.maxUses),
                                                                        validFrom: promo.validFrom ? promo.validFrom.split('T')[0] : '',
                                                                        validUntil: promo.validUntil ? promo.validUntil.split('T')[0] : '',
                                                                        isActive: promo.isActive
                                                                    });
                                                                }} className="p-2 hover:bg-[#38BDF2]/10 rounded-lg text-[#2E2E2F]"><ICONS.Edit className="w-4 h-4" /></button>
                                                                <button onClick={() => handleDeletePromotion(promo.promotionId)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><ICONS.Trash className="w-4 h-4" /></button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {wizardStep === 5 && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className={`rounded-2xl border px-4 py-4 ${isPersonalProfileReady ? 'border-[#38BDF2]/35 bg-[#38BDF2]/10' : 'border-[#2E2E2F]/15 bg-[#F2F2F2]'}`}>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/45">Account Profile</p>
                                            <p className="mt-2 text-sm font-bold text-[#2E2E2F]">{isPersonalProfileReady ? 'Ready' : 'Incomplete'}</p>
                                        </div>
                                        <div className={`rounded-2xl border px-4 py-4 ${isOrganizerProfileReady ? 'border-[#38BDF2]/35 bg-[#38BDF2]/10' : 'border-[#2E2E2F]/15 bg-[#F2F2F2]'}`}>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/45">Organization Profile</p>
                                            <p className="mt-2 text-sm font-bold text-[#2E2E2F]">{isOrganizerProfileReady ? 'Ready' : 'Incomplete'}</p>
                                        </div>
                                        <div className={`rounded-2xl border px-4 py-4 ${canPublishByTicketRule ? 'border-[#38BDF2]/35 bg-[#38BDF2]/10' : 'border-[#2E2E2F]/15 bg-[#F2F2F2]'}`}>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/45">Ticket Setup</p>
                                            <p className="mt-2 text-sm font-bold text-[#2E2E2F]">
                                                {ticketReadinessLoading
                                                    ? 'Checking...'
                                                    : isEditMode
                                                        ? `${activeEventTicketCount} ticket type(s)`
                                                        : 'Save draft first'}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide mb-2 ml-1">Event Status</label>
                                        <p className="mb-2 text-[11px] text-[#2E2E2F]/60">
                                            Current: <span className="font-bold text-[#2E2E2F]">{initialEventStatus}</span> · Choose final status below.
                                        </p>
                                        <select
                                            className="w-full px-4 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-[11px] font-medium uppercase tracking-wide outline-none focus:ring-2 focus:ring-[#38BDF2]/30 focus:border-[#38BDF2]"
                                            value={finalStatusDecision}
                                            onChange={(e) => {
                                                const nextStatus = e.target.value as EventStatus | '';
                                                setFinalStatusDecision(nextStatus);
                                                if (nextStatus) {
                                                    setFormData({ ...formData, status: nextStatus as EventStatus });
                                                }
                                            }}
                                        >
                                            <option value="">Select final status</option>
                                            <option value="DRAFT">Draft / Private</option>
                                            <option value="PUBLISHED" disabled={!canPublishByTicketRule || isAtActiveLimit}>
                                                {!canPublishByTicketRule ? 'Published (Add ticket first)' : isAtActiveLimit ? 'Published (Active Event Limit)' : 'Published'}
                                            </option>

                                            {isEditMode && <option value="CLOSED">Closed</option>}
                                        </select>
                                        {isAtActiveLimit && (
                                            <div className="mt-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                                                <p className="text-[12px] font-bold text-amber-800 flex items-center gap-2">
                                                    <ICONS.AlertTriangle className="w-4 h-4" />
                                                    Active Event Limit Reach (Max: {maxActiveEvents})
                                                </p>
                                                <p className="text-[11px] text-amber-700 mt-1">You are currently at the maximum number of active events for your plan. Please close an existing event or upgrade to publish this one.</p>
                                                <Button size="sm" className="mt-2 text-[10px] px-3 py-1 bg-amber-600 text-white hover:bg-black" onClick={() => navigate('/subscription')}>Upgrade Plan</Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="hidden md:flex gap-4 pt-8 border-t border-[#2E2E2F]/15">
                                <Button
                                    type="button"
                                    className="flex-1 py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#F2F2F2] text-[#2E2E2F] border-2 border-[#2E2E2F]/15 hover:bg-[#2E2E2F]/5 transition-colors min-h-[32px]"
                                    onClick={() => {
                                        if (wizardStep === 1) {
                                            handleCloseEventModal();
                                            return;
                                        }
                                        setWizardStep((prev) => (prev > 1 ? ((prev - 1) as EventSetupStep) : prev));
                                    }}
                                >
                                    {wizardStep === 1 ? 'Cancel' : 'Back'}
                                </Button>

                                {isEditMode && wizardStep < 4 && (
                                    <Button
                                        type="submit"
                                        data-quick-update="true"
                                        className="flex-1 py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#F2F2F2] text-[#2E2E2F] border-2 border-[#2E2E2F]/15 hover:bg-[#2E2E2F]/5 transition-colors min-h-[32px]"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                )}

                                {wizardStep < 4 ? (
                                    <Button
                                        type="button"
                                        className="flex-[2] py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#38BDF2] text-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2] transition-colors min-h-[32px]"
                                        onClick={handleNextWizardStep}
                                        disabled={submitting}
                                    >
                                        {submitting && wizardStep === 3 && !isEditMode ? 'Saving Draft...' : (wizardStep === 3 && !isEditMode ? 'Continue to Tickets' : 'Next Step')}
                                    </Button>
                                ) : (
                                    <Button
                                        type="submit"
                                        className="flex-[2] py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#38BDF2] text-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2] transition-colors min-h-[32px]"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Saving...' : 'Apply Event Status'}
                                    </Button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className={`${
                        previewDevice === 'desktop'
                            ? `fixed top-1/2 right-6 xl:right-8 w-[calc(100vw-3rem)] max-w-[1140px] h-[92vh] z-[150] bg-[#F2F2F2] shadow-[0_20px_60px_rgba(0,0,0,0.12)] rounded-[12px] flex flex-col overflow-hidden custom-scrollbar transform transition-all duration-500 ease-in-out border border-[#2E2E2F]/15 -translate-y-1/2 ${isPreviewMode ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}`
                            : `${isPreviewMode ? 'fixed inset-0 top-16 z-50 bg-[#F2F2F2] overflow-y-auto' : 'hidden'} xl:sticky xl:top-0 self-start space-y-3 xl:max-h-[calc(70vh-1rem)] xl:overflow-y-auto xl:pr-1`
                    }`}>
                        <div className={`flex flex-col h-full w-full ${previewDevice === 'desktop' ? '' : 'pb-32'}`}>
                            <div className={`flex items-center justify-between flex-shrink-0 ${previewDevice === 'desktop' ? 'py-6 px-10' : 'mb-3'}`}>
                                {previewDevice === 'desktop' ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsPreviewMode(false)}
                                        className="flex items-center gap-2 text-[#2E2E2F] hover:text-black font-bold text-sm transition-colors"
                                    >
                                        <ICONS.ChevronLeft className="w-5 h-5" strokeWidth={3} />
                                        Preview
                                    </button>
                                ) : (
                                    <div className="flex items-center justify-between w-full">
                                        <button
                                            type="button"
                                            onClick={() => setIsPreviewMode(false)}
                                            className="flex items-center gap-2 text-[#2E2E2F] hover:text-black font-bold text-sm transition-colors"
                                        >
                                            <ICONS.ChevronRight className="w-4 h-4 text-[#2E2E2F]/65" />
                                            <h4 className="text-[30px] font-black text-[#2E2E2F] tracking-tight">Preview</h4>
                                        </button>
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-2">
                                    <div className="hidden md:inline-flex items-center rounded-lg border border-[#2E2E2F]/15 bg-transparent p-1 shadow-sm">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDevice('mobile')}
                                            className={`w-9 h-9 rounded-md flex items-center justify-center ${previewDevice === 'mobile' ? 'bg-[#2E2E2F]/10 text-[#2E2E2F]' : 'text-[#2E2E2F]/45 hover:text-[#2E2E2F]'}`}
                                            title="Mobile preview"
                                        >
                                            <MobilePreviewIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDevice('desktop')}
                                            className={`w-9 h-9 rounded-md flex items-center justify-center ${previewDevice === 'desktop' ? 'bg-[#2E2E2F]/10 text-[#2E2E2F]' : 'text-[#2E2E2F]/45 hover:text-[#2E2E2F]'}`}
                                            title="Desktop preview"
                                        >
                                            <DesktopPreviewIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className={`${previewDevice === 'desktop' ? 'flex-1 overflow-y-auto custom-scrollbar w-full px-8 xl:px-12 py-6 mx-auto flex justify-center' : 'flex-1 w-full overflow-y-auto'}`}>
                                <div className={`${previewDevice === 'desktop' ? 'w-full max-w-[1024px] rounded-[12px] shadow-sm border border-[#2E2E2F]/15 min-h-[85vh]' : 'w-full'}`}>
                                    <div className={`${previewDevice === 'desktop' ? 'relative p-10 pb-[92px]' : 'w-full'}`}>
                                        {/* Browser Chrome for Laptop/Desktop */}
                                        {previewDevice !== 'mobile' && previewDevice !== 'desktop' && (
                                        <div className="bg-[#E5E7EB] h-10 flex items-center px-4 gap-4 border-b border-[#2E2E2F]/15">
                                            <div className="flex gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                                                <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                                                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                                            </div>
                                            <div className="flex-1 bg-[#F2F2F2]/60 rounded-md h-6 flex items-center px-3 text-[10px] text-[#2E2E2F]/40 font-medium truncate">
                                                startuplab.io/events/{formData.eventName.toLowerCase().replace(/\s+/g, '-')}
                                            </div>
                                        </div>
                                    )}
                                    <div className="h-14 border-b border-[#2E2E2F]/15 px-5 flex items-center justify-between bg-[#F2F2F2]">
                                        <img
                                            src={(organizerProfile?.plan?.features?.enable_custom_branding || organizerProfile?.plan?.features?.custom_branding) && organizerProfile?.profileImageUrl ? getImageUrl(organizerProfile.profileImageUrl) : BRAND_LOGO_URL}
                                            alt="Event Logo"
                                            className="h-8 w-auto object-contain"
                                        />
                                        <div className="flex items-center gap-3 text-[#2E2E2F]/70">
                                            <ICONS.Users className="w-4 h-4" />
                                            <ICONS.MoreHorizontal className="w-4 h-4" />
                                        </div>
                                    </div>

                                    <div className={`bg-[#F2F2F2] p-5 ${previewDevice === 'desktop' ? 'flex gap-8 items-start' : 'space-y-6'}`}>
                                        <div className={`flex-1 ${previewDevice === 'desktop' ? 'max-w-[calc(100%-350px)]' : 'w-full'} space-y-6`}>
                                            <div className="mb-4">
                                                <div className="flex items-center gap-2 text-[8px] font-black tracking-widest uppercase mb-6" style={{ color: previewAccentColor }}>
                                                    <svg className="w-2.5 h-2.5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                                                    BACK TO EVENTS
                                                </div>

                                                <div className="flex items-start justify-between gap-4 mb-4">
                                                    <h2 className={`${previewDevice === 'mobile' ? 'text-2xl' : 'text-3xl'} font-black text-[#2E2E2F] tracking-tighter leading-tight`}>
                                                        {formData.eventName || 'Event title'}
                                                    </h2>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="w-9 h-9 rounded-xl border bg-[#F2F2F2] border-[#2E2E2F]/15 flex items-center justify-center">
                                                            <ICONS.Heart className="w-4 h-4 text-[#2E2E2F]/40" />
                                                        </div>
                                                        <div className="w-9 h-9 rounded-xl border bg-[#F2F2F2] border-[#2E2E2F]/15 flex items-center justify-center">
                                                            <ICONS.Download className="w-4 h-4 text-[#2E2E2F]/40" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="rounded-[2rem] overflow-hidden border-2 border-[#2E2E2F]/15 mb-6 group">
                                                    <img
                                                        src={getImageUrl(formData.imageUrl)}
                                                        alt="Event Preview"
                                                        className="w-full aspect-video object-cover"
                                                    />
                                                </div>

                                                <div className="flex flex-wrap gap-2 mb-6 text-[#2E2E2F]/70">
                                                    <div className="flex items-center text-[#2E2E2F]/80 bg-[#F2F2F2] px-3 py-1.5 rounded-xl border-2 border-[#2E2E2F]/15 text-[10px] font-bold">
                                                        <ICONS.Calendar className="w-3.5 h-3.5 mr-2" style={{ color: previewAccentColor }} />
                                                        {previewDateLabel}
                                                    </div>
                                                    <div className="flex items-center text-[#2E2E2F]/80 bg-[#F2F2F2] px-3 py-1.5 rounded-xl border-2 border-[#2E2E2F]/15 text-[10px] font-bold">
                                                        <ICONS.Monitor className="w-3.5 h-3.5 mr-2" style={{ color: previewAccentColor }} />
                                                        {formData.locationType === 'ONLINE' ? 'DIGITAL SESSION' : formData.locationType === 'HYBRID' ? 'HYBRID ACCESS' : 'IN-PERSON EVENT'}
                                                    </div>
                                                    {formData.streamingPlatform && (
                                                        <div className="flex items-center bg-[#F2F2F2] px-3 py-1.5 rounded-xl border text-[10px] font-black tracking-wide" style={{ color: previewAccentColor, borderColor: `${previewAccentColor}33`, backgroundColor: `${previewAccentColor}0D` }}>
                                                            VIA {formData.streamingPlatform.toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center text-[#2E2E2F]/80 bg-[#F2F2F2] px-3 py-1.5 rounded-xl border-2 border-[#2E2E2F]/15 text-[10px] font-bold">
                                                        CAPACITY: {formData.capacityTotal}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 bg-[#F2F2F2] rounded-[1.5rem] border-2 border-[#2E2E2F]/15">
                                                <h3 className="text-[9px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] mb-4">EVENT DETAILS</h3>
                                                <p className="text-[#2E2E2F]/70 leading-relaxed text-sm font-medium whitespace-pre-wrap">
                                                    {formData.description || 'Provide an executive summary of this event session...'}
                                                </p>
                                            </div>

                                            <div className="p-6 bg-[#F2F2F2] rounded-[1.5rem] border-2 border-[#2E2E2F]/15">
                                                <h3 className="text-[9px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] mb-4">ORGANIZED BY</h3>
                                                <div className="rounded-[1.2rem] border-2 border-[#2E2E2F]/15 bg-[#F2F2F2] p-4 flex flex-col gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-full overflow-hidden text-[#F2F2F2] flex items-center justify-center text-lg font-bold shrink-0" style={{ backgroundColor: previewAccentColor }}>
                                                            {organizerProfile?.profileImageUrl ? (
                                                                <img src={getImageUrl(organizerProfile.profileImageUrl)} alt={organizerProfile.organizerName || 'Organizer'} className="w-full h-full object-cover" />
                                                            ) : (
                                                                organizerPreviewInitial
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-lg font-black text-[#2E2E2F] tracking-tight truncate">
                                                                {organizerProfile?.organizerName || 'Organizer Profile'}
                                                            </p>
                                                            <div className="flex items-center gap-4 mt-1">
                                                                <div>
                                                                    <p className="text-[8px] uppercase tracking-widest font-black text-[#2E2E2F]/40">Followers</p>
                                                                    <p className="text-sm font-black">{organizerProfile?.followersCount || 0}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[14px] font-black">{events.length}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {hasPreviewPhysicalLocation && (
                                                <div className="p-6 bg-[#F2F2F2] rounded-[1.5rem] border-2 border-[#2E2E2F]/15">
                                                    <div className="flex items-center justify-between gap-3 mb-4">
                                                        <h3 className="text-[9px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em]">EXACT LOCATION</h3>
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-[#38BDF2]">Open in Maps</span>
                                                    </div>
                                                    <p className="text-[12px] text-[#2E2E2F]/70 font-medium mb-4">{formData.location}</p>
                                                    <div className="rounded-xl overflow-hidden border-2 border-[#2E2E2F]/15 bg-[#F2F2F2]">
                                                        <iframe
                                                            src={previewMapEmbedUrl}
                                                            title="Preview map"
                                                            className={`w-full ${previewDevice === 'mobile' ? 'h-40' : 'h-56'}`}
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className={`${previewDevice === 'desktop' ? 'w-[320px] shrink-0 space-y-6 sticky top-4' : 'w-full flex-col'}`}>
                                            {/* Tickets Section in Preview */}
                                            <div className="p-6 bg-[#F2F2F2] rounded-[1.5rem] border-2 border-[#2E2E2F]/15 shadow-sm">
                                                <h3 className="text-[9px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] mb-6">SECURE ACCESS</h3>
                                                <div className="space-y-4">
                                                    {formData.ticketTypes && formData.ticketTypes.length > 0 ? (
                                                        formData.ticketTypes.map((ticket: any) => (
                                                            <div key={ticket.ticketTypeId || ticket.name} className="p-5 rounded-2xl border-2 bg-[#F2F2F2]" style={{ borderColor: `${previewAccentColor}1A` }}>
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <p className="text-[10px] font-black text-[#2E2E2F] uppercase tracking-wider">{ticket.name}</p>
                                                                    <span className="text-[8px] font-black px-2 py-0.5 rounded text-white" style={{ backgroundColor: previewAccentColor }}>AVAILABLE</span>
                                                                </div>
                                                                <p className="text-[16px] font-black text-[#2E2E2F]">
                                                                    {ticket.priceAmount === 0 ? 'FREE' : `PHP ${ticket.priceAmount.toLocaleString()}.00`}
                                                                </p>
                                                                <div className="mt-4 pt-4 border-t border-[#2E2E2F]/5 flex items-center justify-between">
                                                                    <span className="text-[8px] font-black text-[#2E2E2F]/30 uppercase tracking-widest">Quantity</span>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-6 h-6 rounded-lg bg-[#2E2E2F]/5 flex items-center justify-center text-[#2E2E2F]/20 text-xs">-</div>
                                                                        <span className="text-xs font-black">1</span>
                                                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs text-white" style={{ backgroundColor: previewAccentColor }}>+</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="py-12 text-center border-2 border-dashed border-[#2E2E2F]/5 rounded-[2rem]">
                                                            <p className="text-[10px] font-bold text-[#2E2E2F]/30 uppercase tracking-widest">No tickets set</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-8 space-y-4">
                                                    <button
                                                        type="button"
                                                        disabled
                                                        className="w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white/50 cursor-not-allowed"
                                                        style={{ backgroundColor: `${previewAccentColor}4D` }}
                                                    >
                                                        Secure Checkout
                                                    </button>
                                                    <div className="flex items-center justify-center gap-2 opacity-20">
                                                        <ICONS.CreditCard className="w-3.5 h-3.5" />
                                                        <p className="text-[8px] font-black uppercase tracking-widest">HITPAY SECURE</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                </div>
                {/* Mobile-only bottom action buttons */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-[#2E2E2F]/15 md:hidden z-50 flex gap-2">
                    <button
                        type="button"
                        onClick={handleNextWizardStep}
                        className="flex-1 py-3 bg-[#38BDF2] text-white rounded-xl font-bold text-sm"
                    >
                        Next
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="flex-1 py-3 bg-[#38BDF2] text-white rounded-xl font-bold text-sm"
                    >
                        Save
                    </button>
                    <button
                        type="button"
                        onClick={() => { if (isPreviewMode) { setIsPreviewMode(false); } else { setPreviewDevice('mobile'); setIsPreviewMode(true); } }}
                        className="flex-1 py-3 bg-[#F2F2F2] text-[#3A3247] rounded-xl font-bold text-sm border-2 border-[#2E2E2F]/15 flex items-center justify-center gap-2"
                    >
                        {isPreviewMode ? 'Close' : 'Preview'}
                    </button>
                </div>
                </div>
            )}

            <Modal
                isOpen={isTicketModalOpen}
                onClose={handleCloseTicketModal}
                title="Ticket Inventory Config"
                size="lg"
            >
                <TicketManager
                    event={selectedEvent}
                    onSave={handleSaveTickets}
                    submitting={submitting}
                    setNotification={setNotification}
                    maxEventCapacity={maxEventCapacity}
                    isPaymentReady={isPaymentReady}
                />
            </Modal>

            <Modal
                isOpen={isAttendeeModalOpen}
                onClose={() => setIsAttendeeModalOpen(false)}
                title={`Guest List: ${selectedEvent?.eventName || ''}`}
            >
                <div className="space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Confirmed Registrations</span>
                        <Badge type="info" className="px-3 py-1 font-semibold text-[10px] tracking-wide">{attendees.filter(r => r.eventId === selectedEvent?.eventId).length} GUESTS</Badge>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
                        {attendees.filter(r => r.eventId === selectedEvent?.eventId).map((reg) => (
                            <div key={reg.id} className="flex items-center justify-between p-5 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-[1.75rem] hover:border-[#38BDF2]/30 transition-colors group">
                                <div className="flex items-center gap-5">
                                    <div className="w-11 h-11 rounded-2xl bg-[#F2F2F2] flex items-center justify-center text-[#2E2E2F] font-semibold text-sm border-2 border-[#2E2E2F]/15 group-hover:bg-[#38BDF2] group-hover:text-[#F2F2F2] transition-colors">
                                        {reg.attendeeName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-[#2E2E2F] text-[15px] tracking-tight">{reg.attendeeName}</p>
                                        <p className="text-[12px] text-[#2E2E2F]/60 font-medium uppercase tracking-tight mt-0.5">{reg.attendeeEmail}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[11px] font-medium text-[#2E2E2F] uppercase tracking-wide mb-1.5">{reg.ticketName}</p>
                                    <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wide ${reg.status === 'USED' ? 'bg-[#38BDF2]/20 text-[#2E2E2F]' : 'bg-[#2E2E2F]/10 text-[#2E2E2F]'}`}>
                                        {reg.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {attendees.filter(r => r.eventId === selectedEvent?.eventId).length === 0 && (
                            <div className="py-24 text-center text-[#2E2E2F]/50">
                                <ICONS.Users className="w-14 h-14 mx-auto mb-5 opacity-20" />
                                <p className="font-medium uppercase tracking-wide text-[11px]">No confirmed guests detected</p>
                            </div>
                        )}
                    </div>
                    <Button
                        className="w-full py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#38BDF2] text-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2] transition-colors min-h-[32px]"
                        onClick={() => navigate('/attendees')}
                    >
                        Open Full Directory
                    </Button>
                </div>
            </Modal>

            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title="Delete Event"
            >
                <div className="space-y-6">
                    <div className="flex items-start gap-5 p-6 bg-amber-50 border border-amber-200 rounded-[1.75rem]">
                        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                            <ICONS.Trash className="w-6 h-6 text-amber-500" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="font-bold text-[#2E2E2F] text-[16px] tracking-tight">
                                Are you sure you want to archive this event?
                            </p>
                            <p className="text-[13px] text-[#2E2E2F]/60 font-medium mt-2 leading-relaxed">
                                This will move <strong>"{deleteConfirm?.eventName}"</strong> to the archive. The event will be hidden from public pages but can be restored later from the Archive page. This action can be undone.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <Button
                            className="flex-1 py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#F2F2F2] text-[#2E2E2F] border-2 border-[#2E2E2F]/15 hover:bg-[#2E2E2F]/10 transition-colors min-h-[32px]"
                            onClick={() => setDeleteConfirm(null)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-[2] py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-amber-500 text-white hover:bg-amber-600 transition-colors min-h-[32px]"
                            onClick={handleDeleteEvent}
                            disabled={submitting}
                        >
                            {submitting ? 'Archiving...' : 'Yes, Archive Event'}
                        </Button>
                    </div>
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
    maxEventCapacity: number;
    isPaymentReady: boolean;
}

function TicketManager({ event, onSave, submitting, setNotification, maxEventCapacity, isPaymentReady }: TicketManagerProps) {
    const navigate = useNavigate();
    const [tickets, setTickets] = useState<TicketType[]>([]);
    const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
    const [isPaymentRestrictionOpen, setIsPaymentRestrictionOpen] = useState(false);

    useEffect(() => {
        const fetchTickets = async () => {
            if (event?.eventId) {
                const fetched = await apiService.getTicketTypes(event.eventId);
                setTickets(fetched);
                setExpandedTicketId(null);
            } else {
                setTickets([]);
                setExpandedTicketId(null);
            }
        };
        fetchTickets();
    }, [event?.eventId]);

    const [newTicket, setNewTicket] = useState({
        name: '',
        description: '',
        priceAmount: 0,
        saleDiscountPercent: 0,
        currency: 'PHP',
        quantityTotal: 100,
        capacityPerTicket: 1,
        salesStartAt: '',
        salesEndAt: '',
        status: true
    });

    const addTicket = () => {
        if (!newTicket.name) return;
        if (newTicket.priceAmount > 0 && !isPaymentReady) {
            setIsPaymentRestrictionOpen(true);
            return;
        }
        const item: TicketType = {
            ticketTypeId: `tk-${Math.random().toString(36).substr(2, 9)}`,
            eventId: event?.eventId || '',
            name: newTicket.name,
            description: newTicket.description || undefined,
            priceAmount: newTicket.priceAmount,
            saleDiscountPercent: newTicket.saleDiscountPercent,
            currency: newTicket.currency || 'PHP',
            quantityTotal: newTicket.quantityTotal,
            quantitySold: 0,
            capacityPerTicket: newTicket.capacityPerTicket,
            salesStartAt: newTicket.salesStartAt || undefined,
            salesEndAt: newTicket.salesEndAt || undefined,
            status: newTicket.status
        };
        setTickets([...tickets, item]);
        setNewTicket({
            name: '',
            description: '',
            priceAmount: 0,
            saleDiscountPercent: 0,
            currency: 'PHP',
            quantityTotal: 100,
            capacityPerTicket: 1,
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

    const updateTicket = (id: string, updates: Partial<TicketType>) => {
        setTickets(prev => prev.map(ticket => (
            ticket.ticketTypeId === id ? { ...ticket, ...updates } : ticket
        )));
    };

    return (
        <div className="space-y-8">
            <div className="bg-[#F2F2F2] p-6 rounded-3xl border-2 border-[#2E2E2F]/15">
                <h4 className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide mb-4">Add Ticket Tier</h4>
                <div className="space-y-4">
                    <Input
                        placeholder="Tier Name (e.g. VIP Access)"
                        value={newTicket.name}
                        onChange={(e: any) => setNewTicket({ ...newTicket, name: e.target.value })}
                    />
                    <textarea
                        className="w-full px-4 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                        placeholder="Description (optional)"
                        value={newTicket.description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewTicket({ ...newTicket, description: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Type</label>
                            <select
                                className="w-full px-4 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
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
                            <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Status</label>
                            <select
                                className="w-full px-4 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                                value={newTicket.status ? 'ACTIVE' : 'INACTIVE'}
                                onChange={(e) => setNewTicket({ ...newTicket, status: e.target.value === 'ACTIVE' })}
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                    </div>
                    {newTicket.priceAmount > 0 && (
                        <>
                            <Input
                                label={`Price (${newTicket.currency})`}
                                type="number"
                                value={newTicket.priceAmount}
                                onChange={(e: any) => setNewTicket({ ...newTicket, priceAmount: parseFloat(e.target.value) })}
                            />
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Sale Discount (%)</label>
                                <div className="flex gap-2 items-end">
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={newTicket.saleDiscountPercent || 0}
                                        onChange={(e: any) => setNewTicket({ ...newTicket, saleDiscountPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                                        className="flex-1 px-4 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                                        placeholder="0"
                                    />
                                    {newTicket.saleDiscountPercent && newTicket.saleDiscountPercent > 0 && (
                                        <div className="text-[10px] font-bold text-[#38BDF2] whitespace-nowrap pb-3">
                                            ₱{Math.round((newTicket.priceAmount * (100 - newTicket.saleDiscountPercent)) / 100)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Quantity Total"
                            type="number"
                            value={newTicket.quantityTotal}
                            onChange={(e: any) => setNewTicket({ ...newTicket, quantityTotal: parseInt(e.target.value, 10) || 0 })}
                        />
                        <Input
                            label="Guests per Ticket"
                            type="number"
                            min={1}
                            value={newTicket.capacityPerTicket}
                            onChange={(e: any) => setNewTicket({ ...newTicket, capacityPerTicket: parseInt(e.target.value, 10) || 1 })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Currency"
                            value={newTicket.currency}
                            onChange={(e: any) => setNewTicket({ ...newTicket, currency: e.target.value.toUpperCase() })}
                        />
                    </div>
                    <div className="space-y-4 mb-2">
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
                            addTicket();
                        }}
                        className="w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#38BDF2] text-[#F2F2F2] hover:text-[#F2F2F2] transition-colors"
                    >
                        Add to Inventory
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Current Inventory</h4>
                {tickets.map((t) => {
                    const isExpanded = expandedTicketId === t.ticketTypeId;
                    const priceLabel = t.priceAmount === 0 ? 'Complimentary' : `PHP ${t.priceAmount.toLocaleString()}`;

                    return (
                        <div
                            key={t.ticketTypeId}
                            className={`flex flex-col gap-4 p-4 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl transition-colors ${!isExpanded ? 'cursor-pointer hover:border-[#38BDF2]/30' : ''
                                }`}
                            onClick={() => {
                                if (!isExpanded) setExpandedTicketId(t.ticketTypeId);
                            }}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="font-bold text-[#2E2E2F] text-sm">{t.name || 'Untitled Ticket'}</p>
                                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-wide">
                                        <span className="text-[#2E2E2F]">{priceLabel}</span>
                                        <span className="text-[#2E2E2F]/60">{t.status ? 'Active' : 'Inactive'}</span>
                                        <span className="text-[#2E2E2F]/60">Qty {t.quantityTotal}</span>
                                        {t.priceAmount > 0 && (
                                            <>
                                                <span className="text-[#2E2E2F]/40">•</span>
                                                <span className="text-[#38BDF2] font-bold">
                                                    {Math.round(((t.quantitySold || 0) / (t.quantityTotal || 1)) * 100)}% Sold
                                                </span>
                                            </>
                                        )}
                                        {t.capacityPerTicket && t.capacityPerTicket > 1 && (
                                            <span className="text-[#38BDF2] font-bold">Bundle ({t.capacityPerTicket} Guests)</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedTicketId(isExpanded ? null : t.ticketTypeId);
                                        }}
                                        className="text-[11px] font-semibold uppercase tracking-wide text-[#2E2E2F] hover:text-[#2E2E2F] transition-colors"
                                    >
                                        {isExpanded ? 'Collapse' : 'Edit'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeTicket(t.ticketTypeId);
                                        }}
                                        className="text-[#2E2E2F] hover:bg-[#38BDF2]/10 p-2 rounded-lg transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#2E2E2F]/20">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Tier Name</label>
                                        <input
                                            value={t.name}
                                            onChange={(e) => updateTicket(t.ticketTypeId, { name: e.target.value })}
                                            className="w-full px-3 py-2 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Status</label>
                                        <select
                                            className="w-full px-3 py-2 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                                            value={t.status ? 'ACTIVE' : 'INACTIVE'}
                                            onChange={(e) => updateTicket(t.ticketTypeId, { status: e.target.value === 'ACTIVE' })}
                                        >
                                            <option value="ACTIVE">Active</option>
                                            <option value="INACTIVE">Inactive</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Type</label>
                                        <select
                                            className="w-full px-3 py-2 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                                            value={t.priceAmount === 0 ? 'FREE' : 'PAID'}
                                            onChange={(e) => {
                                                const isPaid = e.target.value === 'PAID';
                                                if (isPaid && !isPaymentReady) {
                                                    setIsPaymentRestrictionOpen(true);
                                                    return;
                                                }
                                                const isFree = e.target.value === 'FREE';
                                                const nextPrice = isFree ? 0 : Math.max(t.priceAmount || 0, 100);
                                                updateTicket(t.ticketTypeId, { priceAmount: nextPrice });
                                            }}
                                        >
                                            <option value="FREE">Free</option>
                                            <option value="PAID">Paid</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Price ({t.currency || 'PHP'})</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            disabled={t.priceAmount === 0}
                                            value={t.priceAmount}
                                            onChange={(e) => updateTicket(t.ticketTypeId, { priceAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                                            className={`w-full px-3 py-2 border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2] ${t.priceAmount === 0 ? 'bg-[#F2F2F2] text-[#2E2E2F]/60' : 'bg-[#F2F2F2]'}`}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Sale Discount (%)</label>
                                        <div className="flex gap-2 items-end">
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                disabled={t.priceAmount === 0}
                                                value={t.saleDiscountPercent || 0}
                                                onChange={(e) => updateTicket(t.ticketTypeId, { saleDiscountPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                                                className={`flex-1 px-3 py-2 border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2] ${t.priceAmount === 0 ? 'bg-[#F2F2F2] text-[#2E2E2F]/60' : 'bg-[#F2F2F2]'}`}
                                            />
                                            {t.saleDiscountPercent && t.saleDiscountPercent > 0 && (
                                                <div className="text-[10px] font-bold text-[#38BDF2] whitespace-nowrap pb-2">
                                                    ₱{Math.round((t.priceAmount * (100 - t.saleDiscountPercent)) / 100)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Quantity Total</label>
                                        <input
                                            type="number"
                                            min={t.quantitySold || 0}
                                            value={t.quantityTotal}
                                            onChange={(e) => {
                                                const nextValue = parseInt(e.target.value, 10) || 0;
                                                updateTicket(t.ticketTypeId, {
                                                    quantityTotal: Math.max(nextValue, t.quantitySold || 0)
                                                });
                                            }}
                                            className="w-full px-3 py-2 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">Guests per Ticket</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={t.capacityPerTicket || 1}
                                            onChange={(e) => updateTicket(t.ticketTypeId, { capacityPerTicket: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                                            className="w-full px-3 py-2 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Currency</label>
                                        <input
                                            value={t.currency}
                                            onChange={(e) => updateTicket(t.ticketTypeId, { currency: e.target.value.toUpperCase() })}
                                            className="w-full px-3 py-2 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-1.5">
                                        <label className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Description</label>
                                        <textarea
                                            value={t.description || ''}
                                            onChange={(e) => updateTicket(t.ticketTypeId, { description: e.target.value })}
                                            className="w-full px-3 py-2 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                                            rows={2}
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-4 mb-2">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Sales Start</label>
                                            <input
                                                type="datetime-local"
                                                value={t.salesStartAt || ''}
                                                onChange={(e) => updateTicket(t.ticketTypeId, { salesStartAt: e.target.value })}
                                                className="w-full px-3 py-2 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Sales End</label>
                                            <input
                                                type="datetime-local"
                                                value={t.salesEndAt || ''}
                                                onChange={(e) => updateTicket(t.ticketTypeId, { salesEndAt: e.target.value })}
                                                className="w-full px-3 py-2 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-xl text-sm outline-none focus:border-[#38BDF2]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">
                                Sold: {t.quantitySold || 0}
                                {t.priceAmount > 0 && (
                                    <span className="text-[#38BDF2] ml-2">
                                        ({Math.round(((t.quantitySold || 0) / (t.quantityTotal || 1)) * 100)}%)
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
                {tickets.length === 0 && <p className="text-center py-6 text-[#2E2E2F]/50 text-xs font-bold uppercase tracking-widest">No tickets configured</p>}
            </div>

            {tickets.length > 0 && (
                <div className="p-4 bg-[#2E2E2F] rounded-2xl text-white space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-60">
                        <span>Total Guest Capacity</span>
                        <span>{tickets.reduce((acc, t) => acc + (t.quantityTotal * (t.capacityPerTicket || 1)), 0)} / {maxEventCapacity}</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#F2F2F2]/10 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all ${tickets.reduce((acc, t) => acc + (t.quantityTotal * (t.capacityPerTicket || 1)), 0) > maxEventCapacity ? 'bg-red-500' : 'bg-[#38BDF2]'
                                }`}
                            style={{
                                width: `${Math.min(100, (tickets.reduce((acc, t) => acc + (t.quantityTotal * (t.capacityPerTicket || 1)), 0) / maxEventCapacity) * 100)}%`
                            }}
                        />
                    </div>
                </div>
            )}

            <Button
                onClick={() => onSave(tickets)}
                disabled={submitting}
                className="w-full py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#38BDF2] text-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2] transition-colors min-h-[32px]"
            >
                {submitting ? 'Updating...' : 'Commit Inventory Changes'}
            </Button>

            <Modal
                isOpen={isPaymentRestrictionOpen}
                onClose={() => setIsPaymentRestrictionOpen(false)}
                title="Payment Gateway Required"
            >
                <div className="space-y-6">
                    <div className="flex items-start gap-5 p-6 bg-[#38BDF2]/10 border border-[#38BDF2]/20 rounded-[1.75rem]">
                        <div className="w-12 h-12 bg-[#38BDF2]/20 rounded-2xl flex items-center justify-center shrink-0">
                            <ICONS.CreditCard className="w-6 h-6 text-[#38BDF2]" strokeWidth={2.5} />
                        </div>
                        <div className="space-y-2">
                            <p className="font-bold text-[#2E2E2F] text-[16px] tracking-tight">
                                Setup HitPay to Gain More
                            </p>
                            <p className="text-[13px] text-[#2E2E2F]/60 font-medium leading-relaxed">
                                To create paid tickets and receive payouts, you need to connect your HitPay account first. This ensures all transactions are processed securely and funds are routed directly to you.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center gap-3 p-4 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-2xl">
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-600 flex items-center justify-center font-bold text-xs">1</div>
                            <p className="text-xs font-semibold text-[#2E2E2F]/70">Go to Payment Gateway settings</p>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-2xl">
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-600 flex items-center justify-center font-bold text-xs">2</div>
                            <p className="text-xs font-semibold text-[#2E2E2F]/70">Enter your HitPay API Key and Salt</p>
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-[#F2F2F2] border-2 border-[#2E2E2F]/15 rounded-2xl">
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-600 flex items-center justify-center font-bold text-xs">3</div>
                            <p className="text-xs font-semibold text-[#2E2E2F]/70">Save and return here to enable paid tickets</p>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <Button
                            className="flex-1 py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#F2F2F2] text-[#2E2E2F] border-2 border-[#2E2E2F]/15"
                            onClick={() => setIsPaymentRestrictionOpen(false)}
                        >
                            Stay Free
                        </Button>
                        <Button
                            className="flex-[2] py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#38BDF2] text-white hover:bg-black transition-colors min-h-[32px]"
                            onClick={() => navigate('/user-settings?tab=payments')}
                        >
                            Set up HitPay now
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
