import React, { useState, useEffect } from 'react';
import { Card, Button, PageLoader } from '../../components/Shared';
import { apiService } from '../../services/apiService';
import { ICONS } from '../../constants';

interface Transaction {
  orderId: string;
  eventId: string;
  eventName: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  createdAt: string;
}

const formatCurrency = (amount: number, currency: string = 'SGD') => {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const OrganizerReports: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('all');

  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadTransactions();
    loadProfile();
  }, [page, filter]);

  const loadProfile = async () => {
    try {
      const organizer = await apiService.getMyOrganizer();
      setProfile(organizer);
    } catch (err) {
      console.error('Failed to load organizer profile for reports plan check', err);
    }
  };

  const hasAdvancedReports = Boolean(profile?.plan?.features?.enable_advanced_reports || profile?.plan?.features?.advanced_reports);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getRecentTransactions(page, 20);

      let filtered = data.transactions || [];

      // Filter by payment status
      if (filter !== 'all') {
        filtered = filtered.filter((t: Transaction) =>
          t.paymentStatus?.toLowerCase() === filter
        );
      }

      setTransactions(filtered);
      setTotalPages(Math.ceil((data.total || 1) / 20));
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!hasAdvancedReports) {
      alert('Advanced Reports are only available on Professional and Enterprise plans.');
      return;
    }
    // Call the new backend API to trigger spreadsheet download
    apiService.exportAllReports();
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'completed': 'bg-green-100 text-green-800 border-green-200',
      'succeeded': 'bg-green-100 text-green-800 border-green-200',
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'processing': 'bg-blue-100 text-blue-800 border-blue-200',
      'failed': 'bg-red-100 text-red-800 border-red-200',
      'expired': 'bg-gray-100 text-gray-800 border-gray-200'
    };

    const colorClass = statusColors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-200';

    return (
      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
        {status || 'Unknown'}
      </span>
    );
  };

  // Calculate totals
  const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const completedAmount = transactions
    .filter(t => t.paymentStatus?.toLowerCase() === 'completed' || t.paymentStatus?.toLowerCase() === 'succeeded')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  if (loading && transactions.length === 0) {
    return <PageLoader label="Loading reports..." />;
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <div className="bg-transparent border-2 border-[#2E2E2F]/10 rounded-2xl p-6 md:p-8 mb-4">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-2xl md:text-3xl font-bold text-[#2E2E2F] tracking-tight mb-2">
              Transaction Reports
            </h1>
            <p className="text-[#2E2E2F]/60 text-sm font-medium">
              Analyze revenue flow, monitor audience conversions, and export operational datasets.
            </p>
          </div>
          <div className="flex flex-row md:flex-col gap-3 shrink-0">
            <Button
              onClick={handleExport}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${!hasAdvancedReports ? 'opacity-50 grayscale bg-[#2E2E2F]/10 text-[#2E2E2F]' : 'bg-[#38BDF2] text-white hover:bg-[#2E2E2F] hover:-translate-y-0.5 shadow-sm'}`}
            >
              {!hasAdvancedReports && <ICONS.Shield className="w-4 h-4" />}
              Export CSV
            </Button>
            <Button
              onClick={loadTransactions}
              className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest bg-transparent border border-[#2E2E2F]/10 text-[#2E2E2F] hover:bg-[#2E2E2F]/5"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group bg-transparent border-2 border-[#2E2E2F]/10 rounded-2xl p-6 transition-all duration-300 hover:border-[#38BDF2] hover:shadow-sm">
          <p className="text-xs font-bold text-[#38BDF2] uppercase tracking-widest mb-3">Total Transactions</p>
          <p className="text-3xl font-extrabold text-[#2E2E2F] leading-none mb-1">{transactions.length}</p>
        </div>

        <div className="group bg-transparent border-2 border-[#2E2E2F]/10 rounded-2xl p-6 transition-all duration-300 hover:border-green-500 hover:shadow-sm">
          <p className="text-xs font-bold text-green-500 uppercase tracking-widest mb-3">Completed Revenue</p>
          <p className="text-3xl font-extrabold text-[#2E2E2F] leading-none mb-1">{formatCurrency(completedAmount)}</p>
        </div>

        <div className={`relative group bg-transparent border-2 border-[#2E2E2F]/10 rounded-2xl p-6 transition-all duration-300 ${!hasAdvancedReports ? 'cursor-not-allowed border-[#2E2E2F]/20' : 'hover:border-[#2E2E2F] hover:shadow-sm'}`}>
          <p className="text-xs font-bold text-[#2E2E2F]/50 uppercase tracking-widest mb-3">Total Pending & Failed</p>
          <div className={`${!hasAdvancedReports ? 'blur-md select-none opacity-50' : ''}`}>
             <p className="text-3xl font-extrabold text-[#2E2E2F]/50 leading-none mb-1">{formatCurrency(totalAmount - completedAmount)}</p>
          </div>
          {!hasAdvancedReports && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center z-10">
              <div className="bg-[#F2F2F2] border border-[#2E2E2F]/20 text-[#2E2E2F] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg">
                <ICONS.Shield className="w-3.5 h-3.5 text-[#38BDF2]" />
                Pro Feature
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="flex bg-transparent border-2 border-[#2E2E2F]/5 rounded-2xl p-1.5 w-full md:w-auto">
          {(['all', 'completed', 'pending', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === status
                  ? 'bg-[#F2F2F2] text-[#2E2E2F] shadow-lg border border-[#2E2E2F]/10'
                  : 'bg-transparent text-[#2E2E2F]/40 hover:text-[#2E2E2F]'
                }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="p-4 rounded-xl border-red-500 border-2 bg-red-50 text-red-700 font-bold text-sm">
          {error}
        </Card>
      )}

      {/* Transactions Table */}
      <div className="bg-transparent border-2 border-[#2E2E2F]/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-transparent border-b-2 border-[#2E2E2F]/10">
                <th className="px-6 py-4 text-xs font-bold text-[#2E2E2F]/60 uppercase tracking-widest whitespace-nowrap">Order ID</th>
                <th className="px-6 py-4 text-xs font-bold text-[#2E2E2F]/60 uppercase tracking-widest whitespace-nowrap">Event</th>
                <th className="px-6 py-4 text-xs font-bold text-[#2E2E2F]/60 uppercase tracking-widest whitespace-nowrap">Attendee</th>
                <th className="px-6 py-4 text-xs font-bold text-[#2E2E2F]/60 uppercase tracking-widest text-right whitespace-nowrap">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-[#2E2E2F]/60 uppercase tracking-widest text-center whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-[#2E2E2F]/60 uppercase tracking-widest text-right whitespace-nowrap">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#2E2E2F]/40 font-bold text-sm">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((transaction, index) => (
                  <tr
                    key={transaction.orderId || index}
                    className="border-b border-[#2E2E2F]/5 hover:bg-[#38BDF2]/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-bold font-mono text-[#2E2E2F]/60 uppercase tracking-widest bg-[#2E2E2F]/5 px-2 py-1 rounded">
                        {transaction.orderId?.slice(0, 8) || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-[#2E2E2F] truncate max-w-[200px] inline-block">
                        {transaction.eventName || 'Unknown Event'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-[#2E2E2F]">
                          {transaction.customerName || 'Unknown'}
                        </p>
                        <p className="text-xs font-medium text-[#2E2E2F]/60 mt-0.5">
                          {transaction.customerEmail || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-[#2E2E2F]">
                        {formatCurrency(transaction.amount, transaction.currency)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(transaction.paymentStatus)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-medium text-[#2E2E2F]/60">
                        {formatDate(transaction.createdAt)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-8 py-5 border-t-2 border-[#2E2E2F]/5 flex justify-between items-center bg-[#F2F2F2]">
            <p className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-widest">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border-2 border-[#2E2E2F]/5 text-[#2E2E2F] hover:border-[#2E2E2F]/20 disabled:opacity-50"
              >
                Previous
              </Button>
              <Button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border-2 border-[#2E2E2F]/5 text-[#2E2E2F] hover:border-[#2E2E2F]/20 disabled:opacity-50"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
