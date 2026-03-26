import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, PageLoader, Checkbox } from '../../components/Shared';
import { apiService } from '../../services/apiService';
import { ICONS } from '../../constants';
import { useToast } from '../../context/ToastContext';

export const OrganizerSupport: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Record<string, any[]>>({});
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === history.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(history.map(t => t.notification_id)));
    }
  };

  const handlePrintSupport = () => {
    const selected = history.filter(t => selectedRows.has(t.notification_id));
    const printData = selected.length > 0 ? selected : history;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const watermarkLogo = profile?.profileImageUrl || 'https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg';
      printWindow.document.write(`
        <html><head><title>Support History Report</title>
        <style>
          @page { size: portrait; margin: 20mm; }
          body { font-family: 'Inter', sans-serif; color: #2E2E2F; padding: 0; margin: 0; position: relative; min-height: 100vh; }
          .watermark-container {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            z-index: -1000;
            pointer-events: none;
            overflow: hidden;
          }
          .watermark {
            width: 120%; /* "Big as fuck" */
            max-width: none;
            opacity: 0.04; 
            transform: rotate(-25deg);
            filter: grayscale(100%);
          }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #38BDF2; padding-bottom: 15px; margin-bottom: 40px; }
          .logo { height: 70px; object-fit: contain; }
          .report-info { text-align: right; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #2E2E2F; line-height: 1.5; }
          h1 { margin: 0; font-size: 32px; letter-spacing: -0.06em; font-weight: 900; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; position: relative; z-index: 10; background: rgba(255,255,255,0.7); }
          th { background: #2E2E2F; color: white; border: 1px solid #2E2E2F; padding: 14px 10px; text-align: left; text-transform: uppercase; letter-spacing: 0.15em; font-size: 11px; }
          td { border: 1px solid #ddd; padding: 14px 10px; vertical-align: top; background: transparent; }
          .status { font-weight: 900; text-transform: uppercase; font-size: 10px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; }
        </style></head><body>
          <div class="watermark-container">
            <img src="${watermarkLogo}" class="watermark" />
          </div>
          <div class="header">
            <div>
              <h1>Support History</h1>
              <p style="margin: 5px 0 0; font-size: 14px; font-weight: 600; color: #38BDF2;">${profile?.organizerName || 'Official Document'}</p>
            </div>
            <div class="report-info">
              <img src="${watermarkLogo}" class="logo" /><br/>
              <span style="color: #666;">Ref: LOG-${Date.now().toString().slice(-6)}</span><br/>
              Date: ${new Date().toLocaleDateString()}<br/>
              Capacity: ${printData.length} Tickets
            </div>
          </div>
          <table>
            <thead><tr><th>Reference / Subject</th><th>Current Status</th><th>Entry Date</th></tr></thead>
            <tbody>
              ${printData.map(t => `
                <tr>
                  <td>
                    <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px; color: #000;">${t.title || 'No Subject'}</div>
                    <div style="font-size: 11px; color: #444; line-height: 1.4;">${t.message ? t.message.substring(0, 150) + (t.message.length > 150 ? '...' : '') : 'No message body.'}</div>
                  </td>
                  <td style="width: 120px; text-align: center;"><span class="status">${t.metadata?.status || 'Open'}</span></td>
                  <td style="width: 120px; text-align: right; font-weight: 600;">${new Date(t.created_at).toLocaleDateString()}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div style="margin-top: 60px; text-align: center; font-size: 11px; font-weight: bold; color: #2E2E2F; border-top: 2px solid #eee; padding-top: 20px; text-transform: uppercase; letter-spacing: 0.1em;">
            StartupLab Business Ticketing System • Official Organizer Report
          </div>
        </body></html>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExportSupport = () => {
    const selected = history.filter(t => selectedRows.has(t.notification_id));
    const exportData = selected.length > 0 ? selected : history;
    const csvContent = `Subject,Status,Date\n${exportData.map(t => `${t.title || ''},${t.metadata?.status || 'Open'},${new Date(t.created_at).toLocaleDateString()}`).join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `support_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleBulkArchive = async () => {
    if (selectedRows.size === 0) {
      showToast('info', 'Select tickets to archive first');
      return;
    }
    try {
      setRefreshing(true);
      await apiService.bulkArchiveSupportTickets(Array.from(selectedRows));
      showToast('success', `${selectedRows.size} tickets archived successfully.`);
      setSelectedRows(new Set());
      await loadHistory();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to archive tickets');
    } finally {
      setRefreshing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      showToast('info', 'Select tickets to delete first');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedRows.size} tickets and all their messages?`)) return;
    try {
      setRefreshing(true);
      await apiService.bulkDeleteSupportTickets(Array.from(selectedRows));
      showToast('success', `${selectedRows.size} tickets deleted successfully.`);
      setSelectedRows(new Set());
      await loadHistory();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete tickets');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const organizer = await apiService.getMyOrganizer();
      setProfile(organizer);
    } catch (err) {
      console.error('Failed to load organizer profile', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await apiService.getMySupportTickets();
      setHistory(data || []);
    } catch (err) {
      console.warn('Failed to load support history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      setRefreshing(true);
      const data = await apiService.getSupportMessages(ticketId);
      setTicketMessages(prev => ({ ...prev, [ticketId]: data }));
    } catch (err) {
      console.warn('Failed to load messages');
    } finally {
      setTimeout(() => setRefreshing(false), 500); // Small delay for visual impact
    }
  };

  const openThread = (ticket: any) => {
    setSelectedTicket(ticket);
    loadMessages(ticket.notification_id);
  };

  const handleReply = async () => {
    if (!replyText.trim() || isSending || !selectedTicket) return;
    try {
      setIsSending(true);
      await apiService.replyToSupportTicket(selectedTicket.notification_id, replyText);
      setReplyText("");
      await loadMessages(selectedTicket.notification_id);
      showToast('success', 'Reply sent successfully');
    } catch (err) {
      showToast('error', 'Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await apiService.submitSupportTicket({
        subject: ticketSubject,
        message: ticketMessage
      });
      showToast('success', 'Message sent successfully. Our support team will respond to you shortly.');
      setTicketSubject('');
      setTicketMessage('');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderMessageContent = (message: string) => {
    if (!message) return null;
    
    // Check for [IMAGE_URL: some_url]
    const imageMatch = message.match(/\[IMAGE_URL: (.*?)\]/);
    if (imageMatch) {
      const imageUrl = imageMatch[1];
      const textPart = message.replace(/\[IMAGE_URL: (.*?)\]/g, '').trim();
      
      return (
        <div className="space-y-3">
          {textPart && <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{textPart}</p>}
          <div className="relative group cursor-pointer" onClick={() => window.open(imageUrl, '_blank')}>
            <img 
              src={imageUrl} 
              alt="Attachment" 
              className="max-h-60 rounded-lg border-2 border-white/20 shadow-sm transition-all group-hover:scale-[1.02] active:scale-[0.98]" 
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
               <ICONS.Eye className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      );
    }

    return <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{message}</p>;
  };


  if (loading) return <PageLoader label="Loading support center..." />;

  // Check if user has priority support feature
  const hasPrioritySupport = Boolean(profile?.plan?.features?.priority_support) || Boolean(profile?.plan?.features?.enable_priority_support);
  
  // Hard block: Access restricted if feature not in plan
  if (!hasPrioritySupport) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-[#38BDF2]/10 rounded-xl flex items-center justify-center mb-10 text-[#38BDF2] shadow-xl shadow-[#38BDF2]/10 border border-[#38BDF2]/20">
          <ICONS.Lock className="w-10 h-10" strokeWidth={3} />
        </div>
        <h2 className="text-3xl font-black text-[#2E2E2F] mb-4 uppercase tracking-tighter">Support Restricted</h2>
        <p className="text-[#2E2E2F]/50 max-w-[360px] mx-auto mb-12 text-sm font-bold uppercase tracking-widest leading-relaxed">
          The Support Center is exclusive to organizations with Priority Support enabled in their current plan.
        </p>
        <div className="flex flex-col sm:flex-row gap-5">
          <button
            onClick={() => navigate('/subscription')}
            className="px-12 py-5 bg-[#38BDF2] text-white rounded-xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-[#38BDF2]/30 hover:scale-105 active:scale-95 transition-all"
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 space-y-6 max-w-7xl mx-auto">
      {/* Navigation Toggle */}
      <div className="flex items-center justify-end gap-3 mb-2">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 px-5 py-2.5 bg-transparent border border-[#2E2E2F]/5 rounded-xl text-[#2E2E2F]/50 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#2E2E2F]/5 transition-all"
        >
          {showHistory ? (
            <>
              <ICONS.ArrowLeft className="w-4 h-4" />
              New Inquiry
            </>
          ) : (
            <>
              <ICONS.History className="w-4 h-4" />
              View History
            </>
          )}
        </button>
      </div>

      <div className="bg-transparent border border-[#2E2E2F]/5 rounded-xl p-6 md:p-8 relative overflow-hidden group">
        <div className="flex flex-col gap-4 relative z-10">
          <div className="max-w-2xl">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest mb-4 flex-shrink-0 w-fit ${hasPrioritySupport ? 'bg-[#38BDF2]/10 border-[#38BDF2]/20 text-[#38BDF2]' : 'bg-[#2E2E2F]/5 border-[#2E2E2F]/10 text-[#2E2E2F]/60'}`}>
              {hasPrioritySupport ? 'Pro Support Active' : 'Standard Support'}
            </div>
            <h1 className="text-3xl md:text-[2rem] font-semibold text-[#2E2E2F] tracking-tight">
              {showHistory ? 'Support History' : 'Organizer Support'}
            </h1>
            <p className="mt-1 text-sm font-semibold text-[#2E2E2F]/65">
              {showHistory 
                ? 'Review your previous conversations and admin responses.'
                : hasPrioritySupport
                ? 'Welcome to the Priority Support Center. Your tickets bypass the standard queue for lightning-fast resolutions.'
                : 'Need assistance? Open a ticket to connect with our standard support staff.'}
            </p>
          </div>
        </div>
        <div className="absolute -right-20 -top-40 w-96 h-96 bg-[#38BDF2]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#38BDF2]/10 transition-all duration-700" />
      </div>

      {!showHistory ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {!profile?.plan ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-transparent rounded-xl border border-[#2E2E2F]/5 shadow-sm">
                <div className="w-16 h-16 bg-[#2E2E2F]/5 rounded-full flex items-center justify-center mb-6 text-[#2E2E2F]/20">
                  <ICONS.Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-[#2E2E2F] mb-3 uppercase tracking-tight">Support Restricted</h2>
                <p className="text-[#2E2E2F]/60 max-w-[280px] mx-auto mb-8 text-sm font-medium leading-relaxed">
                  Direct messaging services are available for organizations with an active subscription plan.
                </p>
                <button
                  onClick={() => navigate('/subscription')}
                  className="px-10 py-4 bg-[#2E2E2F] text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:-translate-y-1 transition-all"
                >
                  Explore Plans
                </button>
              </div>
            ) : (
              <Card className="bg-transparent border text-[#2E2E2F] border-[#2E2E2F]/5 rounded-xl p-6 md:p-8 shadow-sm transition-all hover:shadow-md">
                <h2 className="text-xl font-bold text-[#2E2E2F] mb-6">Submit a Request</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/70 mb-2 block ml-1">Subject</label>
                    <Input
                      value={ticketSubject}
                      onChange={(e) => setTicketSubject(e.target.value)}
                      placeholder="e.g. Issue with payout"
                      required
                      className="bg-transparent border-2 border-[#2E2E2F]/20 focus:border-[#38BDF2]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/70 mb-2 block ml-1">Message</label>
                    <textarea
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      placeholder="Describe your issue in detail..."
                      required
                      className="w-full bg-transparent text-[#2E2E2F] text-sm font-medium border-2 border-[#2E2E2F]/20 rounded-xl px-4 py-3 focus:outline-none focus:border-[#38BDF2] focus:ring-1 focus:ring-[#38BDF2] transition-colors resize-y min-h-[160px]"
                    />
                  </div>
                  <Button type="submit" disabled={submitting} className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${submitting ? 'opacity-70' : 'hover:-translate-y-0.5 shadow-sm'}`}>
                    {submitting ? 'Sending...' : 'Send Message'}
                  </Button>
                </form>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className={`border rounded-xl p-6 md:p-8 transition-all bg-transparent ${hasPrioritySupport ? 'border-[#38BDF2]/30 shadow-sm' : 'border-[#2E2E2F]/5'}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${hasPrioritySupport ? 'bg-[#38BDF2]/10 text-[#38BDF2]' : 'bg-transparent border border-[#2E2E2F]/10 text-[#2E2E2F]'}`}>
                {hasPrioritySupport ? <ICONS.Zap className="w-6 h-6" /> : <ICONS.MessageSquare className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-bold text-[#2E2E2F] tracking-tight mb-2">
                {hasPrioritySupport ? 'Priority Queue Active' : 'Help Center'}
              </h3>
              <p className="text-sm font-medium leading-relaxed text-[#2E2E2F]/70">
                {hasPrioritySupport
                  ? 'Because you are on a premium plan, your tickets automatically skip the line and are assigned to our specialists.'
                  : 'Need more features? Upgrade your plan to unlock priority support and get faster responses.'}
              </p>
            </Card>

            <Card className="bg-transparent border border-[#2E2E2F]/5 rounded-xl p-6 md:p-8 text-[#2E2E2F] relative overflow-hidden shadow-sm">
              <div className="relative z-10">
                <p className="text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/50 mb-4">Other Ways to Connect</p>
                <div className="space-y-4">
                  <a href="mailto:support@startuplab.ph" className="flex items-center gap-3 group">
                    <div className="w-9 h-9 rounded-xl bg-[#2E2E2F]/5 flex items-center justify-center group-hover:bg-[#38BDF2]/10 transition-all">
                      <ICONS.Mail className="w-4 h-4 text-[#2E2E2F] group-hover:text-[#38BDF2]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#2E2E2F]">Email Us</h4>
                      <p className="text-xs text-[#2E2E2F]/60">support@startuplab.ph</p>
                    </div>
                  </a>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40">
                {selectedRows.size > 0 ? `${selectedRows.size} selected` : `Total ${history.length} tickets`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handlePrintSupport} 
                className="w-10 h-10 flex items-center justify-center bg-[#38BDF2] border-2 border-[#38BDF2] rounded-full text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all shadow-md group"
                title={`Print ${selectedRows.size > 0 ? `Selected (${selectedRows.size})` : 'All'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              </button>
              <button 
                onClick={handleExportSupport} 
                className="w-10 h-10 flex items-center justify-center bg-[#38BDF2] border-2 border-[#38BDF2] rounded-full text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all shadow-md group"
                title={`Export ${selectedRows.size > 0 ? `Selected (${selectedRows.size})` : 'All'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </button>
              {selectedRows.size > 0 && (
                <button 
                  onClick={handleBulkArchive} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 border border-red-600 rounded-xl text-white hover:bg-red-700 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg animate-in fade-in slide-in-from-right-4 duration-300"
                >
                  <ICONS.Lock className="w-4 h-4" />
                  Archive ({selectedRows.size})
                </button>
              )}
            </div>
          </div>

          <div className="bg-transparent border border-[#2E2E2F]/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F2F2F2] border-b border-[#2E2E2F]/5">
                  <tr>
                    <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40 w-12">
                      <div className="flex justify-center">
                        <Checkbox 
                          checked={selectedRows.size === history.length && history.length > 0} 
                          onChange={toggleAll} 
                          size="sm"
                        />
                      </div>
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40">Subject</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40 text-right">Date Posted</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-[#2E2E2F]/5">
                {history.map((t) => (
                  <tr key={t.notification_id} className={`hover:bg-[#2E2E2F]/5 transition-colors cursor-pointer ${selectedRows.has(t.notification_id) ? 'bg-[#38BDF2]/10' : ''}`} onClick={() => openThread(t)}>
                    <td className="px-4 py-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center">
                        <Checkbox 
                          checked={selectedRows.has(t.notification_id)} 
                          onChange={() => toggleRow(t.notification_id)} 
                          size="sm"
                        />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-[#2E2E2F] flex items-center gap-2">
                           {t.is_read ? null : <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF2]"></span>}
                           {t.title}
                        </p>
                        <p className="text-xs text-[#2E2E2F]/40 truncate max-w-sm font-medium">{t.message}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${t.metadata?.status === 'resolved' ? 'bg-[#2E2E2F]/5 text-[#2E2E2F]/30' : 'bg-[#38BDF2]/10 text-[#38BDF2] border border-[#38BDF2]/20'}`}>
                        {t.metadata?.status || 'Open'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-[10px] font-black text-[#2E2E2F]">{new Date(t.created_at).toLocaleDateString()}</p>
                      <p className="text-[9px] font-bold text-[#2E2E2F]/20 uppercase tracking-tighter">{new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-6 transition-opacity animate-in fade-in duration-300" onClick={() => setSelectedTicket(null)}>
          <div className="relative w-full max-w-2xl max-h-full bg-[#F2F2F2] shadow-2xl rounded-xl border border-[#2E2E2F]/10 overflow-hidden flex flex-col h-[90vh]" onClick={e => e.stopPropagation()} style={{ zoom: 0.85 }}>
             {/* Header */}
             <div className="px-8 py-5 border-b border-[#2E2E2F]/5 flex items-center justify-between bg-transparent sticky top-0 z-10">
               <button onClick={() => setSelectedTicket(null)} className="p-3 hover:bg-[#2E2E2F]/5 rounded-full text-[#2E2E2F] transition-all">
                 <ICONS.ArrowLeft className="w-6 h-6" />
               </button>
               <div className="flex items-center gap-3">
                 <img 
                   src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg" 
                   alt="StartupLab" 
                   className="h-20 w-auto object-contain" 
                 />
               </div>
               <button 
                  onClick={() => selectedTicket && loadMessages(selectedTicket.notification_id)}
                  className="p-3 hover:bg-[#2E2E2F]/5 rounded-full text-[#2E2E2F]/40 transition-all hover:text-[#38BDF2]"
                  title="Refresh messages"
               >
                  <ICONS.RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-[#38BDF2]' : ''}`} />
               </button>
             </div>

             {/* Conversation Area */}
             <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar bg-transparent">
                {/* Inquiry */}
                <div className="flex flex-col gap-2 max-w-[85%] items-end ml-auto">
                   <div className="flex items-end gap-3 flex-row-reverse">
                      <div className="w-10 h-10 rounded-xl bg-transparent flex-shrink-0 flex items-center justify-center border border-[#2E2E2F]/5 shadow-sm overflow-hidden">
                         {profile?.profileImageUrl ? (
                           <img src={profile.profileImageUrl} alt="O" className="w-full h-full object-cover" />
                         ) : (
                           <ICONS.Users className="w-5 h-5 text-[#38BDF2]" />
                         )}
                      </div>
                      <div className="bg-[#38BDF2] px-4 py-3 rounded-xl rounded-br-none border-0 shadow-sm text-white">
                         <p className="text-sm font-bold mb-1.5">{selectedTicket.title}</p>
                         {renderMessageContent(selectedTicket.message)}
                      </div>
                   </div>
                   <p className="text-[10px] font-bold text-[#2E2E2F]/30 uppercase tracking-[0.2em] mr-14">
                      You • {new Date(selectedTicket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </p>
                </div>

                {/* Messages Thread */}
                <div className="space-y-10">
                  {(ticketMessages[selectedTicket.notification_id] || []).map((m) => (
                    <div key={m.message_id} className={`flex flex-col gap-2 max-w-[85%] ${m.is_admin_reply ? 'mr-auto items-start' : 'ml-auto items-end'}`}>
                      <div className={`flex items-end gap-3 ${m.is_admin_reply ? 'flex-row' : 'flex-row-reverse'}`}>
                         <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center border border-[#2E2E2F]/5 shadow-sm overflow-hidden bg-transparent">
                            {m.is_admin_reply ? (
                               <img src="/lgo.webp" alt="Bot" className="w-full h-full object-contain p-1.5" />
                            ) : (
                               profile?.profileImageUrl ? (
                                 <img src={profile.profileImageUrl} alt="O" className="w-full h-full object-cover" />
                               ) : (
                                 <ICONS.Users className="w-5 h-5 text-[#38BDF2]" />
                               )
                            )}
                         </div>
                         <div className={`px-4 py-3 rounded-xl shadow-sm ${
                           m.is_admin_reply 
                             ? 'bg-[#2E2E2F]/5 text-[#2E2E2F] rounded-bl-none border border-[#2E2E2F]/5' 
                             : 'bg-[#38BDF2] text-white rounded-br-none border-0'
                         }`}>
                            {renderMessageContent(m.message)}
                         </div>
                      </div>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] text-[#2E2E2F]/30 ${m.is_admin_reply ? 'ml-14' : 'mr-14'}`}>
                        {m.is_admin_reply ? 'Support Team' : 'You'} • {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
             </div>

             {/* Footer */}
             {!(selectedTicket.metadata?.status === 'resolved') ? (
               <div className="p-8 bg-transparent border-t border-[#2E2E2F]/5 sticky bottom-0">
                 <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Reply to support..."
                        className="w-full h-14 pl-6 pr-16 bg-[#F2F2F2]/50 border-2 border-[#2E2E2F]/20 rounded-full text-sm font-medium focus:border-[#38BDF2]/20 transition-all outline-none placeholder:text-[#2E2E2F]/20 text-[#2E2E2F]"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                         <button 
                            disabled={!replyText.trim() || isSending}
                            onClick={handleReply}
                            className="bg-transparent text-[#38BDF2] hover:scale-110 active:scale-95 transition-all disabled:opacity-20"
                         >
                            <ICONS.Send className="w-6 h-6" />
                         </button>
                      </div>
                    </div>
                 </div>
               </div>
             ) : (
               <div className="p-8 bg-transparent border-t border-[#2E2E2F]/5 text-center">
                 <p className="text-[11px] font-black text-[#2E2E2F]/20 uppercase tracking-[0.3em]">This ticket is marked as resolved</p>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

