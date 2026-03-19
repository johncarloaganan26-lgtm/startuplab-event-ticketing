import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrganizerProfile } from '../types';
import { useUser } from '../context/UserContext';
import { useEngagement } from '../context/EngagementContext';

const getImageUrl = (img: any): string => {
    if (!img) return '';
    if (typeof img === 'string') return img;
    return img.url || img.path || img.publicUrl || '';
};

const formatCompactCount = (value: number) => (
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
        Math.max(0, Number(value || 0))
    )
);

interface OrganizerCardProps {
    organizer: OrganizerProfile;
    variant?: 'default' | 'compact' | 'horizontal';
    showBio?: boolean;
    showSocial?: boolean;
    onFollowToggle?: (following: boolean) => void;
}

export const OrganizerCard: React.FC<OrganizerCardProps> = ({
    organizer,
    variant = 'default',
    showBio = false,
    showSocial = false,
    onFollowToggle
}) => {
    const navigate = useNavigate();
    const { isAuthenticated } = useUser();
    const { isFollowing, toggleFollowing, canLikeFollow } = useEngagement();
    const [bioExpanded, setBioExpanded] = useState(false);

    const following = isFollowing(organizer.organizerId);
    const organizerImage = getImageUrl(organizer.profileImageUrl);
    const organizerInitial = (organizer.organizerName || 'O').charAt(0).toUpperCase();

    const handleFollow = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isAuthenticated) {
            navigate('/signup');
            return;
        }
        if (!canLikeFollow) {
            return;
        }
        try {
            const { following: nextFollowing } = await toggleFollowing(organizer.organizerId);
            onFollowToggle?.(nextFollowing);
        } catch (err) {
            console.error('Failed to toggle follow:', err);
        }
    };

    const handleClick = () => {
        navigate(`/organizer/${organizer.organizerId}`);
    };

    // Horizontal variant - for dropdown selector
    if (variant === 'horizontal') {
        return (
            <button
                type="button"
                onClick={handleClick}
                className="group text-left rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] overflow-hidden hover:border-[#38BDF2]/45 transition-all min-w-[200px]"
            >
                <div className="aspect-[4/3] bg-[#2E2E2F]/5">
                    {organizerImage ? (
                        <img
                            src={organizerImage}
                            alt={organizer.organizerName}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#2E2E2F] text-[#F2F2F2] text-3xl font-black">
                            {organizerInitial}
                        </div>
                    )}
                </div>
                <div className="px-4 py-3">
                    <p className="text-sm font-bold text-[#2E2E2F] truncate">{organizer.organizerName}</p>
                    <p className="text-[10px] text-[#2E2E2F]/50 font-medium mt-1">
                        {formatCompactCount(organizer.followersCount || 0)} followers
                    </p>
                </div>
            </button>
        );
    }

    // Compact variant - for small cards in grid
    if (variant === 'compact') {
        return (
            <div
                onClick={handleClick}
                className="group cursor-pointer rounded-xl border border-[#2E2E2F]/10 bg-[#F2F2F2] overflow-hidden hover:border-[#38BDF2]/45 transition-all"
            >
                <div className="aspect-[4/3] bg-[#2E2E2F]/5">
                    {organizerImage ? (
                        <img
                            src={organizerImage}
                            alt={organizer.organizerName}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#2E2E2F] text-[#F2F2F2] text-3xl font-black">
                            {organizerInitial}
                        </div>
                    )}
                </div>
                <div className="px-4 py-3">
                    <p className="text-sm font-bold text-[#2E2E2F] truncate">{organizer.organizerName}</p>
                    <p className="text-[10px] text-[#2E2E2F]/50 font-medium mt-1">
                        {formatCompactCount(organizer.followersCount || 0)} followers
                    </p>
                </div>
            </div>
        );
    }

    // Default variant - full card with details
    return (
        <div className="bg-[#F2F2F2] rounded-xl border border-[#2E2E2F]/10 p-6 hover:border-[#38BDF2]/40 transition-all">
            <div className="flex items-start gap-4 mb-4">
                <div 
                    onClick={handleClick}
                    className="w-20 h-20 rounded-full overflow-hidden bg-[#2E2E2F] text-[#F2F2F2] flex items-center justify-center text-2xl font-bold shrink-0 border-4 border-white shadow-md cursor-pointer"
                >
                    {organizerImage ? (
                        <img src={organizerImage} alt={organizer.organizerName} className="w-full h-full object-cover" />
                    ) : (
                        organizerInitial
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 
                        onClick={handleClick}
                        className="text-lg font-bold text-[#2E2E2F] truncate cursor-pointer hover:text-[#38BDF2] transition-colors"
                    >
                        {organizer.organizerName}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-black text-[#2E2E2F]/50 uppercase">
                            {formatCompactCount(organizer.followersCount || 0)} followers
                        </span>
                        <span className="text-[10px] font-black text-[#2E2E2F]/30">•</span>
                        <span className="text-[10px] font-black text-[#2E2E2F]/50 uppercase">
                            {organizer.eventsHostedCount || 0} events
                        </span>
                    </div>
                </div>
            </div>

            {showBio && organizer.bio && (
                <>
                    <p className={`text-[#2E2E2F]/70 text-sm font-medium leading-relaxed mb-3 ${bioExpanded ? '' : 'line-clamp-2'}`}>
                        {organizer.bio}
                    </p>
                    {organizer.bio.length > 100 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setBioExpanded(!bioExpanded); }}
                            className="text-[#38BDF2] text-xs font-bold hover:underline mb-2"
                        >
                            {bioExpanded ? 'See less' : 'See more'}
                        </button>
                    )}
                </>
            )}

            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={handleFollow}
                    className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all hover:scale-[1.02] active:scale-[0.98] ${following
                        ? 'bg-[#00E6FF] text-white'
                        : 'bg-[#00D4FF] text-white hover:bg-[#00E6FF]'
                    }`}
                >
                    {following ? 'Following' : 'Follow'}
                </button>

                {showSocial && (
                    <div className="flex items-center gap-2">
                        {organizer.websiteUrl && (
                            <a
                                href={organizer.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-3 rounded-xl bg-[#2E2E2F] text-white hover:bg-[#38BDF2] transition-colors"
                                title="Visit Website"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                </svg>
                            </a>
                        )}
                        {organizer.facebookId && (
                            <a
                                href={`https://facebook.com/${organizer.facebookId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-3 rounded-xl bg-[#2E2E2F] text-white hover:bg-[#1877F2] transition-colors"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </a>
                        )}
                        {organizer.twitterHandle && (
                            <a
                                href={`https://twitter.com/${organizer.twitterHandle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-3 rounded-xl bg-[#2E2E2F] text-white hover:bg-[#000000] transition-colors"
                                title="X (Twitter)"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

