path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(2400, 2410):
    print(f"Line {i+1}: {repr(lines[i])}")
