import supabase from '../database/db.js';

/**
 * Plan Validator Utility
 * Checks organizer's current plan against requested actions (event creation, etc.)
 */
export const checkPlanLimits = async (organizerId, featureKey, requestedValue = 1) => {
    try {
        // 1. Fetch organizer's current plan with limits/features
        const { data: organizer, error: orgError } = await supabase
            .from('organizers')
            .select(`
        organizerId,
        subscriptionStatus,
        planExpiresAt,
        plan:plans(*)
      `)
            .eq('organizerId', organizerId)
            .single();

        if (orgError || !organizer) {
            throw new Error('Organizer not found');
        }

        const { plan, subscriptionStatus, planExpiresAt } = organizer;

        // 2. Treat as "Basic/Trial" if no plan or expired
        const isExpired = planExpiresAt && new Date(planExpiresAt) < new Date();
        const isActive = subscriptionStatus === 'active' && !isExpired;

        // Use default limits if no active plan
        const limits = (isActive && plan?.limits) ? plan.limits : {
            max_events: 1,
            max_tickets_per_event: 3,
            max_attendees_per_event: 50,
            enable_custom_branding: false
        };

        const features = (isActive && plan?.features) ? plan.features : {
            custom_domain: false,
            priority_support: false
        };

        // 3. Validate specific feature/limit
        switch (featureKey) {
            case 'max_events': {
                const { count, error } = await supabase
                    .from('events')
                    .select('*', { count: 'exact', head: true })
                    .eq('organizerId', organizerId)
                    .eq('is_archived', false);

                if (error) throw error;
                if (count >= (limits.max_events || 1)) {
                    return {
                        allowed: false,
                        message: `Event limit reached. Your current plan allows up to ${limits.max_events} active events.`,
                        limit: limits.max_events,
                        current: count
                    };
                }
                break;
            }

            case 'max_tickets_per_event': {
                const limitValue = limits.max_tickets_per_event || 3;
                if (requestedValue > limitValue) {
                    return {
                        allowed: false,
                        message: `Limit reached. Your current plan allows up to ${limitValue} ticket types per event.`,
                        limit: limitValue
                    };
                }
                break;
            }

            case 'max_attendees_per_event': {
                const limitValue = limits.max_attendees_per_event || 50;
                if (requestedValue > limitValue) {
                    return {
                        allowed: false,
                        message: `Capacity limit reached. Your current plan allows up to ${limitValue} attendees per event.`,
                        limit: limitValue
                    };
                }
                break;
            }

            case 'custom_branding': {
                if (!features.enable_custom_branding) {
                    return {
                        allowed: false,
                        message: "Custom branding is not included in your current plan. Upgrade to unlock this feature."
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
        return { allowed: true }; // Fallback to allow if error occurs
    }
};
