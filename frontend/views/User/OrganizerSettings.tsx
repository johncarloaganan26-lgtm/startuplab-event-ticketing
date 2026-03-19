import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Badge } from '../../components/Shared';
import { apiService } from '../../services/apiService';
import { OrganizerProfile } from '../../types';
import { useUser } from '../../context/UserContext';
import { ICONS } from '../../constants';

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
  coverImageUrl: string;
  brandColor: string;
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
  coverImageUrl: profile?.coverImageUrl || '',
  brandColor: profile?.brandColor || '#38BDF2',
});

type OrganizerSettingsProps = {
  onboardingMode?: boolean;
  onSaved?: (profile: OrganizerProfile) => void;
};

export const OrganizerSettings: React.FC<OrganizerSettingsProps> = ({
  onboardingMode = false,
  onSaved,
}) => {
  const { name } = useUser();
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [profile, setProfile] = React.useState<OrganizerProfile | null>(null);
  const [formData, setFormData] = React.useState<FormState>(toFormState(null, name || ''));
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState('');
  const [localCoverPreviewUrl, setLocalCoverPreviewUrl] = React.useState('');
  const [notification, setNotification] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const canCustomBrand = !!(profile?.plan?.features?.enable_custom_branding || profile?.plan?.features?.custom_branding);

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
    return () => {
      if (localPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(localPreviewUrl);
      if (localCoverPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(localCoverPreviewUrl);
    };
  }, [localPreviewUrl, localCoverPreviewUrl]);

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
    if (!canCustomBrand) {
      setNotification({ message: 'Logo upload is a Professional feature. Upgrade to unlock custom branding.', type: 'error' });
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    await handleFileUpload(file);
  };

  const handleCoverFileUpload = async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setNotification({ message: 'Only JPEG and PNG images are allowed.', type: 'error' });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setNotification({ message: 'Image must be 10MB or smaller.', type: 'error' });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLocalCoverPreviewUrl(previewUrl);
    setUploading(true);

    try {
      const { publicUrl, organizer } = await apiService.uploadOrganizerCoverImage(file);
      setFormData((prev) => ({ ...prev, coverImageUrl: publicUrl }));
      if (organizer) setProfile(organizer);
      setNotification({ message: 'Cover image uploaded successfully.', type: 'success' });
    } catch (error) {
      setNotification({
        message: extractErrorMessage(error, 'Cover image upload failed.'),
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, isCover = false) => {
    if (!canCustomBrand) {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
      setNotification({ message: 'Logo upload is a Professional feature.', type: 'error' });
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    if (isCover) {
      await handleCoverFileUpload(file);
    } else {
      await handleFileUpload(file);
    }
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
        coverImageUrl: formData.coverImageUrl || null,
        brandColor: formData.brandColor || null,
        ...(onboardingMode ? { isOnboarded: true } : {}),
      };

      const saved = await apiService.upsertOrganizer(payload);
      setProfile(saved);
      setFormData(toFormState(saved, name || ''));
      setNotification({
        message: onboardingMode ? 'Organizer profile setup complete.' : 'Organizer profile updated.',
        type: 'success'
      });
      onSaved?.(saved);
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
            className={`px-5 py-3 rounded-xl border-2 shadow-sm ${notification.type === 'success'
              ? 'bg-[#38BDF2]/20 border-[#38BDF2]/40 text-[#2E2E2F]'
              : 'bg-[#2E2E2F]/10 border-[#2E2E2F]/30 text-[#2E2E2F]'
              }`}
          >
            <p className="text-sm font-bold tracking-tight">{notification.message}</p>
          </Card>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="p-8 rounded-xl border-2 border-[#2E2E2F]/15 bg-[#F2F2F2]">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-start">
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Cover Photo</label>
                <div
                  className={`relative rounded-xl border-2 border-dashed ${dragActive ? 'border-[#38BDF2] bg-[#38BDF2]/10' : 'border-[#2E2E2F]/20 bg-[#F2F2F2]'
                    } p-4 transition-colors group cursor-pointer`}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/jpeg,image/png';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverFileUpload(file);
                    };
                    input.click();
                  }}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => handleDrop(e, true)}
                >
                  <div className="aspect-[3/1] rounded-xl overflow-hidden bg-[#F2F2F2] border border-[#2E2E2F]/10 flex items-center justify-center">
                    {formData.coverImageUrl || localCoverPreviewUrl ? (
                      <img src={formData.coverImageUrl || localCoverPreviewUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <ICONS.Camera className="w-8 h-8 mx-auto text-[#2E2E2F]/20 mb-2" />
                        <p className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-widest">Add Cover Photo</p>
                      </div>
                    )}
                  </div>
                  {!canCustomBrand && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-xl">
                      <Badge type="info" className="mb-2 bg-[#2E2E2F] text-white">PRO ONLY</Badge>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Brand Logo / Avatar</label>
                <div
                  className={`w-32 relative rounded-xl border-2 border-dashed ${dragActive ? 'border-[#38BDF2] bg-[#38BDF2]/10' : 'border-[#2E2E2F]/20 bg-[#F2F2F2]'
                    } p-3 transition-colors`}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => handleDrop(e, false)}
                >
                  <div
                    className="aspect-square rounded-xl overflow-hidden bg-[#F2F2F2] border border-[#2E2E2F]/10 flex items-center justify-center cursor-pointer"
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
                  {!canCustomBrand && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-xl">
                      <Badge type="info" className="mb-2 bg-[#2E2E2F] text-white text-[8px]">PRO</Badge>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-[#2E2E2F]/40 font-bold uppercase tracking-widest">Recommended: 400x400</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Custom Branding</label>
                    {!canCustomBrand && <Badge type="info" className="text-[8px] bg-[#2E2E2F] text-white uppercase px-2 font-black">Professional Feature</Badge>}
                  </div>

                  <div className="p-5 rounded-xl border-2 border-[#2E2E2F]/10 bg-white/50 space-y-4 relative overflow-hidden group">
                    <div className={`flex items-center gap-5 ${!canCustomBrand ? 'opacity-40 grayscale' : ''}`}>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-widest ml-1">Brand Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={formData.brandColor}
                            onChange={(e) => handleFormChange('brandColor', e.target.value)}
                            disabled={!canCustomBrand}
                            className="w-12 h-12 rounded-xl border-none p-0 cursor-pointer bg-transparent"
                          />
                          <div>
                            <p className="text-xs font-bold text-[#2E2E2F]">{formData.brandColor.toUpperCase()}</p>
                            <p className="text-[10px] text-[#2E2E2F]/50 font-medium">Global default for your events</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {!canCustomBrand && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="outline" className="text-[10px] font-black tracking-widest py-2 px-4 border-[#2E2E2F]/20 bg-white shadow-sm" onClick={() => navigate('/subscription')}>UNLOCK BRANDING</Button>
                      </div>
                    )}
                  </div>
                </div>

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
                    className="w-full px-3 py-2 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl outline-none focus:ring-2 focus:ring-[#38BDF2]/40 min-h-[120px]"
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
                    className="w-full px-3 py-2 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl outline-none focus:ring-2 focus:ring-[#38BDF2]/40 min-h-[90px]"
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

                <div className="md:col-span-2 mt-4 pt-6 border-t-2 border-[#2E2E2F]/10">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <label className="block text-[11px] font-black text-[#2E2E2F] uppercase tracking-widest mb-1">Brand Identity</label>
                      <p className="text-[12px] text-[#2E2E2F]/60 font-medium">This color will be applied to your event pages and buttons.</p>
                    </div>
                    {!canCustomBrand && (
                      <Badge type="neutral" className="bg-[#2E2E2F]/5 text-[#2E2E2F]/40 border-none text-[9px] font-black py-1 px-3">PRO FEATURE</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-[#2E2E2F]/40 uppercase tracking-widest">Hex Code</label>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl shadow-sm border border-[#2E2E2F]/10 transition-transform hover:scale-105"
                          style={{ backgroundColor: formData.brandColor }}
                        />
                        <input
                          type="text"
                          value={formData.brandColor}
                          disabled={!canCustomBrand}
                          onChange={(e) => handleFormChange('brandColor', e.target.value)}
                          className={`w-32 px-4 py-3 bg-[#F2F2F2] border border-[#2E2E2F]/10 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#38BDF2]/30 ${!canCustomBrand ? 'opacity-50 cursor-not-allowed' : ''}`}
                          placeholder="#000000"
                        />
                        <input
                          type="color"
                          value={formData.brandColor}
                          disabled={!canCustomBrand}
                          onChange={(e) => handleFormChange('brandColor', e.target.value)}
                          className={`w-10 h-10 p-0 border-none bg-transparent cursor-pointer ${!canCustomBrand ? 'opacity-50 cursor-not-allowed Pointer-events-none' : ''}`}
                        />
                      </div>
                    </div>

                    <div className="flex-1 p-5 rounded-xl bg-white/50 border border-[#2E2E2F]/5 hidden sm:block">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: formData.brandColor }}>
                          <ICONS.CheckCircle className="w-4 h-4" />
                        </div>
                        <p className="text-[11px] font-bold text-[#2E2E2F]/60 uppercase tracking-widest">Brand System Active</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl border-2 border-[#2E2E2F]/15 bg-[#F2F2F2]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold text-[#2E2E2F]/60 uppercase tracking-wide">Organizer Snapshot</p>
              <p className="text-sm text-[#2E2E2F]/70 mt-1">
                Followers: <span className="font-bold text-[#2E2E2F]">{profile?.followersCount || 0}</span>
                {' '}| Events Hosted: <span className="font-bold text-[#2E2E2F]">{profile?.eventsHostedCount || 0}</span>
              </p>
            </div>

            <div className="flex gap-3">
              {!onboardingMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/subscription')}
                  className="px-6 py-3 rounded-xl font-black tracking-widest text-[10px]"
                >
                  Subscription
                </Button>
              )}
              <Button type="submit" className="px-8 py-3 rounded-xl font-black tracking-widest text-[10px]" disabled={loading || saving || uploading}>
                {saving
                  ? (onboardingMode ? 'Finishing Setup...' : 'Saving...')
                  : (onboardingMode ? 'Complete Setup' : 'Save Organizer Profile')}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};

