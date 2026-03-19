path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'
with open(path, 'rb') as f:
    data = f.read()

lines = data.split(b'\r\n')
for i in range(2400, 2410):
    print(f"Line {i+1}: {lines[i]}")
