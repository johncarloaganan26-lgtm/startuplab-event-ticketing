import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

// Simulate EXACTLY what the analytics controller does step by step
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function simulateGetSummary() {
    const results = { steps: [] };
    const requesterId = '597f3a3f-f6a2-44fd-bd37-a06d434242d8';

    try {
        // Step 1: getFilteredEventIds - lookup user by userId
        const step1 = { name: 'users.byUserId' };
        const byUserId = await supabase
            .from('users')
            .select('userId, role, email')
            .eq('userId', requesterId)
            .maybeSingle();
        step1.data = byUserId.data;
        step1.error = byUserId.error;
        results.steps.push(step1);

        const userProfile = byUserId.data;
        const role = String(userProfile?.role || '').toUpperCase();
        const isAdmin = ['ADMIN', 'STAFF'].includes(role === 'USER' ? 'ORGANIZER' : role);
        results.isAdmin = isAdmin;
        results.effectiveRole = role;

        // If admin, filteredEventIds = null (no filter)
        // Step 2: Query tickets
        const step2 = { name: 'tickets.query' };
        try {
            const ticketsQuery = supabase.from('tickets').select('ticketId, status, issuedAt, eventId');
            const { data: tickets, error: ticketErr } = await ticketsQuery;
            step2.count = tickets?.length;
            step2.error = ticketErr;
            step2.firstRow = tickets?.[0] || null;
        } catch (e) {
            step2.exception = e.message;
        }
        results.steps.push(step2);

        // Step 3: Query orders
        const step3 = { name: 'orders.query' };
        try {
            const ordersQuery = supabase.from('orders').select('orderId, totalAmount, status, created_at, eventId');
            const { data: orders, error: orderErr } = await ordersQuery;
            step3.count = orders?.length;
            step3.error = orderErr;
            step3.firstRow = orders?.[0] || null;
        } catch (e) {
            step3.exception = e.message;
        }
        results.steps.push(step3);

        // Step 4: test getSummary complete calculation
        const step4 = { name: 'full_calculation' };
        try {
            const { data: tickets } = await supabase.from('tickets').select('ticketId, status, issuedAt, eventId');
            const { data: orders } = await supabase.from('orders').select('orderId, totalAmount, status, created_at, eventId');

            const totalRegistrations = tickets?.length || 0;
            const usedCount = (tickets || []).filter(t => t.status === 'USED').length;
            const attendanceRate = totalRegistrations ? (usedCount / totalRegistrations) * 100 : 0;
            const paidOrders = (orders || []).filter(o => o.status === 'PAID');
            const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

            step4.result = { totalRegistrations, usedCount, attendanceRate, totalRevenue, paidOrdersCount: paidOrders.length };
        } catch (e) {
            step4.exception = e.message;
        }
        results.steps.push(step4);

    } catch (e) {
        results.fatalError = e.message;
        results.stack = e.stack;
    }

    writeFileSync('diag_simulate.json', JSON.stringify(results, null, 2), 'utf8');
    console.log('Written to diag_simulate.json');
}

simulateGetSummary();
