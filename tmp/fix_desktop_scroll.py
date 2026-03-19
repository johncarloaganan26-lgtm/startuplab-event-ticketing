path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix: The desktop fullscreen content wrapper (line 2036 first branch) needs the same scroll classes
old_desktop_fullscreen = "rounded-[2rem] border border-[#2E2E2F]/10 bg-[linear-gradient(180deg,#F2F2F2_0%,#EDF2F4_100%)] p-5 shadow-[0_40px_120px_-40px_rgba(46,46,47,0.4)]"
new_desktop_fullscreen = "rounded-[2rem] border border-[#2E2E2F]/10 bg-[linear-gradient(180deg,#F2F2F2_0%,#EDF2F4_100%)] p-5 shadow-[0_40px_120px_-40px_rgba(46,46,47,0.4)] flex-1 min-h-0 overflow-y-auto custom-scrollbar"
content = content.replace(old_desktop_fullscreen, new_desktop_fullscreen, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - added scroll classes to desktop fullscreen mode")
