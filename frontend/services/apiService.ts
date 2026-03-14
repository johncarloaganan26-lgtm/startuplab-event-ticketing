
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
  AdminPlan,
  HitPaySettings,
  HitPaySettingsResponse
} from '../types';
import { MOCK_EVENTS } from './mockData';
import { supabase } from '../supabase/supabaseClient';
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
  _mapTicketType: (t: any): TicketType => ({
    ...t,
    capacityPerTicket: t.capacity_per_ticket || t.capacityPerTicket || 1
  }),
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

  getAdminPlans: async (): Promise<AdminPlan[]> => {
    const res = await fetch(`${API_BASE}/api/admin/plans`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to load plans: ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data?.plans) ? data.plans : [];
  },

  createAdminPlan: async (payload: Partial<AdminPlan>): Promise<AdminPlan> => {
    const res = await fetch(`${API_BASE}/api/admin/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Failed to create plan: ${res.status}`);
    return data.plan as AdminPlan;
  },

  updateAdminPlan: async (planId: string, payload: Partial<AdminPlan>): Promise<AdminPlan> => {
    const res = await fetch(`${API_BASE}/api/admin/plans/${encodeURIComponent(planId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Failed to update plan: ${res.status}`);
    return data.plan as AdminPlan;
  },

  updateAdminPlanStatus: async (planId: string, isActive: boolean): Promise<{ planId: string; isActive: boolean }> => {
    const res = await fetch(`${API_BASE}/api/admin/plans/${encodeURIComponent(planId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isActive })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Failed to update plan status: ${res.status}`);
    return { planId: data.planId, isActive: !!data.isActive };
  },

  deleteAdminPlan: async (planId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/admin/plans/${encodeURIComponent(planId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Failed to delete plan: ${res.status}`);
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

  getEmailQuotaStatus: async (): Promise<{ remaining: number; limit: number; sent: number; canSend: boolean; quotaStatus: string }> => {
    const res = await fetch(`${API_BASE}/api/organizer/email-quota`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store'
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to load email quota: ${res.status}`);
    }
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

  uploadOrganizerCoverImage: async (file: File): Promise<{ publicUrl: string; organizer?: OrganizerProfile | null }> => {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${API_BASE}/api/organizer/cover`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to upload organizer cover image: ${res.status}`);
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
  getPublicPlans: async (): Promise<AdminPlan[]> => {
    const res = await fetch(`${API_BASE}/api/plans`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to load plans: ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data?.plans) ? data.plans : [];
  },

  // --- Subscription APIs ---
  getCurrentSubscription: async (): Promise<{ subscription: any; organizer: any }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE}/api/subscriptions/current`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to load subscription: ${res.status}`);
    }
    return await res.json();
  },

  getSubscriptionPlans: async (): Promise<AdminPlan[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE}/api/subscriptions/plans`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to load plans: ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data?.plans) ? data.plans : [];
  },

  createSubscription: async (planId: string, billingInterval: string): Promise<{ subscription: any; plan: AdminPlan; paymentUrl?: string; free?: boolean }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE}/api/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ planId, billingInterval })
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to create subscription: ${res.status}`);
    }
    return await res.json();
  },

  cancelSubscription: async (subscriptionId: string): Promise<{ success: boolean; message: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE}/api/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to cancel subscription: ${res.status}`);
    }
    return await res.json();
  },

  getSubscriptionHistory: async (): Promise<{ subscriptions: any[] }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE}/api/subscriptions/history`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Failed to load history: ${res.status}`);
    }
    return await res.json();
  },

  verifySubscription: async (subscriptionId: string): Promise<{ success: boolean; status: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE}/api/subscriptions/verify/${encodeURIComponent(subscriptionId)}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }
    });
    if (!res.ok) {
      const errorPayload = await res.json().catch(() => ({}));
      throw new Error(errorPayload?.error || `Verification failed: ${res.status}`);
    }
    return await res.json();
  },

  // GET /api/events/live
  getLiveEvents: async (): Promise<Event[]> => {
    const res = await fetch(`${API_BASE}/api/events/live`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`Failed to load live events: ${res.status}`);
    const data = await res.json();
    const events = Array.isArray(data?.data) ? data.data : [];
    return events.map((ev: Event) => ({
      ...ev,
      ticketTypes: ev.ticketTypes?.map(apiService._mapTicketType) || []
    }));
  },

  // GET /api/events
  getEvents: async (page = 1, limit = 10, search = '', location = '', organizerId = '', filters: any = {}): Promise<{ events: Event[], pagination: any }> => {
    const query = new URLSearchParams();
    query.append('status', 'PUBLISHED,LIVE');
    query.append('page', String(page));
    query.append('limit', String(limit));
    if (search) query.append('search', search);
    if (location) query.append('location', location);
    if (organizerId) query.append('organizerId', organizerId);

    // Apply additional filters
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key] !== 'all') {
        query.append(key, filters[key]);
      }
    });

    const res = await fetch(`${API_BASE}/api/events?${query}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`Failed to load events: ${res.status}`);
    const data = await res.json();
    if (data.events) {
      data.events = data.events.map((ev: Event) => ({
        ...ev,
        ticketTypes: ev.ticketTypes?.map(apiService._mapTicketType) || []
      }));
    }
    return data;
  },

  // GET /api/events/:slug
  getEventBySlug: async (slug: string): Promise<Event | null> => {
    const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(slug)}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load event: ${res.status}`);
    const data = await res.json() as Event;
    if (data.ticketTypes) {
      data.ticketTypes = data.ticketTypes.map(apiService._mapTicketType);
    }
    return data;
  },

  // GET /api/events/feed
  getEventsFeed: async (page = 1, limit = 12, search = '', location = '', category = ''): Promise<{ events: Event[], pagination: any }> => {
    const query = new URLSearchParams();
    query.append('page', String(page));
    query.append('limit', String(limit));
    if (search) query.append('search', search);
    if (location) query.append('location', location);
    if (category) query.append('category', category);

    const res = await fetch(`${API_BASE}/api/events/feed?${query}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`Failed to load events feed: ${res.status}`);
    const data = await res.json();
    if (data.events) {
      data.events = data.events.map((ev: Event) => ({
        ...ev,
        ticketTypes: ev.ticketTypes?.map(apiService._mapTicketType)
      }));
    }
    return data;
  },

  // GET /api/events/:id/details
  getEventDetails: async (id: string) => {
    const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(id)}/details`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load event details: ${res.status}`);
    const data = await res.json();
    if (data.ticketTypes) {
      data.ticketTypes = data.ticketTypes.map(apiService._mapTicketType);
    }
    return data;
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
    promoCode?: string | null;
    extraGuests?: { name: string; email?: string }[];
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

  // Public contact form
  submitContactForm: async (payload: {
    name: string;
    occupation?: string;
    email: string;
    mobileNumber: string;
    inquiryType: string;
    message: string;
  }) => {
    const res = await fetch(`${API_BASE}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      throw new Error(data?.error || `Failed to send message (${res.status})`);
    }
    return data;
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
    const data = await res.json();
    return data.map(apiService._mapTicketType);
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
    const result = await res.json();
    return apiService._mapTicketType(result);
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
    const result = await res.json();
    return apiService._mapTicketType(result);
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
    return (data || []).map((event: Event) => ({
      ...event,
      ticketTypes: event.ticketTypes?.map(apiService._mapTicketType) || []
    }));
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
    return (data || []).map((event: Event) => ({
      ...event,
      ticketTypes: event.ticketTypes?.map(apiService._mapTicketType) || []
    }));
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

  // DELETE /api/admin/events/:id (Archives event - soft delete)
  deleteEvent: async (id: string): Promise<{ archived?: boolean; permanent?: boolean; message?: string }> => {
    const res = await fetch(`${API_BASE}/api/user/events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error?.error || `Failed to delete event: ${res.status}`);
    }
    return res.json();
  },

  // GET /api/user/events/archived - Get archived events
  getArchivedEvents: async (page = 1, limit = 20): Promise<{ events: any[]; total: number; page: number; limit: number }> => {
    const res = await fetch(`${API_BASE}/api/user/events/archived?page=${page}&limit=${limit}`, {
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to load archived events: ${res.status}`);
    }
    return res.json();
  },

  // POST /api/user/events/:id/restore - Restore archived event
  restoreEvent: async (id: string): Promise<{ message: string; event: any }> => {
    const res = await fetch(`${API_BASE}/api/user/events/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error?.error || `Failed to restore event: ${res.status}`);
    }
    return res.json();
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

  // --- Event Promotion APIs ---
  
  toggleEventPromotion: async (eventId: string): Promise<{ promoted: boolean; promotionId?: string; expiresAt?: string; message: string }> => {
    const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventId)}/toggle-promotion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Failed to toggle promotion: ${res.status}`);
    return data;
  },

  getEventPromotionStatus: async (eventId: string): Promise<{ promoted: boolean; promotionId?: string; expiresAt?: string; remainingDays?: number }> => {
    const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventId)}/promotion-status`, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!res.ok) return { promoted: false };
    return await res.json();
  },

  promoteEvent: async (eventId: string) => {
    return apiService.toggleEventPromotion(eventId);
  },

  demoteEvent: async (eventId: string) => {
    return apiService.toggleEventPromotion(eventId);
  },

  listMyPromotedEvents: async (): Promise<any[]> => {
    const data = await apiService.getPromotedEvents();
    return Array.isArray(data.events) ? data.events : [];
  },

  getPromotionQuota: async (): Promise<{ limit: number; used: number; remaining: number; durationDays: number; canPromote: boolean }> => {
    const res = await fetch(`${API_BASE}/api/promotion-quota`, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Failed to load promotion quota: ${res.status}`);
    return await res.json();
  },

  getPromotedEvents: async (limit = 10): Promise<{ events: Event[] }> => {
    const res = await fetch(`${API_BASE}/api/promoted-events?limit=${limit}`, {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Failed to load promoted events: ${res.status}`);
    return await res.json();
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

  exportEventReport: async (eventId: string): Promise<void> => {
    window.open(`${API_BASE}/api/analytics/events/${encodeURIComponent(eventId)}/export`, '_blank');
  },

  exportAllReports: async (): Promise<void> => {
    window.open(`${API_BASE}/api/analytics/all-events/export`, '_blank');
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
  updateUserPermissions: async (userId: string, payload: { canViewEvents: boolean; canEditEvents: boolean; canManualCheckIn: boolean; canReceiveNotifications: boolean }) => {
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
  },

  // =====================
  // Notifications API
  // =====================

  // GET /api/notifications/me - Get current user's notifications
  getMyNotifications: async (limit = 25): Promise<{ notifications: any[], unreadCount: number }> => {
    const res = await fetch(`${API_BASE}/api/notifications/me?limit=${limit}`, {
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to load notifications: ${res.status}`);
    }
    return res.json();
  },

  // PATCH /api/notifications/:id/read - Mark a notification as read
  markNotificationRead: async (notificationId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PATCH',
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to mark notification as read: ${res.status}`);
    }
    return res.json();
  },

  // PATCH /api/notifications/read-all - Mark all notifications as read
  markAllNotificationsRead: async (): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
      method: 'PATCH',
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to mark all notifications as read: ${res.status}`);
    }
    return res.json();
  },
  // --- Promotion APIs ---
  validatePromotion: async (eventId: string, code: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/promotions/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, code })
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Promotion validation failed: ${res.status}`);
    }
    return await res.json();
  },

  listPromotions: async (eventId: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/api/promotions/events/${encodeURIComponent(eventId)}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to load promotions: ${res.status}`);
    return await res.json();
  },

  upsertPromotion: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Failed to save promotion: ${res.status}`);
    }
    return await res.json();
  },

  deletePromotion: async (promotionId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/promotions/${encodeURIComponent(promotionId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to delete promotion: ${res.status}`);
  },

  // --- Support API ---
  submitSupportTicket: async (payload: { subject: string, message: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/user/support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Failed to submit ticket: ${res.status}`);
    }
    return await res.json();
  },

  getAdminSupportTickets: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/api/admin/support/messages`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to load support tickets: ${res.status}`);
    return await res.json();
  },

  resolveSupportTicket: async (ticketId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/admin/support/${encodeURIComponent(ticketId)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to resolve support ticket: ${res.status}`);
    return await res.json();
  },

  getMySupportTickets: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/api/user/support/history`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to load support history: ${res.status}`);
    return await res.json();
  },

  getAllSupportMessages: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/api/admin/support/all-messages`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to load support message logs: ${res.status}`);
    return await res.json();
  },

  replyToSupportTicket: async (ticketId: string, message: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/api/admin/support/${encodeURIComponent(ticketId)}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message })
    });
    if (!res.ok) throw new Error(`Failed to send reply: ${res.status}`);
    return await res.json();
  },

  getSupportMessages: async (ticketId: string): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/api/support/${encodeURIComponent(ticketId)}/messages`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Failed to load support messages: ${res.status}`);
    return await res.json();
  }
};
