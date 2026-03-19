path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add a ref to track if the user manually dismissed the preview
old_state = "    const [isPreviewMode, setIsPreviewMode] = useState(false);\n    const [isSidebarHidden, setIsSidebarHidden] = useState(false);"
new_state = "    const [isPreviewMode, setIsPreviewMode] = useState(false);\n    const [previewManuallyHidden, setPreviewManuallyHidden] = useState(false);\n    const [isSidebarHidden, setIsSidebarHidden] = useState(false);"
content = content.replace(old_state, new_state, 1)

# 2. Update the auto-open useEffect to respect the manual hide flag
old_effect = """    // Smoothly reveal preview as the user types
    useEffect(() => {
        if (isFullScreenMode && !isPreviewMode && (formData.eventName || formData.description)) {
            const timeout = setTimeout(() => setIsPreviewMode(true), 300);
            return () => clearTimeout(timeout);
        }
    }, [formData.eventName, formData.description, isFullScreenMode, isPreviewMode]);"""
new_effect = """    // Smoothly reveal preview as the user types (only if not manually hidden)
    useEffect(() => {
        if (isFullScreenMode && !isPreviewMode && !previewManuallyHidden && (formData.eventName || formData.description)) {
            const timeout = setTimeout(() => setIsPreviewMode(true), 300);
            return () => clearTimeout(timeout);
        }
    }, [formData.eventName, formData.description, isFullScreenMode, isPreviewMode, previewManuallyHidden]);"""
content = content.replace(old_effect, new_effect, 1)

# 3. Update all "Hide Preview" button clicks to also set the manual flag
# The side panel hide button (line ~1999)
old_hide1 = """                                        onClick={() => setIsPreviewMode(false)}
                                        className="px-4 py-1.5 rounded-full border border-[#2E2E2F]/15 bg-[#F2F2F2] text-[11px] font-black uppercase tracking-widest text-[#2E2E2F]/60 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                                    >
                                        Hide Preview"""
new_hide1 = """                                        onClick={() => { setIsPreviewMode(false); setPreviewManuallyHidden(true); }}
                                        className="px-4 py-1.5 rounded-full border border-[#2E2E2F]/15 bg-[#F2F2F2] text-[11px] font-black uppercase tracking-widest text-[#2E2E2F]/60 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                                    >
                                        Hide Preview"""
content = content.replace(old_hide1, new_hide1, 1)

# The fullscreen X button (line ~2008)
old_hide2 = """                                        onClick={() => setIsPreviewMode(false)}
                                        className="w-9 h-9 rounded-xl border border-[#2E2E2F]/15 bg-[#F2F2F2] text-[#2E2E2F]/55 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                                        title="Hide preview"
                                    >
                                        <span className="text-lg leading-none">"""
new_hide2 = """                                        onClick={() => { setIsPreviewMode(false); setPreviewManuallyHidden(true); }}
                                        className="w-9 h-9 rounded-xl border border-[#2E2E2F]/15 bg-[#F2F2F2] text-[#2E2E2F]/55 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                                        title="Hide preview"
                                    >
                                        <span className="text-lg leading-none">"""
content = content.replace(old_hide2, new_hide2, 1)

# 4. Update the "Preview" toggle button in the sidebar to clear the manual flag when opening
# Find the toggle button that has both hide/show logic (line ~1452-1457)
old_toggle = """                                            if (isPreviewMode) {
                                                setIsPreviewMode(false);"""
new_toggle = """                                            if (isPreviewMode) {
                                                setIsPreviewMode(false);
                                                setPreviewManuallyHidden(true);"""
content = content.replace(old_toggle, new_toggle, 1)

old_toggle_show = """                                            setIsPreviewMode(true);
                                        }"""
new_toggle_show = """                                            setIsPreviewMode(true);
                                                setPreviewManuallyHidden(false);
                                        }"""
content = content.replace(old_toggle_show, new_toggle_show, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - preview can now be closed and stays closed until manually reopened")
