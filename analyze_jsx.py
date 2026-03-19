with open('frontend/views/User/UserEvents.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def show(start, end):
    print(f'=== Lines {start}-{end} ===')
    for i, ln in enumerate(lines[start-1:end], start):
        stripped = ln.rstrip('\r\n')
        ws = len(stripped) - len(stripped.lstrip(' '))
        content = stripped.lstrip(' ')[:100]
        print(f'{i:4d} [{ws:3d}] {content}')
    print()

show(1393, 1415)
show(2303, 2312)
show(2425, 2438)
