path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Rebuilding the mobile preview block (lines 2308-2428 approximately)
# I will find the exact start/end to replace it cleanly.

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if ') : (' in line and i > 2000:
        # Check if the next line is the beginning of our mobile preview div
        if i + 1 < len(lines) and '<div className="relative">' in lines[i+1]:
             start_idx = i + 1
    if '</div>\n' in line and ')}' in lines[i+1] and start_idx != -1:
         end_idx = i + 1
         break

if start_idx == -1 or end_idx == -1:
    # Fallback search if the previous fix changed lines significantly
    for i, line in enumerate(lines):
        if 'setIsPreviewMode(false);' in line and i > 2300: # inside mobile preview
             pass # just a marker
    # Let's just use the known structure from the previous view_file
    start_idx = 2308 # index 2308 is line 2309
    end_idx = 2427 # index 2427 is line 2428

new_mobile_preview = """                                        <div className="relative h-full flex flex-col items-center py-4">
                                            {/* Subtle Phone Frame */}
                                            <div className="w-full max-w-[320px] h-full bg-white rounded-[3rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.15)] border-[8px] border-[#F8F9FA] relative flex flex-col overflow-hidden ring-1 ring-black/5">
                                                {/* Speaker/Sensors Pill */}
                                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#F8F9FA] rounded-b-2xl z-30 flex items-center justify-center">
                                                    <div className="w-8 h-1 bg-[#E9ECEF] rounded-full"></div>
                                                </div>

                                                {/* Internal Scrollable Content */}
                                                <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#F8F9FA] relative">
                                                    <div className="pt-0 pb-20">
                                                        {/* Hero Section */}
                                                        <div className="relative h-44 w-full overflow-hidden">
                                                            <img
                                                                src={getImageUrl(formData.imageUrl)}
                                                                alt="Event Hero"
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FA] via-transparent to-transparent"></div>
                                                        </div>

                                                        <div className="px-4 -mt-10 relative z-10 space-y-3">
                                                            {/* Title Card */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5 flex items-start justify-between">
                                                                <h2 className="text-xl font-black text-[#2E2E2F] tracking-tight truncate pr-2">
                                                                    {formData.eventName || 'Event Name'}
                                                                </h2>
                                                                <button className="text-[#2E2E2F]/40 hover:text-[#2E2E2F]">
                                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg>
                                                                </button>
                                                            </div>

                                                            {/* Date Chip */}
                                                            <div className="bg-white rounded-xl p-3 shadow-sm border border-black/5 flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                                                                    <ICONS.Calendar className="w-4 h-4" />
                                                                </div>
                                                                <p className="text-[12px] font-bold text-[#2E2E2F]/70">
                                                                    {previewDateLabel || 'Date and time not set'}
                                                                </p>
                                                            </div>

                                                            {/* Venue Chip */}
                                                            <div className="bg-white rounded-xl p-3 shadow-sm border border-black/5 flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
                                                                    <ICONS.MapPin className="w-4 h-4" />
                                                                </div>
                                                                <p className="text-[12px] font-bold text-[#2E2E2F]/70">
                                                                    {previewVenueLabel || 'No venue set'}
                                                                </p>
                                                            </div>

                                                            {/* Details Card */}
                                                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-black/5">
                                                                <h3 className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em] mb-3">EVENT DETAILS</h3>
                                                                <p className="text-[13px] text-[#2E2E2F]/60 font-medium leading-relaxed">
                                                                    {previewOverviewText || 'A short and sweet sentence about your event.'}
                                                                </p>
                                                            </div>

                                                            {/* Location Map Card */}
                                                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <h3 className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em]">LOCATION</h3>
                                                                    <span className="text-[10px] font-black text-blue-500 uppercase">View Map</span>
                                                                </div>
                                                                <div className="h-28 w-full bg-[#F1F3F5] rounded-xl overflow-hidden mb-2">
                                                                    {hasPreviewPhysicalLocation && previewMapEmbedUrl ? (
                                                                        <iframe src={previewMapEmbedUrl} className="w-full h-full border-0" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center opacity-20">
                                                                            <ICONS.MapPin className="w-8 h-8" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <p className="text-[11px] font-bold text-[#2E2E2F]/70">{previewVenueLabel}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Sticky Action Bar */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md px-4 py-4 border-t border-black/5 z-20">
                                                    <button 
                                                        className="w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95"
                                                        style={{ backgroundColor: previewAccentColor || '#38BDF2' }}
                                                    >
                                                        Get tickets
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
"""

# Applying replacement
new_lines = [line + '\n' for line in new_mobile_preview.split('\n')]
lines[start_idx:end_idx+1] = new_lines

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Final mobile preview UI applied successfully.")
