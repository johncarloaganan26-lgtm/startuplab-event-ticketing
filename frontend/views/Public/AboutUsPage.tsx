import React from 'react';
import { ICONS } from '../../constants';
import { PublicPageHero } from '../../components/PublicPageHero';

const ACCENT = '#38BDF2';

const featureCards = [
  {
    title: 'Discover Events',
    description: 'Find verified business, community, and learning events with clear schedules and ticket availability.',
    Icon: ICONS.Search,
  },
  {
    title: 'Create & Publish',
    description: 'Launch events fast with structured setup for details, ticket classes, policies, and promotion.',
    Icon: ICONS.Calendar,
  },
  {
    title: 'Run Smooth Operations',
    description: 'Manage attendees, check-ins, and post-event reporting with secure, measurable workflows.',
    Icon: ICONS.CheckCircle,
  },
];

const testimonials = [
  {
    quote: "As a startup building and scaling events, we needed something practical, not over-engineered. StartupLab fit well with how we actually operate day to day.",
    name: "Pierce Giron",
    role: "Co-Founder · Learnovate Academy",
    rating: 5,
    initials: "PG",
  },
  {
    quote: "We used StartupLab as a core ticketing system while refining our internal processes. It helped us see gaps and standardize how we manage attendee experience.",
    name: "Robi Manalo",
    role: "Co-Founder · RIBO CRM",
    rating: 5,
    initials: "RM",
  },
  {
    quote: "For a multi-event environment, having a shared platform across teams is important. StartupLab made it easier to align basic event workflows.",
    name: "Hanely Yoo",
    role: "Operations Manager · Startuplab Business Center",
    rating: 5,
    initials: "HY",
  },
  {
    quote: "Even in early use, StartupLab gave us better visibility into registration trends and attendee data compared to manual spreadsheets.",
    name: "Richard F. Prodigalidad",
    role: "Founder · Zenkraf 3d Studio",
    rating: 5,
    initials: "RFP",
  },
  {
    quote: "We're still early, but StartupLab helped us think about organizer structure sooner rather than later. That alone is valuable for a growing team.",
    name: "Jun Litang",
    role: "Co-Founder · Wide Vision Tours",
    rating: 5,
    initials: "JL",
  },
  {
    quote: "StartupLab helped us organize attendee records and event access early, before things got messy. It gave us a cleaner check-in foundation as we grow.",
    name: "Stephanie Escalano",
    role: "Human Happiness Manager · Simplysource OPC",
    rating: 5,
    initials: "SE",
  },
];

const impactStats = [
  { label: 'Events Hosted', value: '2,400+' },
  { label: 'Attendees Served', value: '120K+' },
  { label: 'Organizer Teams', value: '900+' },
  { label: 'Check-ins Processed', value: '1.1M+' },
];

export const AboutUsPage: React.FC = () => {
  return (
    <div className="bg-[#F2F2F2]">
      <PublicPageHero
        eyebrow="About Us"
        title="Connecting People Through Meaningful Events"
        description="StartupLab Ticketing helps communities discover experiences, organizers launch events confidently, and teams run attendee operations with secure, measurable workflows."
      />
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16 space-y-10">

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {featureCards.map((feature) => (
            <article key={feature.title} className="rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] p-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${ACCENT}26`, color: ACCENT }}>
                <feature.Icon className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black tracking-tight text-[#2E2E2F] mb-2">{feature.title}</h2>
              <p className="text-sm text-[#2E2E2F]/70 leading-relaxed">{feature.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/50 mb-4">Meet Our Team</p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#2E2E2F]">The people behind StartupLab Ticketing</h2>
          <p className="mt-3 text-sm sm:text-base text-[#2E2E2F]/70 leading-relaxed">
            We’re a cross-functional crew of builders, operators, and event strategists focused on helping organizers run better experiences.
          </p>
        </section>

        <section className="rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/50 mb-4">Community Voices</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((item) => (
              <article key={item.name} className="rounded-xl border border-[#2E2E2F]/10 p-5 bg-[#F2F2F2] shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex text-[#38BDF2] mb-4">
                    {[...Array(item.rating)].map((_, i) => (
                      <ICONS.Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-[#2E2E2F]/80 leading-relaxed mb-6">"{item.quote}"</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#38BDF2] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {item.initials}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#2E2E2F] leading-tight">{item.name}</p>
                    <p className="text-[11px] text-[#2E2E2F]/60 mt-0.5">{item.role}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/50 mb-4">Impact</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {impactStats.map((item) => (
              <div key={item.label} className="rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] px-4 py-5">
                <p className="text-2xl font-black tracking-tight" style={{ color: ACCENT }}>{item.value}</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2E2E2F]/60 mt-2">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

