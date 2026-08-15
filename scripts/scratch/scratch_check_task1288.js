import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://atqjaiebixuzomrfwilu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTkxOTcsImV4cCI6MjA3Mjc3NTE5N30.OGAQFsAl1Eo1tmPZ93VZoSL5tO2FYZa_szeRvUmoj-4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('--- Finding all billboards with has_cutout = true ---');
  
  const { data: cutoutBillboards, error: bErr } = await supabase
    .from('billboards')
    .select('ID, Billboard_Name, Customer_Name, Contract_Number, has_cutout')
    .eq('has_cutout', true);

  console.log(`Found ${cutoutBillboards?.length || 0} billboards with has_cutout=true:`, cutoutBillboards);

  // Update ALL billboards to has_cutout = false
  const { data: bUpdated, error: bUpErr } = await supabase
    .from('billboards')
    .update({ has_cutout: false })
    .eq('has_cutout', true)
    .select('ID, Billboard_Name');

  console.log(`Updated ${bUpdated?.length || 0} billboards to has_cutout=false:`, { bUpErr });

  // Update ALL installation_task_items to has_cutout = false
  const { data: itemsUpdated, error: iUpErr } = await supabase
    .from('installation_task_items')
    .update({ has_cutout: false })
    .eq('has_cutout', true)
    .select('id');

  console.log(`Updated ${itemsUpdated?.length || 0} installation_task_items to has_cutout=false:`, { iUpErr });
}

main().catch(console.error);
