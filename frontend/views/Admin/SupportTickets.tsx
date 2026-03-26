import React, { useState, useEffect } from 'react';
import { Card, PageLoader } from '../../components/Shared';
import { apiService } from '../../services/apiService';
import { ICONS } from '../../constants';
import { useToast } from '../../context/ToastContext';

export const SupportTickets: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminSmtp, setAdminSmtp] = useState<any>(null);
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
    if (selectedRows.size === tickets.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(tickets.map(t => t.notification_id)));
    }
  };

  const handlePrintTickets = () => {
    const selected = tickets.filter(t => selectedRows.has(t.notification_id));
    const printData = selected.length > 0 ? selected : tickets;
    const watermarkLogo = 'https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg';

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Support Tickets Report</title>
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
            width: 120%;
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
          .resolved { color: #10B981; border-color: #10B981; }
          .pending { color: #F59E0B; border-color: #F59E0B; }
        </style>
      </head>
      <body>
        <div class="watermark-container">
          <img src="${watermarkLogo}" class="watermark" />
        </div>
        <div class="header">
          <div>
            <h1>Organizer Support</h1>
            <p style="margin: 5px 0 0; font-size: 14px; font-weight: 600; color: #38BDF2;">Admin Control Panel Logs</p>
          </div>
          <div class="report-info">
            <img src="${watermarkLogo}" class="logo" /><br/>
            <span style="color: #666;">Ref: ADM-LOG-${Date.now().toString().slice(-6)}</span><br/>
            Date: ${new Date().toLocaleDateString()}<br/>
            Load: ${printData.length} Tickets
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Inquiry / Organizer</th>
              <th>Current Status</th>
              <th>Submission Date</th>
            </tr>
          </thead>
          <tbody>
            ${printData.map(t => `
              <tr>
                <td>
                  <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px; color: #000;">${t.title}</div>
                  <div style="font-size: 11px; color: #444; line-height: 1.4;">
                    <span style="font-weight: bold; color: #38BDF2;">${t.organizer?.organizerName || t.metadata?.orgName || t.actor?.name || 'Organizer'}</span>: 
                    ${t.message ? t.message.substring(0, 150) + (t.message.length > 150 ? '...' : '') : 'N/A'}
                  </div>
                </td>
                <td style="width: 120px; text-align: center;">
                  <span class="status ${t.metadata?.status === 'resolved' || t.is_read ? 'resolved' : 'pending'}">
                    ${t.metadata?.status === 'resolved' || t.is_read ? 'Resolved' : 'Pending'}
                  </span>
                </td>
                <td style="width: 120px; text-align: right; font-weight: 600;">${new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 60px; text-align: center; font-size: 11px; font-weight: bold; color: #2E2E2F; border-top: 2px solid #eee; padding-top: 20px; text-transform: uppercase; letter-spacing: 0.1em;">
          StartupLab Internal Support Management • Confidential Admin Record
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExportTickets = () => {
    const selected = tickets.filter(t => selectedRows.has(t.notification_id));
    const exportData = selected.length > 0 ? selected : tickets;
    const csvContent = `Organizer,Subject,Status,Date\n${exportData.map(t => `${t.organizer?.organizerName || t.metadata?.orgName || t.actor?.name || 'Organizer'},${t.title},${t.metadata?.status === 'resolved' ? 'Resolved' : 'Pending'},${new Date(t.created_at).toLocaleDateString()}`).join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `support_tickets_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadTickets();
    loadAdminSmtp();
  }, []);

  const loadAdminSmtp = async () => {
    try {
      const data = await apiService.getSmtpSettings();
      setAdminSmtp(data);
    } catch (err) {
      console.warn('Failed to load admin SMTP settings');
    }
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getAdminSupportTickets();
      setTickets(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (ticketId: string) => {
    try {
      await apiService.resolveSupportTicket(ticketId);
      setTickets(prev => 
        prev.map(t => 
          t.notification_id === ticketId 
            ? { ...t, is_read: true, metadata: { ...t.metadata, status: 'resolved' } } 
            : t
        )
      );
      showToast('success', 'Inquiry resolved successfully');
      if (selectedTicket?.notification_id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, is_read: true, metadata: { ...prev.metadata, status: 'resolved' } } : null);
      }
    } catch (err) {
      showToast('error', 'Failed to resolve ticket');
    }
  };

  const handleBulkResolve = async () => {
    if (selectedRows.size === 0) return;
    try {
      setRefreshing(true);
      const ids = Array.from(selectedRows);
      await Promise.all(ids.map(id => apiService.resolveSupportTicket(id)));
      
      setTickets(prev => 
        prev.map(t => 
          selectedRows.has(t.notification_id) 
            ? { ...t, is_read: true, metadata: { ...t.metadata, status: 'resolved' } } 
            : t
        )
      );
      
      showToast('success', `${selectedRows.size} inquiries resolved successfully`);
      setSelectedRows(new Set());
    } catch (err) {
      showToast('error', 'Failed to resolve some tickets');
    } finally {
      setRefreshing(false);
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

  if (loading) return <PageLoader label="Loading support messages..." />;

  const getStatusBadge = (ticket: any) => {
    const isResolved = ticket.metadata?.status === 'resolved' || ticket.is_read;
    if (isResolved) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2F2F2] text-[#2E2E2F]/50 text-xs font-bold border border-[#2E2E2F]/10">
          <ICONS.CheckCircle className="w-3.5 h-3.5" />
          Resolved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#38BDF2] text-white text-xs font-bold shadow-md">
        <ICONS.Clock className="w-3.5 h-3.5" />
        Open
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl pb-20 relative min-h-[600px]">
      <div className="flex justify-end items-center mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrintTickets} 
            className="w-10 h-10 flex items-center justify-center bg-[#38BDF2] border-2 border-[#38BDF2] rounded-full text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all shadow-md group"
            title={`Print ${selectedRows.size > 0 ? `Selected (${selectedRows.size})` : 'All'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          </button>
          <button 
            onClick={handleExportTickets} 
            className="w-10 h-10 flex items-center justify-center bg-[#38BDF2] border-2 border-[#38BDF2] rounded-full text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all shadow-md group"
            title={`Export ${selectedRows.size > 0 ? `Selected (${selectedRows.size})` : 'All'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </button>
          {selectedRows.size > 0 && (
            <button 
              onClick={handleBulkResolve} 
              disabled={tickets.filter(t => selectedRows.has(t.notification_id) && !(t.metadata?.status === 'resolved' || t.is_read)).length === 0}
              className={`flex items-center gap-2 px-6 py-2.5 border-2 rounded-full transition-all text-[11px] font-black uppercase tracking-widest shadow-lg animate-in fade-in slide-in-from-right-4 ${
                tickets.filter(t => selectedRows.has(t.notification_id) && !(t.metadata?.status === 'resolved' || t.is_read)).length === 0
                  ? 'bg-[#F2F2F2] border-[#2E2E2F]/10 text-[#2E2E2F]/20 cursor-not-allowed'
                  : 'bg-[#38BDF2] border-[#38BDF2] text-white hover:bg-[#0EA5E9]'
              }`}
            >
              <ICONS.CheckCircle className="w-4 h-4" />
              {tickets.filter(t => selectedRows.has(t.notification_id) && !(t.metadata?.status === 'resolved' || t.is_read)).length === 0
                ? "Zero Pending Selection"
                : `Mark Resolved (${tickets.filter(t => selectedRows.has(t.notification_id) && !(t.metadata?.status === 'resolved' || t.is_read)).length})`
              }
            </button>
          )}
          <button onClick={loadTickets} className="w-10 h-10 flex items-center justify-center bg-transparent border-2 border-[#2E2E2F]/10 rounded-full hover:bg-[#F2F2F2] transition-all group" title="Refresh">
            <ICONS.RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>
      </div>

      {error ? (
        <Card className="p-6 bg-red-50 text-red-700 border-red-200 font-bold border rounded-xl">
          {error}
        </Card>
      ) : tickets.length === 0 ? (
        <Card className="p-16 text-center border-2 border-dashed border-[#2E2E2F]/10 rounded-xl bg-transparent">
          <div className="w-20 h-20 mx-auto bg-[#F2F2F2] text-[#2E2E2F]/20 rounded-full flex items-center justify-center mb-6">
            <ICONS.MessageSquare className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold text-[#2E2E2F] mb-2">No Support Messages</h3>
          <p className="text-[#2E2E2F]/60 text-base font-medium">You are all caught up! No active messages from organizers.</p>
        </Card>
      ) : (
        <div className="border-2 border-[#2E2E2F]/5 rounded-xl overflow-hidden bg-transparent shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F2F2F2]/50 border-b-2 border-[#2E2E2F]/5">
              <tr>
                <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/60 w-12">
                  <input
                    type="checkbox"
                    checked={tickets.length > 0 && selectedRows.size === tickets.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-2 border-[#2E2E2F]/30 cursor-pointer accent-[#38BDF2]"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/60">Organizer</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/60">Subject</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/60">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/60 text-right">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/60 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#2E2E2F]/5">
              {tickets.map((t) => (
                <tr key={t.notification_id} className={`hover:bg-[#F2F2F2]/30 transition-colors ${selectedRows.has(t.notification_id) ? 'bg-[#38BDF2]/10' : ''} ${(t.metadata?.status === 'resolved' || t.is_read) ? 'opacity-60' : ''}`} onClick={() => openThread(t)}>
                  <td className="px-4 py-5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedRows.has(t.notification_id)}
                      onChange={() => toggleRow(t.notification_id)}
                      className="w-4 h-4 rounded border-2 border-[#2E2E2F]/30 cursor-pointer accent-[#38BDF2]"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#2E2E2F] text-white rounded-full flex items-center justify-center text-[11px] font-bold shadow-sm overflow-hidden border border-[#2E2E2F]/5">
                        {t.organizer?.profileImageUrl ? (
                           <img src={t.organizer.profileImageUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                           (t.organizer?.organizerName || t.metadata?.orgName || t.actor?.name || 'O').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#2E2E2F]">{t.organizer?.organizerName || t.metadata?.orgName || t.actor?.name || 'Organizer'}</p>
                        <p className="text-[10px] font-medium text-[#2E2E2F]/40">{t.actor?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-bold text-[#2E2E2F]">{t.title}</p>
                    <p className="text-xs text-[#2E2E2F]/60 truncate max-w-[250px]">
                      {t.message?.replace(/\[IMAGE_URL: (.*?)\]/g, ' [Image] ')}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    {getStatusBadge(t)}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-xs font-bold text-[#2E2E2F]/50">
                      {new Date(t.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] font-medium text-[#2E2E2F]/30 uppercase">
                      {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => openThread(t)}
                        className="p-2.5 bg-[#2E2E2F]/5 rounded-full text-[#2E2E2F] hover:bg-[#38BDF2] hover:text-white transition-all"
                        title="View Conversation"
                      >
                        <ICONS.MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[9999] flex items-center justify-center p-4 sm:p-6 transition-opacity animate-in fade-in duration-300" onClick={() => setSelectedTicket(null)}>
          <div className="relative w-full max-w-2xl max-h-full bg-[#F2F2F2] shadow-2xl rounded-xl border border-[#2E2E2F]/10 overflow-hidden flex flex-col h-[90vh]" onClick={e => e.stopPropagation()} style={{ zoom: 0.85 }}>
             {/* RiBOT Style Header */}
             <div className="px-8 py-5 border-b border-[#2E2E2F]/5 flex items-center justify-between bg-transparent sticky top-0 z-10 transition-colors">
               <button onClick={() => setSelectedTicket(null)} className="p-3 hover:bg-[#F2F2F2] rounded-full text-[#2E2E2F] transition-all">
                 <ICONS.ArrowLeft className="w-6 h-6" />
               </button>
               <div className="flex items-center gap-3">
                  <img 
                    src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg" 
                    alt="StartupLab" 
                    className="h-20 w-auto object-contain" 
                  />
               </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => loadMessages(selectedTicket.notification_id)}
                    className="p-3 hover:bg-[#F2F2F2] rounded-full text-[#2E2E2F]/40 transition-all hover:text-[#38BDF2]"
                    title="Refresh messages"
                  >
                    <ICONS.RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-[#38BDF2]' : ''}`} />
                  </button>
                </div>
             </div>

             {/* Conversation Area */}
             <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar bg-transparent">
                {/* Inquiry */}
                <div className="flex flex-col gap-2 max-w-[85%] items-start">
                   <div className="flex items-end gap-3">
                      <div className="w-10 h-10 rounded-xl bg-transparent flex-shrink-0 flex items-center justify-center border border-[#2E2E2F]/5 shadow-sm overflow-hidden">
                         {selectedTicket.organizer?.profileImageUrl ? (
                           <img src={selectedTicket.organizer.profileImageUrl} alt="O" className="w-full h-full object-cover" />
                         ) : (
                           <ICONS.MessageSquare className="w-5 h-5 text-[#38BDF2]" />
                         )}
                      </div>
                      <div className="bg-[#2E2E2F]/5 px-4 py-3 rounded-xl rounded-bl-none border border-[#2E2E2F]/5 shadow-sm">
                         <p className="text-sm font-bold text-[#2E2E2F] mb-1.5">{selectedTicket.title}</p>
                         {renderMessageContent(selectedTicket.message)}
                      </div>
                   </div>
                   <p className="text-[10px] font-bold text-[#2E2E2F]/30 uppercase tracking-[0.2em] ml-14">
                     {selectedTicket.organizer?.organizerName || selectedTicket.metadata?.orgName || 'Organizer'} • {new Date(selectedTicket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </p>
                </div>

                {/* Messages Thread */}
                <div className="space-y-10">
                  {(ticketMessages[selectedTicket.notification_id] || []).map((m) => (
                    <div key={m.message_id} className={`flex flex-col gap-2 max-w-[85%] ${m.is_admin_reply ? 'ml-auto items-end' : 'items-start'}`}>
                      <div className={`flex items-end gap-3 ${m.is_admin_reply ? 'flex-row-reverse' : 'flex-row'}`}>
                         <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center border border-[#2E2E2F]/5 shadow-sm overflow-hidden ${m.is_admin_reply ? 'bg-transparent' : 'bg-transparent'}`}>
                            {m.is_admin_reply ? (
                              <img src="/lgo.webp" alt="Bot" className="w-full h-full object-contain p-1.5" />
                            ) : (
                              selectedTicket.organizer?.profileImageUrl ? (
                                <img src={selectedTicket.organizer.profileImageUrl} alt="O" className="w-full h-full object-cover" />
                              ) : (
                                <ICONS.MessageSquare className="w-5 h-5 text-[#38BDF2]" />
                              )
                            )}
                         </div>
                         <div className={`px-4 py-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${
                           m.is_admin_reply 
                             ? 'bg-[#38BDF2] text-white rounded-br-none border-0' 
                             : 'bg-[#2E2E2F]/5 text-[#2E2E2F] rounded-bl-none border border-[#2E2E2F]/5'
                         }`}>
                           {renderMessageContent(m.message)}
                         </div>
                      </div>
                      <p className={`text-[10px] font-bold uppercase tracking-[0.2em] text-[#2E2E2F]/30 ${m.is_admin_reply ? 'mr-14' : 'ml-14'}`}>
                        {m.is_admin_reply ? 'StartupBot' : (selectedTicket.organizer?.organizerName || 'Organizer')} • {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
             </div>

             {/* Footer styled like the reference */}
             {!(selectedTicket.metadata?.status === 'resolved' || selectedTicket.is_read) ? (
               <div className="p-8 bg-transparent border-t border-[#2E2E2F]/5 sticky bottom-0">
                 <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Enter your message here..."
                        className="w-full h-14 pl-6 pr-32 bg-[#F2F2F2]/50 border-2 border-[#2E2E2F]/20 rounded-full text-sm font-medium focus:border-[#38BDF2]/20 transition-all outline-none placeholder:text-[#2E2E2F]/20 text-[#2E2E2F]"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
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
                 <div className="mt-4 flex justify-center">
                    <button 
                       onClick={() => handleResolve(selectedTicket.notification_id)}
                       className="text-[10px] font-black uppercase tracking-[0.3em] text-[#2E2E2F]/20 hover:text-[#2E2E2F]/40 transition-all px-6 py-2"
                    >
                       Mark conversation as resolved
                    </button>
                 </div>
               </div>
             ) : (
               <div className="p-8 bg-[#F2F2F2]/50 border-t border-[#2E2E2F]/5 text-center">
                 <p className="text-[11px] font-black text-[#2E2E2F]/20 uppercase tracking-[0.3em]">Conversation Concluded</p>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

