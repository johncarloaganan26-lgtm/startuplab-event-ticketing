
import {
  Event,
  Order,
  OrderItem,
  Attendee,
  Ticket,
  TicketType,
  AnalyticsSummary,
  RegistrationView,
  TicketStatus,
  OrderStatus,
  OrganizerProfile,
  HitPaySettings,
  HitPaySettingsResponse
} from '../types';
import { MOCK_EVENTS } from './mockData';
// Local storage keys
const STORAGE_EVENTS = 'ef_events';
const STORAGE_ORDERS = 'ef_orders';
const STORAGE_ATTENDEES = 'ef_attendees';
const STORAGE_TICKETS = 'ef_tickets';

const initializeData = () => {
  if (!localStorage.getItem(STORAGE_EVENTS)) {
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(MOCK_EVENTS));
  }
  if (!localStorage.getItem(STORAGE_ORDERS)) localStorage.setItem(STORAGE_ORDERS, '[]');
  if (!localStorage.getItem(STORAGE_ATTENDEES)) localStorage.setItem(STORAGE_ATTENDEES, '[]');
  if (!localStorage.getItem(STORAGE_TICKETS)) localStorage.setItem(STORAGE_TICKETS, '[]');
};

initializeData();

const API_BASE = import.meta.env.VITE_API_BASE;

const normalizeHitPaySettingsPayload = (data: any): HitPaySettings | null => {
  if (!data) return null;
  // GET returns plain settings; POST update may return { backendReady, settings }.
  if (data.settings && typeof data.settings === 'object') {
    return data.settings as HitPaySettings;
  }
  return data as HitPaySettings;
};

