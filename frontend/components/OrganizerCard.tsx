import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../constants';
import { OrganizerProfile } from '../types';
import { useEngagement } from '../context/EngagementContext';
import { useUser } from '../context/UserContext';

// Helper to handle JSONB image format
const getImageUrl = (img: any): string => {
    if (!img) return '';
    if (typeof img === 'string') return img;
    return img.url || img.path || img.publicUrl || '';
};

interface OrganizerCardProps {
    organizer: OrganizerProfile;
    isFollowing: boolean;
    onFollow: (e: React.MouseEvent) => void;
    onClick: () => void;
    className?: string; // Allow custom classes for carousel sizing
}

export const OrganizerCard: React.FC<OrganizerCardProps> = ({ organizer, isFollowing, onFollow, onClick, className = "" }) => {
    const { userId: currentUserId, imageUrl: currentUserImg, name: currentUserName } = useUser();
    const coverImage = getImageUrl(organizer.coverImageUrl);
    const profileImage = getImageUrl(organizer.profileImageUrl);
    const initials = (organizer.organizerName || 'O').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div
            onClick={onClick}
            className={`group relative bg-[#F2F2F2] rounded-xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-[#2E2E2F]/10 cursor-pointer transition-all duration-300 hover:shadow-[0_4px_30px_rgba(0,0,0,0.12)] hover:-translate-y-1 ${className}`}
        >
            {/* Cover Image */}
            <div className="h-36 w-full bg-[#E5E5E5] relative">
                {coverImage ? (
                    <img src={coverImage} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full bg-[#E5E5E5] flex items-center justify-center">
                        <ICONS.Image className="w-10 h-10 text-[#2E2E2F]/5" />
                    </div>
                )}
            </div>

            {/* Profile Pic Overlap */}
            <div className="px-5 pb-6">
                <div className="relative -mt-9 mb-4 ml-1">
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-[5px] border-[#F2F2F2] overflow-hidden bg-gradient-to-br from-[#38BDF2] to-[#A5E1FF] shadow-lg transition-transform duration-300 group-hover:scale-105">
                        {profileImage ? (
                            <img src={profileImage} alt={organizer.organizerName} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-3xl font-black text-white flex h-full w-full items-center justify-center drop-shadow-md">{initials}</span>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-[#050505] truncate tracking-tight">{organizer.organizerName}</h3>
                    <div className="flex items-center gap-1.5">
                        <p className="text-[13px] text-[#65676B] font-semibold">{organizer.isVerified ? 'Verified Community' : 'Community Organizer'}</p>
                        {organizer.isVerified && <ICONS.CheckCircle className="w-3.5 h-3.5 text-[#38BDF2] stroke-[3px]" />}
                    </div>
                    <p className="text-[12px] text-[#65676B]/80 font-medium line-clamp-2 min-h-[32px] leading-tight mt-1.5">
                        {organizer.bio || 'Discover exclusive events and join our growing community.'}
                    </p>

                    <div className="pt-3 flex items-center gap-2 overflow-hidden">
                        <div className="flex -space-x-2 shrink-0">
                            {(() => {
                                const followers = organizer.recentFollowers || [];
                                
                                // Build unique list of displayable avatars
                                const avatars: Array<{ imageUrl?: string | null; initials: string; id: string }> = [];
                                
                                // 1. Current user if following
                                if (isFollowing) {
                                    avatars.push({
                                        id: currentUserId || 'me',
                                        imageUrl: currentUserImg,
                                        initials: (currentUserName || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
                                    });
                                }
                                
                                // 2. Other recent followers from backend
                                followers.forEach(f => {
                                    if (avatars.length < 3 && f.userId !== currentUserId) {
                                        avatars.push({
                                            id: f.userId,
                                            imageUrl: f.imageUrl,
                                            initials: (f.name || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
                                        });
                                    }
                                });
                                

                                return avatars.map((av, idx) => (
                                    <div 
                                        key={av.id} 
                                        className="w-6 h-6 rounded-full border-2 border-[#F2F2F2] bg-[#38BDF2] overflow-hidden flex items-center justify-center shadow-sm z-10"
                                        style={{ zIndex: 10 - idx }}
                                    >
                                        {av.imageUrl ? (
                                            <img src={av.imageUrl} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <span className="text-[8px] font-black text-white leading-none">{av.initials}</span>
                                        )}
                                    </div>
                                ));
                            })()}
                        </div>
                        <p className="text-[12px] text-[#65676B] font-bold tracking-tight truncate">
                            {organizer.followersCount > 0
                                ? `${organizer.followersCount.toLocaleString()} followers`
                                : 'Be the first to follow'}
                        </p>
                    </div>
                </div>

                {/* Follow Button */}
                <div className="mt-6">
                    <button
                        onClick={onFollow}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm transform hover:brightness-110 bg-[#38BDF2] text-white`}
                    >
                        {isFollowing ? (
                            <><ICONS.CheckCircle className="w-4 h-4 stroke-[2.5px]" /> Following</>
                        ) : (
                            <><ICONS.Plus className="w-4 h-4 stroke-[3px]" /> Follow</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
