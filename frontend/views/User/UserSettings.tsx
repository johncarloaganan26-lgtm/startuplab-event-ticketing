import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AccountSettings } from './AccountSettings';
import { OrganizerSettings } from './OrganizerSettings';
import { EmailSettings } from './EmailSettings';
import { PaymentSettings } from './PaymentSettings';
import { TeamSettings } from './TeamSettings';

type SettingsTab = 'organizer' | 'payments' | 'account' | 'email' | 'team';

const tabItems: Array<{
  id: SettingsTab;
  label: string;
  description: string;
}> = [
  {
    id: 'organizer',
    label: 'Org Profile',
    description: 'Brand, socials, and event page defaults',
  },
  {
    id: 'team',
    label: 'Team & Access',
    description: 'Invite members and manage permissions',
  },
  {
    id: 'email',
    label: 'Email Settings',
    description: 'Professional SMTP server configuration',
  },
  {
    id: 'payments',
    label: 'Payment Gateway',
    description: 'HitPay credentials and payout routing',
  },
  {
    id: 'account',
    label: 'Account',
    description: 'Name, avatar, and login preferences',
  },
];

const normalizeTab = (value: string | null): SettingsTab => {
  if (value === 'email') return 'email';
  if (value === 'payments') return 'payments';
  if (value === 'team') return 'team';
  return value === 'account' ? 'account' : 'organizer';
};

export const UserSettings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = normalizeTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(tabFromUrl);
  const activeTabMeta = tabItems.find((item) => item.id === activeTab) || tabItems[0];

  React.useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  React.useEffect(() => {
    if (!searchParams.get('tab')) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', tabFromUrl);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, tabFromUrl]);

  return (
    <div className="pb-16 space-y-6">
      <div className="px-2">
        <h1 className="text-3xl md:text-[2rem] font-semibold text-[#2E2E2F] tracking-tight">{activeTabMeta.label}</h1>
        <p className="mt-1 text-sm font-semibold text-[#2E2E2F]/65">{activeTabMeta.description}</p>
      </div>
      <div>
        {activeTab === 'organizer' && <OrganizerSettings />}
        {activeTab === 'email' && <EmailSettings />}
        {activeTab === 'payments' && <PaymentSettings />}
        {activeTab === 'team' && <TeamSettings />}
        {activeTab === 'account' && <AccountSettings />}
      </div>
    </div>
  );
};
