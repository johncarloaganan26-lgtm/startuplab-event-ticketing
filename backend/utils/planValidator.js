import supabase from '../database/db.js';

/**
 * Plan Validator Utility
 * Checks organizer's current plan against requested actions (event creation, etc.)
 */
export const checkPlanLimits = async (organizerId, featureKey, requestedValue = 1, options = {}) => {
    try {
        const { excludeId } = options;
        let organizerRecord = null;

        if (organizerId) {
            const { data, error } = await supabase
                .from('organizers')
                .select(`
                    organizerId,
                    ownerUserId,
                    subscriptionStatus,
                    planExpiresAt,
                    currentPlanId,
                    plan:plans(*)
                `)
                .eq('organizerId', organizerId)
                .maybeSingle();

            if (error) {
                console.error(`[checkPlanLimits] Database error fetching organizer ${organizerId}:`, error);
                // PGRST200 means FK/join is missing — fetch organizer without join
                if (error.code === 'PGRST200') {
                    const { data: plainOrg } = await supabase
                        .from('organizers')
                        .select('*')
                        .eq('organizerId', organizerId)
                        .maybeSingle();
                    if (plainOrg) {
                        organizerRecord = plainOrg;
                    }
                }
            } else {
                organizerRecord = data;
            }
        }

        // Use requested organizer or a safe default mock
        const organizer = organizerRecord || {
            organizerId,
            plan: null,
            subscriptionStatus: 'free',
            planExpiresAt: null
        };

        // 1.5. Manual fetch fallback if join fails
        if (organizer.currentPlanId && !organizer.plan) {
            const { data: planData } = await supabase
                .from('plans')
                .select('*')
                .eq('planId', organizer.currentPlanId)
                .maybeSingle();
            organizer.plan = planData;
        }

        const { plan, subscriptionStatus, planExpiresAt } = organizer;

        // 1.8. Strict block for new users without a plan selection
        // 1.8. Relaxed block: Allow creation/drafting even if pending, but block other high-value actions
        if ((subscriptionStatus === 'pending' || !organizer.currentPlanId) && featureKey !== 'max_events' && featureKey !== 'max_total_events') {
            return {
                allowed: false,
                message: "You must choose a plan (free or paid) before you can perform this action. Redirecting to plans page...",
                code: 'SUBSCRIPTION_REQUIRED',
                requiresSubscription: true
            };
        }

        // 2. Determine if the subscription is currently valid
        const isNotExpired = !planExpiresAt || new Date(planExpiresAt) > new Date();
        const isSubscriptionLive = (subscriptionStatus === 'active' || subscriptionStatus === 'trial' || subscriptionStatus === 'free');
        const isActive = isSubscriptionLive && isNotExpired;


        // Base defaults
        const defaultLimits = {
            max_events: 5,
            max_active_events: 5,
            max_total_events: 10,
            max_staff_accounts: 2,
            monthly_attendees: 500,
            max_tickets_per_event: 5,
            max_attendees_per_event: 500
        };

        const defaultFeatures = {
            enable_custom_branding: false,
            discount_codes: false,
            advanced_reports: false,
            priority_support: false
        };

        // Merge plan limits/features into defaults if plan exists
        const limits = { ...defaultLimits, ...(plan?.limits || {}) };
        const features = { ...defaultFeatures, ...(plan?.features || {}) };

        console.log(`[checkPlanLimits] Organizer: ${organizerId}, Key: ${featureKey}, Plan: ${plan?.name || 'None'}, Limits:`, limits);
        // 3. Validate specific feature/limit
        switch (featureKey) {
            case 'max_events': {
                let query = supabase
                    .from('events')
                    .select('eventId', { count: 'exact', head: true })
                    .eq('organizerId', organizerId)
                    .eq('is_archived', false);
                
                if (excludeId) query = query.neq('eventId', excludeId);

                const { count, error } = await query;

                if (error) throw error;
                const limitValue = limits.max_active_events ?? limits.max_events ?? 1;
                if (count >= limitValue) {
                    return {
                        allowed: false,
                        message: `Event limit reached. Your current plan allows up to ${limitValue} active events.`,
                        limit: limitValue,
                        current: count
                    };
                }
                break;
            }

            case 'max_total_events': {
                let query = supabase
                    .from('events')
                    .select('eventId', { count: 'exact', head: true })
                    .eq('organizerId', organizerId);

                if (excludeId) query = query.neq('eventId', excludeId);

                const { count, error } = await query;

                if (error) throw error;
                const limitValue = limits.max_total_events ?? 3;
                if (count >= limitValue) {
                    return {
                        allowed: false,
                        message: `Total event limit reached. Your current plan allows up to ${limitValue} total events.`,
                        limit: limitValue,
                        current: count
                    };
                }
                break;
            }

            case 'max_priced_events': {
                // Count events that have at least one paid ticket type (priceAmount > 0)
                const { data: events } = await supabase
                    .from('events')
                    .select('eventId')
                    .eq('organizerId', organizerId);

                if (!events || events.length === 0) break;

                const eventIds = events.map(e => e.eventId);
                if (excludeId && eventIds.includes(excludeId)) {
                    eventIds.splice(eventIds.indexOf(excludeId), 1);
                }

                // Find events that have at least one ticket type with price > 0
                const { data: pricedEvents } = await supabase
                    .from('ticketTypes')
                    .select('eventId')
                    .in('eventId', eventIds)
                    .gt('priceAmount', 0);

                const uniquePricedEventIds = [...new Set((pricedEvents || []).map(t => t.eventId))];
                const pricedEventCount = uniquePricedEventIds.length;

                const limitValue = Number(limits.max_priced_events || 0);

                if (limitValue === 0) {
                    return {
                        allowed: false,
                        message: `Paid events are not allowed on your current plan. Please upgrade to create paid events.`,
                        limit: 0,
                        current: pricedEventCount
                    };
                }

                if (pricedEventCount >= limitValue) {
                    return {
                        allowed: false,
                        message: `Paid events limit reached. Your current plan allows up to ${limitValue} paid events.`,
                        limit: limitValue,
                        current: pricedEventCount
                    };
                }
                break;
            }

            case 'max_staff_accounts': {
                const ownerUserId = organizer.ownerUserId;

                // 1. Get all current staff IDs
                const { data: staffUsers } = await supabase
                    .from('users')
                    .select('userId')
                    .eq('employerId', ownerUserId);

                const staffIds = (staffUsers || []).map(u => u.userId);
                staffIds.push(ownerUserId); // Include owner to find their invites too

                // 2. Count current staff (excluding owner if they aren't counted as staff)
                const currentCount = (staffUsers || []).length;

                // 3. Count pending invites from anyone in the organization
                const { count: inviteCount } = await supabase
                    .from('invites')
                    .select('*', { count: 'exact', head: true })
                    .in('invitedBy', staffIds);

                const totalStaffPotential = currentCount + (inviteCount || 0);
                const limitValue = (limits.max_staff_accounts ?? 2);

                if (totalStaffPotential >= limitValue) {
                    return {
                        allowed: false,
                        message: `Staff account limit reached. Your current plan allows up to ${limitValue} staff accounts (including pending invites).`,
                        limit: limitValue,
                        current: totalStaffPotential
                    };
                }
                break;
            }

            case 'monthly_attendees': {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                // We need to count attendees for all events of this organizer
                const { data: eventIds } = await supabase
                    .from('events')
                    .select('eventId')
                    .eq('organizerId', organizerId);

                const ids = (eventIds || []).map(e => e.eventId);
                if (ids.length === 0) break;

                const { count, error } = await supabase
                    .from('attendees')
                    .select('*', { count: 'exact', head: true })
                    .in('eventId', ids)
                    .gte('created_at', thirtyDaysAgo.toISOString());

                if (error) throw error;
                const limitValue = limits.monthly_attendees ?? limits.max_attendees_per_month ?? 100;
                if ((count + requestedValue) > limitValue) {
                    return {
                        allowed: false,
                        message: `Monthly attendee limit reached. Your current plan allows up to ${limitValue} attendees per month.`,
                        limit: limitValue,
                        current: count
                    };
                }
                break;
            }

            case 'max_tickets_per_event': {
                const limitValue = limits.max_tickets_per_event ?? 3;
                if (requestedValue > limitValue) {
                    return {
                        allowed: false,
                        message: `Ticket type limit reached. Your current plan allows up to ${limitValue} ticket types per event.`,
                        limit: limitValue
                    };
                }
                break;
            }

            case 'max_attendees_per_event': {
                const limitValue = limits.max_attendees_per_event ?? 50;
                if (requestedValue > limitValue) {
                    return {
                        allowed: false,
                        message: `Event capacity limit reached. Your current plan allows up to ${limitValue} attendees per event.`,
                        limit: limitValue
                    };
                }
                break;
            }

            case 'custom_branding':
            case 'enable_custom_branding': {
                if (features.enable_custom_branding === false && features.custom_branding === false) {
                    return {
                        allowed: false,
                        message: "Custom branding is not included in your current plan. Upgrade to unlock this feature."
                    };
                }
                break;
            }

            case 'advanced_reports':
            case 'enable_advanced_reports': {
                if (features.enable_advanced_reports === false && features.advanced_reports === false) {
                    return {
                        allowed: false,
                        message: "Advanced reports are not included in your current plan. Upgrade to unlock this feature."
                    };
                }
                break;
            }

            case 'discount_codes':
            case 'enable_discount_codes': {
                if (features.enable_discount_codes === false && features.discount_codes === false) {
                    return {
                        allowed: false,
                        message: "Discount codes are not included in your current plan. Upgrade to unlock this feature."
                    };
                }
                break;
            }

            case 'priority_support':
            case 'enable_priority_support': {
                if (features.enable_priority_support === false && features.priority_support === false) {
                    return {
                        allowed: false,
                        message: "Priority support is not included in your current plan. Upgrade to unlock this feature."
                    };
                }
                break;
            }

            default:
                // If feature isn't explicitly blocked, allow it for now
                break;
        }

        return { allowed: true };
    } catch (error) {
        console.error('Plan validation error:', error);
        return { allowed: false, message: 'Internal error checking plan limits.' };
    }
};
