path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Target range: from after the last button's div (2401-ish) to current ternary close
# Let's find exactly where we are
# Line 2400 is </button>, 2401 is </div> (sticky bar), 2402 is </div> (phone), 2403 is </div> (outer)

# We want to keep everything up to 2403 and then put the )} at 2404
# and delete everything until the next valid line.

start_del = 2403 # Line 2404
end_del = 2425   # Line 2426 (inclusive)

# Line 2427 (index 2426) is the current )}

# Delete lines[2403:2426]
# Actually, let's just use replace on the string for safety.

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

bad_chunk = """                                            </div>
                                        </div>

                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sticky Bottom Bar */}
                                            <div className="sticky bottom-0 left-0 right-0 border-t border-[#2E2E2F]/10 bg-[#F2F2F2]/95 backdrop-blur px-4 py-5 z-20">
                                                <div className="rounded-xl border border-[#2E2E2F]/15 bg-[#F2F2F2] px-4 py-3 shadow-[0_12px_28px_-12px_rgba(46,46,47,0.3)]">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#2E2E2F]/50">From</p>
                                                    <div className="mt-2 flex items-center justify-between gap-3">
                                                        <p className="text-xl font-black text-[#2E2E2F]">{previewPriceLabel || 'FREE'}</p>
                                                        <button
                                                            type="button"
                                                            disabled={!formData.ticketTypes || formData.ticketTypes.length === 0}
                                                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${formData.ticketTypes && formData.ticketTypes.length > 0 ? 'text-white shadow-md' : 'bg-[#E8E8E8] text-[#2E2E2F]/40 cursor-not-allowed'}`}
                                                            style={formData.ticketTypes && formData.ticketTypes.length > 0 ? { backgroundColor: previewAccentColor } : {}}
                                                        >
                                                            {formData.ticketTypes && formData.ticketTypes.length > 0 ? 'Get Tickets' : 'Add Tickets'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>"""

good_chunk = """                                            </div>
                                        </div>"""

content = content.replace(bad_chunk, good_chunk, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Cleanup complete - fixed JSX nesting error.")
