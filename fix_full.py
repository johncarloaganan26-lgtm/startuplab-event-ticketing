import os
import re

path = r'c:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix mobile POV: Add conditional hiding to the form container
# Look for line 1304: <div className="space-y-4">
# We need to find the specific one after the sidebar block
search_pattern = r'(<div className="space-y-4">)'
# Since there are multiple "space-y-4", we look for the one after the steps loop
# and after the header block.
# Header has <h3>{activeStepMeta.title}</h3>

new_content = re.sub(
    r'(<h3 className="text-2xl[^>]*>{activeStepMeta\.title}</h3>.*?<div className="space-y-4">)',
    lambda m: m.group(1).replace('<div className="space-y-4">', '<div className={`space-y-4 ${isPreviewMode ? \'hidden xl:block\' : \'block\'}`}>'),
    content,
    flags=re.DOTALL
)

# Replace rounded-2xl or rounded-[2rem] with rounded-[5px] in portal (modals/cards)
# Focus on the blocks we identified
new_content = new_content.replace('rounded-2xl', 'rounded-[5px]')
new_content = new_content.replace('rounded-xl', 'rounded-[5px]')
new_content = new_content.replace('rounded-[2rem]', 'rounded-[5px]')
new_content = new_content.replace('rounded-[1.5rem]', 'rounded-[5px]')
new_content = new_content.replace('rounded-[2.5rem]', 'rounded-[5px]')

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)
