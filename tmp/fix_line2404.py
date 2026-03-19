path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 2404 (0-indexed 2403) is just whitespace - replace it with the closing )}
lines[2403] = '                                      )}\n'

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Fixed: Added )} on line 2404")
