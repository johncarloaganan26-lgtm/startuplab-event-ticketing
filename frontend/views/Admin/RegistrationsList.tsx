
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { RegistrationView, UserRole } from '../../types';
import { Card, Badge, Button, Modal, Input, PageLoader, Checkbox } from '../../components/Shared';
import { ICONS } from '../../constants';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import QRCode from 'react-qr-code';

export const RegistrationsList: React.FC = () => {
  const [regs, setRegs] = useState<RegistrationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [selectedReg, setSelectedReg] = useState<RegistrationView | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { role, canManualCheckIn } = useUser();
  const { showToast } = useToast();
  const isStaff = role === UserRole.STAFF;
  const eventId = searchParams.get('eventId');
  const itemsPerPage = 10;
  const isServerPaged = !eventId;
  const initialLoadRef = useRef(true);
  const requestIdRef = useRef(0);

  const filteredRegs = regs;

  const totalPages = isServerPaged
    ? Math.max(1, pagination.totalPages || 1)
    : Math.max(1, Math.ceil(filteredRegs.length / itemsPerPage));

  const pagedRegs = useMemo(() => {
    if (isServerPaged) return filteredRegs;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRegs.slice(start, start + itemsPerPage);
  }, [filteredRegs, currentPage, itemsPerPage, isServerPaged]);

  // Bulk selection functions
  const toggleRow = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === pagedRegs.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pagedRegs.map(r => r.id || r.ticketCode || '')));
    }
  };

  const handlePrint = () => {
    const selectedData = pagedRegs.filter(r => selectedRows.has(r.id || r.ticketCode || ''));
    const printContent = selectedData.length > 0 ? selectedData : pagedRegs;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>Registrations Export</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
        </style></head><body>
        <h1>Registrations Export</h1>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Event</th><th>Ticket</th><th>Status</th></tr></thead>
          <tbody>
            ${printContent.map(r => `<tr><td>${r.attendeeName || ''}</td><td>${r.attendeeEmail || ''}</td><td>${r.eventName || ''}</td><td>${r.ticketName || ''}</td><td>${r.status || ''}</td></tr>`).join('')}
          </tbody>
        </table></body></html>`);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleExport = () => {
    const exportData = selectedRows.size > 0 
      ? pagedRegs.filter(r => selectedRows.has(r.id || r.ticketCode || ''))
      : pagedRegs;

    const csvContent = [
      ['Attendee Name', 'Email', 'Event', 'Ticket', 'Status', 'Amount Paid'].join(','),
      ...exportData.map(r => [
        `"${r.attendeeName || ''}"`,
        `"${r.attendeeEmail || ''}"`,
        `"${r.eventName || ''}"`,
        `"${r.ticketName || ''}"`,
        `"${r.status || ''}"`,
        `"${r.currency || ''} ${(r.amountPaid ?? 0).toFixed(2)}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendees_list_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkCheckIn = async () => {
    if (selectedRows.size === 0) return;
    
    // Find attendees who are not yet checked in
    const toCheckIn = pagedRegs.filter(r => 
        selectedRows.has(r.id || r.ticketCode || '') && r.status !== 'USED'
    );
    
    if (toCheckIn.length === 0) {
        showToast('info', 'Selected attendees are already checked in.');
        return;
    }

    setIsBulkActionLoading(true);
    try {
        const promises = toCheckIn.map(reg => apiService.checkInTicket(reg.ticketCode));
        await Promise.all(promises);
        
        const timestamp = new Date().toISOString();
        const checkedInIds = new Set(toCheckIn.map(r => r.id));
        
        setRegs(prev => prev.map(r => 
            checkedInIds.has(r.id) ? { ...r, status: 'USED', checkInTimestamp: timestamp } : r
        ));
        
        showToast('success', `Successfully checked in ${toCheckIn.length} attendees.`);
        setSelectedRows(new Set());
    } catch (err: any) {
        showToast('error', 'Failed to bulk check-in attendees.');
    } finally {
        setIsBulkActionLoading(false);
    }
  };

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 350);
    return () => window.clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    const fetchData = async () => {
      const requestId = ++requestIdRef.current;
      if (initialLoadRef.current) {
        setLoading(true);
      } else {
        setIsFetching(true);
      }
      try {
        if (eventId) {
          const data = await apiService.getEventRegistrations(eventId, debouncedSearch);
          if (requestId !== requestIdRef.current) return;
          setRegs(data);
          setPagination({
            page: 1,
            limit: itemsPerPage,
            total: data.length,
            totalPages: Math.max(1, Math.ceil(data.length / itemsPerPage))
          });
        } else {
          const { registrations, pagination: serverPagination } = await apiService.getAllRegistrations(currentPage, itemsPerPage, debouncedSearch);
          if (requestId !== requestIdRef.current) return;
          setRegs(registrations || []);
          setPagination(serverPagination || {
            page: 1,
            limit: itemsPerPage,
            total: 0,
            totalPages: 1
          });
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setIsFetching(false);
          initialLoadRef.current = false;
        }
      }
    };
    if (eventId || isServerPaged) {
      fetchData();
    }
  }, [eventId, currentPage, isServerPaged, itemsPerPage, debouncedSearch]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCheckIn = async (reg: RegistrationView) => {
    try {
      const result = await apiService.checkInTicket(reg.ticketCode);
      setRegs(prev => prev.map(r => r.id === reg.id ? { ...r, status: 'USED', checkInTimestamp: result?.usedAt || new Date().toISOString() } : r));
      showToast('success', `Check-in successful for ${reg.attendeeName}`);
    } catch (err) {
      showToast('error', 'Failed to check in attendee.');
    }
  };

  const formatTimestamp = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const DetailItem = ({ label, value, mono = false }: { label: string; value?: React.ReactNode; mono?: boolean }) => (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em]">{label}</p>
      <p className={`text-sm font-semibold text-[#2E2E2F] ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );



  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, eventId]);

  if (loading) {
    return <PageLoader label="Loading attendees..." variant="section" />;
  }

  return (
    <div className="pb-16 space-y-6">
      <div className="px-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-[2rem] font-semibold text-[#2E2E2F] tracking-tight">Attendee List</h1>
          <p className="mt-1 text-sm font-semibold text-[#2E2E2F]/65">
            Full visibility of confirmed registrations and financial transactions.
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-3 items-center">
          <div className="w-full md:w-80 relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#2E2E2F]/60">
              <ICONS.Search className="h-4 w-4" strokeWidth={3} />
            </div>
            <input
              type="text"
              placeholder="Search directory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-10 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/30 focus:border-[#2E2E2F] transition-colors"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#2E2E2F]/70">
              {isFetching && <div className="w-4 h-4 border-2 border-[#2E2E2F]/30 border-t-transparent rounded-full animate-spin" />}
            </div>
          </div>
          {eventId && (
            <Button
              variant="outline"
              onClick={() => apiService.exportEventReport(eventId)}
              className="px-4 py-3 rounded-xl font-black text-[10px] whitespace-nowrap hidden sm:flex items-center gap-2"
            >
              <ICONS.CreditCard className="w-4 h-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:hidden">
        {pagedRegs.map((reg, index) => {
          const isCheckedIn = reg.status === 'USED';
          return (
            <Card
              key={reg.id ?? reg.ticketCode ?? index}
              className="p-5 border-[#2E2E2F]/10 hover:border-[#38BDF2]/40 transition-colors cursor-pointer"
              onClick={() => setSelectedReg(reg)}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h3 className="font-bold text-[#2E2E2F] text-base truncate">{reg.attendeeName}</h3>
                  <p className="text-[12px] text-[#2E2E2F]/60 font-medium truncate">{reg.attendeeEmail}</p>
                </div>
                <Badge
                  type={isCheckedIn ? 'success' : 'neutral'}
                  className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 shrink-0"
                >
                  {isCheckedIn ? 'CHECKED_IN' : 'ISSUED'}
                </Badge>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-widest">Event</span>
                  <span className="text-[13px] font-bold text-[#2E2E2F] truncate">{reg.eventName}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-widest">Ticket</span>
                  <span className="text-[13px] font-semibold text-[#2E2E2F]/70">{reg.ticketName}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-widest">Payment</span>
                    <span className="text-[14px] font-black text-[#2E2E2F]">{reg.currency} {(reg.amountPaid ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {!isCheckedIn && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCheckIn(reg);
                  }}
                  className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#38BDF2] text-[#F2F2F2] transition-colors"
                  disabled={isStaff && !canManualCheckIn}
                >
                  MANUAL CHECK-IN
                </button>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="hidden md:block overflow-hidden border-[#2E2E2F]/10 rounded-xl bg-[#F2F2F2]">
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#2E2E2F]/10">
          <div className="text-sm font-semibold text-[#2E2E2F]">
            {selectedRows.size > 0 ? `${selectedRows.size} selected` : `${pagedRegs.length} entries`}
          </div>
          <div className="flex items-center gap-3">
            {selectedRows.size > 0 && (
              <div className="flex items-center gap-2 mr-4 border-r border-[#2E2E2F]/15 pr-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <button 
                  onClick={handleBulkCheckIn}
                  disabled={isBulkActionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-[#38BDF2] text-white border-2 border-[#38BDF2] rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 h-[32px]"
                >
                  <ICONS.CheckCircle className="w-3.5 h-3.5" />
                  {isBulkActionLoading ? 'Loading...' : 'Check-In'}
                </button>
              </div>
            )}
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
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F2F2F2] border-b border-[#2E2E2F]/10">
              <tr>
                <th className="px-4 py-5 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] w-12 text-center align-middle">
                  <div className="flex justify-center">
                    <Checkbox checked={selectedRows.size === pagedRegs.length && pagedRegs.length > 0} onChange={toggleAll} />
                  </div>
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em]">Attendee</th>
                <th className="px-8 py-5 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em]">Ticket Information</th>
                <th className="px-8 py-5 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em]">Transaction</th>
                <th className="px-8 py-5 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em] text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2E2E2F]/10">
              {pagedRegs.map((reg, index) => {
                const isCheckedIn = reg.status === 'USED';
                const rowKey = reg.id ?? reg.ticketCode ?? `${reg.eventId}-${reg.orderId}-${index}`;

                return (
                  <tr
                    key={rowKey}
                    className="hover:bg-[#38BDF2]/10 transition-colors cursor-pointer"
                    onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') setSelectedReg(reg); }}
                  >
                    <td className="px-4 py-6 align-middle">
                      <div className="flex justify-center">
                        <Checkbox checked={selectedRows.has(reg.id || reg.ticketCode || '')} onChange={() => toggleRow(reg.id || reg.ticketCode || '')} />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-[15px] text-[#2E2E2F] tracking-tight">{reg.attendeeName}</span>
                        <span className="text-[12px] text-[#2E2E2F]/60 font-medium mt-0.5">{reg.attendeeEmail}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-[#2E2E2F]">{reg.eventName}</span>
                        <span className="text-[12px] text-[#2E2E2F]/60 font-medium mt-0.5">{reg.ticketName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${isCheckedIn
                        ? 'bg-[#38BDF2]/20 text-[#2E2E2F]'
                        : 'bg-[#2E2E2F]/10 text-[#2E2E2F]'
                        }`}>
                        {isCheckedIn ? 'CHECKED_IN' : 'ISSUED'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[15px] font-black text-[#2E2E2F] tracking-tighter">
                        {reg.currency} {(reg.amountPaid ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {!isCheckedIn ? (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setActionLoading(reg.id || reg.ticketCode);
                            handleCheckIn(reg).finally(() => setActionLoading(null));
                          }}
                          className="py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#38BDF2] text-[#F2F2F2] min-h-[32px] transition-colors disabled:opacity-50"
                          disabled={(isStaff && !canManualCheckIn) || isBulkActionLoading || actionLoading === (reg.id || reg.ticketCode)}
                        >
                          {actionLoading === (reg.id || reg.ticketCode) ? '...' : 'MANUAL CHECK-IN'}
                        </button>
                      ) : (
                        <span className="text-[12px] font-bold text-[#2E2E2F]/40 italic tracking-tight">Arrived</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {pagedRegs.length === 0 && !loading && (
        <div className="py-24 text-center">
          <ICONS.Users className="w-12 h-12 text-[#2E2E2F]/30 mx-auto mb-4" />
          <p className="text-[#2E2E2F]/60 font-bold uppercase tracking-widest text-[10px]">No attendees</p>
        </div>
      )}
      <Modal
        isOpen={Boolean(selectedReg)}
        onClose={() => setSelectedReg(null)}
        title="Attendee Details"
        size="xl"
      >
        {selectedReg && (
          <div className="space-y-10 px-1">
            <div className="flex flex-col md:flex-row gap-10">
              <div className="flex-1 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-[11px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.3em] mb-2">Identity</h3>
                  <div className="bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl p-5 grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-[#38BDF2] text-[#F2F2F2] text-lg font-black flex items-center justify-center shrink-0">{selectedReg.attendeeName?.charAt(0)}</span>
                      <span className="font-black text-[#2E2E2F] text-lg truncate min-w-0">{selectedReg.attendeeName}</span>
                    </div>
                    <div className="text-[13px] text-[#2E2E2F]/70 font-bold break-words truncate min-w-0" title={selectedReg.attendeeEmail}>{selectedReg.attendeeEmail}</div>
                    {selectedReg.attendeePhone && <div className="text-[13px] text-[#2E2E2F]/70 font-bold break-words truncate min-w-0">{selectedReg.attendeePhone}</div>}
                    {selectedReg.attendeeCompany && <div className="text-[13px] text-[#2E2E2F]/70 font-bold break-words truncate min-w-0">{selectedReg.attendeeCompany}</div>}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-[11px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.3em] mb-2">Ticket & Order</h3>
                  <div className="bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl p-5 grid grid-cols-1 gap-2">
                    <div className="flex flex-wrap gap-4 text-[13px]">
                      <span className="font-black text-[#2E2E2F]">{selectedReg.ticketName}</span>
                      <span className="font-mono text-[#2E2E2F]/60">{selectedReg.ticketCode}</span>
                    </div>
                    <div className="text-[13px] text-[#2E2E2F]/70 font-bold">Order ID: <span className="font-mono">{selectedReg.orderId}</span></div>
                    <div className="text-[13px] text-[#2E2E2F]/70 font-bold">Event: {selectedReg.eventName}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-[11px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.3em] mb-2">Payment & Status</h3>
                  <div className="bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl p-5 grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-widest ${selectedReg.paymentStatus === 'PAID' ? 'bg-[#38BDF2]/20 text-[#2E2E2F]' : 'bg-[#2E2E2F]/10 text-[#2E2E2F]'}`}>{selectedReg.paymentStatus || '—'}</span>
                      <span className="text-[13px] font-black text-[#2E2E2F]">{selectedReg.currency} {Number(selectedReg.amountPaid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-widest ${selectedReg.status === 'USED' ? 'bg-[#38BDF2]/20 text-[#2E2E2F]' : 'bg-[#2E2E2F]/10 text-[#2E2E2F]'}`}>{selectedReg.status}</span>
                      <span className="text-[13px] text-[#2E2E2F]/70 font-bold">Check-in: {formatTimestamp(selectedReg.checkInTimestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
              {selectedReg.qrPayload && (
                <div className="flex flex-col items-center gap-4 justify-center bg-[#F2F2F2] rounded-xl border border-[#2E2E2F]/20 px-6 py-8 min-w-[220px]">
                  <p className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.2em]">QR Code</p>
                  <QRCode value={selectedReg.qrPayload} size={160} fgColor="#2E2E2F" bgColor="#F2F2F2" />
                  <span className="text-[11px] text-[#2E2E2F]/60 font-mono break-all">{selectedReg.ticketCode}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#F2F2F2] rounded-full border border-[#2E2E2F]/10">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i + 1)}
                className={`min-h-[32px] px-4 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-[#38BDF2] focus:ring-offset-2 ${currentPage === i + 1
                  ? 'bg-[#38BDF2] text-[#F2F2F2]'
                  : 'bg-[#F2F2F2] text-[#2E2E2F] hover:bg-[#2E2E2F] hover:text-[#F2F2F2]'
                  }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

