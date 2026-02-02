
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { AnalyticsSummary, UserRole } from '../../types';
import { Badge, Card, Modal, PageLoader } from '../../components/Shared';
import { ICONS } from '../../constants';
import QRCode from 'react-qr-code';

type Tx = {
  orderId: string;
  eventId?: string;
  buyerName?: string;
  totalAmount?: number;
  currency?: string;
  status?: string;
  created_at?: string;
};

type OrderSummary = {
  orderId: string;
  eventId?: string;
  buyerName?: string;
  buyerEmail?: string;
  totalAmount?: number;
  currency?: string;
  status?: string;
  created_at?: string;
};

type AuditLog = {
  auditLogId: string;
  actionType: string;
  orderId?: string;
  ticketId?: string;
  paymentTransactionId?: string;
  webhookEventsId?: string;
  actorUserId?: string;
  createdAt?: string;
};

type OrderDetailResponse = {
  order: Record<string, any>;
  event?: Record<string, any> | null;
  orderItems?: Array<Record<string, any>>;
  attendees?: Array<Record<string, any>>;
  tickets?: Array<Record<string, any>>;
  payments?: Array<Record<string, any>>;
};

type TicketDetailResponse = {
  ticket: Record<string, any>;
  attendee?: Record<string, any> | null;
  event?: Record<string, any> | null;
  order?: Record<string, any> | null;
  ticketType?: Record<string, any> | null;
};

type AuditLogDetailResponse = {
  log: Record<string, any>;
  orderDetails?: OrderDetailResponse | null;
  ticketDetails?: TicketDetailResponse | null;
  webhookEvent?: Record<string, any> | null;
  paymentTransaction?: Record<string, any> | null;
};

type DetailType = 'transaction' | 'order' | 'audit';

