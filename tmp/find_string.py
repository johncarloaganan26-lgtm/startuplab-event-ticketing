path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

if 'EVENT DETAILS' in content:
    print(f"Found 'EVENT DETAILS' at index {content.find('EVENT DETAILS')}")
    # Show 100 chars around it
    idx = content.find('EVENT DETAILS')
    print(f"Context: {repr(content[idx-50:idx+50])}")
else:
    print("'EVENT DETAILS' not found in content")
