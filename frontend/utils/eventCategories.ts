import React from 'react';
import { ICONS } from '../constants';
import { Event } from '../types';

export type EventCategoryKey =
  | 'MUSIC'
  | 'NIGHTLIFE'
  | 'PERFORMANCE_ARTS'
  | 'HOLIDAYS'
  | 'DATING'
  | 'HOBBIES'
  | 'BUSINESS'
  | 'FOOD_DRINK';

export type EventCategory = {
  key: EventCategoryKey;
  label: string;
  keywords: string[];
  Icon: React.FC<any>;
};

export const EVENT_CATEGORIES: EventCategory[] = [
  { key: 'MUSIC', label: 'Music', keywords: ['music', 'concert', 'band', 'dj', 'acoustic', 'choir'], Icon: ICONS.Bell },
  { key: 'NIGHTLIFE', label: 'Nightlife', keywords: ['night', 'party', 'club', 'after dark', 'mix'], Icon: ICONS.Monitor },
  { key: 'PERFORMANCE_ARTS', label: 'Performance & Visual Arts', keywords: ['performance', 'theater', 'theatre', 'art', 'gallery', 'showcase', 'visual'], Icon: ICONS.Ticket },
  { key: 'HOLIDAYS', label: 'Holidays', keywords: ['holiday', 'christmas', 'new year', 'festive', 'celebration'], Icon: ICONS.Calendar },
  { key: 'DATING', label: 'Dating', keywords: ['dating', 'singles', 'match', 'romance', 'social mixer'], Icon: ICONS.Users },
  { key: 'HOBBIES', label: 'Hobbies', keywords: ['hobby', 'workshop', 'community', 'craft', 'gaming'], Icon: ICONS.Settings },
  { key: 'BUSINESS', label: 'Business', keywords: ['business', 'startup', 'networking', 'summit', 'conference', 'seminar', 'pitch', 'demo day'], Icon: ICONS.Layout },
  { key: 'FOOD_DRINK', label: 'Food & Drink', keywords: ['food', 'drink', 'coffee', 'culinary', 'tasting', 'dinner', 'lunch'], Icon: ICONS.CreditCard },
];

export const getEventCategoryKeys = (event: Event): EventCategoryKey[] => {
  const sourceText = `${event.eventName || ''} ${event.description || ''} ${event.locationText || ''}`.toLowerCase();
  const matches = EVENT_CATEGORIES
    .filter((category) => category.keywords.some((keyword) => sourceText.includes(keyword)))
    .map((category) => category.key);
  return matches.length > 0 ? matches : ['BUSINESS'];
};

export const normalizeCategoryKey = (value: string): EventCategoryKey | null => {
  const normalized = String(value || '').toUpperCase().replace(/-/g, '_');
  return EVENT_CATEGORIES.some((category) => category.key === normalized) ? (normalized as EventCategoryKey) : null;
};

export const getCategoryByKey = (value: string): EventCategory | null => {
  const key = normalizeCategoryKey(value);
  if (!key) return null;
  return EVENT_CATEGORIES.find((category) => category.key === key) || null;
};
