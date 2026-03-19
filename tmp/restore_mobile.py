path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines 2308-2404 (1-indexed) = indices 2307-2403
# Replace lines[2307] through lines[2403] inclusive

new_mobile_block = """                                      ) : (
                                        <div className="relative overflow-y-auto custom-scrollbar">
                                            <div className="px-4 py-8 pb-28 space-y-6">
                                                {/* Back Button */}
                                                <button
                                                    type="button"
                                                    className="hover:opacity-75 text-[11px] font-black tracking-widest uppercase flex items-center gap-2 transition-colors"
                                                    style={{ color: previewAccentColor }}
                                                >
                                                    <ICONS.ChevronRight className="w-4 h-4 rotate-180" />
                                                    BACK TO EVENTS
                                                </button>

                                                {/* Title + Actions */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <h1 className="text-3xl font-black tracking-tight text-[#2E2E2F]">
                                                        {formData.eventName || 'Event title'}
                                                    </h1>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2]">
                                                            <ICONS.Heart className="h-4 w-4" style={{ color: previewAccentColor }} />
                                                        </div>
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2]">
                                                            <ICONS.Download className="h-4 w-4" style={{ color: previewAccentColor }} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Hero Image */}
                                                <div className="overflow-hidden rounded-xl border border-[#2E2E2F]/10 shadow-lg">
                                                    <img
                                                        src={getImageUrl(formData.imageUrl)}
                                                        alt={formData.eventName || 'Event'}
                                                        className="w-full aspect-video object-cover"
                                                    />
                                                </div>

                                                {/* Date & Mode Chips */}
                                                <div className="flex flex-wrap gap-2">
                                                    <div className="flex items-center text-[#2E2E2F]/80 bg-[#F2F2F2] px-3 py-2 rounded-xl border border-[#2E2E2F]/10 text-[12px] font-bold">
                                                        <ICONS.Calendar className="w-4 h-4 mr-2" style={{ color: previewAccentColor }} />
                                                        {previewDateLabel}
                                                    </div>
                                                    <div className="flex items-center text-[#2E2E2F]/80 bg-[#F2F2F2] px-3 py-2 rounded-xl border border-[#2E2E2F]/10 text-[12px] font-bold">
                                                        <ICONS.Monitor className="w-4 h-4 mr-2" style={{ color: previewAccentColor }} />
                                                        {previewAccessModeLabel}
                                                    </div>
                                                </div>

                                                {/* Event Details */}
                                                <div className="p-5 bg-white/40 rounded-xl border border-[#2E2E2F]/10">
                                                    <h3 className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.35em] mb-4">EVENT DETAILS</h3>
                                                    <p className="text-[#2E2E2F]/70 leading-relaxed text-sm font-medium whitespace-pre-wrap break-all">
                                                        {previewOverviewText}
                                                    </p>
                                                </div>

                                                {/* Organized By */}
                                                <div className="p-5 bg-white/40 rounded-xl border border-[#2E2E2F]/10">
                                                    <h3 className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.35em] mb-4">ORGANIZED BY</h3>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#38BDF2] to-[#A5E1FF] text-white text-sm font-black flex items-center justify-center shrink-0">
                                                            {organizerProfile?.profileImageUrl ? (
                                                                <img src={getImageUrl(organizerProfile.profileImageUrl)} alt={previewOrganizerName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                organizerPreviewInitial
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-base font-black text-[#2E2E2F] truncate">{previewOrganizerName}</p>
                                                            <p className="text-[10px] text-[#2E2E2F]/60 uppercase tracking-widest font-bold">Organizer</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Location */}
                                                <div className="p-5 bg-white/40 rounded-xl border border-[#2E2E2F]/10 overflow-hidden">
                                                    <h3 className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.35em] mb-4">LOCATION</h3>
                                                    <p className="text-sm text-[#2E2E2F]/70 font-medium mb-4">{previewVenueLabel}</p>
                                                    <div className="w-full h-48 bg-[#F2F2F2] rounded-xl overflow-hidden border border-[#2E2E2F]/10">
                                                        {hasPreviewPhysicalLocation && previewMapEmbedUrl ? (
                                                            <iframe
                                                                src={previewMapEmbedUrl}
                                                                title="Preview event location map"
                                                                width="100%"
                                                                height="100%"
                                                                style={{ border: 'none' }}
                                                                loading="lazy"
                                                                referrerPolicy="no-referrer-when-downgrade"
                                                            />
                                                        ) : (
                                                            <div className="flex items-center justify-center w-full h-full text-[#2E2E2F]/40">
                                                                <div className="text-center">
                                                                    <ICONS.MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                                    <p className="text-[10px] font-medium uppercase tracking-widest">No physical location</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sticky Bottom Bar */}
                                            <div className="sticky bottom-0 left-0 right-0 border-t border-[#2E2E2F]/10 bg-[#F2F2F2]/95 backdrop-blur px-4 py-5 z-20">
                                                <div className="rounded-xl border border-[#2E2E2F]/15 bg-[#F2F2F2] px-4 py-3 shadow-[0_12px_28px_-12px_rgba(46,46,47,0.3)]">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#2E2E2F]/50">From</p>
                                                    <div className="mt-2 flex items-center justify-between gap-3">
                                                        <p className="text-xl font-black text-[#2E2E2F]">{previewPriceLabel || 'FREE'}</p>
                                                        <button
                                                            type="button"
                                                            disabled={!formData.ticketTypes || formData.ticketTypes.length === 0}
                                                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${formData.ticketTypes && formData.ticketTypes.length > 0 ? 'text-white shadow-md' : 'bg-[#E8E8E8] text-[#2E2E2F]/40 cursor-not-allowed'}`}
                                                            style={formData.ticketTypes && formData.ticketTypes.length > 0 ? { backgroundColor: previewAccentColor } : {}}
                                                        >
                                                            {formData.ticketTypes && formData.ticketTypes.length > 0 ? 'Get Tickets' : 'Add Tickets'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                      )}
"""

new_lines = new_mobile_block.split('\n')
new_lines = [line + '\n' for line in new_lines]

# Replace lines 2308-2404 (indices 2307-2403)
lines[2307:2404] = new_lines

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Replaced lines 2308-2404 with {len(new_lines)} new lines. Total: {len(lines)}")
