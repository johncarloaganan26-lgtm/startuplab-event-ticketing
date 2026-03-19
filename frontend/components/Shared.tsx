
import React from 'react';

export const Badge: React.FC<{
  children: React.ReactNode,
  type?: 'success' | 'danger' | 'warning' | 'info' | 'neutral',
  className?: string
}> = ({ children, type = 'neutral', className = '' }) => {
  const styles = {
    success: 'bg-green-100 text-green-700',
    danger: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-[#38BDF2]/20 text-[#38BDF2]',
    neutral: 'bg-[#2E2E2F]/10 text-[#2E2E2F]',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] sm:text-[12px] font-bold uppercase tracking-wide ${styles[type]} inline-block ${className}`}>
      {children}
    </span>
  );
};

export const Card: React.FC<{
  children: React.ReactNode,
  className?: string,
  style?: React.CSSProperties,
  onClick?: () => void,
  [key: string]: any;
}> = ({ children, className = '', style, onClick, ...props }) => (
  <div
    onClick={onClick}
    style={style}
    className={`bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl overflow-hidden ${className} shadow-sm hover:shadow-md transition-shadow`}
    {...props}
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
  style?: React.CSSProperties,
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>
}> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  style,
  onClick
}) => {
    const base = 'inline-flex items-center justify-center font-bold tracking-wide rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] sm:min-h-[44px] active:scale-95';

    const variants = {
      primary: 'bg-[#38BDF2] text-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2] active:bg-[#2E2E2F] focus:ring-[#38BDF2]',
      secondary: 'bg-[#38BDF2] text-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2] active:bg-[#2E2E2F] focus:ring-[#38BDF2]',
      outline: 'bg-transparent border-2 border-[#38BDF2] text-[#38BDF2] hover:bg-[#38BDF2]/10 active:bg-[#38BDF2]/20 focus:ring-[#38BDF2]',
      ghost: 'bg-transparent text-[#38BDF2] hover:bg-[#38BDF2]/10 active:bg-[#38BDF2]/20 focus:ring-[#38BDF2]',
      danger: 'bg-red-500 text-[#F2F2F2] hover:bg-red-600 active:bg-red-700 focus:ring-red-500'
    };

    const sizes = {
      sm: 'px-3 py-2 text-[12px] sm:text-[13px] min-h-[40px] sm:min-h-[36px]',
      md: 'px-4 sm:px-4 py-3 sm:py-2.5 text-[13px] sm:text-[14px] min-h-[48px] sm:min-h-[44px]',
      lg: 'px-6 py-3 text-[14px] sm:text-[15px] min-h-[52px] sm:min-h-[48px]',
    };

    return (
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        style={style}
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
}> = ({ label, error, className = '', ...props }) => {
  const inputProps = { ...props };
  if (Object.prototype.hasOwnProperty.call(inputProps, 'value') && inputProps.value === null) {
    inputProps.value = '';
  }

  return (
    <div className="space-y-2 w-full">
      {label && <label className="block text-xs sm:text-sm font-semibold text-[#2E2E2F]/70 mb-1">{label}</label>}
      <input
        className={`block w-full px-4 py-3 bg-[#F2F2F2] border text-base sm:text-sm min-h-[48px] sm:min-h-[44px] ${error ? 'border-red-500' : 'border-[#2E2E2F]/20'} rounded-xl focus:outline-none focus:ring-2 ${error ? 'focus:ring-red-300/40' : 'focus:ring-[#38BDF2]/40'} transition-colors font-normal ${className}`}
        {...inputProps}
      />
      {error && <p className="text-xs text-red-500 font-medium mt-1">{error}</p>}
    </div>
  );
};

export const PasswordInput: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  icon?: React.ReactNode;
}> = ({ value, onChange, placeholder, required, className = '', icon }) => {
  const [showPassword, setShowPassword] = React.useState(false);

  // Use a local copy of ICONS since it's not exported from Shared.tsx
  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  );
  const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
  );

  return (
    <div className={`relative group/input ${className}`}>
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2E2E2F]/40 group-focus-within/input:text-[#38BDF2] transition-colors z-10 w-5 h-5 flex items-center justify-center">
          {icon}
        </div>
      )}
      <input
        type={showPassword ? 'text' : 'password'}
        placeholder={placeholder || 'Password'}
        value={value}
        onChange={onChange}
        required={required}
        className={`w-full min-h-[48px] sm:min-h-[44px] text-base sm:text-[14px] ${icon ? 'pl-12' : 'pl-4'} pr-12 py-3 sm:py-2 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-[#2E2E2F] placeholder-[#2E2E2F]/40 focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/40 focus:border-[#38BDF2] transition-colors font-normal`}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2E2E2F]/50 hover:text-[#2E2E2F] transition-colors p-2 z-10 min-h-[48px] sm:min-h-[44px] w-auto flex items-center justify-center active:scale-95"
      >
        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
};

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
  variant?: 'dialog' | 'page';
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
  contentClassName = '',
  variant = 'dialog'
}) => {
    if (!isOpen) return null;

    if (variant === 'page') {
      return (
        <div className={className}>
          <div className={contentClassName}>
            {children}
          </div>
          {footer && (
            <div className="border-t border-[#2E2E2F]/10 bg-[#F2F2F2]">
              {footer}
            </div>
          )}
        </div>
      );
    }

    const sizes = {
      sm: 'max-w-xs sm:max-w-md',
      md: 'max-w-sm sm:max-w-xl',
      lg: 'max-w-md sm:max-w-3xl',
      xl: 'max-w-lg sm:max-w-5xl'
    };

    return (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[90] bg-[#2E2E2F]/60 backdrop-blur-sm transition-opacity"
          onClick={closeOnBackdrop ? onClose : undefined}
        />

        {/* Content */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className={`relative z-[110] bg-[#F2F2F2] sm:rounded-xl rounded-t-3xl border-x-0 sm:border-x border-b-0 sm:border-b border-[#2E2E2F]/10 w-full ${sizes[size]
            } max-h-[90vh] sm:max-h-[85vh] overflow-hidden ${className}`}
        >
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#2E2E2F]/10 flex items-start justify-between gap-3 sticky top-0 bg-[#F2F2F2] z-10">
            <div className="min-w-0">
              <h2 id="modal-title" className="text-base sm:text-xl font-black text-[#2E2E2F] break-words tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1 text-[11px] sm:text-[13px] uppercase tracking-[0.15em] font-bold text-[#2E2E2F]/50">
                  {subtitle}
                </p>
              )}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-[#38BDF2]/10 text-[#38BDF2] hover:bg-[#38BDF2] hover:text-[#F2F2F2] transition-all shrink-0 active:scale-95"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <div className={`p-4 sm:p-6 overflow-y-auto max-h-[calc(100vh-120px)] sm:max-h-[calc(85vh-100px)] ${contentClassName}`}>
            {children}
          </div>
          {footer && (
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-t border-[#2E2E2F]/10 bg-[#F2F2F2]">
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
      page: 'min-h-[100dvh] bg-[#F2F2F2]',
      section: 'min-h-[30vh] sm:min-h-[60vh] bg-transparent'
    };

    const sizes = {
      sm: 'w-5 h-5 sm:w-6 sm:h-6',
      md: 'w-7 h-7 sm:w-8 sm:h-8',
      lg: 'w-8 h-8 sm:w-10 sm:h-10'
    };

    return (
      <div className={`flex flex-col items-center justify-center text-center ${variants[variant]} ${className}`}>
        <div className={`relative ${sizes[size]}`}>
          <div className="absolute inset-0 rounded-full border border-[#38BDF2]/35" />
          <div className="absolute inset-0 rounded-full border-2 border-[#2E2E2F] border-t-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full bg-[#38BDF2]/10" />
        </div>
        {label && (
          <p className="mt-4 text-[#2E2E2F] font-bold uppercase tracking-wide text-[12px] sm:text-[13px] px-4">
            {label}
          </p>
        )}
      </div>
    );
  };

export const Branding: React.FC<{ className?: string, light?: boolean }> = ({ className = '', light = false }) => (
  <img
    src="https://xmjdcbzgdfylbqkjoyyb.supabase.co/storage/v1/object/public/startuplab-business-ticketing/assets/assets/image%20(1).svg"
    alt="StartupLab Business Ticketing Logo"
    className={`h-20 lg:h-32 w-auto drop-shadow-xl transform transition-all duration-300 hover:scale-[1.03] cursor-pointer ${className}`}
    style={{ filter: light ? 'invert(1) grayscale(1) brightness(2)' : undefined }}
  />
);

