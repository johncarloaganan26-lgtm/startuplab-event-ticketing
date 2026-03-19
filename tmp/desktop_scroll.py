path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the preview panel (line 1989) to be a flex column with fixed height
# The non-fullscreen mode class needs max-h and flex-col so the header stays and content scrolls
old_panel = "`${shouldShowPreviewPanel ? 'block' : 'hidden'} xl:sticky self-start space-y-3 xl:overflow-y-auto xl:top-24 xl:max-h-[calc(100vh-10rem)] xl:pr-1 custom-scrollbar`"
new_panel = "`${shouldShowPreviewPanel ? 'flex flex-col' : 'hidden'} xl:sticky self-start xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:pr-1`"
content = content.replace(old_panel, new_panel, 1)

# 2. Update the content wrapper (line 2036) to be scrollable and take remaining space
# Add overflow-y-auto and flex-1 for the non-fullscreen mode
old_content_wrap = "'rounded-[2rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-2 shadow-[0_30px_90px_-40px_rgba(46,46,47,0.35)] md:p-5'"
new_content_wrap = "'rounded-[2rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-2 shadow-[0_30px_90px_-40px_rgba(46,46,47,0.35)] md:p-5 flex-1 min-h-0 overflow-hidden'"
content = content.replace(old_content_wrap, new_content_wrap, 1)

# 3. The inner div (line 2038) - for desktop mode, also give it a fixed height + scroll
old_inner = "overflow-hidden border border-[#2E2E2F]/12 bg-[#F2F2F2] shadow-2xl ${previewDevice === 'mobile' ? 'h-[680px]' : ''}"
new_inner = "overflow-hidden border border-[#2E2E2F]/12 bg-[#F2F2F2] shadow-2xl h-full"
content = content.replace(old_inner, new_inner, 1)

# 4. The desktop preview content (the <> fragment starting line 2040) needs overflow-y-auto
# The fragment <> can't take className, so we need to wrap the desktop content in a scrollable div
# Replace the <> with a div that has overflow-y-auto h-full
old_fragment_open = """                                    {previewDevice !== 'mobile' ? (
                                        <>
                                            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24 sm:pb-32 lg:py-16 lg:pb-16">"""
new_fragment_open = """                                    {previewDevice !== 'mobile' ? (
                                        <div className="overflow-y-auto custom-scrollbar h-full">
                                            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24 sm:pb-32 lg:py-16 lg:pb-16">"""
content = content.replace(old_fragment_open, new_fragment_open, 1)

# 5. Replace the closing </> with </div>
old_fragment_close = """                                         </>"""
new_fragment_close = """                                         </div>"""
# This might match multiple times, so let's be more careful
# Find the exact one near the end of the desktop preview section
# Look for the </> that comes right before ") : ("
old_close_pattern = "                                         </>\n                                      ) : ("
new_close_pattern = "                                         </div>\n                                      ) : ("
content = content.replace(old_close_pattern, new_close_pattern, 1)

# Also handle \r\n variant
old_close_pattern2 = "                                         </>\r\n                                      ) : ("
new_close_pattern2 = "                                         </div>\r\n                                      ) : ("
content = content.replace(old_close_pattern2, new_close_pattern2, 1)

# 6. Add margin-top/gap for the preview header
old_header_div = "flex items-center justify-between ${isCreateDesktopPreviewMode"
new_header_div = "flex items-center justify-between shrink-0 mb-3 ${isCreateDesktopPreviewMode"
content = content.replace(old_header_div, new_header_div, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - desktop preview now has fixed height with internal scrolling")
