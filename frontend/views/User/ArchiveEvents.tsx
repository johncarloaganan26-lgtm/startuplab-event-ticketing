import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Input, Checkbox, Modal } from '../../components/Shared';
import { apiService } from '../../services/apiService';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { ICONS } from '../../constants';

interface ArchivedEvent {
  eventId: string;
  eventName: string;
  slug: string;
  description: string;
  startAt: string;
  endAt: string;
  locationText: string;
  locationType: string;
  status: string;
  imageUrl: string;
  organizerId: string;
  deleted_at: string;
  archived_by_name?: string;
}

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};


export const ArchiveEvents: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [events, setEvents] = useState<ArchivedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<ArchivedEvent | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'transactions' | 'support'>('events');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [transactionToDelete, setTransactionToDelete] = useState<any | null>(null);
  const [supportTicketToDelete, setSupportTicketToDelete] = useState<any | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Record<string, any[]>>({});
  const [refreshing, setRefreshing] = useState(false);

  const toggleRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (activeTab === 'events') {
      if (selectedRows.size === events.length) setSelectedRows(new Set());
      else setSelectedRows(new Set(events.map(e => e.eventId)));
    } else if (activeTab === 'transactions') {
      if (selectedRows.size === transactions.length) setSelectedRows(new Set());
      else setSelectedRows(new Set(transactions.map(t => t.orderId)));
    } else {
      if (selectedRows.size === supportTickets.length) setSelectedRows(new Set());
      else setSelectedRows(new Set(supportTickets.map(s => s.notification_id)));
    }
  };

  const handlePrint = () => {
    if (activeTab === 'support') {
      const selected = supportTickets.filter(t => selectedRows.has(t.notification_id));
      const printData = selected.length > 0 ? selected : supportTickets;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Archived Support History</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
          </style></head><body>
          <h1>Archived Support History</h1>
          <table>
            <thead><tr><th>Subject</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              ${printData.map(t => `<tr><td>${t.title || ''}</td><td>Archived</td><td>${new Date(t.created_at).toLocaleDateString()}</td></tr>`).join('')}
            </tbody>
          </table></body></html>`);
        printWindow.document.close();
        printWindow.print();
      }
      return;
    }
    const selectedData = events.filter(e => selectedRows.has(e.eventId));
    const printContent = selectedData.length > 0 ? selectedData : events;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>Archived Events Export</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
        </style></head><body>
        <h1>Archived Events Export</h1>
        <table>
          <thead><tr><th>Event</th><th>Original Date</th><th>Archived Date</th><th>Location</th></tr></thead>
          <tbody>
            ${printContent.map(e => `<tr><td>${e.eventName || ''}</td><td>${formatDate(e.startAt) || ''}</td><td>${formatDate(e.deleted_at) || ''}</td><td>${e.locationType || ''}</td></tr>`).join('')}
          </tbody>
        </table></body></html>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExport = () => {
    if (activeTab === 'support') {
      const selected = supportTickets.filter(t => selectedRows.has(t.notification_id));
      const exportData = selected.length > 0 ? selected : supportTickets;
      const csvContent = `Subject,Status,Date\n${exportData.map(t => `${t.title || ''},Archived,${new Date(t.created_at).toLocaleDateString()}`).join('\n')}`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `archived_support_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      return;
    }
    const selectedData = events.filter(e => selectedRows.has(e.eventId));
    const exportData = selectedData.length > 0 ? selectedData : events;
    const csvContent = `Event Name,Original Date,Archived Date,Location\n${exportData.map(e => `${e.eventName || ''},${formatDate(e.startAt)},${formatDate(e.deleted_at)},${e.locationType || ''}`).join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archived_events_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (activeTab === 'events') loadArchivedEvents();
    else if (activeTab === 'transactions') loadArchivedTransactions();
    else loadArchivedSupport();
    setSelectedRows(new Set());
  }, [activeTab]);

  const loadArchivedTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getArchivedTransactions();
      setTransactions(data.transactions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load archived transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadArchivedEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getArchivedEvents();
      setEvents(data.events || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load archived events');
    } finally {
      setLoading(false);
    }
  };

  const loadArchivedSupport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getArchivedSupportTickets();
      setSupportTickets(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load archived support tickets');
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

  const handleRestore = async (id: string) => {
    try {
      setActionLoading(id);
      if (activeTab === 'events') {
        await apiService.restoreEvent(id);
        setEvents(events.filter(e => e.eventId !== id));
      } else if (activeTab === 'transactions') {
        await apiService.restoreTransaction(id);
        setTransactions(transactions.filter(t => t.orderId !== id));
      } else {
        await apiService.bulkRestoreSupportTickets([id]);
        setSupportTickets(supportTickets.filter(s => s.notification_id !== id));
      }
      showToast('success', `${activeTab === 'events' ? 'Event' : activeTab === 'transactions' ? 'Transaction' : 'Support ticket'} restored successfully!`);
      setSelectedRows(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      showToast('error', err.message || 'Failed to restore');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!eventToDelete && !transactionToDelete && !supportTicketToDelete && !bulkDeleteConfirm) return;
    
    if (bulkDeleteConfirm) {
      setIsBulkActionLoading(true);
      try {
        const ids = Array.from(selectedRows);
        if (activeTab === 'events') {
          await Promise.all(ids.map(id => apiService.deleteEvent(id)));
          setEvents(events.filter(e => !selectedRows.has(e.eventId)));
        } else if (activeTab === 'transactions') {
          await Promise.all(ids.map(id => apiService.deleteTransaction(id)));
          setTransactions(transactions.filter(t => !selectedRows.has(t.orderId)));
        } else {
          await apiService.bulkDeleteSupportTickets(ids);
          setSupportTickets(supportTickets.filter(s => !selectedRows.has(s.notification_id)));
        }
        showToast('success', `Successfully deleted ${selectedRows.size} ${activeTab} forever!`);
        setSelectedRows(new Set());
        setBulkDeleteConfirm(false);
      } catch (err: any) {
        showToast('error', err.message || 'Failed to bulk delete');
      } finally {
        setIsBulkActionLoading(false);
      }
      return;
    }

    const idToDelete = activeTab === 'events' ? eventToDelete!.eventId : (activeTab === 'transactions' ? transactionToDelete!.orderId : supportTicketToDelete!.notification_id);
    try {
      setActionLoading(idToDelete);
      if (activeTab === 'events') {
        await apiService.deleteEvent(idToDelete);
        setEvents(events.filter(e => e.eventId !== idToDelete));
      } else if (activeTab === 'transactions') {
        await apiService.deleteTransaction(idToDelete);
        setTransactions(transactions.filter(t => t.orderId !== idToDelete));
      } else {
        await apiService.bulkDeleteSupportTickets([idToDelete]);
        setSupportTickets(supportTickets.filter(s => s.notification_id !== idToDelete));
      }
      showToast('success', `${activeTab === 'events' ? 'Event' : (activeTab === 'transactions' ? 'Transaction' : 'Support ticket')} permanently deleted!`);
      setDeleteModalOpen(false);
      setEventToDelete(null);
      setTransactionToDelete(null);
      setSupportTicketToDelete(null);
      setSelectedRows(prev => {
        const next = new Set(prev);
        next.delete(idToDelete);
        return next;
      });
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkRestore = async () => {
    if (!selectedRows.size) return;
    setIsBulkActionLoading(true);
    try {
      const ids = Array.from(selectedRows);
      if (activeTab === 'events') {
        await Promise.all(ids.map(id => apiService.restoreEvent(id)));
        setEvents(events.filter(e => !selectedRows.has(e.eventId)));
      } else if (activeTab === 'transactions') {
        await Promise.all(ids.map(id => apiService.restoreTransaction(id)));
        setTransactions(transactions.filter(t => !selectedRows.has(t.orderId)));
      } else {
        await apiService.bulkRestoreSupportTickets(ids);
        setSupportTickets(supportTickets.filter(s => !selectedRows.has(s.notification_id)));
      }
      showToast('success', `Successfully restored ${selectedRows.size} ${activeTab === 'support' ? 'support tickets' : activeTab}!`);
      setSelectedRows(new Set());
    } catch (err: any) {
      showToast('error', err.message || 'Failed to bulk restore');
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const openDeleteModal = (event: ArchivedEvent) => {
    setEventToDelete(event);
    setDeleteModalOpen(true);
  };

  const getImageUrl = (img: any): string => {
    if (!img) return 'https://via.placeholder.com/800x400?text=No+Image';
    if (typeof img === 'string') return img;
    return img.url || img.path || img.publicUrl || 'https://via.placeholder.com/800x400?text=No+Image';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#38BDF2] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-[#2E2E2F]/60">Loading archive...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 space-y-6">
      {/* Page Header */}
      <div className="px-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-[2rem] font-semibold text-[#2E2E2F] tracking-tight">Archive</h1>
          <p className="mt-1 text-sm font-semibold text-[#2E2E2F]/65">
            Manage your deleted {activeTab === 'support' ? 'Support Tickets' : (activeTab === 'transactions' ? 'Transaction Reports' : 'Events')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2E2E2F]/10 px-2 pb-px">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'events' ? 'text-[#38BDF2]' : 'text-[#2E2E2F]/40 hover:text-[#2E2E2F]/70'}`}
        >
          Events
          {activeTab === 'events' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38BDF2] rounded-full" />}
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'transactions' ? 'text-[#38BDF2]' : 'text-[#2E2E2F]/40 hover:text-[#2E2E2F]/70'}`}
        >
          Transaction Reports
          {activeTab === 'transactions' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38BDF2] rounded-full" />}
        </button>
        <button
          onClick={() => setActiveTab('support')}
          className={`px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'support' ? 'text-[#38BDF2]' : 'text-[#2E2E2F]/40 hover:text-[#2E2E2F]/70'}`}
        >
          Support Tickets
          {activeTab === 'support' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38BDF2] rounded-full" />}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="p-4 rounded-xl border-red-200 bg-red-50">
          <p className="text-red-600 font-semibold text-sm">{error}</p>
        </Card>
      )}

      {/* Empty State */}
      {(activeTab === 'events' ? events.length === 0 : activeTab === 'transactions' ? transactions.length === 0 : supportTickets.length === 0) ? (
        <Card className="p-12 rounded-xl border-[#2E2E2F]/10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F2F2F2] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#2E2E2F]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <h3 className="text-xl font-black text-[#2E2E2F]">No Archived {activeTab === 'events' ? 'Events' : activeTab === 'transactions' ? 'Reports' : 'Support Tickets'}</h3>
          <p className="text-[#2E2E2F]/60 mt-2">{activeTab === 'events' ? 'Events' : activeTab === 'transactions' ? 'Transactions' : 'Support tickets'} you archive will appear here</p>
          <Button 
            onClick={() => navigate(activeTab === 'events' ? '/my-events' : activeTab === 'transactions' ? '/user/reports' : '/organizer-support')}
            className="mt-6 px-6 py-3 rounded-xl font-black text-[10px]"
          >
            Go to {activeTab === 'events' ? 'My Events' : activeTab === 'transactions' ? 'Reports' : 'Support'}
          </Button>
        </Card>
      ) : (
        /* Table View */
        <Card className="overflow-hidden rounded-xl border-[#2E2E2F]/10">
          <div className="flex justify-between items-center px-6 py-4 border-b border-[#2E2E2F]/10">
            <div className="text-sm font-semibold text-[#2E2E2F]">
              {selectedRows.size > 0 ? `${selectedRows.size} selected` : `${activeTab === 'events' ? events.length : activeTab === 'transactions' ? transactions.length : supportTickets.length} entries`}
            </div>
            <div className="flex items-center gap-3">
              {selectedRows.size > 0 && (
                <div className="flex items-center gap-2 mr-4 border-r border-[#2E2E2F]/15 pr-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <button 
                    onClick={handleBulkRestore}
                    disabled={isBulkActionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white border-2 border-green-500 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all shadow-sm disabled:opacity-50 h-[32px]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Restore
                  </button>
<button 
  onClick={() => setBulkDeleteConfirm(true)}
  disabled={isBulkActionLoading}
  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white border-2 border-red-500 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all shadow-sm disabled:opacity-50 h-[32px]"
>
  <ICONS.Trash className="w-3.5 h-3.5" />
  Delete
</button>
                </div>
              )}
              {activeTab === 'support' && (
                <>
                  <button 
                      onClick={handlePrint} 
                      className="w-10 h-10 flex items-center justify-center bg-[#38BDF2] border-2 border-[#38BDF2] rounded-full text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all shadow-md"
                      title="Print Report"
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  </button>
                  <button 
                      onClick={handleExport} 
                      className="w-10 h-10 flex items-center justify-center bg-[#38BDF2] border-2 border-[#38BDF2] rounded-full text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all shadow-md"
                      title="Export CSV"
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </button>
                </>
              )}
              {activeTab === 'events' && (
                <>
                  <button 
                      onClick={handlePrint} 
                      className="w-10 h-10 flex items-center justify-center bg-[#38BDF2] border-2 border-[#38BDF2] rounded-full text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all shadow-md"
                      title="Print Report"
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  </button>
                  <button 
                      onClick={handleExport} 
                      className="w-10 h-10 flex items-center justify-center bg-[#38BDF2] border-2 border-[#38BDF2] rounded-full text-white hover:bg-[#2E2E2F] hover:border-[#2E2E2F] transition-all shadow-md"
                      title="Export CSV"
                  >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            {activeTab === 'events' ? (
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F2F2F2] border-b border-[#2E2E2F]/10">
                    <th className="text-left p-4 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest w-12 text-center align-middle">
                      <div className="flex justify-center">
                        <Checkbox checked={selectedRows.size === events.length && events.length > 0} onChange={toggleAll} />
                      </div>
                    </th>
                    <th className="text-left p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Event</th>
                    <th className="text-left p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Original Date</th>
                    <th className="text-left p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Archived Date</th>
                    <th className="text-left p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Location</th>
                    <th className="text-center p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.eventId} className="border-b border-[#2E2E2F]/5 hover:bg-[#38BDF2]/5 transition-colors">
                      <td className="p-4 align-middle">
                        <div className="flex justify-center">
                          <Checkbox checked={selectedRows.has(event.eventId)} onChange={() => toggleRow(event.eventId)} />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[#2E2E2F]/20">
                            <img src={getImageUrl(event.imageUrl)} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="font-bold text-[#2E2E2F] text-[13px]">{event.eventName}</p>
                            <p className="text-[12px] text-[#2E2E2F]/50">ID: {event.eventId.split('-')[0]}</p>
                          </div>
                         </div>
                      </td>
                      <td className="p-4 text-[12px] text-[#2E2E2F]/70">{event.startAt ? formatDate(event.startAt) : '-'}</td>
                      <td className="p-4 text-[12px] text-[#2E2E2F]/70">{event.deleted_at ? formatDate(event.deleted_at) : '-'}</td>
                      <td className="p-4 text-[12px] text-[#2E2E2F]/60 truncate max-w-[200px]">{event.locationText || '-'}</td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button onClick={() => handleRestore(event.eventId)} disabled={!!actionLoading} className="p-2 text-green-500 hover:scale-110 transition-all disabled:opacity-50" title="Restore"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                          <button onClick={() => openDeleteModal(event)} disabled={!!actionLoading} className="p-2 text-[#2E2E2F] hover:text-red-500 transition-colors disabled:opacity-50" title="Delete Permanently"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeTab === 'transactions' ? (
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F2F2F2] border-b border-[#2E2E2F]/10">
                    <th className="text-left p-4 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest w-12 text-center align-middle">
                      <div className="flex justify-center">
                        <Checkbox checked={selectedRows.size === transactions.length && transactions.length > 0} onChange={toggleAll} />
                      </div>
                    </th>
                    <th className="text-left p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Transaction / Report</th>
                    <th className="text-left p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Event</th>
                    <th className="text-left p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Amount</th>
                    <th className="text-left p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Archived Date</th>
                    <th className="text-center p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.orderId} className="border-b border-[#2E2E2F]/5 hover:bg-[#38BDF2]/5 transition-colors">
                      <td className="p-4 align-middle">
                        <div className="flex justify-center">
                          <Checkbox checked={selectedRows.has(t.orderId)} onChange={() => toggleRow(t.orderId)} />
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-[#2E2E2F] text-[13px]">{t.customerName}</p>
                        <p className="text-[11px] text-[#2E2E2F]/50 font-mono tracking-tighter">{t.orderId}</p>
                      </td>
                      <td className="p-4 text-[12px] text-[#2E2E2F]/70">{t.eventName}</td>
                      <td className="p-4 text-[12px] font-black text-[#2E2E2F]">{t.currency} {t.amount?.toFixed(2)}</td>
                      <td className="p-4 text-[12px] text-[#2E2E2F]/70">{t.archivedAt ? formatDate(t.archivedAt) : '-'}</td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button onClick={() => handleRestore(t.orderId)} disabled={!!actionLoading} className="p-2 text-green-500 hover:scale-110 transition-all disabled:opacity-50" title="Restore"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                          <button onClick={() => { setTransactionToDelete(t); setDeleteModalOpen(true); }} disabled={!!actionLoading} className="p-2 text-[#2E2E2F] hover:text-red-500 transition-colors disabled:opacity-50" title="Delete Permanently"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F2F2F2] border-b border-[#2E2E2F]/10">
                      <th className="text-left p-4 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest w-12 text-center align-middle">
                        <div className="flex justify-center">
                          <Checkbox checked={selectedRows.size === supportTickets.length && supportTickets.length > 0} onChange={toggleAll} />
                        </div>
                      </th>
                      <th className="text-left p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Subject</th>
                      <th className="text-left p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Status</th>
                      <th className="text-left p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Archived Date</th>
                      <th className="text-center p-4 text-[12px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supportTickets.map((t) => (
                      <tr key={t.notification_id} className="border-b border-[#2E2E2F]/5 hover:bg-[#38BDF2]/5 transition-colors cursor-pointer" onClick={() => openThread(t)}>
                        <td className="p-4 align-middle" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center">
                            <Checkbox checked={selectedRows.has(t.notification_id)} onChange={() => toggleRow(t.notification_id)} />
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-[#2E2E2F] text-[13px]">{t.title}</p>
                          <p className="text-[11px] text-[#2E2E2F]/50 truncate max-w-sm">{t.message}</p>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-[#2E2E2F]/5 text-[#2E2E2F]/30">
                            Archived
                          </span>
                        </td>
                        <td className="p-4 text-[12px] text-[#2E2E2F]/70">{new Date(t.created_at).toLocaleDateString()}</td>
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center items-center gap-2">
                            <button onClick={() => handleRestore(t.notification_id)} disabled={!!actionLoading} className="p-2 text-green-500 hover:scale-110 transition-all disabled:opacity-50" title="Restore"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                            <button onClick={() => { setSupportTicketToDelete(t); setDeleteModalOpen(true); }} disabled={!!actionLoading} className="p-2 text-[#2E2E2F] hover:text-red-500 transition-colors disabled:opacity-50" title="Delete Permanently"><ICONS.Trash className="w-5 h-5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            )}
          </div>
        </Card>
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

      {/* Permanent Delete Confirmation Modal */}
      <Modal 
        isOpen={deleteModalOpen || bulkDeleteConfirm} 
        onClose={() => { setDeleteModalOpen(false); setBulkDeleteConfirm(false); setEventToDelete(null); }}
        title="Permanently Delete?"
        showClose={true}
      >
        <div className="space-y-6" style={{ transform: 'scale(0.8)', transformOrigin: 'center' }}>
          <div className="flex items-start gap-5 p-6 bg-red-50 border border-red-200 rounded-[1.75rem]">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
              <ICONS.Trash className="w-6 h-6 text-red-500" strokeWidth={2} />
            </div>
            <div>
              <p className="font-bold text-[#2E2E2F] text-[16px] tracking-tight">
                {bulkDeleteConfirm ? `Permanently delete ${selectedRows.size} ${activeTab}?` : `Permanently delete this ${activeTab === 'events' ? 'event' : 'transaction'}?`}
              </p>
              <p className="text-[13px] text-[#2E2E2F]/60 font-medium mt-2 leading-relaxed">
                {bulkDeleteConfirm 
                  ? `You are about to permanently delete ${selectedRows.size} selected items. This action cannot be undone.`
                  : activeTab === 'events' 
                    ? <>You are about to permanently delete <strong>"{eventToDelete?.eventName}"</strong>. All associated tickets and registrations will be removed. This cannot be undone.</>
                    : <>You are about to permanently delete transaction <strong>"{transactionToDelete?.customerName}"</strong>. This will remove all associated ticket data. This cannot be undone.</>}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              className="flex-1 py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#F2F2F2] text-[#2E2E2F] border-2 border-[#2E2E2F]/15 hover:bg-[#2E2E2F]/10 transition-colors min-h-[32px]"
              onClick={() => { setDeleteModalOpen(false); setBulkDeleteConfirm(false); setEventToDelete(null); }}
              disabled={isBulkActionLoading || !!actionLoading}
            >
              Cancel
            </Button>
            <Button
              className="flex-[2] py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 transition-colors min-h-[32px]"
              onClick={handlePermanentDelete}
              disabled={isBulkActionLoading || !!actionLoading}
            >
              {isBulkActionLoading || actionLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

