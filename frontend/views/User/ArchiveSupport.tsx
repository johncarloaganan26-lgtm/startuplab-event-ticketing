import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, PageLoader } from '../../components/Shared';
import { apiService } from '../../services/apiService';
import { ICONS } from '../../constants';
import { useToast } from '../../context/ToastContext';

export const ArchiveSupport: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [archivedTickets, setArchivedTickets] = useState<any[]>([]);
    const { showToast } = useToast();

    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [ticketMessages, setTicketMessages] = useState<Record<string, any[]>>({});
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadArchived();
    }, []);

    const loadArchived = async () => {
        try {
            setLoading(true);
            const data = await apiService.getArchivedSupportTickets();
            setArchivedTickets(data || []);
        } catch (err) {
            console.error('Failed to load archived tickets', err);
            showToast('error', 'Failed to load archived tickets');
        } finally {
            setLoading(false);
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
            setTimeout(() => setRefreshing(false), 500);
        }
    };

    const openThread = (ticket: any) => {
        setSelectedTicket(ticket);
        loadMessages(ticket.notification_id);
    };

    if (loading) return <PageLoader label="Loading archived support..." />;

    return (
        <div className="pb-16 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between gap-3 mb-2">
                <button 
                    onClick={() => navigate('/organizer-support')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-transparent border border-[#2E2E2F]/5 rounded-xl text-[#2E2E2F]/50 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#2E2E2F]/5 transition-all"
                >
                    <ICONS.ArrowLeft className="w-4 h-4" />
                    Back to Support
                </button>
            </div>

            <div className="bg-transparent border border-[#2E2E2F]/5 rounded-xl p-6 md:p-8 relative overflow-hidden group">
                <div className="flex flex-col gap-4 relative z-10">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#38BDF2]/20 bg-[#38BDF2]/10 text-[#38BDF2] text-[10px] font-bold uppercase tracking-widest mb-4 flex-shrink-0 w-fit">
                            Support History
                        </div>
                        <h1 className="text-3xl md:text-[2rem] font-semibold text-[#2E2E2F] tracking-tight">
                            Archived Inquiries
                        </h1>
                        <p className="mt-1 text-sm font-semibold text-[#2E2E2F]/65">
                            Review your completed or archived support tickets and their resolutions.
                        </p>
                    </div>
                </div>
                <div className="absolute -right-20 -top-40 w-96 h-96 bg-[#38BDF2]/5 rounded-full blur-3xl pointer-events-none group-hover:bg-[#38BDF2]/10 transition-all duration-700" />
            </div>

            <div className="bg-transparent border border-[#2E2E2F]/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#2E2E2F]/5 border-b border-[#2E2E2F]/5">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40">Subject</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40">Status</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/40 text-right">Date Archived</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2E2E2F]/5">
                            {archivedTickets.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-8 py-20 text-center">
                                        <p className="text-sm font-bold text-[#2E2E2F]/30 uppercase tracking-widest">No archived tickets found</p>
                                    </td>
                                </tr>
                            ) : (
                                archivedTickets.map((t) => (
                                    <tr key={t.notification_id} className="hover:bg-[#2E2E2F]/5 transition-colors cursor-pointer" onClick={() => openThread(t)}>
                                        <td className="px-8 py-6">
                                            <p className="text-sm font-bold text-[#2E2E2F]">{t.title}</p>
                                            <p className="text-xs text-[#2E2E2F]/40 truncate max-w-md">{t.message}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-[#2E2E2F]/5 text-[#2E2E2F]/30">
                                                Archived
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <p className="text-[10px] font-black text-[#2E2E2F]">{new Date(t.created_at).toLocaleDateString()}</p>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
                                    <div className="w-10 h-10 rounded-xl bg-transparent flex-shrink-0 flex items-center justify-center border border-[#2E2E2F]/5 shadow-sm overflow-hidden text-[#38BDF2]">
                                        <ICONS.Users className="w-5 h-5" />
                                    </div>
                                    <div className="bg-[#38BDF2] px-4 py-3 rounded-xl rounded-br-none border-0 shadow-sm text-white">
                                        <p className="text-sm font-bold mb-1.5">{selectedTicket.title}</p>
                                        <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">
                                            {selectedTicket.message}
                                        </p>
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
                                                    <ICONS.Users className="w-5 h-5 text-[#38BDF2]" />
                                                )}
                                            </div>
                                            <div className={`px-4 py-3 rounded-xl shadow-sm ${
                                                m.is_admin_reply 
                                                    ? 'bg-[#2E2E2F]/5 text-[#2E2E2F] rounded-bl-none border border-[#2E2E2F]/5' 
                                                    : 'bg-[#38BDF2] text-white rounded-br-none border-0'
                                            }`}>
                                                <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{m.message}</p>
                                            </div>
                                        </div>
                                        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] text-[#2E2E2F]/30 ${m.is_admin_reply ? 'ml-14' : 'mr-14'}`}>
                                            {m.is_admin_reply ? 'Support Team' : 'You'} • {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer (Read Only) */}
                        <div className="p-8 bg-transparent border-t border-[#2E2E2F]/5 text-center">
                            <p className="text-[11px] font-black text-[#2E2E2F]/20 uppercase tracking-[0.3em]">This ticket is archived and read-only</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
