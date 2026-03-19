path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'
outpath = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\tmp\lines_1989.txt'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open(outpath, 'w', encoding='utf-8') as out:
    out.write(f"Line 1989: {repr(lines[1988])}\n")
    # Search for createPreviewPanelClass
    for i, line in enumerate(lines):
        if 'createPreviewPanelClass' in line or 'PreviewPanel' in line:
            out.write(f"Line {i+1}: {repr(line)}\n")

print("Done")
