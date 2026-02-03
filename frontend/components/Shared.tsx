
import React from 'react';

export const Badge: React.FC<{ 
  children: React.ReactNode, 
  type?: 'success' | 'danger' | 'warning' | 'info' | 'neutral',
  className?: string 
}> = ({ children, type = 'neutral', className = '' }) => {
  const styles = {
    success: 'bg-[#56CCF2]/20 text-[#1F3A5F]',
    danger: 'bg-[#1F3A5F]/10 text-[#1F3A5F]',
    warning: 'bg-[#2F80ED]/15 text-[#1F3A5F]',
    info: 'bg-[#2F80ED]/15 text-[#2F80ED]',
    neutral: 'bg-[#F4F6F8] text-[#1F3A5F]/70',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[type]} ${className}`}>
      {children}
    </span>
  );
};

export const Card: React.FC<{ 
  children: React.ReactNode, 
  className?: string,
  onClick?: () => void 
}> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-xl shadow-sm border border-[#F4F6F8] overflow-hidden ${className}`}
  >
    {children}
  </div>
);

export const Button: React.FC<{ 
  children: React.ReactNode, 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger',
  size?: 'sm' | 'md' | 'lg',
  className?: string,
  disabled?: boolean,
  type?: 'button' | 'submit',
  onClick?: () => void 
}> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  disabled = false,
  type = 'button',
  onClick 
}) => {
  const base = 'inline-flex items-center justify-center font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm';
  
  const variants = {
    primary: 'bg-[#2F80ED] text-white hover:bg-[#1F3A5F] active:bg-[#1F3A5F] focus:ring-[#2F80ED] shadow-lg shadow-[#2F80ED]/10',
    secondary: 'bg-[#1F3A5F] text-white hover:bg-[#2F80ED] active:bg-[#2F80ED] focus:ring-[#1F3A5F] shadow-lg shadow-[#1F3A5F]/10',
    outline: 'border-2 border-[#2F80ED]/30 text-[#1F3A5F] bg-white hover:bg-[#F4F6F8] active:bg-[#F4F6F8]/80 focus:ring-[#2F80ED] shadow',
    ghost: 'text-[#1F3A5F]/70 hover:bg-[#F4F6F8] active:bg-[#F4F6F8]/80 focus:ring-[#56CCF2]',
    danger: 'bg-[#EB5757] text-white hover:bg-[#B71C1C] active:bg-[#B71C1C] focus:ring-[#EB5757] shadow-lg shadow-[#EB5757]/10'
  };

  const sizes = {
    sm: 'px-4 py-2 text-[11px]',
    md: 'px-6 py-3 text-[13px]',
    lg: 'px-8 py-4 text-base',
  };

  return (
    <button 
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

export const Input: React.FC<{
  label?: string;
  error?: string;
  [key: string]: any;
}> = ({ label, error, ...props }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="block text-sm font-medium text-[#1F3A5F]">{label}</label>}
    <input
      className={`block w-full px-3 py-2 bg-white border ${error ? 'border-[#2F80ED]' : 'border-[#F4F6F8]'} rounded-lg shadow-sm focus:outline-none focus:ring-2 ${error ? 'focus:ring-[#2F80ED]/40' : 'focus:ring-[#2F80ED]/40'} transition-all`}
      {...props}
    />
    {error && <p className="text-xs text-[#1F3A5F] mt-1">{error}</p>}
  </div>
);

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
  showClose?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
  contentClassName?: string;
}> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  footer,
  showClose = true,
  closeOnBackdrop = true,
  className = '',
  contentClassName = ''
}) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[90] bg-[#1F3A5F]/70 backdrop-blur-sm transition-opacity"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      
      {/* Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-[110] bg-white rounded-3xl shadow-[0_30px_80px_-40px_rgba(31,58,95,0.55)] w-full ${
          sizes[size]
        } max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-300 ${className}`}
      >
        <div className="px-6 py-5 border-b border-[#F4F6F8] flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
          <div>
            <h2 id="modal-title" className="text-lg sm:text-xl font-black text-[#1F3A5F]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] font-bold text-[#1F3A5F]/50">
                {subtitle}
              </p>
            )}
          </div>
          {showClose && (
            <button 
              onClick={onClose}
              className="p-2 text-[#1F3A5F]/50 hover:text-[#1F3A5F] hover:bg-[#F4F6F8] rounded-full transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
        <div className={`p-6 overflow-y-auto max-h-[70vh] ${contentClassName}`}>
          {children}
        </div>
        {footer && (
          <div className="px-6 py-5 border-t border-[#F4F6F8] bg-white">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const PageLoader: React.FC<{
  label?: string;
  variant?: 'page' | 'section';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({
  label = 'Loading content...',
  variant = 'section',
  size = 'md',
  className = ''
}) => {
  const variants = {
    page: 'min-h-screen bg-[#F4F6F8]',
    section: 'min-h-[60vh] bg-transparent'
  };

  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center ${variants[variant]} ${className}`}>
      <div className={`relative ${sizes[size]}`}>
        <div className="absolute inset-0 rounded-full border border-[#56CCF2]/35" />
        <div className="absolute inset-0 rounded-full border-2 border-[#2F80ED] border-t-transparent animate-spin" />
        <div className="absolute inset-2 rounded-full bg-[#2F80ED]/10" />
      </div>
      {label && (
        <p className="mt-4 text-[#1F3A5F]/60 font-black uppercase tracking-widest text-[9px]">
          {label}
        </p>
      )}
    </div>
  );
};
