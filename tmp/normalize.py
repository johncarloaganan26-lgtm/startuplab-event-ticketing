path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'
with open(path, 'rb') as f:
    data = f.read()

# Replace mixed line endings with Unix, then to Windows if needed.
# But more importantly, fix why grep failed.
# If \r was in the middle of a line, it would overwrite the start of the line in the terminal.

cleaned = data.replace(b'\r\n', b'\n').replace(b'\r', b'\n')
with open(path, 'wb') as f:
    f.write(cleaned.replace(b'\n', b'\r\n'))
