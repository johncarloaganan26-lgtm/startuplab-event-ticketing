
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
            const tix = await apiService.getTicketsByOrder(sessionId);
            if (isMounted) setTickets(Array.isArray(tix) ? tix : []);
            if (pollId) window.clearInterval(pollId);
          } else if (data.status === 'FAILED') {
            setStatus('failed');
            if (pollId) window.clearInterval(pollId);
          } else if (data.status === 'EXPIRED') {
            setStatus('expired');
            if (pollId) window.clearInterval(pollId);
          } else {
            setStatus('pending');
          }
        } else {
          setStatus('failed');
          if (pollId) window.clearInterval(pollId);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setStatus('failed');
        if (pollId) window.clearInterval(pollId);
      }
    };

    checkStatus();
    pollId = window.setInterval(checkStatus, 5000);

    return () => {
      isMounted = false;
      if (pollId) window.clearInterval(pollId);
    };
  }, [sessionId]);

  const renderContent = () => {
    switch (status) {
      case 'checking':
        return (
          <div className="flex flex-col items-center py-20">
            <div className="w-12 h-12 border-4 border-[#F4F6F8] border-t-[#2F80ED] rounded-full animate-spin mb-4"></div>
            <h2 className="text-xl font-bold text-[#1F3A5F]">Verifying Payment...</h2>
            <p className="text-[#1F3A5F]/60">Please do not refresh this page.</p>
          </div>
        );
      case 'success':
        return (
          <div className="flex flex-col items-center py-10 px-6 text-center">
            <div className="w-20 h-20 bg-[#56CCF2]/20 text-[#2F80ED] rounded-full flex items-center justify-center mb-6">
              <ICONS.CheckCircle className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-[#1F3A5F] mb-2">Payment Successful!</h1>
            <p className="text-[#1F3A5F]/60 max-w-sm mb-8">
              Your registration order <strong>#{order?.orderId}</strong> is confirmed. A copy of your ticket has been sent to your email.
            </p>
            <div className="space-y-3 w-full max-w-xs">
              <Button className="w-full bg-[#2F80ED] hover:bg-[#1F3A5F] text-white" size="lg" onClick={() => navigate(`/tickets/${sessionId}`)}>
                View Digital Ticket
              </Button>
              <Button variant="outline" className="w-full border-[#2F80ED]/30 text-[#1F3A5F] hover:bg-[#F4F6F8]" onClick={() => navigate('/events')}>
                Back to Events
              </Button>
            </div>

            {tickets.length > 0 && (
              <div className="w-full mt-10 text-left">
                <h3 className="text-sm font-black text-[#1F3A5F]/60 uppercase tracking-[0.2em] mb-4">Tickets</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tickets.map((t) => (
                    <a
                      key={t.ticketId}
                      href={`#/tickets/${t.ticketId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-[#F4F6F8] rounded-2xl p-4 bg-white shadow-sm flex flex-col items-center gap-3 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#2F80ED]"
                      title="Open this ticket"
                    >
                      <QRCode value={t.qrPayload || t.ticketCode} size={140} />
                      <div className="text-xs text-[#1F3A5F]/60 break-all text-center">
                        {t.ticketCode}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#2F80ED]">{t.status}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case 'failed':
        return (
          <div className="flex flex-col items-center py-10 px-6 text-center">
            <div className="w-20 h-20 bg-[#1F3A5F]/10 text-[#1F3A5F] rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </div>
            <h1 className="text-3xl font-black text-[#1F3A5F] mb-2">Payment Failed</h1>
            <p className="text-[#1F3A5F]/60 max-w-sm mb-8">
              We couldn't process your payment. Please try again or contact support if the issue persists.
            </p>
            <Button className="w-full max-w-xs bg-[#2F80ED] hover:bg-[#1F3A5F] text-white" variant="primary" size="lg" onClick={() => navigate('/events')}>
              Try Again
            </Button>
          </div>
        );
      case 'expired':
        return (
          <div className="flex flex-col items-center py-10 px-6 text-center">
            <div className="w-20 h-20 bg-[#1F3A5F]/10 text-[#1F3A5F] rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v5m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h1 className="text-3xl font-black text-[#1F3A5F] mb-2">Reservation Expired</h1>
            <p className="text-[#1F3A5F]/60 max-w-sm mb-8">
              Your payment window expired before completion. Please select your tickets again to continue.
            </p>
            <Button className="w-full max-w-xs bg-[#2F80ED] hover:bg-[#1F3A5F] text-white" variant="primary" size="lg" onClick={() => navigate('/events')}>
              Back to Events
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <Card className="shadow-2xl border-none">
        {renderContent()}
      </Card>
    </div>
  );
};
