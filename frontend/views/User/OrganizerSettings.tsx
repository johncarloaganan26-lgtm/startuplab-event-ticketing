import React from 'react';
import { Card, Button, Input } from '../../components/Shared';
import { apiService } from '../../services/apiService';
import { OrganizerProfile } from '../../types';
import { useUser } from '../../context/UserContext';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

type FormState = {
  organizerName: string;
  websiteUrl: string;
  bio: string;
  eventPageDescription: string;
  facebookId: string;
  twitterHandle: string;
  emailOptIn: boolean;
  profileImageUrl: string;
};

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, '');

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const toFormState = (profile: OrganizerProfile | null, fallbackName: string): FormState => ({
  organizerName: profile?.organizerName || fallbackName || '',
  websiteUrl: profile?.websiteUrl || '',
  bio: profile?.bio || '',
  eventPageDescription: profile?.eventPageDescription || '',
  facebookId: profile?.facebookId || '',
  twitterHandle: profile?.twitterHandle || '',
  emailOptIn: !!profile?.emailOptIn,
  profileImageUrl: profile?.profileImageUrl || '',
});

export const OrganizerSettings: React.FC = () => {
  const { name } = useUser();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [profile, setProfile] = React.useState<OrganizerProfile | null>(null);
  const [formData, setFormData] = React.useState<FormState>(toFormState(null, name || ''));
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState('');
  const [notification, setNotification] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        const organizer = await apiService.getMyOrganizer();
        if (!isMounted) return;
        setProfile(organizer);
        setFormData(toFormState(organizer, name || ''));
      } catch (error) {
        if (!isMounted) return;
        setNotification({
          message: extractErrorMessage(error, 'Failed to load organizer profile.'),
          type: 'error',
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [name]);

  React.useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notification]);

  React.useEffect(() => {
    return () => {
      if (localPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const handleFormChange = (field: keyof FormState, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileUpload = async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setNotification({ message: 'Only JPEG and PNG images are allowed.', type: 'error' });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setNotification({ message: 'Image must be 10MB or smaller.', type: 'error' });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(previewUrl);
    setUploading(true);

    try {
      const { publicUrl, organizer } = await apiService.uploadOrganizerImage(file);
      setFormData((prev) => ({ ...prev, profileImageUrl: publicUrl }));
      if (organizer) setProfile(organizer);
      setNotification({ message: 'Organizer image uploaded successfully.', type: 'success' });
    } catch (error) {
      setNotification({
        message: extractErrorMessage(error, 'Image upload failed.'),
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    const organizerName = stripHtml(formData.organizerName).trim();

    setSaving(true);
    try {
      const payload = {
        organizerName: organizerName || null,
        websiteUrl: formData.websiteUrl.trim() || null,
        bio: stripHtml(formData.bio).trim() || null,
        eventPageDescription: stripHtml(formData.eventPageDescription).trim() || null,
        facebookId: formData.facebookId.trim() || null,
        twitterHandle: formData.twitterHandle.trim() || null,
        emailOptIn: formData.emailOptIn,
        profileImageUrl: formData.profileImageUrl || null,
      };

      const saved = await apiService.upsertOrganizer(payload);
      setProfile(saved);
      setFormData(toFormState(saved, name || ''));
      setNotification({ message: 'Organizer profile updated.', type: 'success' });
    } catch (error) {
      setNotification({
        message: extractErrorMessage(error, 'Failed to save organizer profile.'),
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const displayImageUrl = formData.profileImageUrl || localPreviewUrl || '';
  const fallbackInitial = (formData.organizerName || name || 'O').charAt(0).toUpperCase();

  return (
    <div className="space-y-8 pb-20">
      {notification && (
        <div className="fixed top-24 right-8 z-[120]">
          <Card
            className={`px-5 py-3 rounded-2xl border ${
              notification.type === 'success'
                ? 'bg-[#38BDF2]/20 border-[#38BDF2]/40 text-[#2E2E2F]'
                : 'bg-[#2E2E2F]/10 border-[#2E2E2F]/30 text-[#2E2E2F]'
            }`}
          >
            <p className="text-sm font-bold tracking-tight">{notification.message}</p>
          </Card>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="p-8 rounded-[2rem] border-[#2E2E2F]/10 bg-[#F2F2F2]">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-start">
            <div className="space-y-3">
              <label className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Profile Image</label>
              <div
                className={`relative rounded-[1.5rem] border-2 border-dashed ${
                  dragActive ? 'border-[#38BDF2] bg-[#38BDF2]/10' : 'border-[#2E2E2F]/20 bg-[#F2F2F2]'
                } p-4 transition-colors`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDragActive(false);
                }}
                onDrop={handleDrop}
              >
                <div
                  className="aspect-square rounded-2xl overflow-hidden bg-[#F2F2F2] border border-[#2E2E2F]/10 flex items-center justify-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {displayImageUrl ? (
                    <img src={displayImageUrl} alt="Organizer profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-black text-[#2E2E2F]/25">{fallbackInitial}</span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <p className="text-[11px] text-[#2E2E2F]/60 font-medium mt-3">
                  Drag and drop JPEG/PNG
                  <br />
                  Max 10MB
                </p>
                {uploading && <p className="text-[11px] font-bold text-[#38BDF2] mt-2">Uploading image...</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <Input
                  label="Organizer Name"
                  value={formData.organizerName}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    handleFormChange('organizerName', stripHtml(event.target.value))
                  }
                />
              </div>

              <Input
                label="Website URL"
                placeholder="https://example.com"
                value={formData.websiteUrl}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  handleFormChange('websiteUrl', event.target.value)
                }
              />

              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 text-sm text-[#2E2E2F]/80 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.emailOptIn}
                    onChange={(event) => handleFormChange('emailOptIn', event.target.checked)}
                    className="w-4 h-4 accent-[#38BDF2]"
                  />
                  Receive organizer email updates
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#2E2E2F]/70 mb-1.5">Bio / Description (Text only)</label>
                <textarea
                  className="w-full px-3 py-2 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-lg outline-none focus:ring-2 focus:ring-[#38BDF2]/40 min-h-[120px]"
                  value={formData.bio}
                  onChange={(event) => handleFormChange('bio', stripHtml(event.target.value))}
                  placeholder="Introduce your organization..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#2E2E2F]/70 mb-1.5">
                  Event Page Description (Short)
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-[#F2F2F2] border border-[#2E2E2F]/20 rounded-lg outline-none focus:ring-2 focus:ring-[#38BDF2]/40 min-h-[90px]"
                  maxLength={280}
                  value={formData.eventPageDescription}
                  onChange={(event) => handleFormChange('eventPageDescription', stripHtml(event.target.value))}
                  placeholder="A short default description shown on your event pages."
                />
              </div>

              <Input
                label="Facebook ID"
                placeholder="your.page.id"
                value={formData.facebookId}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  handleFormChange('facebookId', event.target.value)
                }
              />

              <Input
                label="Twitter Handle"
                placeholder="@yourhandle"
                value={formData.twitterHandle}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  handleFormChange('twitterHandle', event.target.value)
                }
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-2xl border-[#2E2E2F]/10 bg-[#F2F2F2]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Organizer Snapshot</p>
              <p className="text-sm text-[#2E2E2F]/70 mt-1">
                Followers: <span className="font-bold text-[#2E2E2F]">{profile?.followersCount || 0}</span>
                {' '}| Events Hosted: <span className="font-bold text-[#2E2E2F]">{profile?.eventsHostedCount || 0}</span>
              </p>
            </div>

            <Button type="submit" className="px-8 py-3 rounded-xl font-black tracking-widest text-[10px]" disabled={loading || saving || uploading}>
              {saving ? 'Saving...' : 'Save Organizer Profile'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
};
