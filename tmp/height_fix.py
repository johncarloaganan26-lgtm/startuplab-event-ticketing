path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The max-w wrapper div (line 2037) also needs h-full so height flows through
old_maxw = "previewDevice === 'mobile' ? 'max-w-[360px] mx-auto' : 'max-w-none'"
new_maxw = "previewDevice === 'mobile' ? 'max-w-[360px] mx-auto h-full' : 'max-w-none h-full'"
content = content.replace(old_maxw, new_maxw, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - added h-full to max-w wrapper")
