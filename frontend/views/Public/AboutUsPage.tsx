import React from 'react';
import { ICONS } from '../../constants';

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
    description: 'Manage attendees, check-ins, and post-event reporting with organizer and admin governance controls.',
    Icon: ICONS.CheckCircle,
  },
];

const testimonials = [
  {
    quote: 'Publishing our event and managing attendee check-in became significantly faster with one workflow.',
    name: 'A. Santos',
    role: 'Community Organizer',
  },
  {
    quote: 'The ticketing and reporting tools gave our team a clearer picture of conversion and attendance quality.',
    name: 'J. Rivera',
    role: 'Program Lead',
  },
  {
    quote: 'Support tooling and role-based access helped us delegate tasks without losing control.',
    name: 'M. Cruz',
    role: 'Operations Manager',
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
      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 h-[260px] sm:h-[300px] lg:h-[350px] overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(116deg,#38BDF2_0%,#38BDF2_44%,#F2F2F2_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,62,134,0.45)_0%,rgba(0,62,134,0.2)_34%,rgba(0,62,134,0)_72%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_32%,rgba(255,255,255,0.34),transparent_46%),linear-gradient(90deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.06)_26%,rgba(255,255,255,0)_52%)]" />
        <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl items-center px-5 sm:px-8">
          <div className="max-w-[740px]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 mb-4">About Us</p>
            <h1 className="text-[2.1rem] font-black leading-none tracking-tight text-white sm:text-5xl">
              Connecting People Through Meaningful Events
            </h1>
            <p className="mt-4 max-w-[700px] text-base leading-relaxed text-white/95 sm:text-[1.1rem]">
              StartupLab Ticketing helps communities discover experiences, organizers launch events confidently, and teams run attendee operations with secure, measurable workflows.
            </p>
          </div>
        </div>
      </section>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16 space-y-10">

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {featureCards.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-[#2E2E2F]/10 bg-[#F2F2F2] p-5">
              <div className="w-10 h-10 rounded-xl bg-[#38BDF2]/15 text-[#38BDF2] flex items-center justify-center mb-4">
                <feature.Icon className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black tracking-tight text-[#2E2E2F] mb-2">{feature.title}</h2>
              <p className="text-sm text-[#2E2E2F]/70 leading-relaxed">{feature.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-[1.6rem] border border-[#2E2E2F]/10 bg-white p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/50 mb-4">Community Voices</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((item) => (
              <article key={item.name} className="rounded-2xl border border-[#2E2E2F]/10 p-5 bg-[#F2F2F2]">
                <p className="text-sm text-[#2E2E2F]/75 leading-relaxed mb-4">"{item.quote}"</p>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-[#2E2E2F]">{item.name}</p>
                <p className="text-[11px] text-[#2E2E2F]/55 mt-1">{item.role}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E2E2F]/50 mb-4">Impact</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {impactStats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#2E2E2F]/10 bg-white px-4 py-5">
                <p className="text-2xl font-black text-[#2E2E2F] tracking-tight">{item.value}</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2E2E2F]/60 mt-2">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
