import supabase from './database/db.js';

async function syncPlans() {
    console.log('🔄 Syncing Plans JSONB columns with planFeatures table...');

    const { data: plans, error: plansError } = await supabase.from('plans').select('*');
    if (plansError) {
        console.error('Error fetching plans:', plansError);
        return;
    }

    for (const plan of plans) {
        console.log(`Processing plan: ${plan.name} (${plan.planId})`);

        const { data: featureRows, error: featuresError } = await supabase
            .from('planFeatures')
            .select('key, value')
            .eq('planId', plan.planId);

        if (featuresError) {
            console.error(`Error fetching features for plan ${plan.planId}:`, featuresError);
            continue;
        }

        const features = { ...plan.features };
        const limits = { ...plan.limits };

        featureRows.forEach(row => {
            const key = row.key;
            const val = row.value;

            // Feature/Limit handling
            if (key.startsWith('enable_') || key === 'custom_branding' || key === 'discount_codes' || key === 'advanced_reports' || key === 'priority_support') {
                const boolVal = val === 'true';
                features[key] = boolVal;

                // Key mapping
                if (key === 'enable_custom_branding') features['custom_branding'] = boolVal;
                if (key === 'custom_branding') features['enable_custom_branding'] = boolVal;
                if (key === 'enable_discount_codes') features['discount_codes'] = boolVal;
                if (key === 'discount_codes') features['enable_discount_codes'] = boolVal;
                if (key === 'enable_advanced_reports') features['advanced_reports'] = boolVal;
                if (key === 'advanced_reports') features['enable_advanced_reports'] = boolVal;
            } else {
                const numericVal = Number(val);
                limits[key] = Number.isFinite(numericVal) ? numericVal : val;

                if (key === 'max_events' && !limits['max_active_events']) limits['max_active_events'] = numericVal;
                if (key === 'max_active_events' && !limits['max_events']) limits['max_events'] = numericVal;
                if (key === 'max_attendees_per_month' && !limits['max_attendees_per_month']) limits['max_attendees_per_month'] = numericVal;
                if (key === 'monthly_attendees' && !limits['max_attendees_per_month']) limits['max_attendees_per_month'] = numericVal;
            }
        });

        // Sync native columns to JSONB limits if present
        if (plan.maxPricedEvents !== undefined && !limits.max_priced_events) {
            limits.max_priced_events = plan.maxPricedEvents;
        }

        const { error: updateError } = await supabase
            .from('plans')
            .update({ features, limits, updated_at: new Date().toISOString() })
            .eq('planId', plan.planId);

        if (updateError) {
            console.error(`Error updating plan ${plan.planId}:`, updateError);
        } else {
            console.log(`✅ Successfully synced ${plan.name}`);
        }
    }

    console.log('🏁 Plan sync complete.');
    process.exit(0);
}

syncPlans();
