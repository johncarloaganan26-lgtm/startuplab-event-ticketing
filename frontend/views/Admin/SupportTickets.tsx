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
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center text-[#2E2E2F]">
            <ICONS.MessageSquare className="w-6 h-6 mr-3 text-[#2E2E2F]" />
            Organizer Support Messages
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-[#2E2E2F]/60 font-medium">
              Manage inquiries and direct messages sent by event organizers.
            </p>
          </div>
        </div>
        <button onClick={loadTickets} className="text-xs font-bold uppercase tracking-widest px-4 py-2 bg-transparent border-2 border-[#2E2E2F]/10 rounded-xl hover:bg-[#F2F2F2] transition-all flex items-center gap-2 group">
          <ICONS.RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          Refresh
        </button>
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
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/60">Organizer</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/60">Subject</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/60">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/60 text-right">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-[#2E2E2F]/60 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#2E2E2F]/5">
              {tickets.map((t) => (
                <tr key={t.notification_id} className={`hover:bg-[#F2F2F2]/30 transition-colors cursor-pointer ${(t.metadata?.status === 'resolved' || t.is_read) ? 'opacity-60' : ''}`} onClick={() => openThread(t)}>
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
                    <p className="text-xs text-[#2E2E2F]/60 truncate max-w-[200px]">{t.message}</p>
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
                        className="p-2 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl text-[#2E2E2F] hover:bg-[#38BDF2] hover:text-white transition-all shadow-sm"
                      >
                        <ICONS.MessageSquare className="w-4 h-4" />
                      </button>
                      <a 
                        href={`mailto:${t.actor?.email}?subject=Re: ${t.title}${adminSmtp?.fromAddress ? `&bcc=${adminSmtp.fromAddress}` : ''}`}
                        title="Reply via Email"
                        className="p-2 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl text-[#2E2E2F] hover:bg-[#38BDF2] hover:text-white transition-all shadow-sm"
                      >
                        <ICONS.Mail className="w-4 h-4" />
                      </a>
                      {!(t.metadata?.status === 'resolved' || t.is_read) && (
                        <button 
                          onClick={() => handleResolve(t.notification_id)}
                          title="Mark as Resolved"
                          className="p-2 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl text-[#2E2E2F] hover:bg-[#2E2E2F] hover:text-white transition-all shadow-sm"
                        >
                          <ICONS.CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTicket && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] transition-opacity animate-in fade-in duration-300" onClick={() => setSelectedTicket(null)} />
          
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-[#F2F2F2]/95 backdrop-blur-xl shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] z-[101] rounded-xl border border-[#2E2E2F]/5 overflow-hidden flex flex-col animate-in zoom-in-95 duration-400 ease-out h-[90vh]">
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
                      <div className="bg-[#2E2E2F]/5 p-6 rounded-xl rounded-bl-none border border-[#2E2E2F]/5 shadow-sm">
                         <p className="text-sm font-bold text-[#2E2E2F] mb-1.5">{selectedTicket.title}</p>
                         <p className="text-sm font-medium text-[#2E2E2F]/60 whitespace-pre-wrap leading-relaxed">
                           {selectedTicket.message}
                         </p>
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
                         <div className={`p-6 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${
                           m.is_admin_reply 
                             ? 'bg-[#38BDF2] text-white rounded-br-none border-0' 
                             : 'bg-[#2E2E2F]/5 text-[#2E2E2F] rounded-bl-none border border-[#2E2E2F]/5'
                         }`}>
                            <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{m.message}</p>
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
        </>
      )}
    </div>
  );
};

