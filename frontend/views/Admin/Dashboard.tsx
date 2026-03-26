
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { AnalyticsSummary, UserRole, AdminPlan, OrganizerProfile } from '../../types';
import { Card, PageLoader, Modal } from '../../components/Shared';
import { ICONS } from '../../constants';
import { useUser } from '../../context/UserContext';
import { CreatePlanModal } from '../../components/CreatePlanModal';

// ── Types ─────────────────────────────────────────────────────────────────
type PlanMetrics = {
  revenueByPlan: { name: string; value: number }[];
  dailyMetrics: { date: string; count: number; revenue: number }[];
};
type HealthMetrics = {
  planDistribution: { name: string; count: number }[];
  totalOrganizers: number;
  activeSubscribers: number;
};

// ── Hero Stat Card ─────────────────────────────────────────────────────────
const HeroCard: React.FC<{
  title: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  trendColor: string;
}> = ({ title, value, sub, icon, iconBg, trendColor }) => (
  <div className="p-5 rounded-2xl border border-[#E0E0E0] bg-[#F2F2F2] flex items-center gap-4 hover:scale-[1.01] transition-transform cursor-default">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0 ${iconBg}`}>
      <div className="[&>svg]:w-6 [&>svg]:h-6">{icon}</div>
    </div>
    <div>
      <p className="text-xs font-bold text-[#1E293B]/50 mb-0.5">{title}</p>
      <p className="text-2xl font-black text-[#1E293B]">{value}</p>
      <p className={`text-[10px] font-bold mt-1 ${trendColor}`}>{sub}</p>
    </div>
  </div>
);

// ── Metric Detail Card ─────────────────────────────────────────────────────
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  trend: string;
  trendColor: string;
  icon: React.ReactNode;
  link?: () => void;
}> = ({ title, value, trend, trendColor, icon, link }) => (
  <Card className="p-6 bg-[#F2F2F2] border border-[#E0E0E0] rounded-2xl shadow-sm">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-3xl font-black text-[#1E293B]">{value}</p>
        <p className="text-sm font-bold text-[#1E293B]/40 mt-1">{title}</p>
      </div>
      <div className="text-[#1E293B]/20 [&>svg]:w-8 [&>svg]:h-8">{icon}</div>
    </div>
    <div className="flex justify-between items-center mt-8">
      <span className={`text-xs font-black ${trendColor}`}>{trend}</span>
      {link && (
        <button onClick={link} className="text-xs font-black text-[#38BDF2] hover:underline">View</button>
      )}
    </div>
  </Card>
);

// ── Main Dashboard ─────────────────────────────────────────────────────────
export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useUser();

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [planMetrics, setPlanMetrics] = useState<PlanMetrics | null>(null);
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [organizers, setOrganizers] = useState<OrganizerProfile[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [analytics, pm, h, adminPlans, orgs, txData, logs] = await Promise.allSettled([
          apiService.getAnalytics(),
          apiService.getPlanMetrics(),
          apiService.getSubscriptionHealth(),
          apiService.getAdminPlans(),
          apiService.getOrganizers(),
          apiService.getRecentTransactions(1, 5),
          apiService.getAuditLogs(1, 15),
        ]);
        let supportResult: any[] = [];
        try { const s = await (apiService.getAdminSupportTickets as any)(); supportResult = Array.isArray(s) ? s : s?.tickets || []; } catch {}
        setSupportTickets(supportResult);
        if (analytics.status === 'fulfilled') setAnalytics(analytics.value);
        if (pm.status === 'fulfilled') setPlanMetrics(pm.value);
        if (h.status === 'fulfilled') setHealth(h.value);
        if (adminPlans.status === 'fulfilled') setPlans(adminPlans.value);
        if (orgs.status === 'fulfilled') setOrganizers(orgs.value);
        if (txData.status === 'fulfilled') setRecentTx((txData.value as any)?.transactions || (txData.value as any)?.items || (txData.value as any)?.data || []);
        if (logs.status === 'fulfilled') {
          const l = logs.value;
          setAuditLogs((l as any)?.items || (l as any)?.data || (l as any)?.logs || (Array.isArray(l) ? l : []));
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <PageLoader label="Loading dashboard..." variant="page" />;

  // Computed values
  const totalRevenue = planMetrics?.revenueByPlan.reduce((s, p) => s + p.value, 0) || 0;
  const activeSubscribers = health?.activeSubscribers || analytics?.activeSubscriptions || 0;
  const totalOrganizers = health?.totalOrganizers || organizers.length || 0;
  const activePlans = plans.filter(p => p.isActive).length;
  const totalPlans = plans.length;
  const pendingSupport = supportTickets.filter(t => t.status === 'open' || t.status === 'OPEN' || !t.resolvedAt).length;
  const planDist = health?.planDistribution || planMetrics?.revenueByPlan.map(p => ({ name: p.name, count: 0 })) || [];
  const barData = planMetrics?.dailyMetrics?.slice(-10).map(d => d.count) || [3, 6, 4, 8, 5, 9, 4, 6, 10, 7];
  const barMax = Math.max(...barData, 1);

  // Plan colors
  const planColors: Record<string, string> = {
    Basic: '#38BDF2',
    Silver: '#64748B',
    Gold: '#EAB308',
    default: '#1E293B',
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2] pb-16 space-y-6 px-2 font-sans">
      {/* ── Header ── */}
      <div className="pt-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-[2rem] font-semibold text-[#2E2E2F] tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm font-semibold text-[#2E2E2F]/65">
            Manage organizers, subscriptions, and platform health
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreatePlanOpen(true)}
            className="bg-[#38BDF2] text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-transform active:scale-95"
          >
            <ICONS.Plus className="w-4 h-4" /> Create New Plan
          </button>
        </div>
      </div>

      {/* ── Row 1: Hero Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <HeroCard
          title="Total Organizers"
          value={totalOrganizers}
          sub="Registered on platform"
          icon={<ICONS.Users />}
          iconBg="bg-[#38BDF2]"
          trendColor="text-[#38BDF2]"
        />
        <HeroCard
          title="Total Plan Revenue"
          value={`₱${totalRevenue.toLocaleString()}`}
          sub="From all subscriptions"
          icon={<ICONS.TrendingUp />}
          iconBg="bg-[#38BDF2]"
          trendColor="text-[#38BDF2]"
        />
        <HeroCard
          title="Active Subscribers"
          value={activeSubscribers}
          sub="Currently subscribed"
          icon={<ICONS.CheckCircle />}
          iconBg="bg-[#38BDF2]"
          trendColor="text-[#38BDF2]"
        />
        <HeroCard
          title="Support Queue"
          value={pendingSupport}
          sub="Open tickets pending"
          icon={<ICONS.MessageSquare />}
          iconBg="bg-[#38BDF2]"
          trendColor="text-[#38BDF2]"
        />
      </div>


      {/* ── Row 3: Charts ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        {/* Organizer Growth Bar Chart */}
        <Card className="p-8 bg-[#F2F2F2] border border-[#E0E0E0] rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-base font-black text-[#1E293B]">Subscription Growth</h3>
              <p className="text-[10px] font-bold text-[#1E293B]/40 mt-1">Last 10 Days</p>
            </div>
            <div className="bg-[#F2F2F2] border border-[#E0E0E0] px-3 py-1.5 rounded-lg text-xs font-black text-[#1E293B]/50">
              Daily New Subscribers
            </div>
          </div>

          <div className="flex gap-3 h-[260px]">
            {/* Y axis */}
            <div className="flex flex-col justify-between text-[9px] font-bold text-[#1E293B]/30 text-right pr-2 pb-6 pt-1">
              {[barMax, Math.round(barMax * 0.75), Math.round(barMax * 0.5), Math.round(barMax * 0.25), 0].map(l => (
                <span key={l}>{l}</span>
              ))}
            </div>
            {/* Bars */}
            <div className="flex-1 flex items-end gap-2 pb-6 border-b border-l border-white/50">
              {barData.map((val, i) => {
                const h = Math.max((val / barMax) * 100, 4);
                return (
                  <div key={i} className="flex-1 flex gap-0.5 items-end h-full group cursor-pointer relative">
                    <div
                      className="w-full rounded-t-md bg-[#38BDF2]/30 group-hover:bg-[#38BDF2]/60 transition-colors"
                      style={{ height: `${h * 0.6}%` }}
                    />
                    <div
                      className="w-full rounded-t-md bg-[#38BDF2] group-hover:bg-[#0E94C5] transition-colors"
                      style={{ height: `${h}%` }}
                    />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1E293B] text-white text-[9px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 font-bold transition-all">
                      {val} new
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-8">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#38BDF2]/30" /><span className="text-[10px] font-bold text-[#1E293B]/40">Previous</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#38BDF2]" /><span className="text-[10px] font-bold text-[#1E293B]/40">New Subscribers</span></div>
          </div>
        </Card>

        {/* Plan Distribution + Org Overview */}
        <Card className="p-8 bg-[#F2F2F2] border border-[#E0E0E0] rounded-2xl shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-black text-[#1E293B]">Plan Overview</h3>
              <p className="text-[10px] font-bold text-[#1E293B]/40 mt-1">Organizer Subscriptions</p>
            </div>
          </div>

          {/* Donut SVG */}
          <div className="flex items-center gap-8 py-4">
            <div className="relative w-36 h-36 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E0E0E0" strokeWidth="12" />
                {/* Three ring tracks for plan distribution */}
                <circle cx="50" cy="50" r="42" fill="none" stroke="#38BDF2" strokeWidth="12"
                  strokeDasharray={`${264 * 0.55} ${264 * 0.45}`} strokeLinecap="round" />
                <circle cx="50" cy="50" r="28" fill="none" stroke="#64748B" strokeWidth="10"
                  strokeDasharray={`${176 * 0.30} ${176 * 0.70}`} strokeLinecap="round" />
                <circle cx="50" cy="50" r="16" fill="none" stroke="#EAB308" strokeWidth="8"
                  strokeDasharray={`${100 * 0.15} ${100 * 0.85}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-lg font-black text-[#1E293B]">{activeSubscribers}</p>
                <p className="text-[9px] font-bold text-[#1E293B]/40">Active</p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-4">
              {plans.slice(0, 4).map((plan) => {
                const color = planColors[plan.name] || planColors.default;
                const distItem = planDist.find(d => d.name === plan.name);
                return (
                  <div key={plan.planId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <div>
                        <p className="text-xs font-black text-[#1E293B]">{plan.name}</p>
                        <p className="text-[9px] font-bold text-[#1E293B]/40">₱{(plan.monthlyPrice || 0).toLocaleString()}/mo</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-[#1E293B]/60">{distItem?.count ?? '—'} users</span>
                  </div>
                );
              })}
              {plans.length === 0 && (
                <p className="text-xs text-[#1E293B]/40 font-bold">No plans configured yet.</p>
              )}
            </div>
          </div>

          {/* Bottom stat strip */}
          <div className="mt-auto pt-6 border-t border-white/60 grid grid-cols-3 text-center gap-4">
            <div>
              <p className="text-2xl font-black text-[#1E293B]">{totalOrganizers}</p>
              <p className="text-[9px] font-black text-[#1E293B]/30 mt-1">Organizers</p>
            </div>
            <div>
              <p className="text-2xl font-black text-[#1E293B]">{activeSubscribers}</p>
              <p className="text-[9px] font-black text-[#1E293B]/30 mt-1">Subscribers</p>
            </div>
            <div>
              <p className="text-2xl font-black text-[#1E293B]">{pendingSupport}</p>
              <p className="text-[9px] font-black text-[#1E293B]/30 mt-1">Open Tickets</p>
            </div>
          </div>
        </Card>

      </div>

      {/* ── Row 4: Recent Transactions & Plans ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        {/* Recent Plan Transactions */}
        <Card className="bg-[#F2F2F2] border border-[#E0E0E0] rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 flex justify-between items-center border-b border-[#2E2E2F]/5 bg-[#F2F2F2]">
            <h3 className="font-black text-[#1E293B] flex items-center gap-2">
              Recent Transactions
            </h3>
          </div>
          <div className="divide-y divide-[#2E2E2F]/5 h-full max-h-[500px] overflow-y-auto custom-scrollbar">
            {recentTx.length === 0 && (
              <p className="p-10 text-center text-xs font-bold text-[#1E293B]/40">No transactions yet.</p>
            )}
            {recentTx.map((tx, i) => {
              const statusStr = String(tx.paymentStatus || tx.status || 'COMPLETED').toUpperCase();
              const isFailed = statusStr === 'FAILED' || statusStr === 'CANCELLED' || statusStr === 'CANCELED';
              const isPending = statusStr === 'PENDING';
              return (
                <div
                  key={tx.orderId || i}
                  onClick={() => setSelectedTx(tx)}
                  className="px-6 py-5 flex items-center justify-between hover:bg-[#38BDF2]/5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-black text-[#1E293B]">{tx.customerName || tx.buyerName || 'Organizer'}</p>
                      <p className="text-[10px] font-bold text-[#1E293B]/40 mt-0.5">
                        <span className="text-[#38BDF2]">{tx.planName || 'Plan'}</span> · {new Date(tx.createdAt || tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5 mb-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${isFailed ? 'bg-red-500' : isPending ? 'bg-amber-400' : 'bg-[#38BDF2]'}`} />
                      <span className={`text-[9px] font-black ${isFailed ? 'text-red-500' : isPending ? 'text-amber-500' : 'text-[#38BDF2]'}`}>
                        {statusStr}
                      </span>
                    </div>
                    <p className="text-sm font-black text-[#1E293B]">₱{Number(tx.amount || 0).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* System Activity Hub (Audit Logs) */}
        <Card className="bg-[#F2F2F2] border border-[#E0E0E0] rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#2E2E2F]/5 flex justify-between items-center bg-[#F2F2F2]">
            <div>
              <h3 className="text-base font-black text-[#1E293B]">Activity Logs</h3>
              <p className="text-[10px] font-bold text-[#1E293B]/40 mt-1">Actions performed across the platform</p>
            </div>
            <span className="text-xs font-bold text-[#38BDF2] bg-[#38BDF2]/10 px-2 py-1 rounded-full">Live</span>
          </div>
          <div className="divide-y divide-[#2E2E2F]/5 h-full max-h-[500px] overflow-y-auto custom-scrollbar">
            {auditLogs.length === 0 && (
              <div className="p-20 text-center">
                <ICONS.Activity className="w-8 h-8 text-[#38BDF2]/40 mx-auto mb-4" />
                <p className="text-[10px] font-bold text-[#2E2E2F]/30">No Activity Found</p>
              </div>
            )}
            {auditLogs.map((log, i) => (
              <div 
                key={log.id || i} 
                className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#38BDF2]/5 transition-colors group/log cursor-pointer active:bg-[#38BDF2]/10"
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 rounded-xl bg-[#38BDF2] flex items-center justify-center shrink-0 shadow-sm text-white">
                    {log.action?.includes('LOGIN') ? <ICONS.Shield className="w-4 h-4" /> : <ICONS.Activity className="w-4 h-4" />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-[#2E2E2F]">{log.action || 'System Action'}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[#38BDF2] bg-[#38BDF2]/5 px-1.5 py-0.5 rounded-sm">{log.actorName || log.performedBy || 'System'}</span>
                      <span className="text-[10px] text-[#2E2E2F]/10 font-bold">•</span>
                      <p className="text-[10px] font-bold text-[#2E2E2F]/40">Target — {log.target || 'General'}</p>
                    </div>
                  </div>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-xs font-bold text-[#2E2E2F]/60">{new Date(log.timestamp).toLocaleDateString()}</p>
                  <p className="text-[10px] font-bold text-[#2E2E2F]/40">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-[#2E2E2F]/5 text-center bg-[#F2F2F2]/50">
            <p className="text-[10px] font-bold text-[#2E2E2F]/30 italic">System Audit Tracking Enabled</p>
          </div>
        </Card>

      </div>

      {/* Transaction Detail Modal */}
      <Modal
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title="Transaction Details"
      >
        {selectedTx && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-[#F2F2F2] rounded-xl border border-[#E0E0E0]">
              <div className="w-12 h-12 rounded-full bg-[#38BDF2] flex items-center justify-center text-white text-xl font-black">
                {(selectedTx.customerName || selectedTx.buyerName || 'O').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-black text-[#1E293B]">{selectedTx.customerName || selectedTx.buyerName || 'Organizer'}</p>
                <p className="text-xs font-bold text-[#1E293B]/40">{selectedTx.customerEmail || selectedTx.buyerEmail || 'No email provided'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#F2F2F2] rounded-xl border border-[#E0E0E0]">
                <p className="text-[10px] font-black text-[#1E293B]/30 mb-1">Plan Subscribed</p>
                <p className="text-sm font-black text-[#1E293B]">{selectedTx.planName || 'Standard Plan'}</p>
              </div>
              <div className="p-4 bg-[#F2F2F2] rounded-xl border border-[#E0E0E0]">
                <p className="text-[10px] font-black text-[#1E293B]/30 mb-1">Amount Paid</p>
                <p className="text-sm font-black text-[#38BDF2]">₱{Number(selectedTx.amount || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-[#F2F2F2] rounded-xl border border-[#E0E0E0]">
                <p className="text-[10px] font-black text-[#1E293B]/30 mb-1">Date</p>
                <p className="text-sm font-bold text-[#1E293B]">{new Date(selectedTx.createdAt || selectedTx.created_at).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-[#F2F2F2] rounded-xl border border-[#E0E0E0]">
                <p className="text-[10px] font-black text-[#1E293B]/30 mb-1">Order ID</p>
                <p className="text-[10px] font-mono font-bold text-[#1E293B]/60 truncate">{selectedTx.orderId || 'N/A'}</p>
              </div>
            </div>

            <div className="p-4 bg-[#F2F2F2] rounded-xl border border-[#E0E0E0]">
              <p className="text-[10px] font-black text-[#1E293B]/30 uppercase mb-2">Transaction Status</p>
              <div className="flex items-center gap-2">
                <div 
                  className={`w-2 h-2 rounded-full ${
                    ['FAILED', 'CANCELLED', 'CANCELED'].includes(String(selectedTx.paymentStatus || selectedTx.status || '').toUpperCase()) 
                      ? 'bg-red-500' 
                      : String(selectedTx.paymentStatus || selectedTx.status || '').toUpperCase() === 'PENDING' 
                        ? 'bg-amber-400' 
                        : 'bg-[#38BDF2]'
                  }`} 
                />
                <span className="text-sm font-black text-[#1E293B]">
                  {selectedTx.paymentStatus || selectedTx.status || 'COMPLETED'}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Activity Log Detail Modal */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Activity Log Details"
      >
        {selectedLog && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-5 bg-[#F2F2F2] rounded-2xl border border-[#E0E0E0]">
              <div className="w-14 h-14 rounded-full bg-[#38BDF2] flex items-center justify-center text-white text-xl font-bold shadow-sm">
                {selectedLog.action?.includes('LOGIN') ? <ICONS.Shield className="w-6 h-6" /> : <ICONS.Activity className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-lg font-black text-[#1E293B]">{selectedLog.action || 'System Action'}</p>
                <p className="text-xs font-bold text-[#1E293B]/40">
                  {new Date(selectedLog.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-[#F2F2F2] rounded-2xl border border-[#E0E0E0]">
                <p className="text-[10px] font-black text-[#1E293B]/30 mb-1 flex items-center gap-2">
                  <ICONS.Users className="w-3 h-3" /> Actor
                </p>
                <p className="text-sm font-black text-[#1E293B]">{selectedLog.actorName || selectedLog.performedBy || 'System'}</p>
              </div>
              <div className="p-5 bg-[#F2F2F2] rounded-2xl border border-[#E0E0E0]">
                <p className="text-[10px] font-black text-[#1E293B]/30 mb-1 flex items-center gap-2">
                  <ICONS.Users className="w-3 h-3" /> Target
                </p>
                <p className="text-sm font-black text-[#1E293B] truncate">{selectedLog.target || 'N/A'}</p>
              </div>
            </div>

            {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
              <div className="p-5 bg-[#F2F2F2] rounded-2xl border border-[#E0E0E0] space-y-3">
                <p className="text-[10px] font-black text-[#1E293B]/30 mb-2">Extended Details</p>
                <div className="space-y-2">
                  {Object.entries(selectedLog.details).map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <span className="text-[10px] font-bold text-[#1E293B]/40">{k}</span>
                      <pre className="text-sm font-bold text-[#1E293B] font-mono whitespace-pre-wrap break-all bg-transparent p-2 rounded-lg border border-[#E0E0E0]/80 mt-1">
                        {(() => {
                          if (v && typeof v === 'object') {
                            const vAny = v as any;
                            if (vAny.type === 'Buffer' && Array.isArray(vAny.data)) {
                              try {
                                const decoded = new TextDecoder().decode(new Uint8Array(vAny.data));
                                try {
                                  return JSON.stringify(JSON.parse(decoded), null, 2);
                                } catch {
                                  return decoded;
                                }
                              } catch {
                                return '[Binary Data]';
                              }
                            }
                            return JSON.stringify(v, null, 2);
                          }
                          return String(v);
                        })()}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedLog(null)} className="px-6 py-2 bg-[#F2F2F2] border border-[#E0E0E0] rounded-xl font-bold text-xs text-[#1E293B]/60 hover:text-[#1E293B] hover:border-[#E0E0E0] transition-colors">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Plan Modal */}
      <CreatePlanModal
        isOpen={isCreatePlanOpen}
        onClose={() => setIsCreatePlanOpen(false)}
        onSuccess={() => {
          setIsCreatePlanOpen(false);
        }}
      />

    </div>
  );
};
