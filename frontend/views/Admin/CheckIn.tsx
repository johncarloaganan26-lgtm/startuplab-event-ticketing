
import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { apiService } from '../../services/apiService';
import { Button, Card, Input } from '../../components/Shared';
import { ICONS } from '../../constants';

export const CheckIn: React.FC = () => {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'scanning'>('idle');
  const [attendeeInfo, setAttendeeInfo] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showScanner, setShowScanner] = useState(false);
  const isProcessingScan = useRef(false);

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    setStatus('scanning');
    setErrorMsg('');
    try {
      const result = await apiService.checkInTicket(code.trim());
      setAttendeeInfo(result);
      setStatus('success');
      setCode('');
    } catch (err: any) {
      setStatus('error');
      const msg = err?.message || 'This code is unrecognized or already used.';
      setErrorMsg(msg.replace(/"/g, ''));
    }
  };

  const handleManualCheckInFromValue = async (value: string) => {
    if (!value) return;
    if (isProcessingScan.current) return;
    isProcessingScan.current = true;
    setShowScanner(false);
    setStatus('scanning');
    setErrorMsg('');
    try {
      const result = await apiService.checkInTicket(value.trim());
      setAttendeeInfo(result);
      setStatus('success');
      setCode('');
    } catch (err: any) {
      setStatus('error');
      const msg = err?.message || 'This code is unrecognized or already used.';
      setErrorMsg(msg.replace(/"/g, ''));
    } finally {
      isProcessingScan.current = false;
    }
  };

  const reset = () => {
    setStatus('idle');
    setAttendeeInfo(null);
    setErrorMsg('');
  };

  // Initialize QR scanner when toggled on
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (showScanner) {
      scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          rememberLastUsedCamera: true,
          disableFlip: true,
          showTorchButtonIfSupported: true,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        },
        false
      );
      scanner.render(
        (text) => {
          if (text) {
            handleManualCheckInFromValue(text);
          }
        },
        () => { }
      );
    }
    return () => {
      if (scanner) {
        scanner.clear().catch(() => { });
        scanner = null;
      }
    };
  }, [showScanner]);

  return (
    <div className="max-w-md mx-auto py-8 px-4 h-full flex flex-col">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-black text-[#2E2E2F] mb-2">Check-In</h1>
        <p className="text-[#2E2E2F]/70">Check in attendees and verify tickets.</p>
      </div>

      <div className="flex-1 space-y-6">
        <Card className="p-6 bg-[#F2F2F2] text-[#2E2E2F] flex flex-col items-center justify-center min-h-[300px] border-[#2E2E2F]/20 relative overflow-hidden">
          {status === 'idle' ? (
            <>
              <div className="w-20 h-20 border-2 border-[#2E2E2F]/40 rounded-xl flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="w-full h-[2px] bg-[#38BDF2] absolute animate-scan-y top-0"></div>
                <ICONS.CheckCircle className="w-8 h-8 text-[#38BDF2]" />
              </div>
              <p className="font-bold text-lg mb-2 text-[#2E2E2F]">Ready to scan tickets</p>
              <p className="text-[#2E2E2F]/60 text-sm text-center px-8">Point your camera at a ticket QR code to check in a guest.</p>
              <button
                className="mt-8 text-[#2E2E2F] font-bold text-sm tracking-wide"
                onClick={() => setShowScanner((s) => !s)}
              >
                {showScanner ? 'Close Camera' : 'Open Camera'}
              </button>
              {showScanner && (
                <div className="w-full mt-4 rounded-xl overflow-hidden bg-[#F2F2F2] border border-[#2E2E2F]/30 p-2">
                  <div id="qr-reader" className="w-full" />
                </div>
              )}
            </>
          ) : status === 'scanning' ? (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-[#2E2E2F]/30 border-t-[#38BDF2] rounded-full animate-spin mb-4"></div>
              <p className="font-bold text-[#2E2E2F]">Checking ticket...</p>
            </div>
          ) : status === 'success' ? (
            <div className="text-center w-full">
              <div className="w-20 h-20 bg-[#38BDF2] rounded-full flex items-center justify-center mx-auto mb-4">
                <ICONS.CheckCircle className="w-10 h-10 text-[#F2F2F2]" />
              </div>
              <h2 className="text-2xl font-bold mb-1 text-[#2E2E2F]">Guest Checked In!</h2>
              <p className="text-[#38BDF2] font-mono text-xs uppercase tracking-widest font-black mb-6">Welcome!</p>

              <div className="bg-[#F2F2F2] rounded-xl p-4 text-left w-full space-y-2 border border-[#2E2E2F]/20">
                <div className="flex justify-between">
                  <span className="text-[#2E2E2F]/60 text-xs font-bold uppercase tracking-wider">Attendee</span>
                  <span className="text-[#2E2E2F] text-sm font-bold">{attendeeInfo?.attendee?.name || attendeeInfo?.attendeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#2E2E2F]/60 text-xs font-bold uppercase tracking-wider">Event</span>
                  <span className="text-[#2E2E2F] text-sm font-bold truncate max-w-[150px]">{attendeeInfo?.eventName || attendeeInfo?.eventId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#2E2E2F]/60 text-xs font-bold uppercase tracking-wider">Ticket Type</span>
                  <span className="text-[#2E2E2F] text-sm font-bold">{attendeeInfo?.ticketName || attendeeInfo?.ticketCode}</span>
                </div>
              </div>

              <Button className="w-full mt-8" onClick={reset}>
                Check In Another Guest
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 bg-[#2E2E2F] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-[#F2F2F2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <h2 className="text-2xl font-bold mb-1 text-[#2E2E2F]">Ticket Not Valid</h2>
              <p className="text-[#2E2E2F]/70 text-sm mb-8 font-medium">We couldn't find a valid ticket for this code. Please try again.</p>
              <Button className="w-full py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#38BDF2] text-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2] min-h-[32px] transition-colors" onClick={reset}>
                Try Another Code
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <p className="text-xs font-black text-[#2E2E2F]/60 uppercase tracking-widest mb-4">Enter Ticket Code Manually</p>
          <form onSubmit={handleManualCheckIn} className="flex gap-2">
            <input
              placeholder="Type or paste ticket code here"
              className="flex-1 px-3 py-2 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/30 focus:border-[#38BDF2]"
              value={code}
              onChange={(e: any) => setCode(e.target.value)}
            />
            <button
              type="submit"
              disabled={!code || status === 'scanning'}
              className="py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#38BDF2] text-[#F2F2F2] hover:bg-[#2E2E2F] hover:text-[#F2F2F2] min-h-[32px] transition-colors disabled:opacity-50"
            >
              Verify
            </button>
          </form>
          {errorMsg && (
            <p className="text-[#2E2E2F] text-xs font-semibold mt-3">{errorMsg}</p>
          )}
        </Card>
      </div>

      <div className="mt-8 text-center text-[#2E2E2F]/60 text-[10px] font-bold uppercase tracking-[0.2em]">
        StartupLab Business Systems • Ops Portal
      </div>

      <style>{`
        @keyframes scan {
          from { top: 0%; }
          to { top: 100%; }
        }
        .animate-scan-y {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
};

