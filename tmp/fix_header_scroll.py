path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Fullscreen mobile preview mode - make it flex column, no overflow-y-auto on the outer
old_fullscreen_mobile = "? 'block xl:sticky self-start space-y-3 xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:pr-2'"
new_fullscreen_mobile = "? 'flex flex-col xl:sticky self-start xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:pr-2 overflow-hidden'"
content = content.replace(old_fullscreen_mobile, new_fullscreen_mobile, 1)

# Fix 2: Fullscreen desktop preview mode - also flex column
old_fullscreen_desktop = "? 'block space-y-4 xl:col-span-full xl:mx-auto xl:w-full xl:max-w-[1460px]'"
new_fullscreen_desktop = "? 'flex flex-col space-y-0 xl:col-span-full xl:mx-auto xl:w-full xl:max-w-[1460px] xl:max-h-[calc(100vh-8rem)] overflow-hidden'"
content = content.replace(old_fullscreen_desktop, new_fullscreen_desktop, 1)

# Fix 3: Side-panel mode - add overflow-hidden so header doesn't scroll away
old_sidepanel = "xl:sticky self-start xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:pr-1`"
new_sidepanel = "xl:sticky self-start xl:top-24 xl:max-h-[calc(100vh-8rem)] xl:pr-1 overflow-hidden`"
content = content.replace(old_sidepanel, new_sidepanel, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - Preview header is now fixed, only content scrolls")
