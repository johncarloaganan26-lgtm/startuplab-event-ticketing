
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { apiService } from '../../services/apiService';
import { Card, Button, PageLoader, Modal } from '../../components/Shared';
import { ICONS } from '../../constants';

const HeroCard: React.FC<{
    title: string;
    value: string | number;
    sub: string;
    icon: React.ReactNode;
}> = ({ title, value, sub, icon }) => (
    <div className="p-5 rounded-2xl border border-[#E0E0E0] bg-[#F2F2F2] flex items-center gap-4 hover:scale-[1.01] transition-transform cursor-default">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#38BDF2] text-white shadow-sm">
            <div className="[&>svg]:w-6 [&>svg]:h-6">{icon}</div>
        </div>
        <div>
            <p className="text-xs font-bold text-[#2E2E2F]/50 tracking-tight mb-0.5">{title}</p>
            <p className="text-2xl font-black text-[#2E2E2F]">{value}</p>
            <p className="text-[10px] font-bold mt-1 text-[#38BDF2]">{sub}</p>
        </div>
    </div>
);

export const OrganizerDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { name, email } = useUser();
    const displayName = name?.trim() || email?.split('@')[0] || 'there';

    const [analytics, setAnalytics] = useState<any>(null);
    const [recentTx, setRecentTx] = useState<any[]>([]);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ paidEventsCount: 0 });
    const [selectedTx, setSelectedTx] = useState<any | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [selectedLog, setSelectedLog] = useState<any | null>(null);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [events, analyticsData, transactions, orders, logs] = await Promise.all([
                apiService.getUserEvents(),
                apiService.getAnalytics(),
                apiService.getRecentTransactions(1, 10).catch(() => ({ data: [] })),
                apiService.getRecentOrders(1, 10).catch(() => ({ data: [] })),
                apiService.getAuditLogs(1, 10).catch(() => ({ data: [] })),
            ]);

            const paidCount = events.filter(e =>
                (e.ticketTypes || []).some((t: any) => (t.priceAmount || 0) > 0)
            ).length;

            const normalizeArray = (val: any) => {
                if (Array.isArray(val)) return val;
                if (val && typeof val === 'object') {
                    return val.data || val.transactions || val.items || [];
                }
                return [];
            };

            setStats({ paidEventsCount: paidCount });
            setAnalytics(analyticsData);
            setRecentTx(normalizeArray(transactions));
            setRecentOrders(normalizeArray(orders));
            setAuditLogs(normalizeArray(logs));
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    if (loading) return <PageLoader label="Loading Analytics..." variant="page" />;

    return (
        <div className="space-y-10 max-w-7xl mx-auto pt-4 px-2 font-sans">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl md:text-[2rem] font-semibold text-[#2E2E2F] tracking-tight">Dashboard Overview</h1>
                    <p className="mt-1 text-sm font-semibold text-[#2E2E2F]/65">
                        See your latest registrations, tickets, and revenue at a glance.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/my-events?openModal=true')}
                        className="bg-[#38BDF2] text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-transform active:scale-95"
                    >
                        <ICONS.Plus className="w-4 h-4" /> Create New Event
                    </button>
                </div>
            </div>

            {/* ── Hero Stats ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <HeroCard
                    title="Total Registrations"
                    value={analytics?.totalRegistrations || 0}
                    sub="Lifetime attendees"
                    icon={<ICONS.Users />}
                />
                <HeroCard
                    title="Tickets Sold Today"
                    value={analytics?.ticketsSoldToday || 0}
                    sub="Recent activity"
                    icon={<ICONS.CheckCircle />}
                />
                <HeroCard
                    title="Total Revenue"
                    value={`PHP ${(analytics?.totalRevenue || 0).toLocaleString()}`}
                    sub="Gross earnings"
                    icon={<ICONS.TrendingUp />}
                />
                <HeroCard
                    title="Revenue Today"
                    value={`PHP ${(analytics?.revenueToday || 0).toLocaleString()}`}
                    sub="24h collection"
                    icon={<ICONS.CreditCard />}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
                <HeroCard
                    title="Attendance Rate"
                    value={`${(analytics?.attendanceRate || 0).toFixed(1)}%`}
                    sub="Checked-in vs Issued"
                    icon={<ICONS.Users />}
                />
                <HeroCard
                    title="Payment Success"
                    value={`${(analytics?.paymentSuccessRate || 0).toFixed(1)}%`}
                    sub="Completed vs Failed"
                    icon={<ICONS.Shield />}
                />
                <HeroCard
                    title="Total Paid Events"
                    value={stats.paidEventsCount}
                    sub="Revenue-driving sessions"
                    icon={<ICONS.Calendar />}
                />
            </div>

            {/* ── Lists Section ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-10">

                {/* All Transactions */}
                <Card className="bg-[#F2F2F2] border border-[#E0E0E0] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-[#2E2E2F]/5">
                        <h3 className="text-base font-black text-[#1E293B]">All Transactions</h3>
                        <p className="text-[10px] font-bold text-[#1E293B]/40 mt-1">Recent payments</p>
                    </div>
                    <div className="divide-y divide-[#2E2E2F]/5 overflow-y-auto max-h-[400px]">
                        {recentTx.length === 0 && (
                            <p className="p-10 text-center text-xs font-bold text-[#2E2E2F]/40">No Transactions Found</p>
                        )}
                        {recentTx.map((tx, i) => (
                            <div 
                                key={tx.orderId || i} 
                                onClick={() => setSelectedTx(tx)}
                                className="p-6 flex justify-between items-center hover:bg-[#38BDF2]/5 transition-colors cursor-pointer group/item"
                            >
                                <div className="space-y-1">
                                    <p className="font-bold text-sm text-[#2E2E2F] group-hover/item:text-[#38BDF2] transition-colors">{tx.customerName || tx.buyerName || 'Organizer'}</p>
                                    <p className="text-[10px] font-bold text-[#2E2E2F]/40">
                                        {tx.planName || 'Ai Automation'} • {new Date(tx.createdAt || tx.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] font-bold bg-[#38BDF2]/10 text-[#38BDF2] px-2 py-1 rounded-md mb-2 inline-block">PAID</span>
                                    <p className="font-bold text-sm text-[#2E2E2F]">PHP {Number(tx.amount || 0).toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-[#2E2E2F]/5 text-center">
                        <p className="text-[10px] font-bold text-[#2E2E2F]/30">End of List</p>
                    </div>
                </Card>

                {/* Recent Orders */}
                <Card className="bg-[#F2F2F2] border border-[#E0E0E0] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-[#2E2E2F]/5">
                        <h3 className="text-base font-black text-[#1E293B]">Recent Orders</h3>
                        <p className="text-[10px] font-bold text-[#1E293B]/40 mt-1">Ticket purchases</p>
                    </div>
                    <div className="divide-y divide-[#2E2E2F]/5 overflow-y-auto max-h-[400px]">
                        {recentOrders.length === 0 && (
                            <p className="p-10 text-center text-xs font-bold text-[#2E2E2F]/40">No Orders Yet</p>
                        )}
                        {recentOrders.map((order, i) => (
                            <div 
                                key={order.orderId || i} 
                                onClick={() => setSelectedOrder(order)}
                                className="p-6 flex justify-between items-center hover:bg-[#38BDF2]/5 transition-colors cursor-pointer group/item"
                            >
                                <div className="space-y-1">
                                    <p className="font-bold text-sm text-[#2E2E2F] group-hover/item:text-[#38BDF2] transition-colors">{order.buyerName}</p>
                                    <p className="text-[10px] font-bold text-[#2E2E2F]/40">
                                        {order.eventName} • Order #{order.orderId?.slice(-8)} • {new Date(order.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[9px] font-bold bg-[#38BDF2]/10 text-[#38BDF2] px-2 py-1 rounded-md mb-2 inline-block">PAID</span>
                                    <p className="font-bold text-sm text-[#2E2E2F]">PHP {Number(order.totalAmount || 0).toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-[#2E2E2F]/5 text-center">
                        <p className="text-[10px] font-bold text-[#2E2E2F]/30">End of List</p>
                    </div>
                </Card>

            </div>

            {/* Audit Logs */}
            <Card className="bg-[#F2F2F2] border border-[#E0E0E0] rounded-2xl shadow-sm overflow-hidden flex flex-col mt-5">
                <div className="p-6 border-b border-[#2E2E2F]/5 flex justify-between items-center">
                    <div>
                        <h3 className="text-base font-black text-[#1E293B]">Activity Logs</h3>
                        <p className="text-[10px] font-bold text-[#1E293B]/40 mt-1">Actions performed on your account</p>
                    </div>
                    <span className="text-xs font-bold text-[#38BDF2] bg-[#38BDF2]/10 px-2 py-1 rounded-full">Live</span>
                </div>
                <div className="divide-y divide-[#2E2E2F]/5 overflow-y-auto max-h-[500px]">
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
                <div className="p-4 border-t border-[#2E2E2F]/5 bg-white/30 text-center">
                    <button 
                        onClick={() => navigate('/user/reports')}
                        className="text-xs font-bold text-[#38BDF2] hover:underline transition-colors"
                    >
                        View System Logs
                    </button>
                </div>
            </Card>

            {/* Transaction Detail Modal */}
            <Modal
                isOpen={!!selectedTx}
                onClose={() => setSelectedTx(null)}
                title="Transaction Details"
                subtitle="Verification for subscriber payments"
            >
                {selectedTx && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-5 bg-[#F2F2F2] rounded-2xl border border-[#E0E0E0]">
                            <div className="w-14 h-14 rounded-full bg-[#38BDF2] flex items-center justify-center text-white text-xl font-bold shadow-sm">
                                {(selectedTx.customerName || selectedTx.buyerName || 'O').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-[#2E2E2F]/40 leading-none mb-1">Customer / Subscriber</p>
                                <p className="text-lg font-bold text-[#2E2E2F] leading-tight">{selectedTx.customerName || selectedTx.buyerName || 'Subscriber'}</p>
                                <p className="text-xs font-bold text-[#38BDF2]">{selectedTx.customerEmail || selectedTx.buyerEmail || 'No email provided'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-[#F2F2F2] rounded-xl border border-[#E0E0E0]">
                                <p className="text-[10px] font-bold text-[#2E2E2F]/40 mb-1">Reference ID</p>
                                <p className="text-xs font-bold text-[#2E2E2F] font-mono">{selectedTx.orderId || 'N/A'}</p>
                            </div>
                            <div className="p-4 bg-[#F2F2F2] rounded-xl border border-[#E0E0E0]">
                                <p className="text-[10px] font-bold text-[#2E2E2F]/40 mb-1">Payment Date</p>
                                <p className="text-xs font-bold text-[#2E2E2F]">{new Date(selectedTx.createdAt || selectedTx.created_at).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="p-5 bg-white rounded-2xl border border-[#E0E0E0] space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-[#2E2E2F]/60">Payment Mode</span>
                                <span className="text-sm font-bold text-[#2E2E2F]">{selectedTx.paymentMethod || 'HitPay'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-[#2E2E2F]/60">Subscription Plan</span>
                                <span className="text-sm font-bold text-[#38BDF2]">{selectedTx.planName || 'Ai Automation'}</span>
                            </div>
                            <div className="h-[1px] bg-[#E0E0E0]" />
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-base font-bold text-[#2E2E2F]">Total Amount</span>
                                <span className="text-xl font-black text-[#2E2E2F]">PHP {Number(selectedTx.amount || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <Button variant="secondary" onClick={() => setSelectedTx(null)} className="px-6 rounded-xl font-bold text-xs">Close</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Order Detail Modal */}
            <Modal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title="Order Details"
                subtitle="Complete ticket purchase breakdown"
            >
                {selectedOrder && (
                    <div className="space-y-6">
                        <div className="p-6 bg-[#F2F2F2] border border-[#E0E0E0] rounded-2xl flex justify-between items-center shadow-sm">
                            <div>
                                <p className="text-[10px] font-bold text-[#2E2E2F]/40 mb-1">Order Total</p>
                                <h2 className="text-3xl font-black text-[#2E2E2F] tracking-tight">PHP {Number(selectedOrder.totalAmount || 0).toLocaleString()}</h2>
                            </div>
                            <div className="bg-[#38BDF2]/10 px-3 py-1.5 rounded-lg border border-[#38BDF2]/20">
                                <span className="text-xs font-bold text-[#38BDF2]">PAID</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 bg-[#F2F2F2] rounded-xl border border-[#E0E0E0]">
                                <div className="w-10 h-10 rounded-xl bg-[#38BDF2] flex items-center justify-center text-white">
                                    <ICONS.Calendar className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-[#2E2E2F]/40 leading-none mb-1">Event</p>
                                    <p className="text-sm font-bold text-[#2E2E2F] truncate">{selectedOrder.eventName || 'Unnamed Event'}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-[#F2F2F2] rounded-xl border border-[#E0E0E0]">
                                <div className="w-10 h-10 rounded-xl bg-[#38BDF2] flex items-center justify-center text-white">
                                    <ICONS.Users className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-[#2E2E2F]/40 leading-none mb-1">Buyer</p>
                                    <p className="text-sm font-bold text-[#2E2E2F] truncate">{selectedOrder.buyerName}</p>
                                    <p className="text-[10px] font-bold text-[#38BDF2]">{selectedOrder.buyerEmail}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 bg-white rounded-2xl border border-[#E0E0E0] space-y-4 shadow-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-[#2E2E2F]/50">Order ID</span>
                                <span className="text-sm font-bold text-[#2E2E2F] font-mono">{selectedOrder.orderId}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-[#2E2E2F]/50">Date</span>
                                <span className="text-sm font-bold text-[#2E2E2F]">{new Date(selectedOrder.createdAt).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="pt-6 flex justify-end">
                            <Button onClick={() => setSelectedOrder(null)} className="px-6 rounded-xl font-bold text-xs">Close</Button>
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
        </div>
    );
};
