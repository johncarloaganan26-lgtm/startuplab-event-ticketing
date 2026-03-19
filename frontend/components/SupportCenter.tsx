import React, { useState } from 'react';
import { ICONS } from '../constants';
import { Button, Modal, Input } from './Shared';

type SupportCenterProps = {
  isOpen: boolean;
  onClose: () => void;
  organizerName: string;
};

export const SupportCenter: React.FC<SupportCenterProps> = ({
  isOpen,
  onClose,
  organizerName,
}) => {
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    email: '',
    category: 'general',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const categories = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'technical', label: 'Technical Issue' },
    { value: 'billing', label: 'Billing Question' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'event', label: 'Event Support' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // TODO: Connect to backend email/support service
      console.log('Support request:', formData);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setFormData({ subject: '', message: '', email: '', category: 'general' });
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to submit support request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Priority Support Center"
      size="lg"
    >
      <div className="space-y-8">
        {/* Success Message */}
        {submitted ? (
          <div className="text-center py-12 space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-[#38BDF2]/10 flex items-center justify-center animate-pulse">
                <ICONS.CheckCircle className="w-10 h-10 text-[#38BDF2]" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-[#2E2E2F]">Request Submitted!</h3>
            <p className="text-[#2E2E2F]/60 max-w-sm mx-auto">
              Our priority support team will respond to your request within 24 hours.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-[#38BDF2]/10 to-[#38BDF2]/5 border border-[#38BDF2]/20 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#38BDF2] text-white flex items-center justify-center flex-shrink-0">
                  <ICONS.Mail className="w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#2E2E2F] mb-1">Dedicated Support</h3>
                  <p className="text-sm text-[#2E2E2F]/60">
                    Get priority help from our support team. We typically respond within 24 hours.
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#2E2E2F]/40 mb-3">
                  Support Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/10 rounded-xl text-sm font-semibold outline-none focus:border-[#38BDF2] transition-colors"
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email */}
              <Input
                label="Your Email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
                required
              />

              {/* Subject */}
              <Input
                label="Subject"
                placeholder="Brief subject of your inquiry"
                value={formData.subject}
                onChange={(e: any) => setFormData({ ...formData, subject: e.target.value })}
                required
              />

              {/* Message */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#2E2E2F]/40 mb-3">
                  Message
                </label>
                <textarea
                  placeholder="Describe your issue or question in detail..."
                  value={formData.message}
                  onChange={(e: any) => setFormData({ ...formData, message: e.target.value })}
                  rows={6}
                  required
                  className="w-full px-4 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/10 rounded-xl text-sm font-semibold outline-none focus:border-[#38BDF2] transition-colors resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-6 border-t border-[#2E2E2F]/10">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <ICONS.Send className="w-4 h-4" />
                      Send Request
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
};

