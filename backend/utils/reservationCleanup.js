import supabase from '../database/db.js';

const DEFAULT_CLEANUP_INTERVAL_MS = 60_000; // 1 minute

const getNumberEnv = (key, fallback) => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const runReservationCleanup = async () => {
  console.log(`[ReservationCleanup] Running cleanup at`, new Date().toISOString());
  const now = new Date();
  const { data: expiredOrders, error } = await supabase
    .from('orders')
    .select('orderId, expiresAt')
    .eq('status', 'PENDING_PAYMENT')
    .not('expiresAt', 'is', null)
    .lt('expiresAt', now.toISOString());

  if (error) {
    console.error('Reservation cleanup failed to load orders', error);
    return { cleaned: 0, error: error.message };
  }

  if (!expiredOrders || expiredOrders.length === 0) {
    return { cleaned: 0 };
  }

  let cleaned = 0;

  for (const order of expiredOrders) {
    try {
      const { data: orderItems, error: itemsErr } = await supabase
        .from('orderItems')
        .select('ticketTypeId, quantity')
        .eq('orderId', order.orderId);

      if (itemsErr) {
        console.error('Reservation cleanup failed to load order items', order.orderId, itemsErr);
        continue;
      }

      const qtyByType = {};
      for (const item of orderItems || []) {
        qtyByType[item.ticketTypeId] = (qtyByType[item.ticketTypeId] || 0) + (item.quantity || 0);
      }

      const typeIds = Object.keys(qtyByType);
      if (typeIds.length) {
        const { data: ticketTypes, error: typesErr } = await supabase
          .from('ticketTypes')
          .select('ticketTypeId, quantitySold')
          .in('ticketTypeId', typeIds);

        if (typesErr) {
          console.error('Reservation cleanup failed to load ticket types', order.orderId, typesErr);
          continue;
        }

        for (const tt of ticketTypes || []) {
          const dec = qtyByType[tt.ticketTypeId] || 0;
          const newSold = Math.max(0, (tt.quantitySold || 0) - dec);
          const { error: updErr } = await supabase
            .from('ticketTypes')
            .update({ quantitySold: newSold })
            .eq('ticketTypeId', tt.ticketTypeId);
          if (updErr) {
            console.error('Reservation cleanup failed to update ticket type', order.orderId, updErr);
          }
        }
      }

      await supabase.from('tickets').delete().eq('orderId', order.orderId);
      await supabase.from('attendees').delete().eq('orderId', order.orderId);

      const { error: orderErr } = await supabase
        .from('orders')
        .update({ status: 'EXPIRED', updated_at: now.toISOString() })
        .eq('orderId', order.orderId);

      if (orderErr) {
        console.error('Reservation cleanup failed to update order', order.orderId, orderErr);
        continue;
      }

      cleaned += 1;
    } catch (err) {
      console.error('Reservation cleanup error', order.orderId, err);
    }
  }

  return { cleaned };
};

export const startReservationCleanup = () => {
  const intervalMs = getNumberEnv('RESERVATION_CLEANUP_INTERVAL_MS', DEFAULT_CLEANUP_INTERVAL_MS);
  if (intervalMs <= 0) return;

  runReservationCleanup().catch(err => console.error('Reservation cleanup initial run failed', err));

  setInterval(() => {
    runReservationCleanup().catch(err => console.error('Reservation cleanup run failed', err));
  }, intervalMs);
};
