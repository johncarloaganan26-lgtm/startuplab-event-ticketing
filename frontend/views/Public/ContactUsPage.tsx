import React from 'react';
import { ICONS } from '../../constants';
import { apiService } from '../../services/apiService';

type InquiryType = 'REGISTRATION' | 'BOOKING' | 'PARTNERSHIP' | 'GENERAL';

type FormState = {
  name: string;
  occupation: string;
  email: string;
  mobileNumber: string;
  inquiryType: InquiryType;
  message: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+0-9()\-\s]{7,20}$/;

const MailIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8l8 6 8-6" />
  </svg>
);

const PhoneIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.61a2 2 0 0 1-.45 2.11L8 9.8a16 16 0 0 0 6.2 6.2l1.36-1.27a2 2 0 0 1 2.11-.45c.84.29 1.71.5 2.61.62A2 2 0 0 1 22 16.92z" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
  </svg>
);

export const ContactUsPage: React.FC = () => {
  const [form, setForm] = React.useState<FormState>({
    name: '',
    occupation: '',
    email: '',
    mobileNumber: '',
    inquiryType: 'GENERAL',
    message: '',
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required.';
    if (!form.email.trim() || !emailPattern.test(form.email.trim())) nextErrors.email = 'Valid email is required.';
    if (!form.mobileNumber.trim() || !phonePattern.test(form.mobileNumber.trim())) nextErrors.mobileNumber = 'Valid mobile number is required.';
    if (!form.inquiryType) nextErrors.inquiryType = 'Inquiry type is required.';
    if (!form.message.trim() || form.message.trim().length < 10) nextErrors.message = 'Message must be at least 10 characters.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await apiService.submitContactForm({
        name: form.name,
        occupation: form.occupation,
        email: form.email,
        mobileNumber: form.mobileNumber,
        inquiryType: form.inquiryType,
        message: form.message,
      });
      setSubmitted(true);
      setForm({
        name: '',
        occupation: '',
        email: '',
        mobileNumber: '',
        inquiryType: 'GENERAL',
        message: '',
      });
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClassName =
    'block w-full px-4 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-sm font-normal text-[#2E2E2F] placeholder:text-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 transition-colors min-h-[48px] sm:min-h-auto';

  const labelClassName = 'mb-2 block text-sm font-semibold text-[#2E2E2F]';

  return (
    <div className="bg-[#F2F2F2]">
      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 h-[260px] sm:h-[300px] lg:h-[350px] overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(116deg,#38BDF2_0%,#38BDF2_44%,#F2F2F2_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,62,134,0.45)_0%,rgba(0,62,134,0.2)_34%,rgba(0,62,134,0)_72%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_32%,rgba(255,255,255,0.34),transparent_46%),linear-gradient(90deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.06)_26%,rgba(255,255,255,0)_52%)]" />

        <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl items-center px-5 sm:px-8">
          <div className="max-w-[740px]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 mb-4">Contact Us</p>
            <h1 className="text-[2.1rem] font-black leading-none tracking-tight text-white sm:text-5xl">
              Contact Support
            </h1>
            <p className="mt-4 max-w-[700px] text-base leading-relaxed text-white/95 sm:text-[1.1rem]">
              Need help with events? Our support team is here to assist you with questions about registrations, bookings, and event details.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <article className="rounded-xl border border-[#3768A2]/20 bg-[#F2F2F2] px-5 py-6 shadow-[0_24px_56px_-36px_rgba(0,62,134,0.2)] sm:px-8 sm:py-8">
            <h2 className="text-4xl font-black leading-tight tracking-tight text-[#2E2E2F] sm:text-5xl">Events Contact Support</h2>
            <p className="mt-3 max-w-[640px] text-sm leading-relaxed text-[#2E2E2F]/70 sm:text-base">
              Need help with event registrations or bookings? Fill out the form below and our team will assist you.
            </p>

            {submitted && (
              <div className="mt-5 rounded-xl border border-[#38BDF2]/45 bg-[#38BDF2]/10 px-4 py-3 text-sm font-semibold text-[#2E2E2F]">
                Your message has been sent. We emailed you a confirmation and our support team will contact you soon.
              </div>
            )}
            {submitError && (
              <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClassName}>
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    className={fieldClassName}
                    placeholder="Ex. John Cruz"
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                </div>

                <div>
                  <label className={labelClassName}>Occupation</label>
                  <input
                    value={form.occupation}
                    onChange={(event) => updateField('occupation', event.target.value)}
                    className={fieldClassName}
                    placeholder="Your occupation"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClassName}>
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    className={fieldClassName}
                    placeholder="you@email.com"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                </div>

                <div>
                  <label className={labelClassName}>
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.mobileNumber}
                    onChange={(event) => updateField('mobileNumber', event.target.value)}
                    className={fieldClassName}
                    placeholder="+639123456789"
                  />
                  {errors.mobileNumber && <p className="mt-1 text-xs text-red-500">{errors.mobileNumber}</p>}
                </div>
              </div>

              <div>
                <label className={labelClassName}>
                  Event Type Interested In <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.inquiryType}
                  onChange={(event) => updateField('inquiryType', event.target.value)}
                  className={fieldClassName}
                >
                  <option value="GENERAL">Select...</option>
                  <option value="REGISTRATION">Registration Support</option>
                  <option value="BOOKING">Booking Assistance</option>
                  <option value="PARTNERSHIP">Partnership Inquiry</option>
                </select>
                {errors.inquiryType && <p className="mt-1 text-xs text-red-500">{errors.inquiryType}</p>}
              </div>

              <div>
                <label className={labelClassName}>
                  Your Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={(event) => updateField('message', event.target.value)}
                  rows={5}
                  className={`${fieldClassName} resize-none`}
                  placeholder="Tell us about the event you're interested in or any questions you have..."
                />
                {errors.message && <p className="mt-1 text-xs text-red-500">{errors.message}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`inline-flex items-center rounded-xl px-6 py-3 text-sm font-black tracking-wide text-[#F2F2F2] transition-colors ${submitting ? 'bg-[#2E2E2F]/40 cursor-not-allowed' : 'bg-[#38BDF2] hover:bg-[#2E2E2F]'}`}
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </article>

          <aside className="rounded-xl border border-[#3768A2]/25 bg-[#38BDF2] p-7 text-[#F2F2F2] shadow-[0_24px_56px_-30px_rgba(56,189,242,0.65)] sm:p-8">
            <h3 className="text-lg lg:text-xl font-extrabold tracking-tight text-[#F2F2F2] mb-1.5">Need Quick Help?</h3>
            <p className="text-[#F2F2F2]/90 text-[13px] font-medium leading-relaxed">
              Prefer to speak with someone directly? Call our support team, and we&apos;ll connect you with a dedicated member of our staff.
            </p>

            <div className="mt-7 space-y-3.5 text-[13px] font-medium text-[#F2F2F2]">
              <div className="flex items-start gap-3">
                <MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#F2F2F2]" />
                <span>hello@startuplab.ph</span>
              </div>

              <div className="flex items-start gap-3">
                <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#F2F2F2]" />
                <span>63.917.715.2587</span>
              </div>

              <div className="flex items-start gap-3">
                <ICONS.MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#F2F2F2]" />
                <span className="leading-relaxed">
                  2nd Floor, Pearl Plaza Building, 7001 Felix F. Manalo Rd, General Trias, 4107 Cavite
                </span>
              </div>

              <div className="flex items-start gap-3">
                <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#F2F2F2]" />
                <span>Mon - Fri, 9:00 AM - 6:00 PM</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden border-y border-[#2E2E2F]/10">
        <div className="h-[340px] sm:h-[420px] lg:h-[500px] w-full">
          <iframe
            title="StartupLab Office Location"
            src="https://www.google.com/maps?q=Pearl+Plaza+Building+7001+Felix+F+Manalo+Rd+General+Trias+Cavite&output=embed"
            className="h-full w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </div>
  );
};

