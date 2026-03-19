import os
import re

path = r'c:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserHome.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace rounded-2xl or rounded-[2rem] etc with rounded-[5px]
content = content.replace('rounded-2xl', 'rounded-[5px]')
content = content.replace('rounded-xl', 'rounded-[5px]')
content = content.replace('rounded-[2rem]', 'rounded-[5px]')
content = content.replace('rounded-[1.5rem]', 'rounded-[5px]')
content = content.replace('rounded-3xl', 'rounded-[5px]')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