const PAGE_SIZE = 10;

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactNode, trend?: string, color?: string }> = ({ title, value, icon, trend, color = 'indigo' }) => (
  <Card className="p-6">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-[#1F3A5F]/60 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-[#1F3A5F]">{value}</h3>
        {trend && (
          <p className={`text-xs mt-2 flex items-center ${trend.startsWith('+') ? 'text-[#2F80ED]' : 'text-[#1F3A5F]'}`}>
            <ICONS.TrendingUp className="w-3 h-3 mr-1" />
            {trend} from last month
          </p>
        )}
      </div>
      <div className={`p-3 bg-[#56CCF2]/20 text-[#2F80ED] rounded-xl`}>
        {icon}
      </div>
    </div>
  </Card>
);

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsSummary | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [txHasMore, setTxHasMore] = useState(true);
  const [txFetching, setTxFetching] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersHasMore, setOrdersHasMore] = useState(true);
  const [ordersFetching, setOrdersFetching] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditHasMore, setAuditHasMore] = useState(true);
  const [auditFetching, setAuditFetching] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<DetailType | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<OrderDetailResponse | AuditLogDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [role, setRole] = React.useState<UserRole | null>(null);
  const isStaff = role === UserRole.STAFF;
  const basePath = isStaff ? '/staff' : '/admin';


  React.useEffect(() => {
    async function fetchRole() {
      try {
        const res = await fetch(`/api/user/role`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setRole(data?.[0]?.role || UserRole.ADMIN);
        } else {
          setRole(UserRole.ADMIN);
        }
      } catch {
        setRole(UserRole.ADMIN);
      }
    }
    fetchRole();
  }, []);

  React.useEffect(() => {
    if (role === UserRole.STAFF) {
      navigate('/staff/events', { replace: true });
    }
  }, [role, navigate]);

  const loadTransactions = async (pageToLoad = 1) => {
    if (txFetching) return;
    setTxFetching(true);
    if (pageToLoad === 1) setTxLoading(true);
    try {
      const data = await apiService.getRecentTransactions(pageToLoad, PAGE_SIZE);
      const items = data?.items || [];
      const pagination = data?.pagination;
      setTransactions(prev => (pageToLoad === 1 ? items : [...prev, ...items]));
      setTxHasMore(Boolean(pagination?.hasMore));
      setTxPage(pagination?.page || pageToLoad);
    } catch {
      setTxHasMore(false);
    } finally {
      setTxLoading(false);
      setTxFetching(false);
    }
  };

  const loadOrders = async (pageToLoad = 1) => {
    if (ordersFetching) return;
    setOrdersFetching(true);
    if (pageToLoad === 1) setOrdersLoading(true);
    try {
      const data = await apiService.getRecentOrders(pageToLoad, PAGE_SIZE);
      const items = data?.items || [];
      const pagination = data?.pagination;
      setOrders(prev => (pageToLoad === 1 ? items : [...prev, ...items]));
      setOrdersHasMore(Boolean(pagination?.hasMore));
      setOrdersPage(pagination?.page || pageToLoad);
    } catch {
      setOrdersHasMore(false);
    } finally {
      setOrdersLoading(false);
      setOrdersFetching(false);
    }
  };

  const loadAuditLogs = async (pageToLoad = 1) => {
    if (auditFetching) return;
    setAuditFetching(true);
    if (pageToLoad === 1) setAuditLoading(true);
    try {
      const data = await apiService.getAuditLogs(pageToLoad, PAGE_SIZE);
      const items = data?.items || [];
      const pagination = data?.pagination;
      setAuditLogs(prev => (pageToLoad === 1 ? items : [...prev, ...items]));
      setAuditHasMore(Boolean(pagination?.hasMore));
      setAuditPage(pagination?.page || pageToLoad);
    } catch {
      setAuditHasMore(false);
    } finally {
      setAuditLoading(false);
      setAuditFetching(false);
    }
  };

  const handleTxScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!txHasMore || txFetching) return;
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < 120) loadTransactions(txPage + 1);
  };

  const handleOrdersScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!ordersHasMore || ordersFetching) return;
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < 120) loadOrders(ordersPage + 1);
  };

  const handleAuditScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!auditHasMore || auditFetching) return;
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < 120) loadAuditLogs(auditPage + 1);
  };

  const formatDate = (value?: string | null) => {
    return value ? new Date(value).toLocaleString() : '—';
  };

  const renderStatusBadge = (status?: string | null) => {
    const value = (status || 'UNKNOWN').toUpperCase();
    const successStates = ['PAID', 'SUCCEEDED', 'USED', 'ISSUED'];
    const dangerStates = ['FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'];
    const type = successStates.includes(value)
      ? 'success'
      : dangerStates.includes(value)
        ? 'danger'
        : value === 'PENDING'
          ? 'warning'
          : 'neutral';
    return (
      <Badge type={type} className="text-[10px] font-black uppercase tracking-[0.2em]">
        {value}
      </Badge>
    );
  };

  const humanizeKey = (key: string) => {
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .trim();
  };

  const formatDetailValue = (value: any): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      if (!value.length) return '—';
      const primitiveItems = value.filter(item => ['string', 'number', 'boolean'].includes(typeof item));
      if (primitiveItems.length === value.length) {
        return primitiveItems.map(item => String(item)).join(', ');
      }
      return `${value.length} items`;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (!entries.length) return '—';
      const preview = entries
        .slice(0, 4)
        .map(([entryKey, entryValue]) => `${humanizeKey(entryKey)}: ${formatDetailValue(entryValue)}`)
        .join(' • ');
      return entries.length > 4 ? `${preview} • +${entries.length - 4} more` : preview;
    }
    return String(value);
  };

  const renderDetailFields = (value: any, emptyMessage: string) => {
    if (!value) {
      return <p className="text-xs text-[#1F3A5F]/50">{emptyMessage}</p>;
    }
    if (typeof value !== 'object') {
      return <p className="text-xs text-[#1F3A5F]/70">{formatDetailValue(value)}</p>;
    }

    const entries = Array.isArray(value)
      ? value.map((item, index) => [`Item ${index + 1}`, item])
      : Object.entries(value);

    if (!entries.length) {
      return <p className="text-xs text-[#1F3A5F]/50">{emptyMessage}</p>;
    }

    return (
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {entries.map(([entryKey, entryValue]) => (
          <div key={entryKey} className="border border-[#F4F6F8] rounded-xl p-3 bg-[#F4F6F8]/40">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1F3A5F]/50">{humanizeKey(entryKey)}</p>
            <p className="text-xs text-[#1F3A5F]/70 mt-2">{formatDetailValue(entryValue)}</p>
          </div>
        ))}
      </div>
    );
  };

  const openDetail = async (type: DetailType, id: string) => {
    if (!id) return;
    setDetailType(type);
    setDetailId(id);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailData(null);
    try {
      const data = type === 'audit'
        ? await apiService.getAuditLogDetail(id)
        : type === 'transaction'
          ? await apiService.getTransactionDetail(id)
          : await apiService.getOrderDetail(id);
      setDetailData(data);
    } catch (err: any) {
      setDetailError(err?.message || 'Failed to load details');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailType(null);
    setDetailId(null);
    setDetailData(null);
    setDetailError(null);
  };

  const renderOrderDetails = (details: OrderDetailResponse) => {
    if (!details?.order) {
      return <div className="text-sm text-[#1F3A5F]/50">Order details unavailable.</div>;
    }

    const { order, event, orderItems = [], attendees = [], tickets = [], payments = [] } = details;
    const company = order?.metadata && typeof order.metadata === 'object' ? order.metadata.company : null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#F4F6F8] bg-[#F4F6F8]/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Order Summary</p>
              {renderStatusBadge(order?.status)}
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-sm font-bold text-[#1F3A5F]">#{order?.orderId}</p>
              <p className="text-xs text-[#1F3A5F]/60">Created {formatDate(order?.created_at)}</p>
              {order?.expiresAt && (
                <p className="text-xs text-[#1F3A5F]/60">Expires {formatDate(order?.expiresAt)}</p>
              )}
              <p className="text-sm font-black text-[#2F80ED]">{order?.currency || 'PHP'} {Number(order?.totalAmount || 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Buyer</p>
            <div className="mt-3 space-y-2">
              <p className="text-sm font-bold text-[#1F3A5F]">{order?.buyerName || '—'}</p>
              <p className="text-xs text-[#1F3A5F]/60">{order?.buyerEmail || '—'}</p>
              <p className="text-xs text-[#1F3A5F]/60">Phone: {order?.buyerPhone || '—'}</p>
              <p className="text-xs text-[#1F3A5F]/60">Company: {company || '—'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Event</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-sm font-bold text-[#1F3A5F]">{event?.eventName || order?.eventId || '—'}</p>
              <p className="text-xs text-[#1F3A5F]/60">{event?.locationText || '—'}</p>
            </div>
            <div className="text-xs text-[#1F3A5F]/60 space-y-1">
              <p>Start: {formatDate(event?.startAt)}</p>
              <p>End: {formatDate(event?.endAt)}</p>
              <p>Timezone: {event?.timezone || '—'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Order Items</p>
            <Badge type="info" className="text-[9px] font-black uppercase tracking-[0.2em]">{orderItems.length} items</Badge>
          </div>
          {orderItems.length ? (
            <div className="mt-3 space-y-3">
              {orderItems.map((item: any) => (
                <div key={item.orderItemId} className="flex items-center justify-between gap-4 border border-[#F4F6F8] rounded-xl p-3 bg-[#F4F6F8]/40">
                  <div>
                    <p className="text-sm font-bold text-[#1F3A5F]">{item.ticketType?.name || 'Ticket'}</p>
                    <p className="text-xs text-[#1F3A5F]/60">Qty {item.quantity} • {item.ticketType?.currency || order?.currency || 'PHP'} {Number(item.price || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-sm font-bold text-[#2F80ED]">{order?.currency || 'PHP'} {Number(item.lineTotal || 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#1F3A5F]/50">No order items recorded.</p>
          )}
        </div>

        <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Attendees</p>
            <Badge type="neutral" className="text-[9px] font-black uppercase tracking-[0.2em]">{attendees.length} total</Badge>
          </div>
          {attendees.length ? (
            <div className="mt-3 space-y-3">
              {attendees.map((att: any) => (
                <div key={att.attendeeId} className="border border-[#F4F6F8] rounded-xl p-3 bg-[#F4F6F8]/40">
                  <p className="text-sm font-bold text-[#1F3A5F]">{att.name || 'Attendee'}</p>
                  <p className="text-xs text-[#1F3A5F]/60">{att.email || '—'}</p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-[#1F3A5F]/60 mt-2">
                    <span>Phone: {att.phoneNumber || '—'}</span>
                    <span>Company: {att.company || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#1F3A5F]/50">No attendee records.</p>
          )}
        </div>

        <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Tickets</p>
            <Badge type="neutral" className="text-[9px] font-black uppercase tracking-[0.2em]">{tickets.length} total</Badge>
          </div>
          {tickets.length ? (
            <div className="mt-3 space-y-3">
              {tickets.map((ticket: any) => (
                <div key={ticket.ticketId} className="border border-[#F4F6F8] rounded-xl p-3 bg-[#F4F6F8]/40">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#1F3A5F]">{ticket.ticketType?.name || 'Ticket'}</p>
                    {renderStatusBadge(ticket.status)}
                  </div>
                  <p className="text-xs text-[#1F3A5F]/60">Code: {ticket.ticketCode || '—'}</p>
                  <p className="text-xs text-[#1F3A5F]/60">Attendee: {ticket.attendee?.name || order?.buyerName || '—'}</p>
                  <p className="text-[10px] text-[#1F3A5F]/50 mt-2">Check-in: {formatDate(ticket.usedAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#1F3A5F]/50">No tickets issued yet.</p>
          )}
        </div>

        <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Payments</p>
            <Badge type="neutral" className="text-[9px] font-black uppercase tracking-[0.2em]">{payments.length} total</Badge>
          </div>
          {payments.length ? (
            <div className="mt-3 space-y-3">
              {payments.map((payment: any) => (
                <div key={payment.paymentTransactionId} className="border border-[#F4F6F8] rounded-xl p-3 bg-[#F4F6F8]/40">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#1F3A5F]">{payment.gateway?.name || payment.gateway || 'HITPAY'}</p>
                    {renderStatusBadge(payment.status)}
                  </div>
                  <p className="text-xs text-[#1F3A5F]/60">Reference: {payment.hitpayReferenceId || '—'}</p>
                  <p className="text-xs text-[#1F3A5F]/60">Amount: {payment.currency || order?.currency || 'PHP'} {Number(payment.amount || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-[#1F3A5F]/50 mt-2">Created: {formatDate(payment.created_at)}</p>
                  {payment.rawPayload && renderDetailFields(payment.rawPayload, 'No payload recorded.')}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#1F3A5F]/50">No payment records.</p>
          )}
        </div>
      </div>
    );
  };

  const renderTicketDetails = (details: TicketDetailResponse) => {
    if (!details?.ticket) {
      return <div className="text-sm text-[#1F3A5F]/50">Ticket details unavailable.</div>;
    }

    const { ticket, attendee, event, order, ticketType } = details;
    const amount = order?.totalAmount ?? ticketType?.priceAmount ?? 0;
    const currency = order?.currency || ticketType?.currency || 'PHP';

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Ticket Detail</p>
          {renderStatusBadge(ticket?.status)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4">
          <div className="border border-[#F4F6F8] rounded-2xl p-3 bg-white flex items-center justify-center">
            {ticket?.qrPayload || ticket?.ticketCode ? (
              <QRCode value={ticket?.qrPayload || ticket?.ticketCode} size={120} />
            ) : (
              <div className="text-xs text-[#1F3A5F]/50">No QR</div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold text-[#1F3A5F]">{ticketType?.name || 'Ticket'}</p>
            <p className="text-xs text-[#1F3A5F]/60">Code: {ticket?.ticketCode || '—'}</p>
            <p className="text-xs text-[#1F3A5F]/60">Event: {event?.eventName || '—'}</p>
            <p className="text-xs text-[#1F3A5F]/60">Order: {order?.orderId || '—'}</p>
            <div className="text-xs text-[#1F3A5F]/60 flex items-center gap-2">
              <span>Payment: {order?.status || '—'}</span>
              {renderStatusBadge(order?.status)}
            </div>
            <p className="text-xs text-[#1F3A5F]/60">Amount: {currency} {Number(amount || 0).toLocaleString()}</p>
            <p className="text-xs text-[#1F3A5F]/60">Check-in: {formatDate(ticket?.usedAt)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Attendee</p>
            <div className="mt-3 space-y-2">
              <p className="text-sm font-bold text-[#1F3A5F]">{attendee?.name || '—'}</p>
              <p className="text-xs text-[#1F3A5F]/60">{attendee?.email || '—'}</p>
              <p className="text-xs text-[#1F3A5F]/60">Phone: {attendee?.phoneNumber || '—'}</p>
              <p className="text-xs text-[#1F3A5F]/60">Company: {attendee?.company || '—'}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Event</p>
            <div className="mt-3 space-y-2">
              <p className="text-sm font-bold text-[#1F3A5F]">{event?.eventName || '—'}</p>
              <p className="text-xs text-[#1F3A5F]/60">{event?.locationText || '—'}</p>
              <p className="text-xs text-[#1F3A5F]/60">Start: {formatDate(event?.startAt)}</p>
              <p className="text-xs text-[#1F3A5F]/60">End: {formatDate(event?.endAt)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAuditDetails = (details: AuditLogDetailResponse) => {
    if (!details?.log) {
      return <div className="text-sm text-[#1F3A5F]/50">Audit log details unavailable.</div>;
    }

    const { log, orderDetails, ticketDetails, webhookEvent, paymentTransaction } = details;

    return (
      <div className="space-y-8">
        <div className="rounded-2xl border border-[#F4F6F8] bg-[#F4F6F8]/40 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Action Type</p>
              <p className="text-lg font-black text-[#1F3A5F]">{log.actionType}</p>
            </div>
            <Badge type="info" className="text-[10px] font-black uppercase tracking-[0.2em]">Audit Log</Badge>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#1F3A5F]/60">
            <div>Audit ID: {log.auditLogId}</div>
            <div>Actor: {log.actorUserId || '—'}</div>
            <div>Order ID: {log.orderId || '—'}</div>
            <div>Ticket ID: {log.ticketId || '—'}</div>
            <div>Payment Tx: {log.paymentTransactionId || '—'}</div>
            <div>Webhook Event: {log.webhookEventsId || '—'}</div>
            <div>Created: {formatDate(log.createdAt)}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Log Details</p>
          {renderDetailFields(log.details, 'No additional details.')}
        </div>

        {paymentTransaction && (
          <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Payment Transaction</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#1F3A5F]">{paymentTransaction.gateway?.name || paymentTransaction.gateway || 'HITPAY'}</p>
                {renderStatusBadge(paymentTransaction.status)}
              </div>
              <p className="text-xs text-[#1F3A5F]/60">Reference: {paymentTransaction.hitpayReferenceId || '—'}</p>
              <p className="text-xs text-[#1F3A5F]/60">Amount: {paymentTransaction.currency || 'PHP'} {Number(paymentTransaction.amount || 0).toLocaleString()}</p>
              <p className="text-[10px] text-[#1F3A5F]/50">Created: {formatDate(paymentTransaction.created_at)}</p>
              {paymentTransaction.rawPayload && renderDetailFields(paymentTransaction.rawPayload, 'No payload recorded.')}
            </div>
          </div>
        )}

        {webhookEvent && (
          <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Webhook Event</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[#1F3A5F]">{webhookEvent.eventType || 'HITPAY'}</p>
                {renderStatusBadge(webhookEvent.processingStatus)}
              </div>
              <p className="text-xs text-[#1F3A5F]/60">External ID: {webhookEvent.externalId || '—'}</p>
              <p className="text-xs text-[#1F3A5F]/60">Received: {formatDate(webhookEvent.receivedAt)}</p>
              <p className="text-xs text-[#1F3A5F]/60">Processed: {formatDate(webhookEvent.processedAt)}</p>
              {webhookEvent.payload && renderDetailFields(webhookEvent.payload, 'No payload recorded.')}
            </div>
          </div>
        )}

        {ticketDetails && (
          <div className="rounded-2xl border border-[#F4F6F8] bg-white p-4">
            {renderTicketDetails(ticketDetails)}
          </div>
        )}

        {orderDetails && (
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1F3A5F]/50">Order Context</p>
            {renderOrderDetails(orderDetails)}
          </div>
        )}
      </div>
    );
  };

  const renderDetailBody = () => {
    if (detailLoading) {
      return <div className="text-sm text-[#1F3A5F]/50">Loading details...</div>;
    }
    if (detailError) {
      return <div className="text-sm text-[#1F3A5F]/50">{detailError}</div>;
    }
    if (!detailData) {
      return <div className="text-sm text-[#1F3A5F]/50">No details available.</div>;
    }
    if (detailType === 'audit') {
      return renderAuditDetails(detailData as AuditLogDetailResponse);
    }
    return renderOrderDetails(detailData as OrderDetailResponse);
  };

  const detailTitle = detailType === 'audit'
    ? 'Audit Log Detail'
    : detailType === 'transaction'
      ? 'Transaction Detail'
      : detailType === 'order'
        ? 'Order Detail'
        : 'Detail';

  React.useEffect(() => {
    if (!isStaff) {
      apiService.getAnalytics().then(data => {
        setStats(data);
        setLoading(false);
      });
      loadTransactions(1);
      loadOrders(1);
      loadAuditLogs(1);
    }
  }, [isStaff]);

  if (isStaff) {
    return (
      <div className="p-20 text-center">
        <ICONS.CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-20" />
        <h2 className="text-xl font-bold text-[#1F3A5F]/50">Restricted Access</h2>
        <p className="text-[#1F3A5F]/50 mt-2">Revenue reports are available for Administrators only.</p>
        <button 
          onClick={() => navigate(`${basePath}/events?role=${role}`)}
          className="mt-6 text-[#2F80ED] font-bold hover:underline"
        >
          Go to Operations Hub
        </button>
      </div>
    );
  }

  if (loading) return <PageLoader label="Loading enterprise reports..." variant="page" />;
  if (!stats) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-[#1F3A5F] tracking-tight">Financial Performance</h1>
        <p className="text-[#1F3A5F]/60 font-medium">Organization-wide revenue and registration analytics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          title="Total Registrations" 
          value={stats.totalRegistrations} 
          icon={<ICONS.Users className="w-6 h-6" />} 
          trend=""
        />
        <StatCard 
          title="Tickets Sold Today" 
          value={stats.ticketsSoldToday} 
          icon={<ICONS.Ticket className="w-6 h-6" />} 
          trend=""
        />
        <StatCard 
          title="Total Revenue" 
          value={`PHP ${stats.totalRevenue.toLocaleString()}`} 
          icon={<ICONS.CreditCard className="w-6 h-6" />} 
          trend=""
        />
        <StatCard 
          title="Revenue Today" 
          value={`PHP ${stats.revenueToday.toLocaleString()}`} 
          icon={<ICONS.CreditCard className="w-6 h-6" />} 
          trend=""
        />
        <StatCard 
          title="Attendance Rate" 
          value={`${stats.attendanceRate.toFixed(1)}%`} 
          icon={<ICONS.CheckCircle className="w-6 h-6" />} 
        />
        <StatCard 
          title="Payment Success" 
          value={`${stats.paymentSuccessRate.toFixed(1)}%`} 
          icon={<ICONS.TrendingUp className="w-6 h-6" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="font-bold text-lg mb-6 flex items-center">
            <ICONS.Calendar className="w-5 h-5 mr-2 text-[#2F80ED]" />
            All Transactions
          </h3>
          {txLoading ? (
            <div className="text-[#1F3A5F]/50 text-sm">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="text-[#1F3A5F]/50 text-sm">No transactions yet.</div>
          ) : (
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1" onScroll={handleTxScroll}>
              {transactions.map((tx) => (
                <div
                  key={tx.orderId}
                  className="flex gap-3 items-start pb-4 border-b border-[#F4F6F8] last:border-0 cursor-pointer rounded-xl p-2 -m-2 hover:bg-[#F4F6F8]/60 transition-colors"
                  onClick={() => openDetail('transaction', tx.orderId)}
                >
                  <div className="w-10 h-10 rounded-full bg-[#F4F6F8] border border-[#F4F6F8] flex items-center justify-center text-[#1F3A5F]/50 flex-shrink-0">
                    <ICONS.Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1F3A5F] truncate">{tx.buyerName || 'Paid Registration'}</p>
                    <p className="text-xs text-[#1F3A5F]/60 truncate">{tx.eventId || 'Event'} • {tx.created_at ? new Date(tx.created_at).toLocaleString() : ''}</p>
                    <span className={`inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded mt-2 ${tx.status === 'PAID' ? 'bg-[#56CCF2]/20 text-[#2F80ED]' : 'bg-[#F4F6F8] text-[#1F3A5F]/60'}`}>
                      {tx.status || 'PENDING'}
                    </span>
                  </div>
                  <div className="ml-auto text-sm font-bold text-[#2F80ED] whitespace-nowrap">
                    {tx.currency || 'PHP'} {Number(tx.totalAmount || 0).toLocaleString()}
                  </div>
                </div>
              ))}
              {txFetching && !txLoading && (
                <div className="text-xs text-[#1F3A5F]/50">Loading more...</div>
              )}
              {!txHasMore && transactions.length > 0 && (
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#1F3A5F]/40">End of list</div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-lg mb-6 flex items-center">
            <ICONS.Ticket className="w-5 h-5 mr-2 text-[#2F80ED]" />
            Recent Orders
          </h3>
          {ordersLoading ? (
            <div className="text-[#1F3A5F]/50 text-sm">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="text-[#1F3A5F]/50 text-sm">No orders yet.</div>
          ) : (
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1" onScroll={handleOrdersScroll}>
              {orders.map((order) => (
                <div
                  key={order.orderId}
                  className="flex gap-3 items-start pb-4 border-b border-[#F4F6F8] last:border-0 cursor-pointer rounded-xl p-2 -m-2 hover:bg-[#F4F6F8]/60 transition-colors"
                  onClick={() => openDetail('order', order.orderId)}
                >
                  <div className="w-10 h-10 rounded-full bg-[#F4F6F8] border border-[#F4F6F8] flex items-center justify-center text-[#1F3A5F]/50 flex-shrink-0">
                    <ICONS.CreditCard className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1F3A5F] truncate">{order.buyerName || order.buyerEmail || 'Order'}</p>
                    <p className="text-xs text-[#1F3A5F]/60 truncate">Order #{order.orderId?.slice(0, 8)} • {order.created_at ? new Date(order.created_at).toLocaleString() : ''}</p>
                    <span className={`inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded mt-2 ${order.status === 'PAID' ? 'bg-[#56CCF2]/20 text-[#2F80ED]' : 'bg-[#F4F6F8] text-[#1F3A5F]/60'}`}>
                      {order.status || 'PENDING'}
                    </span>
                  </div>
                  <div className="ml-auto text-sm font-bold text-[#2F80ED] whitespace-nowrap">
                    {order.currency || 'PHP'} {Number(order.totalAmount || 0).toLocaleString()}
                  </div>
                </div>
              ))}
              {ordersFetching && !ordersLoading && (
                <div className="text-xs text-[#1F3A5F]/50">Loading more...</div>
              )}
              {!ordersHasMore && orders.length > 0 && (
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#1F3A5F]/40">End of list</div>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="font-bold text-lg mb-6 flex items-center">
            <ICONS.CheckCircle className="w-5 h-5 mr-2 text-[#2F80ED]" />
            Audit Logs
          </h3>
          {auditLoading ? (
            <div className="text-[#1F3A5F]/50 text-sm">Loading audit logs...</div>
          ) : auditLogs.length === 0 ? (
            <div className="text-[#1F3A5F]/50 text-sm">No audit logs yet.</div>
          ) : (
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1" onScroll={handleAuditScroll}>
              {auditLogs.map((log) => {
                const targetId = log.orderId || log.ticketId || log.paymentTransactionId || log.webhookEventsId || '—';
                return (
                  <div
                    key={log.auditLogId}
                    className="flex gap-3 items-start pb-4 border-b border-[#F4F6F8] last:border-0 cursor-pointer rounded-xl p-2 -m-2 hover:bg-[#F4F6F8]/60 transition-colors"
                    onClick={() => openDetail('audit', log.auditLogId)}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#F4F6F8] border border-[#F4F6F8] flex items-center justify-center text-[#1F3A5F]/50 flex-shrink-0">
                      <ICONS.Layout className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1F3A5F] truncate">{log.actionType}</p>
                      <p className="text-xs text-[#1F3A5F]/60 truncate">Target {targetId}</p>
                      <p className="text-[10px] text-[#1F3A5F]/50 mt-2">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}</p>
                    </div>
                  </div>
                );
              })}
              {auditFetching && !auditLoading && (
                <div className="text-xs text-[#1F3A5F]/50">Loading more...</div>
              )}
              {!auditHasMore && auditLogs.length > 0 && (
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#1F3A5F]/40">End of list</div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-8 flex flex-col items-center justify-center text-center border-dashed border-2 bg-[#56CCF2]/20/20 border-[#56CCF2]/40">
          <div className="w-20 h-20 bg-white shadow-xl shadow-[#2F80ED]/10 text-[#2F80ED] rounded-3xl flex items-center justify-center mb-6">
            <ICONS.Calendar className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-black text-[#1F3A5F] mb-2">New Event Concept?</h3>
          <p className="text-[#1F3A5F]/60 text-sm max-w-xs mb-8 font-medium">Launch a new workshop or conference to drive organization revenue.</p>
          <button 
            onClick={() => navigate(`/events?openModal=true`)}
            className="bg-[#2F80ED] text-white px-8 py-3 rounded-2xl font-bold hover:bg-[#1F3A5F] transition-all shadow-xl shadow-[#2F80ED]/10 active:scale-95"
          >
            Configure Event
          </button>
        </Card>
      </div>

      <Modal isOpen={detailOpen} onClose={closeDetail} title={detailTitle}>
        {renderDetailBody()}
      </Modal>
    </div>
  );
};
