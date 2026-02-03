
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import { Event, TicketType } from '../../types';
import { Button, Card, Input, PageLoader } from '../../components/Shared';
import { ICONS } from '../../constants';

export const RegistrationForm: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
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
  
  const [errors, setErrors] = useState<Record<string, string>>({});

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
            console.error("Failed to parse selections", e);
          }
        }
        setLoading(false);
      });
    }
  }, [slug, searchParams]);

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
    if (!validate() || !event || selectedItems.length === 0) return;

    setSubmitting(true);
    try {
      const grandTotal = selectedItems.reduce((acc, item) => acc + (item.ticket.priceAmount * item.qty), 0);
      
      const { orderId } = await apiService.createOrderTransaction({
        eventId: event.eventId,
        buyerName: formData.name,
        buyerEmail: formData.email,
        buyerPhone: formData.phone,
        company: formData.company,
        items: selectedItems.map(i => ({ ticketTypeId: i.ticket.ticketTypeId, quantity: i.qty, price: i.ticket.priceAmount })),
        totalAmount: grandTotal,
        currency: selectedItems[0]?.ticket.currency || 'PHP'
      });
      console.log('Order created:', orderId);

      const hasPaid = grandTotal > 0;

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
    } catch (err) {
      console.error(err);
        alert('Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <PageLoader label="Initializing Secure Session..." variant="page" />
  );

  if (!event || selectedItems.length === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6F8]">
      <Card className="p-10 text-center max-w-sm">
        <h2 className="text-xl font-black text-[#1F3A5F] mb-2">Session Expired</h2>
        <p className="text-[#1F3A5F]/60 text-sm mb-6">Please restart your registration from the event page.</p>
        <Button onClick={() => navigate('/')}>Return to Events</Button>
      </Card>
    </div>
  );

  const totalQuantity = selectedItems.reduce((acc, item) => acc + item.qty, 0);
  const grandTotal = selectedItems.reduce((acc, item) => acc + (item.ticket.priceAmount * item.qty), 0);

  return (
    <div className="min-h-screen bg-[#F4F6F8] px-4 py-6 sm:px-6 sm:py-8 lg:py-12 animate-in fade-in duration-700">
      <div className="max-w-6xl mx-auto">
        
        <div className="mb-8 sm:mb-10">
          <button 
            onClick={() => navigate(-1)} 
            className="group flex items-center gap-2 text-[#1F3A5F]/50 hover:text-[#2F80ED] font-black text-[9px] uppercase tracking-[0.2em] transition-colors mb-4"
          >
            <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
            Change Selection
          </button>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1F3A5F] tracking-tighter mb-1 leading-tight sm:leading-none">
            Complete Registration
          </h1>
          <div className="flex items-center gap-3">
            <span className="bg-[#2F80ED] text-white text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest">
              {totalQuantity} {totalQuantity === 1 ? 'Ticket' : 'Tickets'}
            </span>
            <p className="text-[#1F3A5F]/60 font-medium text-sm">
              for <span className="text-[#1F3A5F] font-bold">{event.eventName}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
          
          <div className="flex-1 w-full">
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              <Card className="p-5 sm:p-6 lg:p-8 border-none shadow-[0_30px_60px_-15px_rgba(0,0,0,0.02)] ring-1 ring-[#F4F6F8] rounded-[1.75rem] sm:rounded-[2.5rem] bg-white relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center justify-center gap-5 mb-6 sm:mb-8">
                    <div className="w-12 h-px bg-[#F4F6F8]"></div>
                    <h3 className="text-[11px] font-black text-[#2F80ED] uppercase tracking-[0.4em] whitespace-nowrap text-center">
                      Primary Registrant
                    </h3>
                    <div className="w-12 h-px bg-[#F4F6F8]"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-5 sm:gap-y-6">
                    <div className="space-y-2">
                      <label className="text-[12px] sm:text-[13px] font-bold text-[#1F3A5F]/70 ml-1">Full Name *</label>
                      <Input 
                        placeholder="Full name as per identification" 
                        className="py-3 sm:py-4 px-4 sm:px-5 rounded-[1rem] font-bold bg-[#F4F6F8] border-transparent focus:bg-white focus:border-[#2F80ED]/30 text-[#1F3A5F] placeholder:text-[#1F3A5F]/40 transition-all text-[13px] sm:text-[14px] shadow-sm"
                        value={formData.name}
                        onChange={(e: any) => setFormData({...formData, name: e.target.value})}
                        error={errors.name}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] sm:text-[13px] font-bold text-[#1F3A5F]/70 ml-1">Email Address *</label>
                      <Input 
                        type="email" 
                        placeholder="name@organization.com" 
                        className="py-3 sm:py-4 px-4 sm:px-5 rounded-[1rem] font-bold bg-[#F4F6F8] border-transparent focus:bg-white focus:border-[#2F80ED]/30 text-[#1F3A5F] placeholder:text-[#1F3A5F]/40 transition-all text-[13px] sm:text-[14px] shadow-sm"
                        value={formData.email}
                        onChange={(e: any) => setFormData({...formData, email: e.target.value})}
                        error={errors.email}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] sm:text-[13px] font-bold text-[#1F3A5F]/70 ml-1">Contact Number</label>
                      <Input 
                        placeholder="+63 ...." 
                        className="py-3 sm:py-4 px-4 sm:px-5 rounded-[1rem] font-bold bg-[#F4F6F8] border-transparent focus:bg-white focus:border-[#2F80ED]/30 text-[#1F3A5F] placeholder:text-[#1F3A5F]/40 transition-all text-[13px] sm:text-[14px] shadow-sm"
                        value={formData.phone}
                        onChange={(e: any) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] sm:text-[13px] font-bold text-[#1F3A5F]/70 ml-1">Company</label>
                      <Input 
                        placeholder="Organization / Entity" 
                        className="py-3 sm:py-4 px-4 sm:px-5 rounded-[1rem] font-bold bg-[#F4F6F8] border-transparent focus:bg-white focus:border-[#2F80ED]/30 text-[#1F3A5F] placeholder:text-[#1F3A5F]/40 transition-all text-[13px] sm:text-[14px] shadow-sm"
                        value={formData.company}
                        onChange={(e: any) => setFormData({...formData, company: e.target.value})}
                      />
                    </div>

                    <div className="md:col-span-2 pt-4 border-t border-[#F4F6F8] space-y-4">
                       <label className="flex items-start gap-4 cursor-pointer group select-none">
                          <div className="relative mt-1">
                            <input 
                              type="checkbox" 
                              className="peer sr-only"
                              checked={formData.termsAccepted}
                              onChange={(e) => setFormData({...formData, termsAccepted: e.target.checked})}
                            />
                            <div className="w-6 h-6 border-2 border-[#F4F6F8] rounded-lg bg-white peer-checked:bg-[#2F80ED] peer-checked:border-[#2F80ED] transition-all flex items-center justify-center">
                              <ICONS.CheckCircle className={`w-4 h-4 text-white transition-opacity ${formData.termsAccepted ? 'opacity-100' : 'opacity-0'}`} strokeWidth={4} />
                            </div>
                          </div>
                          <span className="text-sm font-medium text-[#1F3A5F]/60 leading-relaxed group-hover:text-[#1F3A5F] transition-colors">
                            I acknowledge that I have read and agree to the <a href="#" className="text-[#2F80ED] font-bold hover:underline">Terms and Conditions</a> and <a href="#" className="text-[#2F80ED] font-bold hover:underline">Privacy Policy</a> governing this event session.
                          </span>
                       </label>
                       {errors.terms && <p className="text-[11px] font-black text-[#1F3A5F] uppercase tracking-widest pl-10">{errors.terms}</p>}
                    </div>
                  </div>
                </div>
              </Card>

              <div className="flex flex-col sm:flex-row items-stretch gap-4">
                <Button 
                  type="submit" 
                  size="md" 
                  className="flex-[2] py-3 sm:py-4 rounded-xl shadow-lg shadow-[#2F80ED]/15 font-black text-sm sm:text-base bg-[#2F80ED]" 
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </span>
                  ) : grandTotal === 0 ? 'Confirm Registration' : `Checkout PHP ${grandTotal.toLocaleString()}`}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="md" 
                  className="flex-1 py-3 sm:py-4 rounded-xl text-[#1F3A5F]/60 font-black uppercase tracking-widest text-[9px] border border-[#F4F6F8] transition-all" 
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
              </div>

              <div className="flex flex-col items-center gap-4 pt-6">
                 <div className="flex items-center gap-6 opacity-60 grayscale">
                    <img src="https://www.hitpayapp.com/static/media/hitpay-logo.0f074558.png" alt="HitPay" className="h-4" />
                 </div>
                 <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#1F3A5F]/40">
                  Global Transaction Security by HitPay
                </p>
              </div>
            </form>
          </div>

          {/* High-Contrast Reservation Summary */}
          <div className="w-full lg:w-[400px] shrink-0 lg:sticky lg:top-10">
            <Card className="bg-white border border-[#F4F6F8] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden p-0">
              <div className="p-5 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
                <div className="flex items-center justify-between border-b border-[#F4F6F8] pb-6">
                  <h3 className="font-black text-[10px] sm:text-[11px] text-[#2F80ED] uppercase tracking-[0.4em] flex items-center gap-3">
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
                          <p className="font-black text-[#1F3A5F] text-[12px] sm:text-[13px] uppercase tracking-tight leading-tight mb-2 group-hover:text-[#2F80ED] transition-colors">
                            {item.ticket.name}
                          </p>
                          <div className="flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 bg-[#56CCF2] rounded-full"></span>
                            <p className="text-[10px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.15em]">
                              {item.qty} {item.qty === 1 ? 'Guest' : 'Guests'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm sm:text-base font-black text-[#1F3A5F] tracking-tighter block">
                            PHP {(item.ticket.priceAmount * item.qty).toLocaleString()}
                          </span>
                          <span className="text-[9px] text-[#1F3A5F]/40 font-black uppercase tracking-widest block mt-0.5">
                            {item.ticket.priceAmount > 0 ? `PHP ${item.ticket.priceAmount.toLocaleString()} ea` : 'Complimentary'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Fee Breakdown */}
                  <div className="pt-5 sm:pt-6 border-t border-[#F4F6F8] space-y-4">
                    <div className="flex justify-between items-center text-[#1F3A5F]/50">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em]">Platform Subtotal</span>
                      <span className="text-[10px] sm:text-[11px] font-black tracking-widest">PHP {grandTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-[#1F3A5F]/50 uppercase tracking-[0.2em]">HitPay Service Fee</span>
                      <span className="text-[9px] font-black text-[#2F80ED] border border-[#56CCF2]/30 px-2.5 py-0.5 rounded-lg tracking-[0.15em] bg-[#56CCF2]/10">
                        WAIVED
                      </span>
                    </div>
                  </div>

                  {/* Grand Total Footer */}
                  <div className="pt-5 sm:pt-6 border-t-2 border-[#F4F6F8]">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black text-[#2F80ED] uppercase tracking-[0.4em] block">Grand Total</span>
                        <span className="text-2xl sm:text-3xl font-black text-[#1F3A5F] tracking-tighter block leading-none">
                          {grandTotal === 0 ? 'FREE' : `PHP ${grandTotal.toLocaleString()}`}
                        </span>
                      </div>
                      <div className="pb-1">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#F4F6F8] text-[#2F80ED] rounded-xl flex items-center justify-center border border-[#F4F6F8] shadow-sm">
                           <ICONS.CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Information */}
                <div className="mt-2 pt-6 sm:pt-8 border-t border-[#F4F6F8]">
                   <div className="flex items-center gap-4 bg-[#F4F6F8] p-4 rounded-2xl border border-[#F4F6F8] group transition-all">
                      <div className="p-2.5 bg-white text-[#2F80ED] rounded-lg shadow-sm group-hover:scale-105 transition-transform border border-[#F4F6F8]">
                        <ICONS.CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-[#1F3A5F] uppercase tracking-widest leading-none">Digital Delivery</p>
                        <p className="text-[9px] text-[#1F3A5F]/50 font-bold mt-1.5 uppercase tracking-widest">Instant Ticket Access</p>
                      </div>
                   </div>
                </div>
              </div>
            </Card>
            
            <div className="mt-6 sm:mt-8 px-2 sm:px-10 text-center">
              <p className="text-[9px] text-[#1F3A5F]/40 font-bold leading-relaxed uppercase tracking-[0.2em]">
                Enterprise Shield • Secure Checkout
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
