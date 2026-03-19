
import sys

filename = r'c:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(filename, 'r', encoding='utf-8') as f:
    text = f.read()

def count_tags(text):
    open_divs = text.count('<div')
    close_divs = text.count('</div>')
    
    open_fragments = text.count('<>')
    close_fragments = text.count('</>')
    
    print(f"Divs: {open_divs} open, {close_divs} close. Delta={open_divs - close_divs}")
    print(f"Fragments: {open_fragments} open, {close_fragments} close. Delta={open_fragments - close_fragments}")

count_tags(text)
