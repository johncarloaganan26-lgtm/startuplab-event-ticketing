
import os

path = r'C:\Users\John Carlo\OneDrive\Desktop\startupevent\startuplab-business-ticketing\frontend\views\User\UserEvents.tsx'

with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Define the markers for the Modal section
start_marker = "{/* ─── Create/Edit Event Modal (SAME as Admin side) ─── */}"
modal_start_tag = "<Modal"
modal_end_tag = "</Modal>"

start_pos = text.find(start_marker)
modal_start_pos = text.find(modal_start_tag, start_pos)
# We need the FIRST modal end after the start (which is the main builder modal)
modal_end_pos = text.find(modal_end_tag, modal_start_pos) + len(modal_end_tag)

new_builder_ui = """
            {/* ─── Event Builder: Full-Screen Workspace ─── */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-[#F2F2F2] z-[999] flex flex-col overflow-hidden animate-in fade-in duration-500">
                    <div className="flex-1 grid grid-cols-[320px_1fr_420px] h-full overflow-hidden">
                        
                        {/* 1. Left Sidebar: Context & Progress */}
                        <div className="p-8 border-r-2 border-[#2E2E2F]/5 flex flex-col gap-8 overflow-y-auto custom-scrollbar bg-[#F2F2F2]">
                            <button 
                                onClick={handleCloseEventModal}
                                className="group flex items-center gap-3 text-[10px] font-black tracking-[0.2em] text-[#2E2E2F]/40 hover:text-[#2E2E2F] transition-all uppercase mb-4"
                            >
                                <div className="p-2.5 rounded-xl bg-white border-2 border-[#2E2E2F]/10 group-hover:border-[#38BDF2]/40 group-hover:shadow-sm transition-all text-[#2E2E2F]/60">
                                    <ICONS.ChevronRight className="w-3.5 h-3.5 rotate-180" />
                                </div>
                                BACK TO EVENTS
                            </button>

                            <div className="p-8 bg-white/60 border-2 border-[#2E2E2F]/5 rounded-[2.5rem] space-y-6 shadow-sm">
                                <div className="space-y-3">
                                    <h2 className="text-3xl font-black text-[#2E2E2F] tracking-tight leading-[1.1]">
                                        {formData.eventName || 'Event Title'}
                                    </h2>
                                    <div className="inline-flex px-3 py-1 bg-[#2E2E2F]/5 rounded-lg text-[9px] font-black text-[#2E2E2F]/40 uppercase tracking-widest">
                                        Draft
                                    </div>
                                </div>
                                
                                <div className="space-y-3 pt-3">
                                    <div className="flex items-center gap-3 p-4 bg-[#F2F2F2] border-2 border-[#2E2E2F]/5 rounded-2xl">
                                        <ICONS.Calendar className="w-4 h-4 text-[#38BDF2]" />
                                        <span className="text-[12px] font-bold text-[#2E2E2F]/40">Date and time not set</span>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-[#F2F2F2] border-2 border-[#2E2E2F]/5 rounded-2xl">
                                        <ICONS.MapPin className="w-4 h-4 text-[#38BDF2]" />
                                        <span className="text-[12px] font-bold text-[#2E2E2F]/40">Set Venue / Connection</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-white/60 border-2 border-[#2E2E2F]/5 rounded-[2.5rem] shadow-sm flex-1">
                                <p className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.3em] mb-8">STEP {wizardStep}</p>
                                <div className="space-y-2">
                                    {EVENT_SETUP_STEPS.map((step) => (
                                        <button 
                                            key={step.id}
                                            onClick={() => setWizardStep(step.id)}
                                            className={`w-full flex items-start gap-4 p-5 rounded-[1.5rem] transition-all group relative ${wizardStep === step.id ? 'bg-[#38BDF2]/10 border-2 border-[#38BDF2]/20' : 'hover:bg-white border-2 border-transparent'}`}
                                        >
                                            <div className={`mt-0.5 h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${wizardStep >= step.id ? 'bg-[#38BDF2] border-[#38BDF2] text-white' : 'border-[#2E2E2F]/15'}`}>
                                                {wizardStep > step.id ? <ICONS.Check className="w-3 h-3" strokeWidth={5} /> : <span className="text-[10px] font-black">{step.id}</span>}
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-sm font-black tracking-tight ${wizardStep === step.id ? 'text-[#38BDF2]' : 'text-[#2E2E2F]'}`}>{step.title}</p>
                                                <p className="text-[10px] text-[#2E2E2F]/40 font-bold leading-relaxed mt-1">{EVENT_SETUP_STEP_DETAIL[step.id]}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 2. Middle: Editor Workspace */}
                        <div className="relative h-full bg-white flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.05)] overflow-hidden">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-20 pb-40">
                                <div className="max-w-3xl mx-auto">
                                    <div className="mb-20 space-y-4">
                                        <div className="flex items-baseline gap-4">
                                            <h1 className="text-6xl font-black text-[#2E2E2F] tracking-tighter leading-none">{activeStepMeta.title}</h1>
                                            <p className="text-2xl font-light text-[#2E2E2F]/20 tracking-tighter">Step {wizardStep} of 5</p>
                                        </div>
                                        <p className="text-[10px] font-black text-[#2E2E2F]/30 uppercase tracking-[0.5em]">{EVENT_SETUP_STEP_DETAIL[wizardStep].toUpperCase()}</p>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-16">
                                        {wizardStep === 1 && (
                                            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.3em] ml-1">Organizer Name</label>
                                                    <select value={organizerProfile?.organizerId || ''} disabled className="w-full px-6 py-5 bg-[#F2F2F2] border-2 border-[#2E2E2F]/5 rounded-2xl text-sm font-bold text-[#2E2E2F] appearance-none cursor-not-allowed">
                                                        <option>{organizerProfile?.organizerName || 'BBEK'}</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.3em] ml-1">Event Name</label>
                                                    <Input 
                                                        placeholder="e.g. Founder Growth Summit 2026" 
                                                        value={formData.eventName} 
                                                        onChange={(e: any) => setFormData({ ...formData, eventName: e.target.value })} 
                                                        className="px-6 py-6 bg-[#F2F2F2] border-2 border-[#2E2E2F]/5 rounded-2xl text-base font-bold text-[#2E2E2F] transition-all focus:bg-white focus:border-[#38BDF2]/40"
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.3em] ml-1">Description</label>
                                                    <textarea 
                                                        className="w-full px-6 py-6 bg-[#F2F2F2] border-2 border-[#2E2E2F]/5 rounded-[2.5rem] text-sm font-medium text-[#2E2E2F] min-h-[180px] focus:bg-white focus:border-[#38BDF2]/40 transition-all outline-none leading-relaxed" 
                                                        value={formData.description} 
                                                        placeholder="Tell the story of your event..."
                                                        onChange={(e: any) => setFormData({ ...formData, description: e.target.value })} 
                                                    />
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.3em] ml-1">Brand Color</label>
                                                    <div className="p-5 bg-white border-2 border-[#2E2E2F]/5 rounded-[2rem] flex items-center gap-6 shadow-sm">
                                                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-inner border border-black/5 shrink-0">
                                                            <input
                                                                type="color"
                                                                value={formData.brandColor || '#38BDF2'}
                                                                onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                                                                className="absolute -inset-4 w-[200%] h-[200%] cursor-pointer border-none p-0"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3">
                                                                <p className="text-sm font-black text-[#2E2E2F]">Primary color</p>
                                                                <span className="text-[11px] font-bold text-[#2E2E2F]/20 uppercase tracking-tighter">{(formData.brandColor || '#38BDF2').toUpperCase()}</span>
                                                            </div>
                                                            <p className="text-[10px] text-[#2E2E2F]/40 font-bold uppercase tracking-tight mt-1">Applied to buttons, links, and accents across your event page.</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.3em] ml-1">Visual Media</label>
                                                    <div
                                                        className="relative group w-full h-[300px] rounded-[3rem] border-2 border-dashed border-[#2E2E2F]/10 bg-[#F9FAFB] flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-[#38BDF2]/40 hover:bg-white transition-all shadow-inner"
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        {formData.imageUrl ? (
                                                            <img src={getImageUrl(formData.imageUrl)} alt="Preview" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-700">
                                                                <div className="w-20 h-20 rounded-full bg-[#38BDF2]/10 flex items-center justify-center text-[#38BDF2] mb-6">
                                                                    <ICONS.Cloud className="w-10 h-10" />
                                                                </div>
                                                                <h3 className="text-xl font-black text-[#2E2E2F] tracking-tight mb-2">Upload cover image</h3>
                                                                <p className="text-[11px] font-bold text-[#2E2E2F]/40 uppercase tracking-[0.2em]">Drag & drop or <span className="text-[#38BDF2] underline">browse</span></p>
                                                                <p className="text-[10px] text-[#2E2E2F]/20 font-black uppercase tracking-widest mt-6">Recommended Ratio 16:9</p>
                                                            </div>
                                                        )}
                                                        <div className="absolute bottom-6 right-6 bg-white border-2 border-[#2E2E2F]/10 rounded-2xl px-6 py-2.5 text-[11px] font-black text-[#2E2E2F]/40 uppercase tracking-widest shadow-sm group-hover:bg-[#38BDF2] group-hover:text-white group-hover:border-[#38BDF2] transition-all">BROWSE</div>
                                                    </div>
                                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                                </div>
                                            </div>
                                        )}

                                        {wizardStep === 2 && (
                                            <div className="space-y-12 animate-in fade-in duration-500">
                                                <div className="grid grid-cols-2 gap-8">
                                                    <Input label="Session Date" type="date" value={formData.eventDate} onChange={(e: any) => setFormData({ ...formData, eventDate: e.target.value })} className="px-6 py-5 bg-[#F2F2F2] border-2 border-[#2E2E2F]/5 rounded-2xl font-bold" />
                                                    <Input label="Start Time" type="time" value={formData.eventTime} onChange={(e: any) => setFormData({ ...formData, eventTime: e.target.value })} className="px-6 py-5 bg-[#F2F2F2] border-2 border-[#2E2E2F]/5 rounded-2xl font-bold" />
                                                </div>
                                                <div className="p-10 bg-[#F2F2F2] rounded-[3rem] border-2 border-[#2E2E2F]/5 space-y-8 shadow-inner">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-[#38BDF2]/10 flex items-center justify-center text-[#38BDF2]">
                                                            <ICONS.MapPin className="w-6 h-6" />
                                                        </div>
                                                        <h3 className="text-lg font-black text-[#2E2E2F] tracking-tight truncate max-w-full">Exact Location</h3>
                                                    </div>
                                                    <Input 
                                                        placeholder="Search location or enter address..." 
                                                        value={formData.location} 
                                                        onChange={(e: any) => setFormData({ ...formData, location: e.target.value })} 
                                                        className="px-6 py-5 bg-white border-2 border-[#2E2E2F]/5 rounded-2xl font-bold shadow-sm"
                                                    />
                                                    <OnsiteLocationAssistant value={formData.location} onChange={applyLocationValue} />
                                                </div>
                                            </div>
                                        )}

                                        {wizardStep === 3 && (
                                            <div className="space-y-12 animate-in fade-in duration-500">
                                                <div className="grid grid-cols-2 gap-8">
                                                    <Input 
                                                        label={`Capacity Total (${formData.capacityTotal}/${maxEventCapacity})`} 
                                                        type="number" 
                                                        value={formData.capacityTotal} 
                                                        onChange={(e: any) => setFormData({ ...formData, capacityTotal: parseInt(e.target.value, 10) || 1 })} 
                                                        className="px-6 py-5 bg-[#F2F2F2] border-2 border-[#2E2E2F]/5 rounded-2xl font-bold"
                                                    />
                                                    <div className="flex flex-col gap-3">
                                                        <label className="text-[10px] font-black text-[#2E2E2F]/40 uppercase tracking-[0.3em] ml-1">Live Status</label>
                                                        <div className="p-4 bg-[#38BDF2]/5 border-2 border-[#38BDF2]/20 rounded-2xl text-[12px] font-black text-[#38BDF2] uppercase tracking-[0.2em] text-center shadow-sm">Locked Until Verification</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </form>
                                </div>
                            </div>

                            {/* Sticky Bottom Actions */}
                            <div className="absolute bottom-0 left-0 right-0 p-10 bg-white/90 backdrop-blur-xl border-t-2 border-[#2E2E2F]/5 flex items-center justify-between z-30 shadow-[0_-20px_50px_rgba(0,0,0,0.03)]">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#2E2E2F]/40 hover:text-[#2E2E2F] transition-all cursor-pointer flex items-center gap-2">
                                        Draft saved <ICONS.ChevronRight className="w-3.5 h-3.5 rotate-90" />
                                    </p>
                                </div>
                                <div className="flex items-center gap-6">
                                    <button 
                                        onClick={handleSubmit} 
                                        className="px-14 py-6 bg-[#38BDF2] text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] shadow-[0_20px_40px_-10px_rgba(56,189,242,0.5)] hover:bg-[#2E2E2F] hover:shadow-black/20 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center gap-4 group"
                                    >
                                        Next step 
                                        <ICONS.ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={4} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 3. Right Sidebar: Premium Mobile Preview */}
                        <div className="p-12 flex flex-col items-center bg-[#F2F2F2] overflow-y-auto custom-scrollbar">
                            <div className="w-full flex items-center gap-3 mb-12 opacity-40 group hover:opacity-100 transition-opacity">
                                <ICONS.ChevronRight className="w-4 h-4 text-[#2E2E2F]" />
                                <h4 className="text-xs font-black text-[#2E2E2F] uppercase tracking-[0.25em]">Preview <span className="opacity-50 font-medium">(mobille)</span></h4>
                            </div>

                            {/* Realistic White iPhone Frame */}
                            <div className="relative mx-auto w-[340px] h-[700px] bg-white rounded-[4rem] border-[14px] border-white shadow-[0_50px_100px_-30px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden animate-in zoom-in duration-1000">
                                {/* Notch/Camera Area */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-8 bg-white rounded-b-[2rem] z-40 border-b border-black/5" />
                                
                                <div className="h-full overflow-y-auto custom-scrollbar bg-[#F9FAFB] relative flex flex-col">
                                    {/* Mobile Content (Premium Look) */}
                                    <div className="sticky top-0 h-16 bg-white border-b border-black/5 flex items-center justify-between px-6 z-20">
                                        <h2 className="text-lg font-black tracking-tight text-[#2E2E2F]">Event</h2>
                                        <ICONS.MoreHorizontal className="w-5 h-5 text-[#2E2E2F]/40" />
                                    </div>
                                    
                                    <div className="p-6 space-y-6 flex-1">
                                        <div className="w-full aspect-[4/3] rounded-[2rem] bg-[#F2F2F2] overflow-hidden border border-black/5 shadow-inner">
                                            {formData.imageUrl ? (
                                                <img src={getImageUrl(formData.imageUrl)} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#BAF3FF] to-[#38BDF2] transition-all" />
                                            )}
                                        </div>
                                        
                                        <div className="space-y-5">
                                            <h3 className="text-2xl font-black tracking-tighter leading-tight text-[#2E2E2F]">
                                                {formData.eventName || 'Untitled Event'}
                                            </h3>
                                            
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-black/5 shadow-sm">
                                                    <ICONS.Calendar className="w-4 h-4 text-[#38BDF2]" />
                                                    <span className="text-[11px] font-bold text-[#2E2E2F]/50 uppercase tracking-widest">{previewDateLabel === 'Set Date & Time' ? 'Date not set' : previewDateLabel}</span>
                                                </div>
                                                <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-black/5 shadow-sm">
                                                    <ICONS.MapPin className="w-4 h-4 text-[#38BDF2]" />
                                                    <span className="text-[11px] font-bold text-[#2E2E2F]/50 uppercase tracking-widest leading-none truncate">{formData.location || 'No venue set'}</span>
                                                </div>
                                            </div>

                                            <div className="p-6 bg-white rounded-[2.5rem] border border-black/5 shadow-sm">
                                                <h4 className="text-[9px] font-black tracking-[0.3em] uppercase text-[#2E2E2F]/30 mb-4">Event Details</h4>
                                                <p className="text-xs font-medium text-[#2E2E2F]/60 leading-relaxed line-clamp-4">
                                                    {formData.description || 'Information about this event session will appear here...'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mobile Bottom Bar */}
                                    <div className="sticky bottom-0 left-0 right-0 p-5 bg-white/90 backdrop-blur-md border-t border-black/5 z-20">
                                        <button className="w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] text-white shadow-lg" style={{ backgroundColor: previewAccentColor }}>
                                            Get tickets
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
"""

final_text = text[:modal_start_pos] + new_builder_ui + text[modal_end_pos:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(final_text)

print("Full-Page Builder Evolution Complete")
