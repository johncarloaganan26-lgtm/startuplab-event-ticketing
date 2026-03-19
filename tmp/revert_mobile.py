path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Identify the start of the mobile preview branch: ) : (
# 2. Identify the end of the mobile preview branch: )}
# 3. Replace everything in between with the stable "old layout".

start_line = -1
end_line = -1

for i, line in enumerate(lines):
    if ') : (' in line and i > 1500: # Ensure we are in the right area
        start_line = i
    if ')}' in line and start_line != -1 and i > start_line:
        end_line = i
        break

if start_line != -1 and end_line != -1:
    stable_mobile_layout = [
        '                                      ) : (\n',
        '                                        <div className="relative overflow-y-auto custom-scrollbar h-full">\n',
        '                                            <div className="px-4 py-8 pb-28 space-y-6">\n',
        '                                                {/* Back Button */}\n',
        '                                                <button\n',
        '                                                    type="button"\n',
        '                                                    className="hover:opacity-75 text-[11px] font-black tracking-widest uppercase flex items-center gap-2 transition-colors"\n',
        '                                                    style={{ color: previewAccentColor }}\n',
        '                                                >\n',
        '                                                    <ICONS.ChevronRight className="w-4 h-4 rotate-180" />\n',
        '                                                    BACK TO EVENTS\n',
        '                                                </button>\n',
        '\n',
        '                                                {/* Title + Actions */}\n',
        '                                                <div className="flex items-start justify-between gap-3">\n',
        '                                                    <h1 className="text-3xl font-black tracking-tight text-[#2E2E2F]">\n',
        '                                                        {formData.eventName || \'Event title\'}\n',
        '                                                    </h1>\n',
        '                                                    <div className="flex items-center gap-2">\n',
        '                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2]">\n',
        '                                                            <ICONS.Heart className="h-4 w-4" style={{ color: previewAccentColor }} />\n',
        '                                                        </div>\n',
        '                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2]">\n',
        '                                                            <ICONS.Download className="h-4 w-4" style={{ color: previewAccentColor }} />\n',
        '                                                        </div>\n',
        '                                                    </div>\n',
        '                                                </div>\n',
        '\n',
        '                                                {/* Hero Image */}\n',
        '                                                <div className="overflow-hidden rounded-xl border border-[#2E2E2F]/10 shadow-lg">\n',
        '                                                    <img\n',
        '                                                        src={getImageUrl(formData.imageUrl)}\n',
        '                                                        alt={formData.eventName || \'Event\'}\n',
        '                                                        className="w-full aspect-video object-cover"\n',
        '                                                    />\n',
        '                                                </div>\n',
        '\n',
        '                                                {/* Date & Mode Chips */}\n',
        '                                                <div className="flex flex-wrap gap-2">\n',
        '                                                    <div className="flex items-center text-[#2E2E2F]/80 bg-[#F2F2F2] px-3 py-2 rounded-xl border border-[#2E2E2F]/10 text-[12px] font-bold">\n',
        '                                                        <ICONS.Calendar className="w-4 h-4 mr-2" style={{ color: previewAccentColor }} />\n',
        '                                                        {previewDateLabel}\n',
        '                                                    </div>\n',
        '                                                    <div className="flex items-center text-[#2E2E2F]/80 bg-[#F2F2F2] px-3 py-2 rounded-xl border border-[#2E2E2F]/10 text-[12px] font-bold">\n',
        '                                                        <ICONS.Monitor className="w-4 h-4 mr-2" style={{ color: previewAccentColor }} />\n',
        '                                                        {previewAccessModeLabel}\n',
        '                                                    </div>\n',
        '                                                </div>\n',
        '\n',
        '                                                {/* Event Details */}\n',
        '                                                <div className="p-5 bg-white/40 rounded-xl border border-[#2E2E2F]/10">\n',
        '                                                    <h3 className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.35em] mb-4">EVENT DETAILS</h3>\n',
        '                                                    <p className="text-[#2E2E2F]/70 leading-relaxed text-sm font-medium whitespace-pre-wrap break-all">\n',
        '                                                        {previewOverviewText}\n',
        '                                                    </p>\n',
        '                                                </div>\n',
        '\n',
        '                                                {/* Organized By */}\n',
        '                                                <div className="p-5 bg-white/40 rounded-xl border border-[#2E2E2F]/10">\n',
        '                                                    <h3 className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.35em] mb-4">ORGANIZED BY</h3>\n',
        '                                                    <div className="flex items-center gap-3">\n',
        '                                                        <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-[#38BDF2] to-[#A5E1FF] text-white text-sm font-black flex items-center justify-center shrink-0">\n',
        '                                                            {organizerProfile?.profileImageUrl ? (\n',
        '                                                                <img src={getImageUrl(organizerProfile.profileImageUrl)} alt={previewOrganizerName} className="w-full h-full object-cover" />\n',
        '                                                            ) : (\n',
        '                                                                organizerPreviewInitial\n',
        '                                                            )}\n',
        '                                                        </div>\n',
        '                                                        <div className="min-w-0 flex-1">\n',
        '                                                            <p className="text-base font-black text-[#2E2E2F] truncate">{previewOrganizerName}</p>\n',
        '                                                            <p className="text-[10px] text-[#2E2E2F]/60 uppercase tracking-widest font-bold">Organizer</p>\n',
        '                                                        </div>\n',
        '                                                    </div>\n',
        '                                                </div>\n',
        '\n',
        '                                                {/* Location */}\n',
        '                                                <div className="p-5 bg-white/40 rounded-xl border border-[#2E2E2F]/10 overflow-hidden">\n',
        '                                                    <h3 className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.35em] mb-4">LOCATION</h3>\n',
        '                                                    <p className="text-sm text-[#2E2E2F]/70 font-medium mb-4">{previewVenueLabel}</p>\n',
        '                                                    <div className="w-full h-48 bg-[#F2F2F2] rounded-xl overflow-hidden border border-[#2E2E2F]/10">\n',
        '                                                        {hasPreviewPhysicalLocation && previewMapEmbedUrl ? (\n',
        '                                                            <iframe\n',
        '                                                                src={previewMapEmbedUrl}\n',
        '                                                                title="Preview event location map"\n',
        '                                                                width="100%"\n',
        '                                                                height="100%"\n',
        '                                                                style={{ border: \'none\' }}\n',
        '                                                                loading="lazy"\n',
        '                                                                referrerPolicy="no-referrer-when-downgrade"\n',
        '                                                            />\n',
        '                                                        ) : (\n',
        '                                                            <div className="flex items-center justify-center w-full h-full text-[#2E2E2F]/40">\n',
        '                                                                <div className="text-center">\n',
        '                                                                    <ICONS.MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />\n',
        '                                                                    <p className="text-[10px] font-medium uppercase tracking-widest">No physical location</p>\n',
        '                                                                </div>\n',
        '                                                            </div>\n',
        '                                                        )}\n',
        '                                                    </div>\n',
        '                                                </div>\n',
        '                                            </div>\n',
        '\n',
        '                                            {/* Sticky Bottom Bar */}\n',
        '                                            <div className="sticky bottom-0 left-0 right-0 border-t border-[#2E2E2F]/10 bg-[#F2F2F2]/95 backdrop-blur px-4 py-5 z-20">\n',
        '                                                <div className="rounded-xl border border-[#2E2E2F]/15 bg-[#F2F2F2] px-4 py-3 shadow-[0_12px_28px_-12px_rgba(46,46,47,0.3)]">\n',
        '                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#2E2E2F]/50">From</p>\n',
        '                                                    <div className="mt-2 flex items-center justify-between gap-3">\n',
        '                                                        <p className="text-xl font-black text-[#2E2E2F]">{previewPriceLabel || \'FREE\'}</p>\n',
        '                                                        <button\n',
        '                                                            type="button"\n',
        '                                                            disabled={!formData.ticketTypes || formData.ticketTypes.length === 0}\n',
        '                                                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${formData.ticketTypes && formData.ticketTypes.length > 0 ? \'text-white shadow-md\' : \'bg-[#E8E8E8] text-[#2E2E2F]/40 cursor-not-allowed\'}`}\n',
        '                                                            style={formData.ticketTypes && formData.ticketTypes.length > 0 ? { backgroundColor: previewAccentColor } : {}}\n',
        '                                                        >\n',
        '                                                            {formData.ticketTypes && formData.ticketTypes.length > 0 ? \'Get Tickets\' : \'Add Tickets\'}\n',
        '                                                        </button>\n',
        '                                                    </div>\n',
        '                                                </div>\n',
        '                                            </div>\n',
        '                                        </div>\n',
        '                                      )\n'
    ]
    
    # Replace the range
    lines[start_line:end_line+1] = stable_mobile_layout
    
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Reverted to stable 'old layout' mobile preview.")
else:
    print(f"Could not find stable insertion points: start={start_line}, end={end_line}")
