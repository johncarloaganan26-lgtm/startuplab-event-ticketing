import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { EventList } from './EventList';

type InfoSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type InfoPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: InfoSection[];
  highlights?: string[];
  heroImage?: string;
  heroAlt?: string;
};

const LEGAL_LINKS: Array<{ label: string; path: string }> = [
  { label: 'About Us', path: '/about-us' },
  { label: 'Events', path: '/browse-events' },
  { label: 'Contact Us', path: '/contact-us' },
];

const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80';

const InfoPageLayout: React.FC<InfoPageProps> = ({
  eyebrow,
  title,
  intro,
  updated,
  sections,
  highlights = [],
  heroImage = DEFAULT_HERO_IMAGE,
  heroAlt = 'Event operations'
}) => {
  const location = useLocation();
  return (
    <div className="bg-[#F2F2F2]">
      <div className="max-w-[88rem] mx-auto px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 lg:gap-10">
          <article className="rounded-[1.8rem] border border-[#2E2E2F]/10 bg-white p-6 sm:p-8 lg:p-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#38BDF2] mb-4">{eyebrow}</p>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-[#2E2E2F] mb-4">{title}</h1>
            <p className="text-[#2E2E2F]/70 text-sm sm:text-base leading-relaxed mb-8">{intro}</p>
            <div className="mb-8 overflow-hidden rounded-2xl border border-[#2E2E2F]/10">
              <img
                src={heroImage}
                alt={heroAlt}
                className="w-full h-[220px] sm:h-[280px] object-cover"
                loading="lazy"
              />
            </div>
            {highlights.length > 0 && (
              <div className="mb-8 rounded-2xl border border-[#2E2E2F]/10 bg-[#F2F2F2] p-4 sm:p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/50 mb-3">Platform Scope</p>
                <div className="flex flex-wrap gap-2">
                  {highlights.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full border border-[#2E2E2F]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#2E2E2F]/70 bg-white"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-8">
              {sections.map((section) => (
                <section key={section.title}>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#2E2E2F] mb-3">{section.title}</h2>
                  <div className="space-y-3">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="text-[13px] sm:text-sm text-[#2E2E2F]/75 leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {section.bullets.map((item) => (
                        <li key={item} className="text-[13px] sm:text-sm text-[#2E2E2F]/75 leading-relaxed flex items-start gap-2">
                          <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-[#38BDF2] shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <p className="mt-10 text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/45">
              Last Updated: {updated}
            </p>
          </article>

          <aside className="rounded-[1.5rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-5 h-fit lg:sticky lg:top-28">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/50 mb-4">Related Pages</p>
            <div className="space-y-2.5">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${location.pathname === link.path
                    ? 'border-[#38BDF2]/40 text-[#38BDF2] bg-white'
                    : 'border-[#2E2E2F]/10 text-[#2E2E2F]/70 hover:text-[#38BDF2] hover:border-[#38BDF2]/40'
                    }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export const AboutUsPage: React.FC = () => (
  <InfoPageLayout
    eyebrow="Company"
    title="About StartupLab Ticketing"
    intro="StartupLab Ticketing is an event platform built for organizer operations, public ticketing, and admin governance in one connected system."
    updated="March 3, 2026"
    highlights={['Organizer Console', 'Public Ticketing', 'Admin Governance', 'QR Check-In']}
    heroImage="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80"
    heroAlt="Event team planning session"
    sections={[
      {
        title: 'Platform Mission',
        paragraphs: [
          'We help organizers launch events faster while giving attendees a secure and frictionless ticket-buying experience.',
          'The platform standardizes event lifecycle operations from setup to post-event reporting so teams can run events with confidence.'
        ],
      },
      {
        title: 'Core Product Areas',
        paragraphs: ['StartupLab Ticketing is structured around three user contexts.'],
        bullets: [
          'Attendees: discovery, checkout, confirmation, and ticket access',
          'Organizers: event setup, ticket inventory, attendee ops, and promotion',
          'Admins: moderation, risk controls, disputes monitoring, and audit visibility'
        ],
      },
      {
        title: 'Operating Principles',
        paragraphs: [
          'We prioritize operational reliability, clear permissions, and measurable performance for each event.',
          'Every release is designed to support secure payments, accurate check-in, and consistent reporting quality.'
        ],
      },
    ]}
  />
);

export const PrivacyPolicyPage: React.FC = () => (
  <InfoPageLayout
    eyebrow="Legal"
    title="Privacy Policy"
    intro="This Privacy Policy describes how StartupLab Ticketing processes personal and operational data across attendee, organizer, and admin workflows."
    updated="March 3, 2026"
    highlights={['PII Protection', 'Role-Based Access', 'Tokenized Payments', 'Audit Logging']}
    heroImage="https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=1400&q=80"
    heroAlt="Secure technology and data protection"
    sections={[
      {
        title: 'Data We Process',
        paragraphs: ['We only process data required to operate event registration, ticketing, support, and security controls.'],
        bullets: [
          'Identity data: account email, profile details, authentication metadata',
          'Transaction data: orders, ticket classes, attendee details, refund records',
          'Security data: access logs, IP/device metadata, role and permission changes'
        ],
      },
      {
        title: 'How Data Is Used',
        paragraphs: [
          'Data is used to process purchases, deliver tickets, operate check-in, and support organizer reporting.',
          'Data is also used for abuse prevention, dispute handling, and platform governance requirements.'
        ],
      },
      {
        title: 'Protection Controls',
        paragraphs: [
          'Payment card details are not stored as raw card data in the platform; payment processors handle sensitive card input using tokenization.',
          'Access to personal data is restricted by scoped roles, and sensitive actions are captured in audit logs.'
        ],
      },
      {
        title: 'Retention and Rights',
        paragraphs: [
          'Records are retained based on operational, financial, and legal needs, then removed or anonymized when no longer required.',
          'Users may request data access or correction through platform support channels, subject to applicable compliance requirements.'
        ],
      },
    ]}
  />
);

export const TermsOfServicePage: React.FC = () => (
  <InfoPageLayout
    eyebrow="Legal"
    title="Terms of Service"
    intro="These Terms define acceptable use, responsibilities, and operational limits for all StartupLab Ticketing users."
    updated="March 3, 2026"
    highlights={['Account Security', 'Acceptable Use', 'Payment Terms', 'Policy Enforcement']}
    heroImage="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1400&q=80"
    heroAlt="Agreement document and policy review"
    sections={[
      {
        title: 'Account Responsibilities',
        paragraphs: [
          'Users are responsible for safeguarding login credentials and keeping account details accurate.',
          'Role assignments determine what actions can be performed inside organizer and admin consoles.'
        ],
      },
      {
        title: 'Acceptable Use',
        paragraphs: ['Use of the platform must comply with law, payment rules, and service policies.'],
        bullets: [
          'No fraudulent event listings, fabricated ticket activity, or abusive refund behavior',
          'No attempts to bypass permissions, security checks, or technical controls',
          'No misuse of attendee data or unauthorized export/distribution of personal information'
        ],
      },
      {
        title: 'Payments and Service Boundaries',
        paragraphs: [
          'Payments are processed through integrated providers and remain subject to provider terms and transaction controls.',
          'Service availability is maintained on a best-effort basis with monitoring, but outages or third-party failures may occur.'
        ],
      },
      {
        title: 'Enforcement and Updates',
        paragraphs: [
          'Violations may result in content takedown, account restriction, or permanent removal from the platform.',
          'Terms may be revised to reflect product changes, legal requirements, or risk controls. Continued use indicates acceptance.'
        ],
      },
    ]}
  />
);

export const ContactUsPage: React.FC = () => (
  <InfoPageLayout
    eyebrow="Support"
    title="Contact Us"
    intro="For organizer setup, attendee concerns, or policy-related requests, use the support pathways below for faster resolution."
    updated="March 3, 2026"
    highlights={['Support Ops', 'Organizer Help', 'Policy Requests', 'Event-Day Escalation']}
    heroImage="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=80"
    heroAlt="Customer support and collaboration team"
    sections={[
      {
        title: 'How to Reach Support',
        paragraphs: ['Include your event ID, order ID, and issue summary to help us triage quickly.'],
        bullets: [
          'In-app support for account and organizer console issues',
          'Order-related support for attendee payment and ticket concerns',
          'Policy escalations for moderation, disputes, and governance issues'
        ],
      },
      {
        title: 'Response Windows',
        paragraphs: [
          'Standard support requests are typically reviewed within 1-2 business days.',
          'Event-day operational concerns are prioritized for same-day review during active support coverage.'
        ],
      },
      {
        title: 'Operating Hours',
        paragraphs: [
          'Primary support hours follow Asia/Manila business schedules.',
          'Extended coverage may be applied for approved high-volume or time-sensitive events.'
        ],
      },
    ]}
  />
);

export const FaqPage: React.FC = () => (
  <InfoPageLayout
    eyebrow="Help"
    title="Frequently Asked Questions"
    intro="Quick guidance for the most common organizer and attendee workflows in StartupLab Ticketing."
    updated="March 3, 2026"
    highlights={['Event Setup', 'Checkout', 'Check-In', 'Refunds']}
    heroImage="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80"
    heroAlt="Frequently asked questions workspace"
    sections={[
      {
        title: 'How do I create an event?',
        paragraphs: [
          'Sign in as an organizer, create a draft event, configure ticket classes and order form fields, then publish when ready.'
        ],
      },
      {
        title: 'How do attendees receive tickets?',
        paragraphs: [
          'After successful checkout, attendees receive confirmation and ticket records tied to their order, including QR-enabled check-in details where configured.'
        ],
      },
      {
        title: 'Can my team have different access levels?',
        paragraphs: [
          'Yes. Organizer access can be scoped by role so teams can separate event editing, finance, marketing, and check-in responsibilities.'
        ],
      },
      {
        title: 'What should I do if payment fails at checkout?',
        paragraphs: [
          'Retry within the checkout flow. If the issue persists, use support with your order reference and timestamp for transaction review.'
        ],
      },
      {
        title: 'How are refunds processed?',
        paragraphs: [
          'Refunds follow organizer rules, event status, and platform safeguards. Duplicate refund attempts are blocked by transaction controls.'
        ],
      },
    ]}
  />
);

export const RefundPolicyPage: React.FC = () => (
  <InfoPageLayout
    eyebrow="Policy"
    title="Refund Policy"
    intro="This policy defines how refund requests are validated and processed for transactions in StartupLab Ticketing."
    updated="March 3, 2026"
    highlights={['Eligibility Rules', 'Review Workflow', 'Payment Reversal', 'Abuse Controls']}
    heroImage="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1400&q=80"
    heroAlt="Refund and finance process"
    sections={[
      {
        title: 'Eligibility',
        paragraphs: ['Refund eligibility depends on organizer configuration, event status, and policy windows.'],
        bullets: [
          'Cancelled events: generally eligible for full refund',
          'Rescheduled events: refund options may vary by organizer policy',
          'Completed events: usually non-refundable unless otherwise stated'
        ],
      },
      {
        title: 'Request Process',
        paragraphs: [
          'Refund requests must include order reference and reason for review.',
          'Approved requests are processed through payment integrations with idempotent controls to prevent duplicate refunds.'
        ],
      },
      {
        title: 'Processing and Settlement',
        paragraphs: [
          'Approved refunds are initiated after validation. Final settlement time depends on payment provider and issuing bank timelines.'
        ],
      },
      {
        title: 'Risk and Exceptions',
        paragraphs: [
          'Abuse signals, repeated duplicate requests, or policy violations may trigger rejection, hold, or additional verification.'
        ],
      },
    ]}
  />
);

export const PublicEventsPage: React.FC = () => <EventList />;