export const apiService = {
  // PATCH /api/user/name
  updateUserName: async (name: string) => {
    const res = await fetch(`${API_BASE}/api/user/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update name');
    return await res.json();
  },

  // --- SMTP Settings APIs ---
  getSmtpSettings: async () => {
    const res = await fetch(`${API_BASE}/api/settings/smtp`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Failed to load SMTP settings: ${res.status}`);
    return await res.json();
  },

  updateSmtpSettings: async (payload: any) => {
    const res = await fetch(`${API_BASE}/api/settings/smtp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Failed to update SMTP settings: ${res.status}`);
    return await res.json();
  },

  testSmtpSettings: async (payload: any) => {
    const res = await fetch(`${API_BASE}/api/settings/smtp/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `SMTP Test failed: ${res.status}`);
    }
    return await res.json();
  },

  getHitPaySettings: async (scope: 'admin' | 'organizer'): Promise<HitPaySettingsResponse> => {
    const res = await fetch(`${API_BASE}/api/settings/hitpay?scope=${encodeURIComponent(scope)}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });

    if (res.status === 404 || res.status === 501) {
      return { backendReady: false, settings: null };
    }

    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to load HitPay settings: ${res.status}`);
    }

    const data = await res.json();
    return { backendReady: true, settings: normalizeHitPaySettingsPayload(data) };
  },

  updateHitPaySettings: async (
    scope: 'admin' | 'organizer',
    payload: Partial<HitPaySettings>
  ): Promise<HitPaySettingsResponse> => {
    const res = await fetch(`${API_BASE}/api/settings/hitpay?scope=${encodeURIComponent(scope)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (res.status === 404 || res.status === 501) {
      return { backendReady: false, settings: null };
    }

    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to save HitPay settings: ${res.status}`);
    }

    const data = await res.json();
    return { backendReady: true, settings: normalizeHitPaySettingsPayload(data) };
  },

  // --- Organizer APIs ---
  getMyOrganizer: async (): Promise<OrganizerProfile | null> => {
    const res = await fetch(`${API_BASE}/api/organizer/me`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load organizer profile: ${res.status}`);
    return await res.json();
  },

  getOrganizerById: async (id: string): Promise<OrganizerProfile | null> => {
    const res = await fetch(`${API_BASE}/api/organizer/${encodeURIComponent(id)}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load organizer: ${res.status}`);
    return await res.json();
  },

  upsertOrganizer: async (payload: Partial<OrganizerProfile>): Promise<OrganizerProfile> => {
    const res = await fetch(`${API_BASE}/api/organizer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to save organizer profile: ${res.status}`);
    }
    return await res.json();
  },

  uploadOrganizerImage: async (file: File): Promise<{ publicUrl: string; organizer?: OrganizerProfile | null }> => {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${API_BASE}/api/organizer/image`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to upload organizer image: ${res.status}`);
    }
    const data = await res.json();
    return { publicUrl: data.publicUrl, organizer: data.organizer || null };
  },

  getMyFollowingOrganizerIds: async (): Promise<string[]> => {
    const res = await fetch(`${API_BASE}/api/organizer/followings`, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (res.status === 404) return [];
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to load followings: ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data?.organizerIds) ? data.organizerIds : [];
  },

  getOrganizers: async (): Promise<OrganizerProfile[]> => {
    const res = await fetch(`${API_BASE}/api/organizers/all`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Failed to load organizers: ${res.status}`);
    return await res.json();
  },

  getMyLikedEventIds: async (): Promise<string[]> => {
    const res = await fetch(`${API_BASE}/api/events/likes/me`, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (res.status === 404) return [];
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to load liked events: ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data?.eventIds) ? data.eventIds : [];
  },

  likeEvent: async (eventId: string): Promise<{ eventId: string; liked: boolean; likesCount: number }> => {
    const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventId)}/like`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to like event: ${res.status}`);
    }
    return await res.json();
  },

  unlikeEvent: async (eventId: string): Promise<{ eventId: string; liked: boolean; likesCount: number }> => {
    const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventId)}/like`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to unlike event: ${res.status}`);
    }
    return await res.json();
  },

  followOrganizer: async (organizerId: string): Promise<{ organizerId: string; following: boolean; followersCount: number; confirmationEmailSent: boolean }> => {
    const res = await fetch(`${API_BASE}/api/organizer/${encodeURIComponent(organizerId)}/follow`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to follow organizer: ${res.status}`);
    }
    return await res.json();
  },

  unfollowOrganizer: async (organizerId: string): Promise<{ organizerId: string; following: boolean; followersCount: number }> => {
    const res = await fetch(`${API_BASE}/api/organizer/${encodeURIComponent(organizerId)}/follow`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to unfollow organizer: ${res.status}`);
    }
    return await res.json();
  },

  // --- User Orders ---
  getMyOrders: async (): Promise<{ orders: any[]; count: number }> => {
    const res = await fetch(`${API_BASE}/api/orders/my`, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (res.status === 401) return { orders: [], count: 0 };
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to load orders: ${res.status}`);
    }
    return await res.json();
  },

  // --- Public APIs ---

  // GET /api/events
  getEvents: async (page = 1, limit = 10, search = '', location = '', organizerId = ''): Promise<{ events: Event[], pagination: any }> => {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const locParam = location ? `&location=${encodeURIComponent(location)}` : '';
    const orgParam = organizerId ? `&organizerId=${encodeURIComponent(organizerId)}` : '';
    const res = await fetch(`${API_BASE}/api/events?status=PUBLISHED&page=${page}&limit=${limit}${searchParam}${locParam}${orgParam}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`Failed to load events: ${res.status}`);
    const data = await res.json();
    return data;
  },

  // GET /api/events/:slug
  getEventBySlug: async (slug: string): Promise<Event | null> => {
    const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(slug)}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load event: ${res.status}`);
    const data = await res.json();
    return data as Event;
  },

  // POST /api/orders (Creates Order -> OrderItems -> Attendees -> Tickets)
  createOrderTransaction: async (data: {
    eventId: string;
    buyerName: string;
    buyerEmail: string;
    buyerPhone?: string;
    company?: string;
    items: { ticketTypeId: string; quantity: number; price: number }[];
    totalAmount: number;
    currency: string;
  }): Promise<{ orderId: string }> => {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Order failed: ${(await res.json()).error || res.status}`);
    return await res.json();
  },

  // POST /api/payments/hitpay/checkout-session
  createHitpayCheckoutSession: async (
    orderId: string
  ): Promise<{ checkoutUrl: string | null; status?: string; mock?: boolean }> => {
    const res = await fetch(`${API_BASE}/api/payments/hitpay/checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ orderId })
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload?.error || `Failed to create checkout session: ${res.status}`);
    return payload;
  },

  // GET /api/payments/status?sessionId=...
  getPaymentStatus: async (orderId: string): Promise<Order | null> => {
    const res = await fetch(`${API_BASE}/api/payments/status?sessionId=${encodeURIComponent(orderId)}`, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load order: ${res.status}`);
    return await res.json();
  },

  // GET /api/tickets/order/:orderId
  getTicketsByOrder: async (orderId: string) => {
    const res = await fetch(`${API_BASE}/api/tickets/order/${encodeURIComponent(orderId)}`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to load tickets: ${res.status}`);
    return await res.json();
  },

  // GET /api/tickets/:ticketId
  getTicketDetails: async (id: string): Promise<RegistrationView | null> => {
    const res = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    // Map backend ticket fields to RegistrationView for UI
    return {
      id: data.ticketId,
      ticketCode: data.ticketCode,
      qrPayload: data.qrPayload || data.ticketCode,
      eventId: data.eventId,
      eventName: data.eventName || '', // backend may need to populate this
      locationType: data.locationType || null,
      locationText: data.locationText || null,
      eventStartAt: data.eventStartAt || null,
      eventEndAt: data.eventEndAt || null,
      attendeeName: data.attendeeName || '', // backend may need to populate this
      attendeeEmail: data.attendeeEmail || '', // backend may need to populate this
      attendeePhone: data.attendeePhone || null,
      attendeeCompany: data.attendeeCompany || null,
      ticketName: data.ticketName || '', // backend may need to populate this
      status: data.status,
      paymentStatus: data.paymentStatus || '', // backend may need to populate this
      orderId: data.orderId,
      amountPaid: data.amountPaid || 0, // backend may need to populate this
      currency: data.currency || 'PHP', // backend may need to populate this
      streamingPlatform: data.streamingPlatform || null,
      checkInTimestamp: data.usedAt || data.checkInTimestamp || null
    };
  },

  // --- TicketTypes APIs ---

  // GET /api/ticket-types?eventId=...
  getTicketTypes: async (eventId: string): Promise<TicketType[]> => {
    const res = await fetch(`${API_BASE}/api/ticket-types?eventId=${encodeURIComponent(eventId)}`);
    if (!res.ok) throw new Error(`Failed to load ticket types: ${res.status}`);
    return await res.json();
  },

  // POST /api/ticket-types
  createTicketType: async (data: Partial<TicketType>): Promise<TicketType> => {
    // Remove createdBy if present
    const { createdBy, ...clean } = data;
    const res = await fetch(`${API_BASE}/api/ticket-types`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean)

    });
    if (!res.ok) throw new Error(`Failed to create ticket type: ${res.status}`);
    return await res.json();
  },

  // PUT /api/ticket-types/:id
  updateTicketType: async (id: string, data: Partial<TicketType>): Promise<TicketType> => {
    const res = await fetch(`${API_BASE}/api/ticket-types/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Failed to update ticket type: ${res.status}`);
    return await res.json();
  },

  // DELETE /api/ticket-types/:id
  deleteTicketType: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/ticket-types/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to delete ticket type: ${res.status}`);
  },

  // --- Admin APIs ---

  getAttendeesByEvent: async (eventId: string): Promise<Attendee[]> => {
    const res = await fetch(`${API_BASE}/api/admin/attendees?eventId=${encodeURIComponent(eventId)}`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to load attendees: ${res.status}`);
    return await res.json();
  },

  createTicket: async (payload: Partial<Ticket>): Promise<Ticket> => {
    const res = await fetch(`${API_BASE}/api/admin/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Failed to create ticket: ${res.status}`);
    return await res.json();
  },

  getAdminEvents: async (search = ''): Promise<Event[]> => {
    const searchParam = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${API_BASE}/api/admin/events${searchParam}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to load admin events: ${res.status}`);
    const data = await res.json();
    return (data || []).map((event: Event) => ({ ...event, ticketTypes: event.ticketTypes || [] }));
  },

  // User-specific events (only events created by the logged-in user)
  getUserEvents: async (search = ''): Promise<Event[]> => {
    const searchParam = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${API_BASE}/api/user/events${searchParam}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to load user events: ${res.status}`);
    const data = await res.json();
    return (data || []).map((event: Event) => ({ ...event, ticketTypes: event.ticketTypes || [] }));
  },

  createUserEvent: async (eventData: Partial<Event>): Promise<Event> => {
    const res = await fetch(`${API_BASE}/api/user/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(eventData)
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to create user event: ${res.status}`);
    }
    const data = await res.json();
    return { ...data, ticketTypes: data?.ticketTypes || eventData.ticketTypes || [] } as Event;
  },

  updateUserEvent: async (id: string, eventData: Partial<Event>): Promise<Event> => {
    const res = await fetch(`${API_BASE}/api/user/events/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(eventData)
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to update user event: ${res.status}`);
    }
    const data = await res.json();
    return { ...data, ticketTypes: data?.ticketTypes || eventData.ticketTypes || [] } as Event;
  },

  deleteUserEvent: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/user/events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to delete user event: ${res.status}`);
  },


  uploadUserEventImage: async (file: File, eventId?: string): Promise<{ publicUrl: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    if (eventId) formData.append('eventId', eventId);

    const endpoint = eventId
      ? `${API_BASE}/api/user/events/${encodeURIComponent(eventId)}/image`
      : `${API_BASE}/api/user/events/image`;

    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!res.ok) throw new Error(`Failed to upload user event image: ${res.status}`);
    const data = await res.json();
    return { publicUrl: data.publicUrl };
  },

  createEvent: async (eventData: Partial<Event>): Promise<Event> => {
    const res = await fetch(`${API_BASE}/api/admin/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(eventData)
    });
    if (!res.ok) throw new Error(`Failed to create event: ${res.status}`);
    const data = await res.json();
    return { ...data, ticketTypes: data?.ticketTypes || eventData.ticketTypes || [] } as Event;
  },

  updateEvent: async (id: string, eventData: Partial<Event>): Promise<Event> => {
    const res = await fetch(`${API_BASE}/api/admin/events/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(eventData)
    });
    if (!res.ok) throw new Error(`Failed to update event: ${res.status}`);
    const data = await res.json();
    return { ...data, ticketTypes: data?.ticketTypes || eventData.ticketTypes || [] } as Event;
  },

  // DELETE /api/admin/events/:id
  deleteEvent: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/admin/events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to delete event: ${res.status}`);
  },

  uploadEventImage: async (file: File, eventId?: string): Promise<{ publicUrl: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    if (eventId) formData.append('eventId', eventId);

    const endpoint = eventId
      ? `${API_BASE}/api/admin/events/${encodeURIComponent(eventId)}/image`
      : `${API_BASE}/api/admin/events/image`;

    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!res.ok) throw new Error(`Failed to upload image: ${res.status}`);
    const data = await res.json();
    return { publicUrl: data.publicUrl };
  },

  getAnalytics: async (): Promise<AnalyticsSummary> => {
    const res = await fetch(`${API_BASE}/api/analytics/summary`, {
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to load analytics: ${res.status}`);
    }
    return res.json();
  },

  getRecentTransactions: async (page = 1, limit = 10) => {
    const res = await fetch(`${API_BASE}/api/analytics/transactions?page=${page}&limit=${limit}`, {
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to load transactions: ${res.status}`);
    }
    return res.json();
  },

  getRecentOrders: async (page = 1, limit = 10) => {
    const res = await fetch(`${API_BASE}/api/analytics/orders?page=${page}&limit=${limit}`, {
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to load orders: ${res.status}`);
    }
    return res.json();
  },

  getAuditLogs: async (page = 1, limit = 10) => {
    const res = await fetch(`${API_BASE}/api/analytics/audit-logs?page=${page}&limit=${limit}`, {
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to load audit logs: ${res.status}`);
    }
    return res.json();
  },

  getTransactionDetail: async (orderId: string) => {
    const res = await fetch(`${API_BASE}/api/analytics/transactions/${encodeURIComponent(orderId)}`, {
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to load transaction: ${res.status}`);
    }
    return res.json();
  },

  getOrderDetail: async (orderId: string) => {
    const res = await fetch(`${API_BASE}/api/analytics/orders/${encodeURIComponent(orderId)}`, {
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to load order: ${res.status}`);
    }
    return res.json();
  },

  getAuditLogDetail: async (auditLogId: string) => {
    const res = await fetch(`${API_BASE}/api/analytics/audit-logs/${encodeURIComponent(auditLogId)}`, {
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to load audit log: ${res.status}`);
    }
    return res.json();
  },

  // GET /api/tickets/registrations?eventId=...
  getEventRegistrations: async (eventId: string, search = ''): Promise<RegistrationView[]> => {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${API_BASE}/api/tickets/registrations?eventId=${encodeURIComponent(eventId)}${searchParam}`, {
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to load registrations: ${res.status}`);
    return await res.json();
  },

  // GET /api/tickets/registrations-all (admin)
  getAllRegistrations: async (page = 1, limit = 10, search = ''): Promise<{ registrations: RegistrationView[]; pagination: any }> => {
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
    const url = `${API_BASE}/api/tickets/registrations-all?page=${page}&limit=${limit}${searchParam}`;
    console.log('Making request to:', url);
    try {
      const res = await fetch(url, {
        credentials: 'include'
      });
      console.log('Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', {
          status: res.status,
          statusText: res.statusText,
          url,
          error: errorText
        });
        throw new Error(`Failed to load all registrations: ${res.status}`);
      }
      const data = await res.json();
      console.log('API Response data:', data);
      if (Array.isArray(data)) {
        const result = {
          registrations: data,
          pagination: {
            page,
            limit,
            total: data.length,
            totalPages: Math.max(1, Math.ceil(data.length / limit))
          }
        };
        console.log('Normalized array response to:', result);
        return result;
      }
      if (!data.registrations || !data.pagination) {
        console.warn('Unexpected API response format. Expected {registrations, pagination} but got:', data);
      }
      return data;
    } catch (error: any) {
      console.error('Error in getAllRegistrations:', {
        error,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  },

  // POST /api/tickets/checkin
  checkInTicket: async (code: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/tickets/checkin`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Check-in failed: ${res.status}`);
    }
    return res.json();
  },

  // PUT /api/users/:id/permissions
  updateUserPermissions: async (userId: string, payload: { canViewEvents: boolean; canEditEvents: boolean; canManualCheckIn: boolean }) => {
    const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(userId)}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to update permissions: ${res.status}`);
    }
    return res.json();
  }
};
