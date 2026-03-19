path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'
outpath = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\tmp\preview_logic.txt'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open(outpath, 'w', encoding='utf-8') as out:
    keywords = ['isPreviewMode', 'isFullScreenMode', 'shouldShowPreview', 'setIsPreviewMode', 'PreviewPanel', 'previewPanelClass', 'isCreateDesktopPreview', 'isCreateMobilePreview']
    for i, line in enumerate(lines):
        for kw in keywords:
            if kw in line:
                out.write(f"Line {i+1}: {line.rstrip()}\n")
                break

print("Done")
