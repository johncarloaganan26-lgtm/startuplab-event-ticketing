path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The issue: after line 2403's </div>, there's a blank line, then </div> on 2405
# But the ternary `)}` is missing. We need to add it.
# Current structure around lines 2401-2405:
#   </div>   <- closes scrollbar div
#   </div>   <- closes max-w card div  
#   </div>   <- closes outer M1 div
#            <- blank
#   </div>   <- but this is supposed to close something else

# The problem is that the ternary expression ) : ( ... ) needs its closing )}
# Let's find the exact spot.
# Look for the pattern: the outer M1 div close followed by the next </div>

# The replacement script left out the closing ')}'
# We need to insert it after the M1 div close

old = '                                          </div>\r\n                                       \r\n                                </div>'
if old in content:
    new = '                                          </div>\r\n                                      )}\r\n                                </div>'
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fix 1 applied")
else:
    print("Pattern 1 not found, trying alternate...")
    # Try with just \n
    old2 = '                                          </div>\n                                       \n                                </div>'
    if old2 in content:
        new2 = '                                          </div>\n                                      )}\n                                </div>'
        content = content.replace(old2, new2)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fix 1 (alt) applied")
    else:
        # Let's find what's really there - search around "Outer Box (M1)"
        # and find the closing structure
        lines = content.split('\n')
        for i in range(2399, 2410):
            print(f"Line {i+1}: {repr(lines[i])}")
