path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# RESTORING THE ENTIRE PREVIEW SECTION (from the panel start to the end of the toggle logic)
# We find the start at createPreviewPanelClass line (~1992)
# and replace everything until the end of the preview panel block.

start_panel = -1
for i, line in enumerate(lines):
    if 'createPreviewPanelClass' in line and i > 1500:
        start_panel = i
        break

# Find the end of this block (ending with the match for line 1992's div)
# Since I messed up the nesting, it's safer to find the next major sibling or modal end.
end_modal = -1
for i, line in enumerate(lines):
    if '</Modal>' in line and i > start_panel:
         # Check if it looks like the right modal end (before isTicketModalOpen)
         if i + 5 < len(lines) and 'isTicketModalOpen' in lines[i+4]:
              end_modal = i
              break

if start_panel != -1 and end_modal != -1:
    # Rebuilding the block perfectly
    preview_block = [
        '                    <div className={isFullScreenMode ? createPreviewPanelClass : `${shouldShowPreviewPanel ? \'flex flex-col\' : \'hidden\'} xl:sticky self-start xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:pr-1 overflow-hidden`}>\n',
        '                        <div className={`flex items-center justify-between shrink-0 mb-3 ${isCreateDesktopPreviewMode ? \'rounded-full border border-[#2E2E2F]/10 bg-[#F2F2F2]/90 px-4 py-3 shadow-[0_20px_50px_-30px_rgba(46,46,47,0.35)] backdrop-blur\' : \'\'}`}>\n',
        '                            <div className="flex items-center gap-2">\n',
        '                                <ICONS.ChevronRight className="w-4 h-4 text-[#2E2E2F]/65" />\n',
        '                                <h4 className={`${isCreateDesktopPreviewMode ? \'text-xl\' : \'text-[30px]\'} font-black text-[#2E2E2F] tracking-tight`}>Preview</h4>\n',
        '                            </div>\n',
        '                            <div className="flex items-center gap-2">\n',
        '                                {!isFullScreenMode && (\n',
        '                                    <button\n',
        '                                        type="button"\n',
        '                                        onClick={() => { setIsPreviewMode(false); setPreviewManuallyHidden(true); }}\n',
        '                                        className="px-4 py-1.5 rounded-full border border-[#2E2E2F]/15 bg-[#F2F2F2] text-[11px] font-black uppercase tracking-widest text-[#2E2E2F]/60 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"\n',
        '                                    >\n',
        '                                        Hide Preview\n',
        '                                    </button>\n',
        '                                )}\n',
        '                                {isFullScreenMode && (\n',
        '                                    <button\n',
        '                                        type="button"\n',
        '                                        onClick={() => { setIsPreviewMode(false); setPreviewManuallyHidden(true); }}\n',
        '                                        className="w-9 h-9 rounded-xl border border-[#2E2E2F]/15 bg-[#F2F2F2] text-[#2E2E2F]/55 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"\n',
        '                                        title="Hide preview"\n',
        '                                    >\n',
        '                                        <span className="text-lg leading-none">×</span>\n',
        '                                    </button>\n',
        '                                )}\n',
        '                                <div className="inline-flex items-center rounded-xl border border-[#2E2E2F]/15 bg-[#F2F2F2] p-1">\n',
        '                                    <button\n',
        '                                        type="button"\n',
        '                                        onClick={() => setPreviewDevice(\'mobile\')}\n',
        '                                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${previewDevice === \'mobile\' ? \'bg-[#2563EB]/15 text-[#2563EB]\' : \'text-[#2E2E2F]/45 hover:text-[#2E2E2F]\'}`}\n',
        '                                        title="Mobile preview"\n',
        '                                    >\n',
        '                                        <MobilePreviewIcon className="w-4 h-4" />\n',
        '                                    </button>\n',
        '                                    <button\n',
        '                                        type="button"\n',
        '                                        onClick={() => setPreviewDevice(\'desktop\')}\n',
        '                                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${previewDevice === \'desktop\' ? \'bg-[#2563EB]/15 text-[#2563EB]\' : \'text-[#2E2E2F]/45 hover:text-[#2E2E2F]\'}`}\n',
        '                                        title="Desktop preview"\n',
        '                                    >\n',
        '                                        <DesktopPreviewIcon className="w-4 h-4" />\n',
        '                                    </button>\n',
        '                                </div>\n',
        '                            </div>\n',
        '                        </div>\n',
        '\n',
        '                        <div className={isCreateDesktopPreviewMode ? \'rounded-[2rem] border border-[#2E2E2F]/10 bg-[linear-gradient(180deg,#F2F2F2_0%,#EDF2F4_100%)] p-5 shadow-[0_40px_120px_-40px_rgba(46,46,47,0.4)] flex-1 min-h-0 overflow-hidden\' : \'rounded-[2rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-2 shadow-[0_30px_90px_-40px_rgba(46,46,47,0.35)] md:p-5 flex-1 min-h-0 overflow-hidden\'}>\n',
        '                            <div className={`h-full ${isCreateDesktopPreviewMode ? \'mx-auto max-w-7xl\' : previewDevice === \'mobile\' ? \'max-w-[360px] mx-auto\' : \'max-w-none\'}`}>\n',
        '                                <div className={`h-full border border-[#2E2E2F]/12 bg-[#F2F2F2] shadow-2xl overflow-hidden rounded-[2rem]`}>\n',
        '                                    {previewDevice !== \'mobile\' ? (\n',
        '                                        <div className="h-full overflow-y-auto custom-scrollbar">\n',
        '                                            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24 sm:pb-32 lg:py-16 lg:pb-16">\n',
        '                                                 {/* Desktop Preview Content */}\n',
        '                                                 <div className="mb-8">\n',
        '                                                     <button type="button" className="hover:opacity-75 text-[#2E2E2F] text-[11px] font-black tracking-widest uppercase flex items-center mb-10 gap-2 transition-colors" style={{ color: previewAccentColor }}>\n',
        '                                                         <ICONS.ChevronRight className="w-4 h-4 rotate-180" />\n',
        '                                                         BACK TO EVENTS\n',
        '                                                     </button>\n',
        '                                                     \n',
        '                                                     <div className="flex flex-col lg:flex-row gap-16 items-start">\n',
        '                                                         <div className="flex-1 space-y-10">\n',
        '                                                             <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">\n',
        '                                                                 <h1 className="text-4xl lg:text-5xl font-black text-[#2E2E2F] tracking-tighter leading-tight">\n',
        '                                                                     {formData.eventName || \'Event title\'}\n',
        '                                                                 </h1>\n',
        '                                                             </div>\n',
        '                                                             <div className="overflow-hidden rounded-xl border border-[#2E2E2F]/10">\n',
        '                                                                 <img src={getImageUrl(formData.imageUrl)} className="w-full aspect-video object-cover" />\n',
        '                                                             </div>\n',
        '                                                             <div className="p-8 bg-[#F2F2F2] rounded-xl border border-[#2E2E2F]/10">\n',
        '                                                                 <h3 className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.4em] mb-6">EVENT DETAILS</h3>\n',
        '                                                                 <p className="text-[#2E2E2F]/70 text-base font-medium whitespace-pre-wrap">{previewOverviewText}</p>\n',
        '                                                             </div>\n',
        '                                                         </div>\n',
        '                                                         <div className="w-full lg:w-[380px] shrink-0">\n',
        '                                                             <Card className="p-8 rounded-xl bg-[#F2F2F2] border border-[#2E2E2F]/10">\n',
        '                                                                 <h2 className="text-xl font-black text-[#2E2E2F] mb-6 tracking-tight">Get Tickets</h2>\n',
        '                                                                 <Button className="w-full" style={{ backgroundColor: previewAccentColor }}>Get Tickets</Button>\n',
        '                                                             </Card>\n',
        '                                                         </div>\n',
        '                                                     </div>\n',
        '                                                 </div>\n',
        '                                            </div>\n',
        '                                        </div>\n',
        '                                      ) : (\n',
        '                                        <div className="relative h-full overflow-y-auto custom-scrollbar">\n',
        '                                            <div className="px-4 py-8 pb-28 space-y-6">\n',
        '                                                {/* Reverted Stable Mobile Layout */}\n',
        '                                                <button type="button" className="hover:opacity-75 text-[11px] font-black tracking-widest uppercase flex items-center gap-2 transition-colors" style={{ color: previewAccentColor }}>\n',
        '                                                    <ICONS.ChevronRight className="w-4 h-4 rotate-180" />\n',
        '                                                    BACK TO EVENTS\n',
        '                                                </button>\n',
        '                                                <h1 className="text-3xl font-black tracking-tight text-[#2E2E2F]">{formData.eventName || \'Event title\'}</h1>\n',
        '                                                <div className="overflow-hidden rounded-xl border border-[#2E2E2F]/10 shadow-lg">\n',
        '                                                    <img src={getImageUrl(formData.imageUrl)} className="w-full aspect-video object-cover" />\n',
        '                                                </div>\n',
        '                                                <div className="p-5 bg-white/40 rounded-xl border border-[#2E2E2F]/10">\n',
        '                                                    <h3 className="text-[10px] font-black text-[#2E2E2F]/60 uppercase tracking-[0.35em] mb-4">EVENT DETAILS</h3>\n',
        '                                                    <p className="text-[#2E2E2F]/70 text-sm font-medium whitespace-pre-wrap">{previewOverviewText}</p>\n',
        '                                                </div>\n',
        '                                            </div>\n',
        '                                            <div className="sticky bottom-0 left-0 right-0 border-t border-[#2E2E2F]/10 bg-[#F2F2F2]/95 backdrop-blur px-4 py-5 z-20">\n',
        '                                                <button className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-md" style={{ backgroundColor: previewAccentColor }}>Get Tickets</button>\n',
        '                                            </div>\n',
        '                                        </div>\n',
        '                                      )}\n',
        '                                </div>\n',
        '                            </div>\n',
        '                        </div>\n',
        '                    </div>\n',
        '                </div>\n'
    ]
    
    # Replace the huge range with a clean, known-good structure
    lines[start_panel:end_modal+1] = preview_block
    
    with open(path, \'w\', encoding=\'utf-8\') as f:
        f.writelines(lines)
    print("Full Preview Restored Successfully")
else:
    print(f"Failed to find restoration points: start={start_panel}, end={end_modal}")
