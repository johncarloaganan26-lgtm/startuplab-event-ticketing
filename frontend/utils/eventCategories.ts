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
  | 'FOOD_DRINK'
  | 'HEALTH'
  | 'AUTO_BOAT_AIR'
  | 'CHARITY_CAUSES'
  | 'COMMUNITY'
  | 'FAMILY_EDUCATION'
  | 'FASHION'
  | 'FILM_MEDIA'
  | 'HOME_LIFESTYLE'
  | 'GOVERNMENT'
  | 'SPIRITUALITY'
  | 'SCHOOL_ACTIVITIES'
  | 'SCIENCE_TECH'
  | 'SPORTS_FITNESS'
  | 'TRAVEL_OUTDOOR'
  | 'OTHER';

export type EventCategory = {
  key: EventCategoryKey;
  label: string;
  keywords: string[];
  Icon: React.FC<any>;
};

export const EVENT_CATEGORIES: EventCategory[] = [
  { key: 'BUSINESS', label: 'Business', keywords: ['business', 'startup', 'networking', 'summit', 'conference', 'seminar', 'pitch', 'demo day', 'professional'], Icon: ICONS.Layout },
  { key: 'FOOD_DRINK', label: 'Food & Drink', keywords: ['food', 'drink', 'coffee', 'culinary', 'tasting', 'dinner', 'lunch', 'restaurant', 'bar'], Icon: ICONS.CreditCard },
  { key: 'HEALTH', label: 'Health', keywords: ['health', 'wellness', 'medical', 'fitness', 'mental health', 'yoga', 'meditation'], Icon: ICONS.Heart },
  { key: 'MUSIC', label: 'Music', keywords: ['music', 'concert', 'band', 'dj', 'acoustic', 'choir', 'orchestra', 'festival'], Icon: ICONS.Bell },
  { key: 'AUTO_BOAT_AIR', label: 'Auto, Boat & Air', keywords: ['car', 'automotive', 'boat', 'aviation', 'plane', 'bike', 'motor'], Icon: ICONS.Box },
  { key: 'CHARITY_CAUSES', label: 'Charity & Causes', keywords: ['charity', 'foundation', 'nonprofit', 'fundraiser', 'volunteer'], Icon: ICONS.Shield },
  { key: 'COMMUNITY', label: 'Community', keywords: ['community', 'local', 'neighborhood', 'town hall', 'gathering'], Icon: ICONS.Users },
  { key: 'FAMILY_EDUCATION', label: 'Family & Education', keywords: ['family', 'kids', 'education', 'school', 'learning', 'parenting'], Icon: ICONS.Search },
  { key: 'FASHION', label: 'Fashion', keywords: ['fashion', 'style', 'runway', 'clothing', 'apparel', 'beauty'], Icon: ICONS.Ticket },
  { key: 'FILM_MEDIA', label: 'Film & Media', keywords: ['film', 'movie', 'cinema', 'photography', 'media', 'journalism'], Icon: ICONS.Monitor },
  { key: 'HOBBIES', label: 'Hobbies', keywords: ['hobby', 'workshop', 'community', 'craft', 'gaming', 'collector'], Icon: ICONS.Settings },
  { key: 'HOME_LIFESTYLE', label: 'Home & Lifestyle', keywords: ['home', 'lifestyle', 'interior', 'garden', 'cooking', 'diy'], Icon: ICONS.Home },
  { key: 'PERFORMANCE_ARTS', label: 'Performing & Visual Arts', keywords: ['performance', 'theater', 'theatre', 'art', 'gallery', 'showcase', 'visual', 'dance'], Icon: ICONS.Ticket },
  { key: 'GOVERNMENT', label: 'Government', keywords: ['government', 'policy', 'politics', 'public', 'civic'], Icon: ICONS.Shield },
  { key: 'SPIRITUALITY', label: 'Spirituality', keywords: ['spirituality', 'religion', 'faith', 'church', 'temple', 'belief'], Icon: ICONS.Globe },
  { key: 'SCHOOL_ACTIVITIES', label: 'School Activities', keywords: ['school', 'university', 'college', 'student', 'campus'], Icon: ICONS.Calendar },
  { key: 'SCIENCE_TECH', label: 'Science & Tech', keywords: ['science', 'tech', 'technology', 'it', 'software', 'coding', 'ai', 'robotics'], Icon: ICONS.Monitor },
  { key: 'HOLIDAYS', label: 'Holidays', keywords: ['holiday', 'christmas', 'new year', 'festive', 'celebration', 'halloween', 'easter'], Icon: ICONS.Calendar },
  { key: 'SPORTS_FITNESS', label: 'Sports & Fitness', keywords: ['sports', 'fitness', 'gym', 'workout', 'running', 'football', 'basketball', 'soccer'], Icon: ICONS.TrendingUp },
  { key: 'TRAVEL_OUTDOOR', label: 'Travel & Outdoor', keywords: ['travel', 'outdoor', 'adventure', 'hiking', 'camping', 'nature', 'trip'], Icon: ICONS.MapPin },
  { key: 'OTHER', label: 'Other', keywords: ['other', 'miscellaneous', 'general'], Icon: ICONS.MoreHorizontal },
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
