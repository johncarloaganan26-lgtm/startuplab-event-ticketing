
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Order } from '../../types';
import { Card, Button } from '../../components/Shared';
import { ICONS } from '../../constants';
import QRCode from 'react-qr-code';

export const PaymentStatusView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<'checking' | 'success' | 'failed' | 'pending' | 'expired'>('checking');
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicketIndex, setActiveTicketIndex] = useState(0);

  const isOnlineEvent = order?.locationType === 'ONLINE';
  const meetLink = (order?.locationText || '').trim();
  const eventName = order?.eventName || 'Event';
  const orderId = order?.orderId || sessionId;

  useEffect(() => {
    if (!sessionId) return;
    let isMounted = true;
    let pollId: number | undefined;

    const checkStatus = async () => {
      try {
        const data = await apiService.getPaymentStatus(sessionId);
        if (!isMounted) return;
        if (data) {
          setOrder(data);
          if (data.status === 'PAID') {
            setStatus('success');
            // For ONSITE/HYBRID, fetch tickets for QR display
            if (data.locationType !== 'ONLINE') {
              const tix = await apiService.getTicketsByOrder(sessionId);
              if (isMounted) setTickets(Array.isArray(tix) ? tix : []);
            }
            if (pollId) window.clearInterval(pollId);
          } else if (data.status === 'FAILED') {
            setStatus('failed');
            if (pollId) window.clearInterval(pollId);
          } else if (data.status === 'EXPIRED') {
            setStatus('expired');
            if (pollId) window.clearInterval(pollId);
          } else if (data.status === 'PENDING_PAYMENT') {
            setStatus('pending');
          }
        }
      } catch (err) {
        if (isMounted) setStatus('failed');
        if (pollId) window.clearInterval(pollId);
      }
    };

    checkStatus();
    pollId = window.setInterval(checkStatus, 2000);

    return () => {
      isMounted = false;
      if (pollId) window.clearInterval(pollId);
    };
  }, [sessionId]);

  const getProviderName = (url: string) => {
    const lowUrl = url.toLowerCase();
    if (lowUrl.includes('meet.google.com')) return 'Google Meet';
    if (lowUrl.includes('zoom.us') || lowUrl.includes('zoom.com')) return 'Zoom';
    if (lowUrl.includes('teams.microsoft.com') || lowUrl.includes('teams.live.com')) return 'Microsoft Teams';
    if (lowUrl.includes('youtube.com') || lowUrl.includes('youtu.be')) return 'YouTube Live';
    return null; // Return null if no standard provider detected
  };

  const detectedProvider = getProviderName(meetLink);
  const provider = (order?.streamingPlatform && order.streamingPlatform.trim()) || detectedProvider || 'StartupLab Portal';

  if (status === 'checking') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
        <div className="relative w-16 h-16 mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-[#38BDF2]/20 border-t-[#38BDF2] animate-spin"></div>
        </div>
        <h1 className="text-2xl font-black text-[#2E2E2F] tracking-tight mb-3">Confirming Transaction</h1>
        <p className="text-[#2E2E2F]/60 font-medium">Please wait while we secure your participation...</p>
      </div>
    );
  }

  if (status === 'failed' || status === 'expired') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <Card className="p-10 text-center rounded-xl bg-[#F2F2F2] border-[#2E2E2F]/10">
          <div className="w-16 h-16 bg-[#2E2E2F]/5 text-[#2E2E2F]/40 rounded-xl flex items-center justify-center mx-auto mb-8">
            <ICONS.CheckCircle className="w-8 h-8 opacity-20" />
          </div>
          <h1 className="text-3xl font-black text-[#2E2E2F] tracking-tighter mb-4">
            {status === 'expired' ? 'Session Expired' : 'Payment Failed'}
          </h1>
          <p className="text-[#2E2E2F]/70 font-medium leading-relaxed mb-10 max-w-sm mx-auto">
            {status === 'expired'
              ? 'Your reservation window has closed. Your selected seats have been released.'
              : 'We encountered an error processing your payment. No funds were captured.'}
          </p>
          <div className="flex flex-col gap-4">
            <Button onClick={() => navigate('/')} variant="primary" className="w-full py-4 rounded-xl">
              Back to Events
            </Button>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/40">Enterprise Support • Contact help@startuplab.com</p>
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <Card className="p-10 text-center rounded-xl bg-[#F2F2F2] border-[#2E2E2F]/10">
          <div className="relative w-12 h-12 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-[#38BDF2]/10 border-t-[#38BDF2] animate-spin"></div>
          </div>
          <h1 className="text-3xl font-black text-[#2E2E2F] tracking-tighter mb-4">Awaiting Verification</h1>
          <p className="text-[#2E2E2F]/70 font-medium leading-relaxed mb-10 max-w-sm mx-auto">
            Your transaction is currently being processed by the provider. This page will update automatically once confirmed.
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/40">Synchronizing with Payment Gateway...</p>
        </Card>
      </div>
    );
  }

  // SUCCESS STATE
  return (
    <div className="max-w-6xl mx-auto px-6 py-12 lg:py-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between items-start gap-10 mb-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#38BDF2]/10 rounded-xl text-[#38BDF2] text-[10px] font-black uppercase tracking-widest mb-6">
            <span className="w-2 h-2 bg-[#38BDF2] rounded-full animate-pulse"></span>
            Registration Verified
          </div>
          <h1 className="text-5xl lg:text-6xl font-black text-[#2E2E2F] tracking-tighter leading-[0.9] mb-4">
            You're all set!
          </h1>
          <p className="text-[#2E2E2F]/40 font-bold text-xs lg:text-sm uppercase tracking-widest mt-4 flex items-center gap-3">
            <span>Order #{orderId?.toString().slice(-8).toUpperCase()}</span>
            <span className="w-1 h-1 bg-[#2E2E2F]/20 rounded-full"></span>
            <span>{eventName}</span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <Button variant="outline" className="rounded-xl px-8 py-4 border-[#2E2E2F]/10 hover:bg-[#2E2E2F] hover:text-white transition-all duration-300" onClick={() => navigate('/')}>
            BACK TO EVENTS
          </Button>
          {!isOnlineEvent && tickets.length > 0 && (
            <Button
              className="rounded-xl px-8 py-4 bg-[#38BDF2] text-[#F2F2F2] shadow-lg shadow-[#38BDF2]/20 scale-105 hover:scale-110 active:scale-95 transition-all duration-300"
              onClick={() => navigate(`/tickets/${tickets[activeTicketIndex].ticketId}`)}
            >
              VIEW TICKET {tickets.length > 1 ? `#${activeTicketIndex + 1}` : ''}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Access Card */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/10 overflow-hidden shadow-xl shadow-[#2E2E2F]/5">
            <div className="p-8 sm:p-12">
              {isOnlineEvent ? (
                /* ONLINE VERSION */
                <div className="space-y-10">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tight mb-3">Online Event Access</h2>
                      <p className="text-[#2E2E2F]/70 font-medium leading-relaxed max-w-md">
                        This event is hosted digitally. You can join the session directly from this portal or via the link sent to your email.
                      </p>
                    </div>
                    <div className="hidden sm:flex w-20 h-20 bg-[#38BDF2] rounded-xl items-center justify-center text-[#F2F2F2] shrink-0">
                      <ICONS.Layout className="w-10 h-10" />
                    </div>
                  </div>

                  <div className="bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-8">
                    <div className="flex-1 w-full sm:w-auto text-center sm:text-left overflow-hidden">
                      <p className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-widest mb-2">Connection Link</p>
                      <p className="text-sm font-bold text-[#2E2E2F] truncate mb-1 pr-4">{meetLink}</p>
                      <p className="text-[11px] font-medium text-[#38BDF2] flex items-center justify-center sm:justify-start gap-1">
                        <ICONS.CheckCircle className="w-3 h-3" />
                        Verified Access
                      </p>
                    </div>
                    <Button
                      className="w-full sm:w-auto px-10 py-5 rounded-xl bg-[#38BDF2] text-[#F2F2F2] text-sm font-black tracking-wide"
                      onClick={() => { window.open(meetLink, '_blank'); }}
                    >
                      JOIN LIVE SESSION
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-5 rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/5">
                      <p className="text-[9px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-2">Access Method</p>
                      <p className="text-sm font-bold text-[#2E2E2F]">{provider}</p>
                    </div>
                    <div className="p-5 rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/5">
                      <p className="text-[9px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-2">Entry Status</p>
                      <p className="text-sm font-bold text-[#38BDF2]">Auto-Confirmed</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* ONSITE VERSION */
                <div className="space-y-12">
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tight mb-3">Your Digital Ticket</h2>
                      <p className="text-[#2E2E2F]/70 font-medium leading-relaxed max-w-md">
                        Present this QR code at the event for check-in.
                      </p>
                    </div>
                    <div className="hidden sm:flex w-20 h-20 bg-[#2E2E2F] rounded-xl items-center justify-center text-[#F2F2F2] shrink-0">
                      <ICONS.Ticket className="w-10 h-10" />
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-10">
                    {tickets.length > 0 ? (
                      <div className="relative group w-full max-w-[340px] md:max-w-[280px] lg:max-w-[340px]">
                        <div className="absolute -inset-6 bg-[#38BDF2]/5 rounded-xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Card className="relative p-8 sm:p-10 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl shadow-2xl shadow-[#2E2E2F]/10 overflow-hidden">
                          <div className="flex justify-center mb-8">
                            <QRCode
                              value={tickets[activeTicketIndex].qrPayload || tickets[activeTicketIndex].ticketCode}
                              size={200}
                              fgColor="#2E2E2F"
                              bgColor="#F2F2F2"
                              className="w-full h-auto"
                            />
                          </div>
                          <div className="pt-8 border-t border-[#2E2E2F]/5 text-center">
                            <p className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.4em] mb-2">TICKET CODE</p>
                            <p className="text-lg font-black text-[#2E2E2F] tracking-widest uppercase">{tickets[activeTicketIndex].ticketCode}</p>
                            <p className="text-[10px] font-bold text-[#2E2E2F]/40 mt-2 uppercase">{tickets[activeTicketIndex].attendeeName}</p>
                          </div>
                        </Card>
                      </div>
                    ) : (
                      <div className="py-20 text-center text-[#2E2E2F]/40 font-bold italic">Generating entry credentials...</div>
                    )}

                    {tickets.length > 1 && (
                      <div className="flex items-center gap-4 bg-[#2E2E2F] p-2 rounded-xl shadow-xl border border-[#F2F2F2]/5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-10 h-10 p-0 rounded-xl text-[#F2F2F2] hover:bg-[#F2F2F2]/10"
                          onClick={() => setActiveTicketIndex(prev => (prev > 0 ? prev - 1 : tickets.length - 1))}
                        >
                          <ICONS.ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex flex-col items-center min-w-[100px]">
                          <p className="text-[8px] font-black text-[#F2F2F2]/40 uppercase tracking-widest">Ticket Selection</p>
                          <p className="text-sm font-black text-[#F2F2F2]">{activeTicketIndex + 1} of {tickets.length}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-10 h-10 p-0 rounded-xl text-[#F2F2F2] hover:bg-[#F2F2F2]/10"
                          onClick={() => setActiveTicketIndex(prev => (prev < tickets.length - 1 ? prev + 1 : 0))}
                        >
                          <ICONS.ChevronRight className="w-5 h-5" />
                        </Button>
                      </div>
                    )}

                    <div className="max-w-md w-full bg-[#38BDF2]/5 border border-[#38BDF2]/10 rounded-xl py-5 px-8 text-center sm:text-left flex items-center gap-6">
                      <div className="w-10 h-10 bg-[#38BDF2] rounded-xl flex items-center justify-center text-[#F2F2F2] shrink-0">
                        <ICONS.CheckCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-widest mb-1">Entry Requirement</p>
                        <p className="text-[11px] font-bold text-[#2E2E2F] leading-snug">Present this QR code per registrant. Valid identification may be required.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-6 rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/5">
                      <p className="text-[9px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-2">Access Method</p>
                      <p className="text-sm font-bold text-[#2E2E2F]">In-Person Verification</p>
                    </div>
                    <div className="p-6 rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/5">
                      <p className="text-[9px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-2">Entry Status</p>
                      <p className="text-sm font-bold text-[#38BDF2]">Registration Verified</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Verification Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <Card className="p-8 rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/5">
              <div className="w-10 h-10 bg-[#38BDF2]/10 rounded-xl flex items-center justify-center text-[#38BDF2] mb-6">
                <ICONS.Layout className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-black text-[#2E2E2F] uppercase tracking-wide mb-2">Email Delivered</h4>
              <p className="text-xs text-[#2E2E2F]/60 font-medium leading-relaxed">
                A confirmation receipt and detailed instructions have been dispatched to your registered address.
              </p>
            </Card>
            <Card className="p-8 rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/5">
              <div className="w-10 h-10 bg-[#38BDF2]/10 rounded-xl flex items-center justify-center text-[#38BDF2] mb-6">
                <ICONS.Users className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-black text-[#2E2E2F] uppercase tracking-wide mb-2">
                {order?.organizerName || 'Guest Support'}
              </h4>
              <p className="text-xs text-[#2E2E2F]/60 font-medium leading-relaxed">
                Need assistance with your booking? Contact us at{' '}
                <span className="text-[#38BDF2] font-bold">
                  {order?.supportEmail || 'help@startuplab.com'}
                </span>
                .
              </p>
            </Card>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-8">
          <Card className="p-8 rounded-xl bg-[#2E2E2F] text-[#F2F2F2]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#F2F2F2]/40 mb-8">Event Logistics</h3>
            <div className="space-y-8">
              <div>
                <p className="text-[9px] font-black text-[#38BDF2] uppercase tracking-widest mb-2">
                  {isOnlineEvent ? 'Streaming Platform' : 'Venue Location'}
                </p>
                <p className="text-sm font-bold leading-snug">
                  {isOnlineEvent ? provider : (order?.locationText || 'TBA')}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black text-[#38BDF2] uppercase tracking-widest mb-2">Scheduled Start</p>
                <p className="text-sm font-bold leading-snug">
                  {order?.eventStartAt ? new Date(order.eventStartAt).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  }) : 'Refer to email'}
                </p>
              </div>
            </div>
          </Card>

          <div className="px-6 text-center">
            <p className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.4em] mb-4">Secured by StartupLab</p>
            <div className="flex justify-center gap-4 opacity-10">
              <img src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/images/hitpay.png" alt="HitPay" className="h-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


