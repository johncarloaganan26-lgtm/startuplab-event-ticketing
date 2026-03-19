path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the outer container: when mobile, less padding
old_outer = "rounded-[2rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-4 shadow-[0_30px_90px_-40px_rgba(46,46,47,0.35)] md:p-5"
new_outer = "rounded-[2rem] border border-[#2E2E2F]/10 bg-[#F2F2F2] p-2 shadow-[0_30px_90px_-40px_rgba(46,46,47,0.35)] md:p-5"
content = content.replace(old_outer, new_outer, 1)

# 2. Update the inner wrapper div (line 2038) to have a fixed height when mobile
old_inner = """overflow-hidden border border-[#2E2E2F]/12 bg-[#F2F2F2] shadow-2xl`}>"""
new_inner = """overflow-hidden border border-[#2E2E2F]/12 bg-[#F2F2F2] shadow-2xl ${previewDevice === 'mobile' ? 'h-[680px]' : ''}`}>"""
content = content.replace(old_inner, new_inner, 1)

# 3. Update the mobile preview content div to have overflow-y-auto and fill height
old_mobile_div = '<div className="relative overflow-y-auto custom-scrollbar">'
new_mobile_div = '<div className="relative overflow-y-auto custom-scrollbar h-full">'
content = content.replace(old_mobile_div, new_mobile_div, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - applied phone mode with fixed height + internal scroll")
