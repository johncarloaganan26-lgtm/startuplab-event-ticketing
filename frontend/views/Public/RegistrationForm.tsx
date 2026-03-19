import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Event, TicketType } from '../../types';
import { Button, Card, Input, PageLoader } from '../../components/Shared';
import { ICONS } from '../../constants';
import { useUser } from '../../context/UserContext';

const PAYMENT_METHODS = [
  {
    id: 'gcash',
    label: 'GCash',
    description: 'E-wallet',
    hitpayMethod: 'gcash',
    feeRate: 0.023,
    feeLabel: '2.3%'
  }
];

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  });

export const RegistrationForm: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { name: userName, email: userEmail, isAuthenticated } = useUser();

  const [event, setEvent] = useState<Event | null>(null);
  const [selectedItems, setSelectedItems] = useState<{ ticket: TicketType, qty: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    termsAccepted: false
  });

  const [extraGuests, setExtraGuests] = useState<{ name: string; email: string }[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState(PAYMENT_METHODS[0].id);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || userName || '',
        email: prev.email || userEmail || ''
      }));
    }
  }, [isAuthenticated, userName, userEmail]);

  useEffect(() => {
    if (slug) {
      apiService.getEventBySlug(slug).then(data => {
        setEvent(data);
        if (data) {
          try {
            const selectionRaw = searchParams.get('selections');
            if (selectionRaw) {
              const parsed: { id: string, qty: number }[] = JSON.parse(decodeURIComponent(selectionRaw));
              const items = parsed.map(p => {
                const t = data.ticketTypes.find(tick => tick.ticketTypeId === p.id);
                return t ? { ticket: t, qty: p.qty } : null;
              }).filter(i => i !== null) as { ticket: TicketType, qty: number }[];
              setSelectedItems(items);
            }
          } catch (e) {
          }
        }
        setLoading(false);
      });
    }
  }, [slug, searchParams]);

  const now = new Date();
  
  // Calculate effective price for each item (applying discount if within sales window)
  const getEffectivePrice = (ticket: any) => {
    if (ticket.priceAmount === 0) return 0;
    
    if (ticket.saleDiscountPercent && ticket.saleDiscountPercent > 0) {
      const salesStart = ticket.salesStartAt ? new Date(ticket.salesStartAt) : null;
      const salesEnd = ticket.salesEndAt ? new Date(ticket.salesEndAt) : null;
      
      // Apply discount only if we're within the sales window
      const isInSalesWindow = (!salesStart || now >= salesStart) && (!salesEnd || now <= salesEnd);
      if (isInSalesWindow) {
        return Math.round(ticket.priceAmount * (100 - ticket.saleDiscountPercent) / 100);
      }
    }
    
    return ticket.priceAmount;
  };

  const subtotal = selectedItems.reduce((acc, item) => acc + (getEffectivePrice(item.ticket) * item.qty), 0);
  const totalQuantity = selectedItems.reduce((acc, item) => acc + item.qty, 0);
  const totalGuests = selectedItems.reduce((acc, item) => acc + (item.qty * (item.ticket.capacityPerTicket || 1)), 0);

  // Check registration window
  const regOpen = event?.regOpenAt ? new Date(event.regOpenAt) : null;
  const regClose = event?.regCloseAt ? new Date(event.regCloseAt) : null;
  const isRegistrationOpen = (!regOpen || now >= regOpen) && (!regClose || now <= regClose);
  const registrationStatus = regOpen && now < regOpen 
    ? `Registration opens on ${regOpen.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : regClose && now > regClose
    ? 'Registration has closed'
    : null;

  // Sync extraGuests array size with totalGuests - 1
  useEffect(() => {
    const needed = Math.max(0, totalGuests - 1);
    if (extraGuests.length !== needed) {
      setExtraGuests(prev => {
        if (prev.length > needed) return prev.slice(0, needed);
        const next = [...prev];
        while (next.length < needed) {
          next.push({ name: '', email: '' });
        }
        return next;
      });
    }
  }, [totalGuests]);

  let discountAmount = 0;
  if (appliedPromo) {
    if (appliedPromo.discountType === 'PERCENTAGE') {
      discountAmount = (subtotal * Number(appliedPromo.discountValue)) / 100;
    } else {
      discountAmount = Number(appliedPromo.discountValue);
    }
  }

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const selectedPayment = PAYMENT_METHODS.find((method) => method.id === paymentMethodId) ?? PAYMENT_METHODS[0];

  let paymentFee = 0;
  if (discountedSubtotal > 0) {
    paymentFee = roundCurrency(discountedSubtotal * selectedPayment.feeRate);
  }

  const totalPayable = roundCurrency(discountedSubtotal + paymentFee);
  const hasPaid = totalPayable > 0;
  const brandColor = event?.organizer?.brandColor || '#38BDF2';

  const handleApplyPromo = async () => {
    if (!event?.eventId || !promoCode) return;
    setPromoError(null);
    setValidatingPromo(true);
    try {
      const promo = await apiService.validatePromotion(event.eventId, promoCode);
      setAppliedPromo(promo);
      setPromoCode(promo.code); // normalized
    } catch (err: any) {
      setPromoError(err.message || 'Invalid promotion code');
      setAppliedPromo(null);
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError(null);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Full name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.termsAccepted) newErrors.terms = 'You must accept the terms';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validate() || !event || selectedItems.length === 0) return;

    setSubmitting(true);
    try {
      const { orderId } = await apiService.createOrderTransaction({
        eventId: event.eventId,
        buyerName: formData.name,
        buyerEmail: formData.email,
        buyerPhone: formData.phone,
        company: formData.company,
        items: selectedItems.map(i => ({ ticketTypeId: i.ticket.ticketTypeId, quantity: i.qty, price: getEffectivePrice(i.ticket) })),
        totalAmount: totalPayable,
        currency: selectedItems[0]?.ticket.currency || 'PHP',
        promoCode: appliedPromo?.code || null,
        extraGuests: extraGuests // Pass extra guest details
      });
      if (!hasPaid) {
        navigate(`/payment/status?sessionId=${orderId}`); // Free order also goes to status page for confirmation
      } else {
        // Paid: create HitPay checkout session then redirect
        const { checkoutUrl, status } = await apiService.createHitpayCheckoutSession(orderId);
        if (checkoutUrl && checkoutUrl !== 'null' && checkoutUrl !== 'undefined') {
          window.location.href = checkoutUrl;
        } else {
          // Mock/disabled HitPay: go straight to status page
          navigate(`/payment/status?sessionId=${orderId}&status=${status || 'PAID'}`);
        }
      }
    } catch (err: any) {
      console.error('[Registration] Error:', err);
      const data = err.response?.data;
      let message = data?.error || err.message || 'Registration failed. Please try again.';
      if (data?.message) {
        message = `${message}: ${data.message}`;
      }
      setApiError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <PageLoader label="Loading registration form..." variant="page" />
  );

  if (!event || selectedItems.length === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F2F2]">
      <Card className="p-10 text-center max-w-sm">
        <h2 className="text-xl font-black text-[#2E2E2F] mb-2">Session Expired</h2>
        <p className="text-[#2E2E2F]/70 text-sm mb-6">Please restart your registration from the event page.</p>
        <Button onClick={() => navigate('/')}>Return to Events</Button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2F2F2] px-4 py-6 sm:px-6 sm:py-8 lg:py-12">
      <div className="max-w-6xl mx-auto">

        <div className="mb-8 sm:mb-10">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#2E2E2F]/60 hover:text-[#2E2E2F] font-semibold text-[10px] uppercase tracking-wide transition-colors mb-4"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Change Selection
          </button>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#2E2E2F] tracking-tighter mb-1 leading-tight sm:leading-none">
            Complete Registration
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-[#F2F2F2] text-[9px] font-semibold px-2.5 py-1 rounded-xl uppercase tracking-wide" style={{ backgroundColor: brandColor }}>
              {totalGuests} {totalGuests === 1 ? 'Ticket' : 'Tickets'}
            </span>
            <p className="text-[#2E2E2F]/70 font-medium text-sm">
              for <span className="text-[#2E2E2F] font-semibold">{event.eventName}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">

          <div className="flex-1 w-full">
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              <Card className="p-5 sm:p-6 lg:p-8 border border-[#2E2E2F]/10 rounded-xl sm:rounded-xl bg-[#F2F2F2] relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center justify-center gap-5 mb-6 sm:mb-8">
                    <div className="w-12 h-px bg-[#2E2E2F]/10"></div>
                    <h3 className="text-[12px] font-semibold text-[#2E2E2F] uppercase tracking-wide whitespace-nowrap text-center">
                      Primary Registrant
                    </h3>
                    <div className="w-12 h-px bg-[#2E2E2F]/10"></div>
                  </div>

                  {apiError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600">
                      <ICONS.AlertTriangle className="w-5 h-5 shrink-0" />
                      <p className="text-xs font-semibold uppercase tracking-wide leading-relaxed">
                        {apiError}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-5 sm:gap-y-6">
                    <div className="space-y-2">
                      <label className="text-[13px] font-medium text-[#2E2E2F]/70 ml-1">Full Name *</label>
                      <Input
                        placeholder="Full name as per identification"
                        className="sm:min-h-auto font-normal bg-[#F2F2F2] rounded-xl text-[14px]"
                        style={{ '--tw-ring-color': brandColor } as any}
                        value={formData.name}
                        onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                        error={errors.name}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[13px] font-medium text-[#2E2E2F]/70 ml-1">Email Address *</label>
                      <Input
                        type="email"
                        placeholder="name@organization.com"
                        className="sm:min-h-auto font-normal bg-[#F2F2F2] rounded-xl text-[14px]"
                        style={{ '--tw-ring-color': brandColor } as any}
                        value={formData.email}
                        onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
                        error={errors.email}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[13px] font-medium text-[#2E2E2F]/70 ml-1">Contact Number</label>
                      <Input
                        placeholder="+63 ...."
                        className="sm:min-h-auto font-normal bg-[#F2F2F2] rounded-xl text-[14px]"
                        value={formData.phone}
                        onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[13px] font-medium text-[#2E2E2F]/70 ml-1">Company</label>
                      <Input
                        placeholder="Organization / Entity"
                        className="sm:min-h-auto font-normal bg-[#F2F2F2] rounded-xl text-[14px]"
                        value={formData.company}
                        onChange={(e: any) => setFormData({ ...formData, company: e.target.value })}
                      />
                    </div>

                    {/* Dynamic Guest Inputs for Bundles */}
                    {extraGuests.length > 0 && (
                      <div className="md:col-span-2 pt-8 border-t border-[#2E2E2F]/10 space-y-6">
                        <div className="flex items-center justify-center gap-5">
                          <div className="w-12 h-px bg-[#2E2E2F]/10"></div>
                          <h3 className="text-[12px] font-semibold text-[#2E2E2F] uppercase tracking-wide whitespace-nowrap text-center">Guest Information ({extraGuests.length} additional)</h3>
                          <div className="w-12 h-px bg-[#2E2E2F]/10"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {extraGuests.map((guest, index) => (
                            <div key={index} className="p-6 border border-[#2E2E2F]/10 rounded-xl bg-[#F2F2F2] transition-all">
                              <div className="flex items-center gap-3 mb-5">
                                <div className="w-8 h-8 rounded-xl bg-[#2E2E2F]/10 flex items-center justify-center text-[11px] font-black text-[#2E2E2F]">
                                  {index + 2}
                                </div>
                                <span className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-widest">Additional Guest</span>
                              </div>
                              
                                <div className="space-y-4">
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium text-[#2E2E2F]/70 ml-1">Guest Full Name</label>
                                    <Input
                                      placeholder="Full name as per identification"
                                      className="sm:min-h-auto font-normal bg-[#F2F2F2] rounded-xl text-[14px]"
                                      style={{ '--tw-ring-color': brandColor } as any}
                                      value={guest.name}
                                      onChange={(e: any) => {
                                        const newGuests = [...extraGuests];
                                        newGuests[index] = { ...newGuests[index], name: e.target.value };
                                        setExtraGuests(newGuests);
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium text-[#2E2E2F]/70 ml-1">Guest Email Address</label>
                                    <Input
                                      type="email"
                                      placeholder="name@organization.com"
                                      className="sm:min-h-auto font-normal bg-[#F2F2F2] rounded-xl text-[14px]"
                                      style={{ '--tw-ring-color': brandColor } as any}
                                      value={guest.email}
                                      onChange={(e: any) => {
                                        const newGuests = [...extraGuests];
                                        newGuests[index] = { ...newGuests[index], email: e.target.value };
                                        setExtraGuests(newGuests);
                                      }}
                                    />
                                  </div>
                                </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="md:col-span-2 pt-8 border-t border-[#2E2E2F]/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-semibold text-[#2E2E2F] uppercase tracking-wide">Payment Method</p>
                      </div>
                      <div className="space-y-3">
                        <select
                          className="w-full p-3 rounded-xl border border-[#2E2E2F]/20 bg-[#F2F2F2] text-[13px] font-normal text-[#2E2E2F] focus:border-[#38BDF2]/40 outline-none disabled:opacity-60"
                          value={paymentMethodId}
                          onChange={e => setPaymentMethodId(e.target.value)}
                          aria-label="Select payment method"
                          disabled={subtotal === 0}
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method.id} value={method.id}>
                              {method.label} — {method.description}
                            </option>
                          ))}
                        </select>
                        <div className={`mt-2 text-xs font-medium ${subtotal === 0 ? 'text-[#2E2E2F]/30' : 'text-[#2E2E2F]/70'}`}>
                          Fee: <span style={{ color: brandColor }}>{selectedPayment.feeLabel}</span>
                          {subtotal === 0 && <span className="ml-2">(No payment required for free ticket)</span>}
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 pt-4 border-t border-[#2E2E2F]/10 space-y-4">
                      <label className="flex items-start gap-4 cursor-pointer group select-none">
                        <div className="relative mt-1">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={formData.termsAccepted}
                            onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                          />
                          <div className="w-6 h-6 border-2 border-[#2E2E2F]/20 rounded-xl bg-[#F2F2F2] peer-checked:bg-[#38BDF2] peer-checked:border-[#38BDF2] transition-colors flex items-center justify-center">
                            <ICONS.CheckCircle className={`w-4 h-4 text-[#F2F2F2] transition-opacity ${formData.termsAccepted ? 'opacity-100' : 'opacity-0'}`} strokeWidth={4} />
                          </div>
                        </div>
                        <span className="text-sm font-medium text-[#2E2E2F]/70 leading-relaxed group-hover:text-[#2E2E2F] transition-colors">
                          I acknowledge that I have read and agree to the <a href="#" className="text-[#2E2E2F] font-bold hover:underline" style={{ color: brandColor }}>Terms and Conditions</a> and <a href="#" className="text-[#2E2E2F] font-bold hover:underline" style={{ color: brandColor }}>Privacy Policy</a> governing this event session.
                        </span>
                      </label>
                      {errors.terms && <p className="text-[11px] font-semibold text-[#2E2E2F] uppercase tracking-wide pl-10">{errors.terms}</p>}
                    </div>
                  </div>
                </div>
              </Card>

              <div className="flex flex-col sm:flex-row items-stretch gap-4">
                <Button
                  type="submit"
                  size="md"
                  className="flex-[2]"
                  disabled={submitting || !isRegistrationOpen}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-t-[#F2F2F2] rounded-full animate-spin" style={{ borderColor: `${brandColor}4D` }}></div>
                      Processing...
                    </span>
                  ) : !isRegistrationOpen ? (
                    registrationStatus || 'Registration is closed'
                  ) : totalPayable === 0 ? 'Confirm Registration' : `Checkout PHP ${formatCurrency(totalPayable)}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="flex-1"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
              </div>

              <div className="flex flex-col items-center gap-4 pt-6">
                <div className="flex items-center gap-6 opacity-60">
                  <img src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/images/hitpay.png" alt="HitPay" className="h-4" />
                </div>
                <p className="text-[9px] font-medium uppercase tracking-[0.4em] text-[#2E2E2F]/50">
                  Global Transaction Security by HitPay
                </p>
              </div>
            </form>
          </div>

          {/* High-Contrast Reservation Summary */}
          <div className="w-full md:w-[280px] lg:w-[400px] shrink-0 md:sticky lg:sticky md:top-10 lg:top-10">
            <Card className="bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl sm:rounded-xl overflow-hidden p-0">
              <div className="p-5 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
                <div className="flex items-center justify-between border-b border-[#2E2E2F]/10 pb-6">
                  <h3 className="font-semibold text-[11px] sm:text-[12px] text-[#2E2E2F] uppercase tracking-wide flex items-center gap-3">
                    <ICONS.Calendar className="w-4 h-4" />
                    Reservation Summary
                  </h3>
                </div>

                <div className="space-y-10">
                  {/* Line Items */}
                  <div className="space-y-6 sm:space-y-8">
                    {selectedItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start group">
                        <div className="flex-1 pr-6">
                          <p className="font-semibold text-[#2E2E2F] text-[13px] sm:text-[14px] uppercase tracking-tight leading-tight mb-2 group-hover:text-[#38BDF2] transition-colors">
                            {item.ticket.name}
                          </p>
                          <div className="flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 bg-[#38BDF2] rounded-full"></span>
                            <p className="text-[11px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">
                              {item.qty} {item.qty === 1 ? (item.ticket.capacityPerTicket && item.ticket.capacityPerTicket > 1 ? 'Bundle' : 'Ticket') : 'Units'}
                            </p>
                            {item.ticket.capacityPerTicket && item.ticket.capacityPerTicket > 1 && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[#2E2E2F]/5 text-[#2E2E2F]/40">
                                {item.qty * item.ticket.capacityPerTicket} GUESTS
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm sm:text-base font-bold tracking-tight block" style={{ color: brandColor }}>
                            PHP {(getEffectivePrice(item.ticket) * item.qty).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-[#2E2E2F]/50 font-medium uppercase tracking-wide block mt-0.5">
                            {item.ticket.priceAmount > 0 ? `PHP ${getEffectivePrice(item.ticket).toLocaleString()} ea` : 'Complimentary'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Promo Code Input */}
                  <div className="pt-5 sm:pt-6 border-t border-[#2E2E2F]/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2E2E2F]/60">Got a promo code?</span>
                    </div>
                    {appliedPromo ? (
                      <div className="flex items-center justify-between bg-[#38BDF2]/10 border border-[#38BDF2]/30 px-3 py-2.5 rounded-xl">
                        <div className="flex items-center gap-2">
                          <ICONS.CheckCircle className="w-4 h-4 text-[#38BDF2]" />
                          <span className="text-[12px] font-bold text-[#2E2E2F] uppercase">{appliedPromo.code}</span>
                        </div>
                        <button
                          onClick={handleRemovePromo}
                          className="text-[10px] font-bold text-[#2E2E2F]/40 hover:text-red-500 uppercase tracking-tighter"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="ENTER CODE"
                          className="flex-1 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl px-3 py-2 text-[12px] font-bold uppercase tracking-wider text-[#2E2E2F] focus:outline-none focus:ring-1"
                          style={{ '--tw-ring-color': brandColor } as any}
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyPromo())}
                        />
                        <button
                          type="button"
                          disabled={!promoCode || validatingPromo}
                          onClick={handleApplyPromo}
                          className="bg-[#2E2E2F] text-[#F2F2F2] px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-[#38BDF2] transition-colors disabled:opacity-50"
                        >
                          {validatingPromo ? '...' : 'Apply'}
                        </button>
                      </div>
                    )}
                    {promoError && <p className="text-[10px] font-bold text-red-500 pl-1 uppercase tracking-tighter">{promoError}</p>}
                  </div>

                  {/* Fee Breakdown */}
                  <div className="mt-8 pt-6 border-t border-[#2E2E2F]/10 space-y-4">
                    <div className="p-5 rounded-xl flex flex-col gap-1 bg-[#F2F2F2] border border-[#2E2E2F]/10">
                      <span className="text-[10px] font-black text-[#2E2E2F]/50 uppercase tracking-widest">Total Amount</span>
                      <span className="text-2xl sm:text-3xl font-black text-[#2E2E2F] tracking-tighter">
                        PHP {formatCurrency(totalPayable)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 p-5 rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2]">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-xl bg-[#2E2E2F]/5">
                          <ICONS.Ticket className="w-4 h-4 text-[#2E2E2F]/60" />
                        </div>
                        <span className="text-[11px] font-black text-[#2E2E2F] uppercase tracking-[0.1em]">
                          Issuing {totalGuests} Individual {totalGuests === 1 ? 'Ticket' : 'Tickets'}
                        </span>
                      </div>
                      <p className="text-[9px] font-bold text-[#2E2E2F]/40 leading-relaxed uppercase tracking-wider">
                        Every guest in your bundle will receive their own unique digital ticket and entry QR code.
                      </p>
                    </div>
                  </div>
                  <div className="pt-5 sm:pt-6 border-t border-[#2E2E2F]/10 space-y-4">
                    <div className="flex justify-between items-center text-[#2E2E2F]/60">
                      <span className="text-[10px] font-medium uppercase tracking-wide">Platform Subtotal</span>
                      <span className="text-[11px] sm:text-[12px] font-semibold tracking-wide">PHP {formatCurrency(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between items-center text-green-600">
                        <span className="text-[10px] font-medium uppercase tracking-wide">Discount Applied</span>
                        <span className="text-[11px] sm:text-[12px] font-bold tracking-wide">- PHP {formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-medium text-[#2E2E2F]/60 uppercase tracking-wide">HitPay Service Fee</span>
                      {subtotal === 0 ? (
                        <span className="text-[10px] font-semibold text-[#2E2E2F] border px-2.5 py-0.5 rounded-xl tracking-wide bg-[#38BDF2]/10" style={{ borderColor: `${brandColor}66`, backgroundColor: `${brandColor}1A` }}>
                          WAIVED
                        </span>
                      ) : (
                        <div className="text-right">
                          <span className="text-[11px] sm:text-[12px] font-semibold tracking-wide text-[#2E2E2F] block">
                            PHP {formatCurrency(paymentFee)}
                          </span>
                          <span className="text-[9px] font-medium text-[#2E2E2F]/50 uppercase tracking-wide block mt-1">
                            {selectedPayment.feeLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grand Total Footer */}
                  <div className="pt-5 sm:pt-6 border-t-2 border-[#2E2E2F]/10">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-[#2E2E2F] uppercase tracking-wide block">Grand Total</span>
                        <span className="text-2xl sm:text-3xl font-black tracking-tighter block leading-none" style={{ color: brandColor }}>
                          {totalPayable === 0 ? 'FREE' : `PHP ${formatCurrency(totalPayable)}`}
                        </span>
                      </div>
                      <div className="pb-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#F2F2F2] text-[#38BDF2] rounded-xl flex items-center justify-center border border-[#2E2E2F]/10">
                          <ICONS.CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Information */}
                <div className="mt-2 pt-6 sm:pt-8 border-t border-[#2E2E2F]/10">
                  <div className="flex items-center gap-4 bg-[#F2F2F2] p-4 rounded-xl border border-[#2E2E2F]/10">
                    <div className="p-2.5 bg-[#F2F2F2] text-[#38BDF2] rounded-xl border border-[#2E2E2F]/10">
                      <ICONS.CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[#2E2E2F] uppercase tracking-wide leading-none">Digital Delivery</p>
                      <p className="text-[10px] text-[#2E2E2F]/60 font-medium mt-1.5 uppercase tracking-wide">Instant Ticket Access</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="mt-6 sm:mt-8 px-2 sm:px-10 text-center">
              <p className="text-[10px] text-[#2E2E2F]/60 font-medium leading-relaxed uppercase tracking-wide">
                Enterprise Shield • Secure Checkout
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

