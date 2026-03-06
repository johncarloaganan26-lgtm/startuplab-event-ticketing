import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { apiService } from '../../services/apiService';
import { ICONS } from '../../constants';
import { format } from 'date-fns';

const MyTicketsPage: React.FC = () => {
    const { name, email, imageUrl, isAuthenticated } = useUser();
    const navigate = useNavigate();
    const displayName = name?.trim() || email?.split('@')[0] || 'User';
    const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<any[]>([]);

    // Real counts
    const [ordersCount, setOrdersCount] = useState(0);
    const [likesCount, setLikesCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);

    const fetchStats = async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const [ordersRes, likedIds, followingIds] = await Promise.all([
                apiService.getMyOrders().catch(() => ({ orders: [], count: 0 })),
                apiService.getMyLikedEventIds().catch(() => []),
                apiService.getMyFollowingOrganizerIds().catch(() => []),
            ]);

            // Sort orders: newest first
            const sortedOrders = (ordersRes.orders || []).sort((a: any, b: any) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            setOrders(sortedOrders);
            setOrdersCount(ordersRes.count);
            setLikesCount(likedIds.length);
            setFollowingCount(followingIds.length);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [isAuthenticated]);

    const filteredOrders = orders.filter(order => {
        const eventDate = order.eventStartAt ? new Date(order.eventStartAt) : new Date();
        const now = new Date();
        if (activeTab === 'upcoming') {
            return eventDate >= now;
        } else {
            return eventDate < now;
        }
    });

    const formatDateText = (dateStr?: string) => {
        if (!dateStr) return 'Date TBA';
        try {
            return format(new Date(dateStr), 'MMM d, yyyy · h:mm aa');
        } catch {
            return 'Invalid Date';
        }
    };

    return (
        <div className="min-h-[70vh] max-w-3xl mx-auto px-4 sm:px-6 py-10">
            {/* Profile Header */}
            <div className="flex items-center gap-5 mb-10">
                <div className="w-20 h-20 rounded-full bg-[#F2F2F2] border-2 border-[#2E2E2F]/10 flex items-center justify-center overflow-hidden shrink-0">
                    {imageUrl ? (
                        <img src={imageUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                        <svg className="w-10 h-10 text-[#2E2E2F]/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    )}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-black text-[#2E2E2F] tracking-tight">{displayName}</h1>
                        <button
                            onClick={() => navigate('/user-settings?tab=account')}
                            title="Edit Profile"
                            className="w-7 h-7 rounded-lg border border-[#2E2E2F]/10 flex items-center justify-center hover:bg-[#38BDF2]/10 hover:border-[#38BDF2]/30 transition-colors group"
                        >
                            <svg className="w-3.5 h-3.5 text-[#2E2E2F]/40 group-hover:text-[#38BDF2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-sm text-[#2E2E2F]/50 font-medium mt-1">
                        {loading && orders.length === 0 ? (
                            <span className="inline-flex gap-1 items-center">
                                <span className="w-3 h-3 rounded-full bg-[#2E2E2F]/10 animate-pulse" />
                                <span className="text-[#2E2E2F]/30">Loading...</span>
                            </span>
                        ) : (
                            <>
                                <button
                                    onClick={() => navigate('/my-tickets')}
                                    className="hover:text-[#38BDF2] transition-colors"
                                >
                                    {ordersCount} orders
                                </button>
                                &nbsp;·&nbsp;
                                <button
                                    onClick={() => navigate('/liked')}
                                    className="hover:text-[#38BDF2] transition-colors"
                                >
                                    {likesCount} likes
                                </button>
                                &nbsp;·&nbsp;
                                <button
                                    onClick={() => navigate('/followings')}
                                    className="hover:text-[#38BDF2] transition-colors"
                                >
                                    {followingCount} following
                                </button>
                            </>
                        )}
                    </p>
                </div>
            </div>

            {/* Orders Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-black text-[#2E2E2F] tracking-tight">Orders</h2>
                    <div className="flex gap-2 p-1.5 bg-[#F2F2F2] rounded-2xl border border-[#2E2E2F]/5">
                        <button
                            onClick={() => setActiveTab('upcoming')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all duration-300 ${activeTab === 'upcoming' ? 'bg-white text-[#38BDF2] shadow-sm scale-105' : 'text-[#2E2E2F]/40 hover:text-[#2E2E2F]'}`}
                        >
                            UPCOMING
                        </button>
                        <button
                            onClick={() => setActiveTab('past')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all duration-300 ${activeTab === 'past' ? 'bg-white text-[#38BDF2] shadow-sm scale-105' : 'text-[#2E2E2F]/40 hover:text-[#2E2E2F]'}`}
                        >
                            PAST
                        </button>
                    </div>
                </div>

                {loading && orders.length === 0 ? (
                    <div className="flex flex-col gap-5">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 rounded-[2rem] bg-[#F2F2F2] animate-pulse" />
                        ))}
                    </div>
                ) : filteredOrders.length > 0 ? (
                    <div className="flex flex-col gap-5">
                        {filteredOrders.map((order) => (
                            <div
                                key={order.orderId}
                                onClick={() => navigate(`/payment-status?sessionId=${order.orderId}`)}
                                className="group cursor-pointer p-8 rounded-[2rem] bg-[#F2F2F2] border border-[#2E2E2F]/5 hover:border-[#38BDF2]/30 transition-all duration-500 hover:shadow-2xl hover:shadow-[#38BDF2]/10 hover:bg-white hover:scale-[1.02]"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="px-3 py-1 bg-white rounded-lg shadow-sm border border-[#2E2E2F]/5">
                                                <p className="text-[9px] font-black text-[#38BDF2] uppercase tracking-widest leading-none">
                                                    {order.status === 'PAID' ? 'Confirmed' : order.status}
                                                </p>
                                            </div>
                                            <p className="text-[10px] font-bold text-[#2E2E2F]/30 uppercase tracking-[0.2em] leading-none">
                                                #{order.orderId.slice(-8).toUpperCase()}
                                            </p>
                                        </div>

                                        <h3 className="text-2xl font-black text-[#2E2E2F] tracking-tight mb-2 group-hover:text-[#38BDF2] transition-colors leading-[1.1]">
                                            {order.eventName || 'Untitled Event'}
                                        </h3>

                                        <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
                                            <p className="text-sm font-bold text-[#2E2E2F]/50">
                                                {formatDateText(order.eventStartAt)}
                                            </p>
                                            <span className="w-1 h-1 bg-[#2E2E2F]/10 rounded-full hidden sm:block"></span>
                                            <div className="flex items-center gap-1.5">
                                                <ICONS.CheckCircle className={`w-3.5 h-3.5 ${order.ticketStats?.allUsed ? 'text-[#2E2E2F]/30' : order.ticketStats?.someUsed ? 'text-amber-500' : 'text-[#38BDF2]'}`} />
                                                <p className={`text-[11px] font-black uppercase tracking-wider ${order.ticketStats?.allUsed ? 'text-[#2E2E2F]/30' : order.ticketStats?.someUsed ? 'text-amber-500' : 'text-[#38BDF2]'}`}>
                                                    {order.ticketStats?.allUsed ? 'USED' : order.ticketStats?.someUsed ? `PARTIALLY USED (${order.ticketStats.used}/${order.ticketStats.total})` : 'VALID ACCESS'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const slug = order.eventSlug || order.events?.slug;
                                                if (slug) navigate(`/events/${slug}`);
                                                else navigate('/');
                                            }}
                                            className="px-4 py-2.5 rounded-xl bg-white border border-[#2E2E2F]/5 text-[10px] font-black uppercase tracking-widest text-[#2E2E2F]/60 hover:text-[#38BDF2] hover:border-[#38BDF2]/30 transition-all shadow-sm"
                                        >
                                            EVENT PAGE
                                        </button>
                                        <div className="w-12 h-12 rounded-2xl bg-white border border-[#2E2E2F]/5 flex items-center justify-center group-hover:bg-[#38BDF2] group-hover:border-[#38BDF2] transition-all duration-500 shadow-sm">
                                            <svg className="w-6 h-6 text-[#2E2E2F]/20 group-hover:text-white transition-all transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center py-20 bg-[#F2F2F2]/50 rounded-[2.5rem] border border-dashed border-[#2E2E2F]/10">
                        <div className="w-16 h-16 rounded-[2rem] bg-[#38BDF2]/10 border border-[#38BDF2]/20 flex items-center justify-center mb-6">
                            <ICONS.Ticket className="w-9 h-9 text-[#38BDF2]" />
                        </div>
                        <p className="text-base font-bold text-[#2E2E2F]/70 mb-2">
                            {activeTab === 'upcoming' ? 'No upcoming orders' : 'No past orders'}
                        </p>
                        {activeTab === 'upcoming' ? (
                            <button
                                onClick={() => setActiveTab('past')}
                                className="text-sm font-bold text-[#38BDF2] hover:text-[#38BDF2]/80 transition-colors mt-1"
                            >
                                See past orders
                            </button>
                        ) : (
                            <button
                                onClick={() => navigate('/')}
                                className="text-sm font-bold text-[#38BDF2] hover:text-[#38BDF2]/80 transition-colors mt-1"
                            >
                                Browse sessions
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyTicketsPage;

