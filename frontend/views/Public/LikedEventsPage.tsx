import React from 'react';
import { EventList } from './EventList';

export const LikedEventsPage: React.FC = () => {
  return <EventList mode="events" listing="liked" />;
};
