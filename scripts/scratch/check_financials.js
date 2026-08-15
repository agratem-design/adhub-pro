import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://atqjaiebixuzomrfwilu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTkxOTcsImV4cCI6MjA3Mjc3NTE5N30.OGAQFsAl1Eo1tmPZ93VZoSL5tO2FYZa_szeRvUmoj-4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const customerId = "1ed051fc-abe7-4b85-a087-368eb31c59fe"; // Ali Ammar

async function run() {
  const [
    contractsRes,
    paymentsRes,
    salesRes,
    printedRes,
    purchasesRes,
    discountsRes,
    compositeRes,
    printTasksRes,
    cutoutTasksRes
  ] = await Promise.all([
    supabase.from('Contract').select('Total, customer_id, Contract_Number, friend_rental_data, "Contract Date"').eq('customer_id', customerId),
    supabase.from('customer_payments').select('customer_id, amount, entry_type, sales_invoice_id, printed_invoice_id, purchase_invoice_id, notes, distributed_payment_id').eq('customer_id', customerId),
    supabase.from('sales_invoices').select('customer_id, total_amount, remaining_amount, paid_amount, paid').eq('customer_id', customerId),
    supabase.from('printed_invoices').select('id, customer_id, total_amount, print_cost, included_in_contract, invoice_type, paid').eq('customer_id', customerId),
    supabase.from('purchase_invoices').select('customer_id, total_amount, used_as_payment').eq('customer_id', customerId),
    supabase.from('customer_general_discounts').select('customer_id, discount_value').eq('status', 'active').eq('customer_id', customerId),
    supabase.from('composite_tasks').select('id, customer_id, customer_total, combined_invoice_id, print_task_id, discount_amount').eq('customer_id', customerId),
    supabase.from('print_tasks').select('id, customer_id, invoice_id, is_composite, installation_task_id, composite_task_id').eq('customer_id', customerId),
    supabase.from('cutout_tasks').select('id, customer_id, invoice_id, is_composite, installation_task_id').eq('customer_id', customerId)
  ]);

  if (contractsRes.error) console.error("contracts error:", contractsRes.error);
  if (paymentsRes.error) console.error("payments error:", paymentsRes.error);
  if (salesRes.error) console.error("sales error:", salesRes.error);
  if (printedRes.error) console.error("printed error:", printedRes.error);
  if (purchasesRes.error) console.error("purchases error:", purchasesRes.error);
  if (discountsRes.error) console.error("discounts error:", discountsRes.error);
  if (compositeRes.error) console.error("composite error:", compositeRes.error);
  if (printTasksRes.error) console.error("printTasks error:", printTasksRes.error);
  if (cutoutTasksRes.error) console.error("cutoutTasks error:", cutoutTasksRes.error);

  const contracts = contractsRes.data || [];
  console.log("Contracts count:", contracts.length);
}

run().catch(console.error);
