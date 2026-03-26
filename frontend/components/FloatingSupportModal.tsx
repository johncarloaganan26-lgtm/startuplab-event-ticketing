import React, { useState, useRef } from 'react';
import { ICONS } from '../constants';
import { apiService } from '../services/apiService';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';

interface FloatingSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

const EMOJI_LIST = [
  '😊','😂','😍','🙏','👍','🔥','❤️','😢','😎','🤔',
  '😅','🎉','✅','⚠️','🐛','💡','📎','🖼️','📝','🚀',
  '❌','✔️','💬','📧','🔗','📸','🎯','⚡','🛠️','💻',
];

export const FloatingSupportModal: React.FC<FloatingSupportModalProps> = ({ isOpen, onClose, userEmail = '' }) => {
  const { email: sessionEmail, name: sessionName, role: sessionRole, isAuthenticated } = useUser();
  const [email, setEmail] = useState(userEmail || sessionEmail || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ preview: string; name: string; url: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Toolbar states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showUrlInput, setShowUrlInput]       = useState(false);
  const [urlValue, setUrlValue]               = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  if (!isOpen) return null;

  /* ── helpers ── */
  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) { setMessage(prev => prev + text); return; }
    const start = ta.selectionStart ?? message.length;
    const end   = ta.selectionEnd   ?? message.length;
    const next  = message.slice(0, start) + text + message.slice(end);
    setMessage(next);
    // restore cursor position after React re-render
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const handleEmojiClick = (emoji: string) => {
    insertAtCursor(emoji);
    setShowEmojiPicker(false);
  };

  const handleUrlInsert = () => {
    if (!urlValue.trim()) return;
    const formatted = urlValue.startsWith('http') ? urlValue : `https://${urlValue}`;
    insertAtCursor(` ${formatted} `);
    setUrlValue('');
    setShowUrlInput(false);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Show local preview immediatey
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachedImage({ preview: ev.target?.result as string, name: file.name, url: '' });
    };
    reader.readAsDataURL(file);

    // 2. Upload to server
    setUploadingImage(true);
    try {
      const { publicUrl } = await apiService.uploadSupportImage(file);
      setAttachedImage(prev => prev ? { ...prev, url: publicUrl } : null);
    } catch (err) {
      showToast('error', 'Failed to upload image. Please try again.');
      setAttachedImage(null);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const removeAttachedImage = () => setAttachedImage(null);

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formattedSubject = category ? `[Report/${category}] ${subject}` : subject;
      const imageNote = attachedImage?.url ? `\n\n[IMAGE_URL: ${attachedImage.url}]` : '';

      if (isAuthenticated) {
        await apiService.submitSupportTicket({
          subject: formattedSubject,
          message: `Email provided in form: ${email}\n\nUser Context:\nName: ${sessionName}\nEmail: ${sessionEmail}\nRole: ${sessionRole}\n\nMessage:\n${message}${imageNote}`
        });
      } else {
        await apiService.submitContactForm({
          name: email.split('@')[0],
          email,
          mobileNumber: 'N/A',
          inquiryType: category || 'Support',
          message: `${formattedSubject}\n\n${message}${imageNote}`
        });
      }

      showToast('success', 'Support request submitted successfully. Our team will get back to you soon.');
      onClose();
      setSubject('');
      setMessage('');
      setCategory('');
      setAttachedImage(null);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to submit support ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        className="relative bg-[#F2F2F2] rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300 border border-[#2E2E2F]/10"
        style={{ zoom: 0.8 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Side: Form */}
        <div className="flex-1 p-8 md:p-12 overflow-y-auto max-h-[90vh]">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-[#2E2E2F]/30 hover:text-[#38BDF2] hover:bg-white shadow-sm rounded-xl transition-all z-50 group"
          >
            <ICONS.X className="w-6 h-6" />
          </button>

          <div className="flex justify-between items-start mb-8">
            <div className="flex flex-col gap-1">
              <h2 className="text-3xl font-black text-[#2E2E2F] tracking-tight">Submit Feedback</h2>
              <p className="text-[11px] font-bold text-[#2E2E2F]/40 uppercase tracking-[0.2em]">Our team will review your report.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#2E2E2F]/70 ml-1">Your email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-5 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/10 focus:border-[#38BDF2] rounded-xl outline-none transition-all font-medium"
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#2E2E2F]/70 ml-1">In a few words, tell us what your enquiry is about</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject of your ticket"
                className="w-full px-5 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/10 focus:border-[#38BDF2] rounded-xl outline-none transition-all font-medium"
              />
            </div>

            {/* Message + rich toolbar */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#2E2E2F]/70 ml-1">Provide a detailed description</label>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or question..."
                  rows={6}
                  className="w-full px-5 py-4 bg-[#F2F2F2] border-2 border-[#2E2E2F]/10 focus:border-[#38BDF2] rounded-xl outline-none transition-all font-medium resize-none pb-14"
                />

                {/* Toolbar */}
                <div className="absolute bottom-4 left-5 flex items-center gap-4 text-[#2E2E2F]/30">

                  {/* ── Emoji ── */}
                  <div className="relative">
                    <button
                      type="button"
                      title="Insert emoji"
                      onClick={() => { setShowEmojiPicker(v => !v); setShowUrlInput(false); }}
                      className="hover:text-[#38BDF2] transition-colors"
                    >
                      <ICONS.Smile className="w-5 h-5" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-8 left-0 z-50 bg-white border border-[#2E2E2F]/10 rounded-xl shadow-xl p-3 w-64 grid grid-cols-10 gap-1 animate-in zoom-in-95 duration-200">
                        {EMOJI_LIST.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiClick(emoji)}
                            className="text-lg hover:bg-[#38BDF2]/10 rounded-lg p-0.5 transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── URL / Link ── */}
                  <div className="relative">
                    <button
                      type="button"
                      title="Insert link"
                      onClick={() => { setShowUrlInput(v => !v); setShowEmojiPicker(false); }}
                      className="hover:text-[#38BDF2] transition-colors"
                    >
                      <ICONS.Paperclip className="w-5 h-5" />
                    </button>
                    {showUrlInput && (
                      <div className="absolute bottom-8 left-0 z-50 bg-white border border-[#2E2E2F]/10 rounded-xl shadow-xl p-3 w-64 animate-in zoom-in-95 duration-200">
                        <p className="text-[11px] font-bold text-[#2E2E2F]/50 uppercase tracking-widest mb-2">Insert URL</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={urlValue}
                            onChange={(e) => setUrlValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleUrlInsert())}
                            placeholder="https://..."
                            className="flex-1 text-xs px-3 py-2 rounded-lg border border-[#2E2E2F]/10 focus:border-[#38BDF2] outline-none font-medium"
                          />
                          <button
                            type="button"
                            onClick={handleUrlInsert}
                            className="px-3 py-2 bg-[#38BDF2] text-white text-xs font-bold rounded-lg hover:bg-[#2E2E2F] transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Image ── */}
                  <div>
                    <button
                      type="button"
                      title="Attach image"
                      onClick={() => fileInputRef.current?.click()}
                      className="hover:text-[#38BDF2] transition-colors"
                    >
                      <ICONS.Image className="w-5 h-5" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </div>
                </div>
              </div>

              {/* Image preview */}
              {attachedImage && (
                <div className="relative inline-block mt-2">
                  <div className="relative">
                    <img
                      src={attachedImage.preview}
                      alt={attachedImage.name}
                      className={`max-h-32 max-w-full rounded-xl border-2 ${uploadingImage ? 'border-yellow-400 opacity-50' : 'border-[#38BDF2]/30'} object-contain shadow-md`}
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-[#38BDF2] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {!uploadingImage && (
                    <button
                      type="button"
                      onClick={removeAttachedImage}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors text-xs font-bold"
                      title="Remove image"
                    >
                      ✕
                    </button>
                  )}
                  <p className="text-[10px] text-[#2E2E2F]/40 mt-1 truncate max-w-[200px]">{attachedImage.name}</p>
                </div>
              )}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#2E2E2F]/70 ml-1">Select the item you need help with</label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-5 py-3 bg-[#F2F2F2] border-2 border-[#2E2E2F]/10 focus:border-[#38BDF2] rounded-xl outline-none transition-all font-medium appearance-none cursor-pointer"
              >
                <option value="" disabled>Select an option...</option>
                <option value="Technical Issue">Technical Issue</option>
                <option value="Bug Report">Bug Report</option>
                <option value="Billing">Billing &amp; Subscription</option>
                <option value="Account">Account Access</option>
                <option value="Feature Request">Feature Request</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Submit */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-10 py-3.5 bg-[#38BDF2] text-white rounded-full font-bold shadow-lg shadow-[#38BDF2]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Info Sidebar */}
        <div className="w-full md:w-[320px] bg-[#2E2E2F]/5 p-8 md:p-12 border-l border-[#2E2E2F]/10 space-y-8 overflow-y-auto">
          <h3 className="text-xl font-bold text-[#2E2E2F]">Before you submit:</h3>
          <div className="space-y-8">
            <div className="space-y-2">
              <h4 className="font-bold text-[#2E2E2F]">Tell us!</h4>
              <p className="text-sm text-[#2E2E2F]/60 leading-relaxed font-medium">Add as much detail as possible, including site and page name.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-[#2E2E2F]">Show us!</h4>
              <p className="text-sm text-[#2E2E2F]/60 leading-relaxed font-medium">Add a screenshot or a link to a video.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-[#2E2E2F]">What problem did you experience?</h4>
              <p className="text-sm text-[#2E2E2F]/60 leading-relaxed font-medium">Describe what happened and what you expected instead.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-[#2E2E2F]">When did this problem happen?</h4>
              <p className="text-sm text-[#2E2E2F]/60 leading-relaxed font-medium">Let us know the date and approximate time.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
