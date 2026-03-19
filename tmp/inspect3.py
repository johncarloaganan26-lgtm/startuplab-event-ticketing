path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'
outpath = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\tmp\lines_output.txt'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open(outpath, 'w', encoding='utf-8') as out:
    for i in range(2399, 2412):
        out.write(f"Line {i+1}: {repr(lines[i])}\n")
    out.write(f"\nTotal lines: {len(lines)}\n")

print("Output written to lines_output.txt")
