
import sys

filename = r'c:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(filename, 'r', encoding='utf-8') as f:
    text = f.read()

def count_tokens(text):
    curlies = 0
    squares = 0
    roundies = 0
    
    for i, char in enumerate(text):
        if char == '{': curlies += 1
        elif char == '}': curlies -= 1
        elif char == '[': squares += 1
        elif char == ']': squares -= 1
        elif char == '(': roundies += 1
        elif char == ')': roundies -= 1
        
        # If we encounter negatives, something is wrong
        if curlies < 0:
            # find line number
            line_num = text[:i].count('\n') + 1
            print(f"Negative curlies at line {line_num}")
            curlies = 0
        if roundies < 0:
            line_num = text[:i].count('\n') + 1
            print(f"Negative roundies at line {line_num}")
            roundies = 0

    print(f"Final counts: Curley={curlies}, Square={squares}, Round={roundies}")

count_tokens(text)
