import re

filepath = r'c:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

lines = content.split(b'\r\n')

# Print lines 2400-2435 with indentation counts
for i in range(2399, 2435):
    trimmed = lines[i].strip()
    spaces = len(lines[i]) - len(lines[i].lstrip())
    print(f'L{i+1} ({spaces:3d}): {trimmed[:100].decode("utf-8", errors="replace")}')
