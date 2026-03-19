import React, { useState, useEffect } from 'react';
import { Card, Button, Modal } from '../../components/Shared';
import { apiService } from '../../services/apiService';
import { useNavigate } from 'react-router-dom';

interface ArchivedEvent {
  eventId: string;
  eventName: string;
  slug: string;
  description: string;
  startAt: string;
  endAt: string;
  locationText: string;
  locationType: string;
  status: string;
  imageUrl: string;
  organizerId: string;
  deleted_at: string;
  archived_by_name?: string;
}

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const ArchiveEvents: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ArchivedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<ArchivedEvent | null>(null);

  useEffect(() => {
    loadArchivedEvents();
  }, []);

  const loadArchivedEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getArchivedEvents();
      setEvents(data.events || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load archived events');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (eventId: string) => {
    try {
      setActionLoading(eventId);
      await apiService.restoreEvent(eventId);
      setNotification({ message: 'Event restored successfully!', type: 'success' });
      setEvents(events.filter(e => e.eventId !== eventId));
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to restore event', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!eventToDelete) return;
    
    try {
      setActionLoading(eventToDelete.eventId);
      await apiService.deleteEvent(eventToDelete.eventId);
      setNotification({ message: 'Event permanently deleted!', type: 'success' });
      setEvents(events.filter(e => e.eventId !== eventToDelete.eventId));
      setDeleteModalOpen(false);
      setEventToDelete(null);
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to delete event', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const openDeleteModal = (event: ArchivedEvent) => {
    setEventToDelete(event);
    setDeleteModalOpen(true);
  };

  const getImageUrl = (img: any): string => {
    if (!img) return 'https://via.placeholder.com/800x400?text=No+Image';
    if (typeof img === 'string') return img;
    return img.url || img.path || img.publicUrl || 'https://via.placeholder.com/800x400?text=No+Image';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#38BDF2] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm font-medium text-[#2E2E2F]/60">Loading archive...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#2E2E2F] tracking-tight">Archive</h1>
          <p className="text-[#2E2E2F]/60 font-medium mt-1">
            Manage your deleted events
          </p>
        </div>
        <button
          onClick={loadArchivedEvents}
          className="p-2 rounded-xl text-[#2E2E2F]/60 hover:text-[#38BDF2] transition-colors"
          title="Refresh"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed top-24 right-8 z-[120]">
          <Card
            className={`px-5 py-3 rounded-xl border ${
              notification.type === 'success' 
                ? 'bg-green-50 border-green-200 text-green-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <p className="text-sm font-bold">{notification.message}</p>
          </Card>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <Card className="p-4 rounded-xl border-red-200 bg-red-50">
          <p className="text-red-600 font-semibold text-sm">{error}</p>
        </Card>
      )}

      {/* Empty State */}
      {events.length === 0 ? (
        <Card className="p-12 rounded-xl border-[#2E2E2F]/10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F2F2F2] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#2E2E2F]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <h3 className="text-xl font-black text-[#2E2E2F]">No Archived Events</h3>
          <p className="text-[#2E2E2F]/60 mt-2">Events you archive will appear here</p>
          <Button 
            onClick={() => navigate('/my-events')}
            className="mt-6 px-6 py-3 rounded-xl font-black text-[10px]"
          >
            Go to My Events
          </Button>
        </Card>
      ) : (
        /* Table View */
        <Card className="overflow-hidden rounded-xl border-[#2E2E2F]/10">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F2F2F2] border-b border-[#2E2E2F]/10">
                  <th className="text-left p-4 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Event</th>
                  <th className="text-left p-4 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Original Date</th>
                  <th className="text-left p-4 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Archived Date</th>
                  <th className="text-left p-4 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Location</th>
                  <th className="text-center p-4 text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr 
                    key={event.eventId} 
                    className="border-b border-[#2E2E2F]/5 hover:bg-[#38BDF2]/5 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[#2E2E2F]/20">
                          <img src={getImageUrl(event.imageUrl)} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="font-bold text-[#2E2E2F] text-sm">{event.eventName}</p>
                          <p className="text-xs text-[#2E2E2F]/50">ID: {event.eventId.split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-[#2E2E2F]/70">
                        {event.startAt ? formatDate(event.startAt) : '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-[#2E2E2F]/70">
                        {event.deleted_at ? formatDate(event.deleted_at) : '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-[#2E2E2F]/60 truncate max-w-[200px] block">
                        {event.locationText || '-'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          onClick={() => handleRestore(event.eventId)}
                          disabled={actionLoading === event.eventId}
                          className="p-2 text-[#2E2E2F] hover:text-green-500 transition-colors disabled:opacity-50"
                          title="Restore"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openDeleteModal(event)}
                          disabled={actionLoading === event.eventId}
                          className="p-2 text-[#2E2E2F] hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Delete Permanently"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Permanent Delete Confirmation Modal */}
      <Modal 
        isOpen={deleteModalOpen} 
        onClose={() => setDeleteModalOpen(false)}
        title="Permanently Delete?"
        showClose={true}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-full bg-red-100">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-[#2E2E2F]">Permanently Delete?</h3>
          </div>
          
          <p className="text-[#2E2E2F]/70 mb-6">
            Are you sure you want to permanently delete <strong>{eventToDelete?.eventName}</strong>? 
            This action cannot be undone and all associated data will be lost.
          </p>
          
          <div className="flex gap-3">
            <Button
              onClick={() => setDeleteModalOpen(false)}
              className="flex-1 px-4 py-3 rounded-xl font-black text-[10px] bg-[#F2F2F2]"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePermanentDelete}
              disabled={actionLoading !== null}
              className="flex-1 px-4 py-3 rounded-xl font-black text-[10px] bg-red-500 text-white"
            >
              {actionLoading ? 'Deleting...' : 'Yes, Delete Forever'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

