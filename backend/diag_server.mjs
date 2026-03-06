import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(cookieParser());
app.use(express.json());

// Test endpoint 1: simple json
app.get('/test1', (req, res) => {
    res.json({ ok: true });
});

// Test endpoint 2: with res.set like analytics does
app.get('/test2', (req, res) => {
    res.set('x-analytics-build', 'test');
    res.json({ ok: true });
});

// Test endpoint 3: async handler like analytics
app.get('/test3', async (req, res) => {
    try {
        res.set('x-analytics-build', 'test');
        const { data, error } = await supabase.from('users').select('userId').limit(1);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true, count: data?.length });
    } catch (err) {
        return res.status(500).json({ error: err?.message || 'Unexpected error' });
    }
});

// Test endpoint 4: exact mimic of getSummary
app.get('/test4', async (req, res) => {
    try {
        res.set('x-analytics-build', 'test4');

        // Tickets
        const { data: tickets, error: ticketErr } = await supabase
            .from('tickets')
            .select('ticketId, status, issuedAt, eventId');
        if (ticketErr) return res.status(500).json({ error: ticketErr.message });

        // Orders
        const { data: orders, error: orderErr } = await supabase
            .from('orders')
            .select('orderId, totalAmount, status, created_at, eventId');
        if (orderErr) return res.status(500).json({ error: orderErr.message });

        const totalRegistrations = tickets?.length || 0;
        const paidOrders = (orders || []).filter(o => o.status === 'PAID');
        const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        return res.json({
            totalRegistrations,
            ticketsSoldToday: 0,
            totalRevenue,
            revenueToday: 0,
            attendanceRate: 0,
            paymentSuccessRate: 0,
        });
    } catch (err) {
        return res.status(500).json({ error: err?.message || 'Unexpected error' });
    }
});

const PORT = 5555;
app.listen(PORT, () => {
    console.log(`Test server on port ${PORT}`);
    console.log('Test with:');
    console.log('  curl http://localhost:5555/test1');
    console.log('  curl http://localhost:5555/test2');
    console.log('  curl http://localhost:5555/test3');
    console.log('  curl http://localhost:5555/test4');
});
