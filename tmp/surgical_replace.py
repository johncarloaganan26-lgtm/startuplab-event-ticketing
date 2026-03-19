import os

path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Search for the lines
start_line = -1
end_line = -1

for i, line in enumerate(lines):
    if ') : (' in line and i > 2300 and i < 2320: # Match the 'else' part
        start_line = i
    if ')}' in line and i > 2400 and i < 2450: # Match the end of the block
        # Check if it has enough indentation or specific surrounding
        end_line = i

if start_line != -1 and end_line != -1:
    print(f"Index found: {start_line+1} to {end_line+1}")
    
    new_content = """                                      ) : (
                                          <div className="bg-[#F2F2F2] p-8 flex justify-center w-full"> {/* Outer Box (M1) */}
                                                <div className="w-full max-w-[375px] bg-[#F2F2F2] rounded-[2.8rem] shadow-2xl overflow-hidden flex flex-col relative border-2 border-[#2E2E2F]/10">
                                                    <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                                                        <div className="px-5 py-10 pb-32 space-y-7">
                                                            {/* Hero Image */}
                                                            <div className="rounded-[2.2rem] overflow-hidden shadow-md border border-[#2E2E2F]/5">
                                                                <img
                                                                    src={getImageUrl(formData.imageUrl)}
                                                                    alt={formData.eventName || 'Event'}
                                                                    className="w-full aspect-[4/3] object-cover"
                                                                />
                                                            </div>

                                                            {/* Quick Info */}
                                                            <div className="space-y-3 px-1">
                                                                <div className="flex items-center gap-3 text-[#2E2E2F]/60 font-black text-[11px] uppercase tracking-widest">
                                                                    <ICONS.MapPin className="w-3.5 h-3.5" style={{ color: previewAccentColor }} />
                                                                    <span>{previewVenueLabel || 'Venue'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3 text-[#2E2E2F]/60 font-black text-[11px] uppercase tracking-widest">
                                                                    <ICONS.Calendar className="w-3.5 h-3.5" style={{ color: previewAccentColor }} />
                                                                    <span>{previewDateLabel || 'Date & Time'}</span>
                                                                </div>
                                                            </div>

                                                            {/* Overview Section */}
                                                            <div className="space-y-4">
                                                                <h2 className="text-2xl font-black text-[#2E2E2F] tracking-tight">Overview</h2>
                                                                <p className="text-[#2E2E2F]/70 leading-relaxed text-sm font-medium whitespace-pre-wrap">
                                                                    {previewOverviewText || 'A short and sweet sentence about your event.'}
                                                                </p>
                                                            </div>

                                                            {/* Good to Know */}
                                                            <div className="space-y-4">
                                                                <h2 className="text-xl font-black text-[#2E2E2F] tracking-tight">Good to Know</h2>
                                                                <div className="p-6 bg-white/50 rounded-[2rem] border border-[#2E2E2F]/10 space-y-5">
                                                                    <h3 className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.2em]">Highlights</h3>
                                                                    <div className="space-y-4">
                                                                        <div className="flex items-center gap-3 text-[13px] font-bold text-[#2E2E2F]/70">
                                                                            <ICONS.Clock className="w-4 h-4 opacity-50" />
                                                                            <span>Duration estimated</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-3 text-[13px] font-bold text-[#2E2E2F]/70">
                                                                            <ICONS.MapPin className="w-4 h-4 opacity-50" />
                                                                            <span>{formData.locationType === 'PHYSICAL' ? 'In person' : 'Online / Hybrid'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Location */}
                                                            <div className="space-y-4">
                                                                <h2 className="text-xl font-black text-[#2E2E2F] tracking-tight">Location</h2>
                                                                <div className="px-1">
                                                                    <p className="text-[15px] font-bold text-[#2E2E2F] mb-4">{previewVenueLabel || 'Venue'}</p>
                                                                    <div className="w-full h-44 bg-white/40 rounded-[2rem] overflow-hidden border border-[#2E2E2F]/10">
                                                                        {hasPreviewPhysicalLocation && previewMapEmbedUrl ? (
                                                                            <iframe
                                                                                src={previewMapEmbedUrl}
                                                                                title="Preview map"
                                                                                width="100%"
                                                                                height="100%"
                                                                                style={{ border: 'none' }}
                                                                                loading="lazy"
                                                                            />
                                                                        ) : (
                                                                            <div className="flex items-center justify-center h-full text-[#2E2E2F]/30 bg-[#2E2E2F]/5">
                                                                                <ICONS.MapPin className="w-8 h-8 opacity-20" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Sticky Footer */}
                                                        <div className="sticky bottom-0 left-0 right-0 border-t border-[#2E2E2F]/5 bg-[#F2F2F2]/90 backdrop-blur-xl px-6 py-6 z-20">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div>
                                                                    <p className="text-sm font-black text-[#2E2E2F]">From {previewPriceLabel || '$-'}</p>
                                                                    <p className="text-[10px] font-bold text-[#2E2E2F]/40 mt-1 uppercase tracking-wider">{previewDateLabel}</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95"
                                                                    style={{ backgroundColor: previewAccentColor || '#2E2E2F' }}
                                                                >
                                                                    Get tickets
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                          </div>
                                      """
    
    # Replace lines from start to end (exclusive of lines[end_line+1])
    # Lines are 0-indexed. lines[start_line] is ') : ('
    # lines[end_line] is ')}'
    
    lines[start_line:end_line+1] = [new_content + "\n"]
    
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Replacement success.")
else:
    print(f"Failed to find indexes. Start: {start_line}, End: {end_line}")
