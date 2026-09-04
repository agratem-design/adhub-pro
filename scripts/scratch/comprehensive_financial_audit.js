import pg from 'pg';

const client = new pg.Client({
  host: 'aws-1-eu-north-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.atqjaiebixuzomrfwilu',
  password: 'Zer4oBi57gZ',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function auditContracts() {
  console.log('\n=============================================================');
  console.log('1. تدقيق حسابات العقود (CONTRACTS AUDIT)');
  console.log('=============================================================');

  const { rows: contracts } = await client.query(`
    SELECT *
    FROM "Contract"
    ORDER BY CAST(NULLIF(regexp_replace("Contract_Number"::text, '[^0-9]', '', 'g'), '') AS INTEGER) ASC
  `);

  const { rows: payments } = await client.query(`
    SELECT contract_number, sum(amount) as total_paid_ledger, count(*) as pmt_count
    FROM customer_payments
    WHERE entry_type IN ('payment', 'receipt', 'account_payment')
      AND contract_number IS NOT NULL AND contract_number::text <> ''
    GROUP BY contract_number
  `);

  const pmtMap = new Map();
  for (const p of payments) {
    pmtMap.set(String(p.contract_number), {
      paid: Number(p.total_paid_ledger) || 0,
      count: Number(p.pmt_count)
    });
  }

  let totalValueAll = 0;
  let totalStoredPaidAll = 0;
  let totalLedgerPaidAll = 0;
  
  let count1086Plus = 0;
  let value1086Plus = 0;
  let ledgerPaid1086Plus = 0;

  const mismatches = [];
  const overpaid = [];
  const zeroContractsWithPayments = [];
  const costDiscrepancies = [];

  for (const c of contracts) {
    const cNum = String(c.Contract_Number);
    const num = parseInt(cNum, 10);
    const total = Number(c.Total) || 0;
    const storedPaid = Number(c['Total Paid']) || 0;
    const ledger = pmtMap.get(cNum) || { paid: 0, count: 0 };
    const ledgerPaid = ledger.paid;

    const rent = Number(c['Total Rent'] ?? c.rent_cost ?? 0);
    const inst = Number(c.installation_cost ?? 0);
    const print = Number(c.print_cost ?? 0);
    const sumComponents = rent + inst + print;

    totalValueAll += total;
    totalStoredPaidAll += storedPaid;
    totalLedgerPaidAll += ledgerPaid;

    if (num >= 1086) {
      count1086Plus++;
      value1086Plus += total;
      ledgerPaid1086Plus += ledgerPaid;
    }

    // Check Total Paid vs Ledger Paid
    if (Math.abs(storedPaid - ledgerPaid) > 0.01) {
      mismatches.push({
        contract: cNum,
        customer: c['Customer Name'],
        storedPaid,
        ledgerPaid,
        diff: ledgerPaid - storedPaid,
        is1086: num >= 1086
      });
    }

    // Check Overpaid
    if (ledgerPaid > total && total > 0) {
      overpaid.push({
        contract: cNum,
        customer: c['Customer Name'],
        total,
        ledgerPaid,
        excess: ledgerPaid - total,
        is1086: num >= 1086
      });
    }

    // Total is 0 but payments exist
    if (total === 0 && ledgerPaid > 0) {
      zeroContractsWithPayments.push({
        contract: cNum,
        customer: c['Customer Name'],
        total,
        ledgerPaid,
        is1086: num >= 1086
      });
    }

    // Component sum vs Total (if components are populated)
    if (sumComponents > 0 && Math.abs(sumComponents - total) > 1) {
      costDiscrepancies.push({
        contract: cNum,
        customer: c['Customer Name'],
        total,
        sumComponents,
        diff: total - sumComponents
      });
    }
  }

  console.log(`إجمالي عدد العقود في المنظومة: ${contracts.length}`);
  console.log(`• إجمالي قيمة العقود المسجلة: ${totalValueAll.toLocaleString()} د.ل`);
  console.log(`• إجمالي المدفوع المحفوظ في جدول العقود: ${totalStoredPaidAll.toLocaleString()} د.ل`);
  console.log(`• إجمالي المدفوع الفعلي في سجل الدفعات: ${totalLedgerPaidAll.toLocaleString()} د.ل`);
  console.log(`• فرق إجمالي المدفوع (سجل الدفعات − المحفوظ قديمًا): ${(totalLedgerPaidAll - totalStoredPaidAll).toLocaleString()} د.ل`);

  console.log(`\nالعقود بدءًا من 1086 (${count1086Plus} عقدًا):`);
  console.log(`• إجمالي قيمتها: ${value1086Plus.toLocaleString()} د.ل`);
  console.log(`• إجمالي المحصل الفعلي منها (سجل الدفعات): ${ledgerPaid1086Plus.toLocaleString()} د.ل`);

  console.log(`\nالعقود التي يختلف فيها المدفوع المحفوظ عن سجل الدفعات: ${mismatches.length} عقدًا`);
  console.log(`منها في عقود 1086 فما فوق: ${mismatches.filter(m => m.is1086).length} عقدًا`);
  for (const m of mismatches.filter(m => m.is1086)) {
    console.log(`   - عقد ${m.contract} (${m.customer}): محفوظ ${m.storedPaid.toLocaleString()} د.ل | فعلي ${m.ledgerPaid.toLocaleString()} د.ل | فرق: ${m.diff > 0 ? '+' : ''}${m.diff.toLocaleString()}`);
  }

  console.log(`\nعقود قيمتها 0 د.ل بينما عليها دفعات محصلة: ${zeroContractsWithPayments.length}`);
  for (const z of zeroContractsWithPayments) {
    console.log(`   - عقد ${z.contract} (${z.customer}): القيمة ${z.total} د.ل | المسجل عليه: ${z.ledgerPaid.toLocaleString()} د.ل`);
  }

  console.log(`\nعقود مدفوعاتها الفعلية تتجاوز قيمتها الإجمالية: ${overpaid.length}`);
  for (const o of overpaid) {
    console.log(`   - عقد ${o.contract} (${o.customer}): القيمة ${o.total.toLocaleString()} د.ل | المدفوع: ${o.ledgerPaid.toLocaleString()} د.ل | زيادة: +${o.excess.toLocaleString()} د.ل`);
  }
}

async function auditExpenses() {
  console.log('\n=============================================================');
  console.log('2. تدقيق المصروفات والسداد (EXPENSES AUDIT)');
  console.log('=============================================================');

  const { rows: expenses } = await client.query(`
    SELECT *
    FROM expenses
    ORDER BY created_at DESC
  `);

  const { rows: pmtLogs } = await client.query(`
    SELECT expense_id, sum(amount) as total_recorded_paid, count(*) as payment_entries
    FROM expense_payments
    GROUP BY expense_id
  `);

  const logMap = new Map();
  for (const p of pmtLogs) {
    logMap.set(String(p.expense_id), {
      paid: Number(p.total_recorded_paid) || 0,
      count: Number(p.payment_entries)
    });
  }

  let totalExpensesAmt = 0;
  let totalStoredPaid = 0;
  let totalPaymentsRecorded = 0;
  const overpaidExpenses = [];
  const statusMismatches = [];

  for (const e of expenses) {
    const amt = Number(e.amount) || 0;
    const paidCol = Number(e.paid_amount) || 0;
    const log = logMap.get(String(e.id)) || { paid: 0, count: 0 };
    const logPaid = log.paid;
    const expTitle = e.description || e.title || e.category || 'مصروف بدون اسم';

    totalExpensesAmt += amt;
    totalStoredPaid += paidCol;
    totalPaymentsRecorded += logPaid;

    if (logPaid > amt) {
      overpaidExpenses.push({
        id: e.id,
        title: expTitle,
        amount: amt,
        paid: logPaid,
        excess: logPaid - amt
      });
    }

    // Check status consistency
    const expectedStatus = logPaid >= amt && amt > 0 ? 'paid' : (logPaid > 0 ? 'partially_paid' : 'unpaid');
    if (e.payment_status && e.payment_status !== expectedStatus && amt > 0) {
      statusMismatches.push({
        id: e.id,
        title: expTitle,
        status: e.payment_status,
        expectedStatus,
        amount: amt,
        paid: logPaid
      });
    }
  }

  console.log(`إجمالي عدد المصروفات: ${expenses.length}`);
  console.log(`• إجمالي مبالغ المصروفات: ${totalExpensesAmt.toLocaleString()} د.ل`);
  console.log(`• إجمالي المسدد في سجل دفعات المصروفات (expense_payments): ${totalPaymentsRecorded.toLocaleString()} د.ل`);
  console.log(`• إجمالي المسجل في عمود paid_amount: ${totalStoredPaid.toLocaleString()} د.ل`);

  console.log(`\nالمصروفات التي يتجاوز سدادها قيمتها المسجلة: ${overpaidExpenses.length}`);
  for (const o of overpaidExpenses) {
    console.log(`   - "${o.title}": قيمته ${o.amount.toLocaleString()} د.ل | المسدد: ${o.paid.toLocaleString()} د.ل | زيادة سداد: +${o.excess.toLocaleString()} د.ل`);
  }
  for (const o of overpaidExpenses) {
    console.log(`   - "${o.title}": قيمته ${o.amount.toLocaleString()} د.ل | المسدد: ${o.paid.toLocaleString()} د.ل | زيادة سداد: +${o.excess.toLocaleString()} د.ل`);
  }
}

async function auditPaymentDistributions() {
  console.log('\n=============================================================');
  console.log('3. تدقيق توزيع الدفعات (PAYMENT DISTRIBUTIONS AUDIT)');
  console.log('=============================================================');

  const { rows: distAnalysis } = await client.query(`
    WITH dist_in AS (
      SELECT distributed_payment_id, 
             customer_name, 
             min(paid_at) as paid_at,
             sum(amount) as customer_payment_total,
             string_agg(DISTINCT contract_number::text, ', ') as contracts,
             count(*) as receipts_count
      FROM customer_payments
      WHERE distributed_payment_id IS NOT NULL
      GROUP BY distributed_payment_id, customer_name
    ),
    exp_out AS (
      SELECT distributed_payment_id, sum(amount) as exp_amt
      FROM expense_payments
      WHERE distributed_payment_id IS NOT NULL
      GROUP BY distributed_payment_id
    ),
    adv_out AS (
      SELECT distributed_payment_id, sum(amount) as adv_amt
      FROM employee_advances
      WHERE distributed_payment_id IS NOT NULL
      GROUP BY distributed_payment_id
    ),
    cus_out AS (
      SELECT source_payment_id as distributed_payment_id, sum(initial_amount) as cus_amt
      FROM custody_accounts
      WHERE source_payment_id IS NOT NULL
      GROUP BY source_payment_id
    ),
    team_out AS (
      SELECT distributed_payment_id, sum(amount) as team_amt
      FROM installation_team_accounts
      WHERE distributed_payment_id IS NOT NULL
      GROUP BY distributed_payment_id
    ),
    w_out AS (
      SELECT distributed_payment_id, sum(amount) as w_amt
      FROM expenses_withdrawals
      WHERE distributed_payment_id IS NOT NULL
      GROUP BY distributed_payment_id
    )
    SELECT 
      d.distributed_payment_id,
      d.customer_name,
      d.paid_at,
      d.customer_payment_total,
      d.contracts,
      d.receipts_count,
      COALESCE(e.exp_amt, 0) as exp_amt,
      COALESCE(a.adv_amt, 0) as adv_amt,
      COALESCE(c.cus_amt, 0) as cus_amt,
      COALESCE(t.team_amt, 0) as team_amt,
      COALESCE(w.w_amt, 0) as w_amt,
      (COALESCE(e.exp_amt, 0) + COALESCE(a.adv_amt, 0) + COALESCE(c.cus_amt, 0) + COALESCE(t.team_amt, 0) + COALESCE(w.w_amt, 0)) as total_outflow,
      (d.customer_payment_total - (COALESCE(e.exp_amt, 0) + COALESCE(a.adv_amt, 0) + COALESCE(c.cus_amt, 0) + COALESCE(t.team_amt, 0) + COALESCE(w.w_amt, 0))) as diff
    FROM dist_in d
    LEFT JOIN exp_out e ON e.distributed_payment_id = d.distributed_payment_id
    LEFT JOIN adv_out a ON a.distributed_payment_id = d.distributed_payment_id
    LEFT JOIN cus_out c ON c.distributed_payment_id = d.distributed_payment_id
    LEFT JOIN team_out t ON t.distributed_payment_id = d.distributed_payment_id
    LEFT JOIN w_out w ON w.distributed_payment_id = d.distributed_payment_id
    ORDER BY d.paid_at DESC;
  `);

  console.log(`إجمالي مجموعات الدفعات الموزعة: ${distAnalysis.length}`);

  let totalDistributedInAll = 0;
  let totalOutflowAll = 0;
  const fullyDisbursed = [];
  const partiallyDisbursed = [];
  const notDisbursedToExpensesOrWithdrawals = [];

  for (const row of distAnalysis) {
    const inTotal = Number(row.customer_payment_total) || 0;
    const outTotal = Number(row.total_outflow) || 0;
    totalDistributedInAll += inTotal;
    totalOutflowAll += outTotal;

    if (outTotal === 0) {
      notDisbursedToExpensesOrWithdrawals.push(row);
    } else if (Math.abs(inTotal - outTotal) < 0.01) {
      fullyDisbursed.push(row);
    } else {
      partiallyDisbursed.push(row);
    }
  }

  console.log(`• إجمالي المبالغ المحصلة من الزبائن في الدفعات الموزعة: ${totalDistributedInAll.toLocaleString()} د.ل`);
  console.log(`• إجمالي المصروف/المسحوب منها خارجياً (مصروفات + سحوبات + عهد + سلف + فرق تركيب): ${totalOutflowAll.toLocaleString()} د.ل`);
  console.log(`• دفعات موجهة فقط للعقود (بقيت في حساب الشركة / بدون صرف خارجي): ${notDisbursedToExpensesOrWithdrawals.length} دفعة`);
  console.log(`• دفعات صُرفت بالكامل لأوجه صرف خارجية: ${fullyDisbursed.length} دفعة`);
  console.log(`• دفعات صُرف جزء منها وبقي جزء للعقد/الشركة: ${partiallyDisbursed.length} دفعة`);

  console.log('\n--- تفاصيل الدفعات التي تم صرف جزء منها أو كاملها في مصارف خارجية ---');
  for (const r of [...fullyDisbursed, ...partiallyDisbursed]) {
    console.log(`- دفعة ${r.customer_name} | تاريخ: ${r.paid_at?.toISOString().slice(0, 10)} | عقود: ${r.contracts || '—'}`);
    console.log(`  المبلغ: ${Number(r.customer_payment_total).toLocaleString()} د.ل | أوجه الصرف: ${Number(r.total_outflow).toLocaleString()} د.ل (مصروفات: ${Number(r.exp_amt).toLocaleString()} | سحب: ${Number(r.w_amt).toLocaleString()} | عهد: ${Number(r.cus_amt).toLocaleString()} | سلف: ${Number(r.adv_amt).toLocaleString()} | فرق: ${Number(r.team_amt).toLocaleString()})`);
    if (Math.abs(Number(r.diff)) > 0.01) {
      console.log(`  باقي في حساب الشركة / العقد: ${Number(r.diff).toLocaleString()} د.ل`);
    }
  }
}

async function main() {
  await client.connect();
  console.log('Postgres Connected Successfully.');
  await auditContracts();
  await auditExpenses();
  await auditPaymentDistributions();
  await client.end();
}

main().catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});
