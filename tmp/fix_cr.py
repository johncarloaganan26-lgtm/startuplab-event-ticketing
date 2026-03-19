path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'
with open(path, 'rb') as f:
    data = f.read()

# Completely remove all \r and \r\n and normalize to \n first.
# This fixes any CR in the middle of the text.
clean = data.replace(b'\r\n', b'\n').replace(b'\r', b'\n')

# Convert back to Windows CRLF if needed, but let's try just \n for now.
# Actually, the user is on Windows, so \r\n is safer.
final = clean.replace(b'\n', b'\r\n')

with open(path, 'wb') as f:
    f.write(final)

print("Normalization complete.")
