
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { RegistrationView, UserRole } from '../../types';
import { Card, Modal, PageLoader } from '../../components/Shared';
import { ICONS } from '../../constants';
import { useUser } from '../../context/UserContext';
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
  const [searchParams] = useSearchParams();
  const { role } = useUser();
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
        console.error('Error fetching registrations:', error);
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

  useEffect(() => {
    console.log('Pagination state updated:', {
      currentPage,
      pagination,
      totalPages,
      isServerPaged,
      regsLength: regs?.length || 0
    });
  }, [pagination, currentPage, totalPages, isServerPaged, regs]);

  const handlePageChange = (page: number) => {
  setCurrentPage(page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

  const handleCheckIn = async (reg: RegistrationView) => {
    try {
      const result = await apiService.checkInTicket(reg.ticketCode);
      setRegs(prev => prev.map(r => r.id === reg.id ? { ...r, status: 'USED', checkInTimestamp: result?.usedAt || new Date().toISOString() } : r));
    } catch (err) {
      // no-op for now; could add toast/alert
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
      <p className="text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em]">{label}</p>
      <p className={`text-sm font-semibold text-[#1F3A5F] ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );



  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, eventId]);

  if (loading) {
    return <PageLoader label="Loading attendee directory..." variant="section" />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-[#1F3A5F] tracking-tighter">Attendee Directory</h1>
          <p className="text-[#1F3A5F]/60 font-medium text-sm mt-1">
            {isStaff ? 'Operations: Verifying registrations and managing check-ins.' : 'Full visibility of confirmed registrations and financial transactions.'}
          </p>
        </div>
        <div className="w-full md:w-80">
          <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#1F3A5F]/20">
               <ICONS.Search className="h-4 w-4" strokeWidth={3} />
             </div>
             <input 
              type="text" 
              placeholder="Search directory..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-10 py-3 bg-white border border-[#F4F6F8] rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-600/5 focus:border-indigo-600 transition-all"
             />
             <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#2F80ED]/70">
               {isFetching && <div className="w-4 h-4 border-2 border-[#2F80ED]/60 border-t-transparent rounded-full animate-spin" />}
             </div>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-[#F4F6F8] shadow-sm rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F4F6F8]/50 border-b border-[#F4F6F8]">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em]">Attendee</th>
                <th className="px-8 py-5 text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em]">Ticket Information</th>
                <th className="px-8 py-5 text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em]">Transaction</th>
                <th className="px-8 py-5 text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em] text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F6F8]">
              {pagedRegs.map((reg, index) => {
                const isCheckedIn = reg.status === 'USED';
                const rowKey = reg.id ?? reg.ticketCode ?? `${reg.eventId}-${reg.orderId}-${index}`;
                
                return (
                  <tr
                    key={rowKey}
                    className="hover:bg-[#F4F6F8]/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedReg(reg)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-[15px] text-[#1F3A5F] tracking-tight">{reg.attendeeName}</span>
                        <span className="text-[12px] text-[#1F3A5F]/50 font-medium mt-0.5">{reg.attendeeEmail}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-[14px] font-bold text-[#1F3A5F]">{reg.eventName}</span>
                        <span className="text-[12px] text-[#1F3A5F]/50 font-medium mt-0.5">{reg.ticketName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`inline-flex px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        isCheckedIn 
                          ? 'bg-[#56CCF2]/20 text-[#2F80ED]' 
                          : 'bg-[#2F80ED]/10 text-[#2F80ED]'
                      }`}>
                        {isCheckedIn ? 'CHECKED_IN' : 'ISSUED'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[15px] font-black text-[#1F3A5F] tracking-tighter">
                        {reg.currency} {(reg.amountPaid ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {!isCheckedIn ? (
                          <button 
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCheckIn(reg);
                            }}
                            className="text-[11px] font-black text-[#2F80ED] uppercase tracking-[0.15em] hover:text-[#1F3A5F] transition-colors"
                          >
                            MANUAL CHECK-IN
                          </button>
                      ) : (
                        <span className="text-[12px] font-bold text-[#1F3A5F]/20 italic tracking-tight">Arrived</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRegs.length === 0 && !loading && (
          <div className="py-24 text-center">
            <ICONS.Users className="w-12 h-12 text-slate-100 mx-auto mb-4" />
            <p className="text-[#1F3A5F]/50 font-bold uppercase tracking-widest text-[10px]">No active attendees found.</p>
          </div>
        )}
      </Card>
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
                  <h3 className="text-[11px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.3em] mb-2">Identity</h3>
                  <div className="bg-[#F4F6F8] rounded-xl p-5 grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-[#2F80ED] text-white text-lg font-black flex items-center justify-center shrink-0">{selectedReg.attendeeName?.charAt(0)}</span>
                      <span className="font-black text-[#1F3A5F] text-lg truncate min-w-0">{selectedReg.attendeeName}</span>
                    </div>
                    <div className="text-[13px] text-[#1F3A5F]/70 font-bold break-words truncate min-w-0" title={selectedReg.attendeeEmail}>{selectedReg.attendeeEmail}</div>
                    {selectedReg.attendeePhone && <div className="text-[13px] text-[#1F3A5F]/70 font-bold break-words truncate min-w-0">{selectedReg.attendeePhone}</div>}
                    {selectedReg.attendeeCompany && <div className="text-[13px] text-[#1F3A5F]/70 font-bold break-words truncate min-w-0">{selectedReg.attendeeCompany}</div>}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-[11px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.3em] mb-2">Ticket & Order</h3>
                  <div className="bg-[#F4F6F8] rounded-xl p-5 grid grid-cols-1 gap-2">
                    <div className="flex flex-wrap gap-4 text-[13px]">
                      <span className="font-black text-[#2F80ED]">{selectedReg.ticketName}</span>
                      <span className="font-mono text-[#1F3A5F]/60">{selectedReg.ticketCode}</span>
                    </div>
                    <div className="text-[13px] text-[#1F3A5F]/70 font-bold">Order ID: <span className="font-mono">{selectedReg.orderId}</span></div>
                    <div className="text-[13px] text-[#1F3A5F]/70 font-bold">Event: {selectedReg.eventName}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-[11px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.3em] mb-2">Payment & Status</h3>
                  <div className="bg-[#F4F6F8] rounded-xl p-5 grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest ${selectedReg.paymentStatus === 'PAID' ? 'bg-[#56CCF2]/20 text-[#2F80ED]' : 'bg-[#2F80ED]/10 text-[#2F80ED]'}`}>{selectedReg.paymentStatus || '—'}</span>
                      <span className="text-[13px] font-black text-[#1F3A5F]">{selectedReg.currency} {Number(selectedReg.amountPaid ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest ${selectedReg.status === 'USED' ? 'bg-[#56CCF2]/20 text-[#2F80ED]' : 'bg-[#2F80ED]/10 text-[#2F80ED]'}`}>{selectedReg.status}</span>
                      <span className="text-[13px] text-[#1F3A5F]/70 font-bold">Check-in: {formatTimestamp(selectedReg.checkInTimestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
              {selectedReg.qrPayload && (
                <div className="flex flex-col items-center gap-4 justify-center bg-white rounded-2xl border border-[#F4F6F8] shadow-sm px-6 py-8 min-w-[220px]">
                  <p className="text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em]">QR Code</p>
                  <QRCode value={selectedReg.qrPayload} size={160} />
                  <span className="text-[11px] text-[#1F3A5F]/40 font-mono break-all">{selectedReg.ticketCode}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-[1.5rem] border border-[#F4F6F8] shadow-sm">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i + 1)}
                className={`w-10 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  currentPage === i + 1
                    ? 'bg-[#1F3A5F] text-white shadow-lg shadow-[#2F80ED]/10'
                    : 'text-[#1F3A5F]/50 hover:text-[#1F3A5F] hover:bg-[#F4F6F8]'
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
