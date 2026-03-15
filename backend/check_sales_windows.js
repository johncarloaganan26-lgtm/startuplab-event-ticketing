import supabase from './database/db.js';

async function checkTicketSales() {
  const { data: ticketTypes, error } = await supabase
    .from('ticketTypes')
    .select('ticketTypeId, name, salesStartAt, salesEndAt, quantityTotal, quantitySold');

  if (error) {
    console.error('Error fetching ticket types:', error);
    return;
  }

  console.log('Ticket Types Sales Windows:');
  ticketTypes.forEach(tt => {
    console.log(`- ${tt.name} (${tt.ticketTypeId}):`);
    console.log(`  Sales Start: ${tt.salesStartAt}`);
    console.log(`  Sales End: ${tt.salesEndAt}`);
    console.log(`  Sold: ${tt.quantitySold}/${tt.quantityTotal}`);
    
    const now = new Date();
    const start = tt.salesStartAt ? new Date(tt.salesStartAt) : null;
    if (start && now < start) {
      console.log(`  ⚠️  SALES NOT STARTED YET (Starts in ${((start.getTime() - now.getTime()) / 1000 / 60).toFixed(2)} minutes)`);
    } else {
      console.log(`  ✅  Sales have started (or no start date)`);
    }
  });
}

checkTicketSales();
