path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix: Make the content wrapper (line 2036) the scroll container instead of overflow-hidden
# This is the div that holds the actual preview box - it should scroll
old_wrap = "rounded-[2rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-2 shadow-[0_30px_90px_-40px_rgba(46,46,47,0.35)] md:p-5 flex-1 min-h-0 overflow-hidden"
new_wrap = "rounded-[2rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-2 shadow-[0_30px_90px_-40px_rgba(46,46,47,0.35)] md:p-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar"
content = content.replace(old_wrap, new_wrap, 1)

# Remove overflow-hidden from the inner container (line 2038) - keep just h-full and visual styles
old_inner = "overflow-hidden border border-[#2E2E2F]/12 bg-[#F2F2F2] shadow-2xl h-full"
new_inner = "border border-[#2E2E2F]/12 bg-[#F2F2F2] shadow-2xl overflow-hidden"
content = content.replace(old_inner, new_inner, 1)

# Remove h-full and overflow-y-auto from the desktop content div (line 2040) - parent handles scroll now
old_desktop_scroll = '<div className="overflow-y-auto custom-scrollbar h-full">'
new_desktop_scroll = '<div>'
content = content.replace(old_desktop_scroll, new_desktop_scroll, 1)

# Remove h-full from the mobile preview div - parent handles scroll now
old_mobile = '<div className="relative overflow-y-auto custom-scrollbar h-full">'
new_mobile = '<div className="relative">'
content = content.replace(old_mobile, new_mobile, 1)

# Remove h-full from the max-w wrapper (line 2037)
old_maxw_mobile = "max-w-[360px] mx-auto h-full"
new_maxw_mobile = "max-w-[360px] mx-auto"
content = content.replace(old_maxw_mobile, new_maxw_mobile, 1)

old_maxw_desktop = "max-w-none h-full"
new_maxw_desktop = "max-w-none"
content = content.replace(old_maxw_desktop, new_maxw_desktop, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - simplified scroll: content wrapper is now the scrollable element")
