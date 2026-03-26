
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { AnalyticsSummary, UserRole, AdminPlan, OrganizerProfile } from '../../types';
import { Card, PageLoader } from '../../components/Shared';
import { ICONS } from '../../constants';
import { useUser } from '../../context/UserContext';

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
      <p className="text-xs font-bold text-[#1E293B]/50 uppercase tracking-tight mb-0.5">{title}</p>
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

  useEffect(() => {
    const load = async () => {
      try {
        const [analytics, pm, h, adminPlans, orgs, txData] = await Promise.allSettled([
          apiService.getAnalytics(),
          apiService.getPlanMetrics(),
          apiService.getSubscriptionHealth(),
          apiService.getAdminPlans(),
          apiService.getOrganizers(),
          apiService.getRecentTransactions(1, 5),
        ]);
        let supportResult: any[] = [];
        try { const s = await (apiService.getAdminSupportTickets as any)(); supportResult = Array.isArray(s) ? s : s?.tickets || []; } catch {}
        setSupportTickets(supportResult);
        if (analytics.status === 'fulfilled') setAnalytics(analytics.value);
        if (pm.status === 'fulfilled') setPlanMetrics(pm.value);
        if (h.status === 'fulfilled') setHealth(h.value);
        if (adminPlans.status === 'fulfilled') setPlans(adminPlans.value);
        if (orgs.status === 'fulfilled') setOrganizers(orgs.value);
        if (txData.status === 'fulfilled') setRecentTx((txData.value as any)?.transactions || (txData.value as any)?.items || []);
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
    <div className="min-h-screen bg-[#F2F2F2] pb-16 space-y-8 px-4 lg:px-8 font-sans">

      {/* ── Header ── */}
      <div className="pt-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-[#1E293B]">Dashboard</h1>
          <p className="text-sm font-bold text-[#1E293B]/40 mt-0.5">
            Manage organizers, subscriptions, and platform health
          </p>
        </div>
        <button
          onClick={() => navigate('/settings?tab=plans&openPlanModal=1')}
          className="bg-[#38BDF2] text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg shadow-[#38BDF2]/20 hover:scale-105 transition-transform active:scale-95"
        >
          <ICONS.Plus className="w-4 h-4" /> Create New Plan
        </button>
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
              <p className="text-[10px] font-bold text-[#1E293B]/40 mt-1 uppercase tracking-widest">Last 10 Days</p>
            </div>
            <div className="bg-white border border-[#E0E0E0] px-3 py-1.5 rounded-lg text-xs font-black text-[#1E293B]/50">
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
              <p className="text-[10px] font-bold text-[#1E293B]/40 mt-1 uppercase tracking-widest">Organizer Subscriptions</p>
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
                <p className="text-[9px] font-bold text-[#1E293B]/40 uppercase">Active</p>
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
              <p className="text-[9px] font-black text-[#1E293B]/30 uppercase mt-1">Organizers</p>
            </div>
            <div>
              <p className="text-2xl font-black text-[#1E293B]">{activeSubscribers}</p>
              <p className="text-[9px] font-black text-[#1E293B]/30 uppercase mt-1">Subscribers</p>
            </div>
            <div>
              <p className="text-2xl font-black text-[#1E293B]">{pendingSupport}</p>
              <p className="text-[9px] font-black text-[#1E293B]/30 uppercase mt-1">Open Tickets</p>
            </div>
          </div>
        </Card>

      </div>

      {/* ── Row 4: Recent Transactions & Plans ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Recent Plan Transactions */}
        <Card className="bg-[#F2F2F2] border border-[#E0E0E0] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 flex justify-between items-center border-b border-white/60">
            <h3 className="font-black text-[#1E293B] flex items-center gap-2">
              <ICONS.CreditCard className="w-5 h-5 opacity-40" /> Recent Transactions
            </h3>
            <ICONS.MoreHorizontal className="w-5 h-5 text-[#1E293B]/20" />
          </div>
          <div className="divide-y divide-white/40">
            {recentTx.length === 0 && (
              <p className="p-6 text-xs font-bold text-[#1E293B]/40">No transactions yet.</p>
            )}
            {recentTx.slice(0, 5).map((tx, i) => (
              <div key={tx.orderId || i} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white border border-[#E0E0E0] flex items-center justify-center text-[#1E293B]/30">
                    <ICONS.Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#1E293B]">{tx.customerName || tx.buyerName || 'Organizer'}</p>
                    <p className="text-[10px] font-bold text-[#1E293B]/30 mt-0.5">
                      <span className="text-[#38BDF2]">{tx.planName || 'Plan'}</span> · {new Date(tx.createdAt || tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-black text-[#1E293B]">₱{Number(tx.amount || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Plan Catalog */}
        <Card className="bg-[#F2F2F2] border border-[#E0E0E0] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 flex justify-between items-center border-b border-white/60">
            <h3 className="font-black text-[#1E293B] flex items-center gap-2">
              <ICONS.Layout className="w-5 h-5 opacity-40" /> Active Plans
            </h3>
            <button
              onClick={() => navigate('/settings?tab=plans')}
              className="text-xs font-black text-[#38BDF2] hover:underline"
            >
              Manage
            </button>
          </div>
          <div className="divide-y divide-white/40">
            {plans.length === 0 && (
              <p className="p-6 text-xs font-bold text-[#1E293B]/40">No plans created yet.</p>
            )}
            {plans.slice(0, 5).map((plan) => {
              const color = planColors[plan.name] || planColors.default;
              return (
                <div key={plan.planId} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                    <div>
                      <p className="text-sm font-black text-[#1E293B]">{plan.name}</p>
                      <p className="text-[10px] font-bold text-[#1E293B]/30 mt-0.5">₱{(plan.monthlyPrice || 0).toLocaleString()}/month</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${plan.isActive ? 'bg-[#38BDF2]/10 text-[#38BDF2]' : 'bg-[#1E293B]/10 text-[#1E293B]/40'}`}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => navigate('/settings?tab=plans&openPlanModal=1')}
            className="w-full py-4 text-sm font-black text-[#38BDF2] hover:text-white hover:bg-[#38BDF2] transition-colors border-t border-white/60"
          >
            + Create New Plan
          </button>
        </Card>

      </div>

    </div>
  );
};
