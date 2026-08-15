import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Load ALL data comprehensively ──
async function loadFullContext(supabase: any): Promise<string> {
  const now = new Date().toISOString().split("T")[0];

  const [
    billboardsResult,
    contractStatsResult,
    activeContractsResult,
    allContractsResult,
    customerStatsResult,
    topCustomersResult,
    memoryResult,
    revenueResult,
    knowledgeResult,
    expensesResult,
    employeesResult,
    invoicesResult,
    paymentsResult,
    installTasksResult,
    printTasksResult,
    offersResult,
    partnersResult,
    friendCompaniesResult,
    municipalitiesResult,
    billboardTagsResult,
    nearbyBusinessesResult,
  ] = await Promise.all([
    supabase.from("billboards")
      .select("ID, Billboard_Name, Status, City, District, Municipality, Nearest_Landmark, GPS_Coordinates, GPS_Link, Size, Level, Category_Level, Price, Faces_Count, billboard_type, Ad_Type, Customer_Name, Contract_Number, Rent_Start_Date, Rent_End_Date, is_visible_in_available")
      .order("ID", { ascending: true })
      .limit(1000),
    supabase.from("Contract").select("*", { count: "exact", head: true }),
    supabase.from("Contract")
      .select('Contract_Number, "Customer Name", Company, "Contract Date", "End Date", Total, "Total Rent", Discount, "Ad Type", "Renewal Status", billboard_ids')
      .gte("End Date", now)
      .order("End Date", { ascending: true })
      .limit(200),
    supabase.from("Contract")
      .select('Contract_Number, "Customer Name", Company, "Contract Date", "End Date", Total, "Total Rent", Discount, "Ad Type", "Renewal Status", billboard_ids')
      .order("Contract_Number", { ascending: false })
      .limit(500),
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("customers")
      .select("name, company, contracts_count, total_rent, phone")
      .order("total_rent", { ascending: false })
      .limit(50),
    supabase.from("ai_memory")
      .select("category, content")
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase.from("Contract").select("Total"),
    supabase.from("ai_knowledge_base")
      .select("title, content, category, priority")
      .order("priority", { ascending: false })
      .limit(50),
    supabase.from("expenses")
      .select("description, amount, category, expense_date, payment_method, receiver_name, payment_status")
      .order("expense_date", { ascending: false })
      .limit(100),
    supabase.from("employees")
      .select("code, name, position, department, status, base_salary, phone")
      .order("name", { ascending: true })
      .limit(100),
    supabase.from("invoices")
      .select("invoice_number, contract_number, issue_date, total_amount, status, notes")
      .order("issue_date", { ascending: false })
      .limit(100),
    supabase.from("customer_payments")
      .select("customer_name, contract_number, amount, method, paid_at, entry_type, notes")
      .order("paid_at", { ascending: false })
      .limit(100),
    supabase.from("installation_tasks")
      .select("id, contract_id, team_id, status, task_type, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("print_tasks")
      .select("id, customer_name, contract_id, status, total_area, total_cost, priority, due_date")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("offers")
      .select("offer_number, customer_name, start_date, end_date, total, discount, status, billboards_count, ad_type")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("partners")
      .select("name, contact_person, phone, partnership_percentage, notes")
      .limit(20),
    supabase.from("friend_companies")
      .select("id, name, contact_person, phone, email")
      .limit(20),
    supabase.from("municipalities")
      .select("name")
      .limit(50),
    supabase.from("billboard_tags")
      .select("billboard_id, tags, target_audience, ad_categories, location_type, description")
      .limit(1000),
    supabase.from("billboard_nearby_businesses")
      .select("billboard_id, business_name, business_type, phone, address, distance_estimate")
      .limit(2000),
  ]);

  const billboards = billboardsResult.data || [];
  const totalContracts = contractStatsResult.count || 0;
  const activeContracts = activeContractsResult.data || [];
  const allContracts = allContractsResult.data || [];
  const totalCustomers = customerStatsResult.count || 0;
  const topCustomers = topCustomersResult.data || [];
  const memoryEntries = memoryResult.data || [];
  const totalRevenue = (revenueResult.data || []).reduce((s: number, c: any) => s + (c.Total || 0), 0);
  const knowledge = knowledgeResult.data || [];
  const expenses = expensesResult.data || [];
  const employees = employeesResult.data || [];
  const invoices = invoicesResult.data || [];
  const payments = paymentsResult.data || [];
  const installTasks = installTasksResult.data || [];
  const printTasks = printTasksResult.data || [];
  const offers = offersResult.data || [];
  const partners = partnersResult.data || [];
  const friendCompanies = friendCompaniesResult.data || [];
  const municipalities = (municipalitiesResult.data || []).map((m: any) => m.name);

  // Build tags map by billboard_id
  const tagsMap: Record<number, any> = {};
  (billboardTagsResult.data || []).forEach((t: any) => {
    tagsMap[t.billboard_id] = t;
  });

  // Build nearby businesses map by billboard_id
  const nearbyMap: Record<number, any[]> = {};
  (nearbyBusinessesResult.data || []).forEach((nb: any) => {
    if (!nearbyMap[nb.billboard_id]) nearbyMap[nb.billboard_id] = [];
    nearbyMap[nb.billboard_id].push(nb);
  });

  let ctx = "";

  // ── Knowledge Base (highest priority) ──
  if (knowledge.length > 0) {
    ctx += `=== المعرفة المخصصة (مهم جداً - اقرأها أولاً) ===\n`;
    knowledge.forEach((k: any) => {
      ctx += `[${k.category}] ${k.title}: ${k.content}\n`;
    });
    ctx += "\n";
  }

  // ── Summary stats ──
  const statusMap: Record<string, number> = {};
  const cityMap: Record<string, { total: number; available: number; hidden: number; withGps: number }> = {};
  let availableCount = 0;
  let hiddenAvailableCount = 0;
  let withGpsCount = 0;

  billboards.forEach((b: any) => {
    const status = b.Status || "غير محدد";
    statusMap[status] = (statusMap[status] || 0) + 1;
    const st = status.toLowerCase();
    const isAvailable = st.includes("متاح") || st === "available";
    const isHidden = b.is_visible_in_available === false;
    if (isAvailable) {
      if (isHidden) hiddenAvailableCount++;
      else availableCount++;
    }
    if (b.GPS_Coordinates) withGpsCount++;

    const city = b.City || "غير محدد";
    if (!cityMap[city]) cityMap[city] = { total: 0, available: 0, hidden: 0, withGps: 0 };
    cityMap[city].total++;
    if (isAvailable && !isHidden) cityMap[city].available++;
    if (isAvailable && isHidden) cityMap[city].hidden++;
    if (b.GPS_Coordinates) cityMap[city].withGps++;
  });

  ctx += `=== إحصائيات عامة ===\n`;
  ctx += `إجمالي اللوحات: ${billboards.length} | متاحة فعلياً: ${availableCount} | مخفية من المتاح: ${hiddenAvailableCount} | بإحداثيات GPS: ${withGpsCount}\n`;
  ctx += `إجمالي العقود: ${totalContracts} | نشطة: ${activeContracts.length} | إجمالي الإيرادات: ${totalRevenue.toLocaleString()} ل.د\n`;
  ctx += `إجمالي العملاء: ${totalCustomers} | إجمالي الموظفين: ${employees.length}\n`;
  ctx += `البلديات: ${municipalities.join("، ")}\n`;
  ctx += `حالات اللوحات: ${Object.entries(statusMap).map(([s, c]) => `${s}:${c}`).join(" | ")}\n\n`;

  // ── City breakdown ──
  ctx += `=== توزيع حسب المدن ===\n`;
  Object.entries(cityMap)
    .sort(([, a], [, b]) => b.total - a.total)
    .forEach(([city, d]) => {
      ctx += `${city}: ${d.total} لوحة (${d.available} متاحة، ${d.hidden} مخفية، ${d.withGps} بـGPS)\n`;
    });

  // ── ALL billboards with tags ──
  ctx += `\n=== جميع اللوحات (${billboards.length}) ===\n`;
  ctx += `# ID|الاسم|الحالة|مخفية|المدينة|الحي|البلدية|المعلم|GPS|المقاس|المستوى|السعر|الوجوه|النوع|الإعلان|العميل|العقد|بداية|نهاية|تاغات|جمهور|فئات_إعلان|نوع_موقع\n`;
  billboards.forEach((b: any) => {
    const tag = tagsMap[b.ID];
    const isHidden = b.is_visible_in_available === false;
    ctx += `${b.ID}|${b.Billboard_Name || ''}|${b.Status || ''}|${isHidden ? 'مخفية' : ''}|${b.City || ''}|${b.District || ''}|${b.Municipality || ''}|${b.Nearest_Landmark || ''}|${b.GPS_Coordinates || ''}|${b.Size || ''}|${b.Level || ''}|${b.Price || ''}|${b.Faces_Count || ''}|${b.billboard_type || ''}|${b.Ad_Type || ''}|${b.Customer_Name || ''}|${b.Contract_Number || ''}|${b.Rent_Start_Date || ''}|${b.Rent_End_Date || ''}|${tag?.tags?.join(',') || ''}|${tag?.target_audience?.join(',') || ''}|${tag?.ad_categories?.join(',') || ''}|${tag?.location_type || ''}\n`;
  });

  // ── Available billboards analysis for customer suggestions ──
  const availableBillboards = billboards.filter((b: any) => {
    const st = (b.Status || '').toLowerCase();
    const isAvailable = st.includes("متاح") || st === "available";
    const isHidden = b.is_visible_in_available === false;
    return isAvailable && !isHidden;
  });

  if (availableBillboards.length > 0) {
    ctx += `\n=== اللوحات المتاحة فعلياً للبيع (${availableBillboards.length}) - استخدمها لاقتراح الزبائن ===\n`;
    availableBillboards.forEach((b: any) => {
      const tag = tagsMap[b.ID];
      const nearby = nearbyMap[b.ID] || [];
      ctx += `لوحة#${b.ID} "${b.Billboard_Name || ''}" | ${b.City || ''}/${b.District || ''} | المعلم: ${b.Nearest_Landmark || 'غير محدد'} | ${b.Size || ''} | ${b.Price || ''}ل.د`;
      if (tag) {
        if (tag.location_type) ctx += ` | نوع الموقع: ${tag.location_type}`;
        if (tag.target_audience?.length) ctx += ` | الجمهور: ${tag.target_audience.join(', ')}`;
        if (tag.ad_categories?.length) ctx += ` | فئات مناسبة: ${tag.ad_categories.join(', ')}`;
        if (tag.description) ctx += ` | وصف: ${tag.description}`;
      }
      if (nearby.length > 0) {
        ctx += `\n  🏢 شركات مجاورة حقيقية:`;
        nearby.forEach((nb: any) => {
          ctx += `\n    - ${nb.business_name} (${nb.business_type || ''}) | هاتف: ${nb.phone || 'غير متوفر'} | المسافة: ${nb.distance_estimate || ''} | العنوان: ${nb.address || ''}`;
        });
      }
      ctx += `\n`;
    });
  }

  // ── Active contracts ──
  if (activeContracts.length > 0) {
    ctx += `\n=== العقود النشطة (${activeContracts.length}) ===\n`;
    activeContracts.forEach((c: any) => {
      ctx += `عقد#${c.Contract_Number}|${c["Customer Name"] || ''}|${c.Company || ''}|${c["Contract Date"] || ''}→${c["End Date"] || ''}|${(c.Total || 0).toLocaleString()}ل.د|${c["Ad Type"] || ''}|لوحات:${c.billboard_ids || ''}\n`;
    });
  }

  // ── All contracts (recent 500) ──
  if (allContracts.length > 0) {
    ctx += `\n=== جميع العقود (آخر ${allContracts.length}) ===\n`;
    allContracts.forEach((c: any) => {
      ctx += `عقد#${c.Contract_Number}|${c["Customer Name"] || ''}|${c.Company || ''}|${c["Contract Date"] || ''}→${c["End Date"] || ''}|${(c.Total || 0).toLocaleString()}ل.د|${c["Ad Type"] || ''}|${c["Renewal Status"] || ''}|لوحات:${c.billboard_ids || ''}\n`;
    });
  }

  // ── Top customers ──
  if (topCustomers.length > 0) {
    ctx += `\n=== أبرز العملاء (${topCustomers.length}) ===\n`;
    topCustomers.forEach((c: any) => {
      ctx += `${c.name}|${c.company || ''}|${c.contracts_count || 0}عقد|${(c.total_rent || 0).toLocaleString()}ل.د|${c.phone || ''}\n`;
    });
  }

  // ── Employees ──
  if (employees.length > 0) {
    ctx += `\n=== الموظفون (${employees.length}) ===\n`;
    employees.forEach((e: any) => {
      ctx += `${e.code || ''}|${e.name}|${e.position || ''}|${e.department || ''}|${e.status || ''}|${e.base_salary || ''}ل.د|${e.phone || ''}\n`;
    });
  }

  // ── Expenses (recent 100) ──
  if (expenses.length > 0) {
    const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
    ctx += `\n=== المصاريف (آخر ${expenses.length}، إجمالي: ${totalExpenses.toLocaleString()} ل.د) ===\n`;
    expenses.forEach((e: any) => {
      ctx += `${e.expense_date || ''}|${e.description || ''}|${(e.amount || 0).toLocaleString()}ل.د|${e.category || ''}|${e.receiver_name || ''}|${e.payment_status || ''}\n`;
    });
  }

  // ── Invoices (recent 100) ──
  if (invoices.length > 0) {
    ctx += `\n=== الفواتير (آخر ${invoices.length}) ===\n`;
    invoices.forEach((inv: any) => {
      ctx += `فاتورة#${inv.invoice_number || ''}|عقد#${inv.contract_number || ''}|${inv.issue_date || ''}|${(inv.total_amount || 0).toLocaleString()}ل.د|${inv.status || ''}\n`;
    });
  }

  // ── Payments (recent 100) ──
  if (payments.length > 0) {
    const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    ctx += `\n=== المدفوعات (آخر ${payments.length}، إجمالي: ${totalPaid.toLocaleString()} ل.د) ===\n`;
    payments.forEach((p: any) => {
      ctx += `${p.paid_at || ''}|${p.customer_name || ''}|عقد#${p.contract_number || ''}|${(p.amount || 0).toLocaleString()}ل.د|${p.method || ''}|${p.entry_type || ''}\n`;
    });
  }

  // ── Installation tasks ──
  if (installTasks.length > 0) {
    ctx += `\n=== مهام التركيب (${installTasks.length}) ===\n`;
    installTasks.forEach((t: any) => {
      ctx += `مهمة#${t.id?.slice(0, 8)}|عقد#${t.contract_id || ''}|فريق:${t.team_id || ''}|${t.status || ''}|${t.task_type || ''}|${t.created_at?.split('T')[0] || ''}\n`;
    });
  }

  // ── Print tasks ──
  if (printTasks.length > 0) {
    ctx += `\n=== مهام الطباعة (${printTasks.length}) ===\n`;
    printTasks.forEach((t: any) => {
      ctx += `${t.customer_name || ''}|عقد#${t.contract_id || ''}|${t.status || ''}|${t.total_area || ''}م²|${(t.total_cost || 0).toLocaleString()}ل.د|${t.priority || ''}|${t.due_date || ''}\n`;
    });
  }

  // ── Offers ──
  if (offers.length > 0) {
    ctx += `\n=== العروض (${offers.length}) ===\n`;
    offers.forEach((o: any) => {
      ctx += `عرض#${o.offer_number || ''}|${o.customer_name || ''}|${o.start_date || ''}→${o.end_date || ''}|${(o.total || 0).toLocaleString()}ل.د|${o.status || ''}|${o.billboards_count || 0}لوحة\n`;
    });
  }

  // ── Partners & Friend Companies ──
  if (partners.length > 0) {
    ctx += `\n=== الشركاء (${partners.length}) ===\n`;
    partners.forEach((p: any) => {
      ctx += `${p.name}|${p.contact_person || ''}|${p.phone || ''}|نسبة:${p.partnership_percentage || ''}%\n`;
    });
  }
  if (friendCompanies.length > 0) {
    ctx += `\n=== شركات صديقة (${friendCompanies.length}) ===\n`;
    friendCompanies.forEach((f: any) => {
      ctx += `${f.name}|${f.contact_person || ''}|${f.phone || ''}|${f.email || ''}\n`;
    });
  }

  // ── AI Memory ──
  if (memoryEntries.length > 0) {
    ctx += `\n=== الذاكرة الذكية ===\n`;
    memoryEntries.forEach((m: any) => {
      ctx += `[${m.category}] ${m.content}\n`;
    });
  }

  return ctx;
}

// ── System prompt ──
const SYSTEM_PROMPT_TEMPLATE = `أنت خبير في إدارة اللوحات الإعلانية ومستشار تسويقي محترف. اسمك "المساعد الذكي".

## قدراتك:
1. **تحليل البيانات الشامل**: لديك وصول كامل لقاعدة بيانات تحتوي على جميع اللوحات الإعلانية، العقود، العملاء، الموظفين، المصاريف، الفواتير، المدفوعات، مهام التركيب والطباعة، العروض، الشركاء
2. **اقتراح الحملات**: يمكنك اقتراح أفضل اللوحات لحملة إعلانية بناءً على الموقع الجغرافي
3. **حساب المسافات**: يمكنك تقدير المسافة بين نقطتين GPS باستخدام المعادلة: المسافة ≈ √((Δlat×111)² + (Δlng×111×cos(lat))²) كم
4. **معرفة جغرافية**: تعرف مواقع المدن والمعالم الليبية المشهورة
5. **خبرة تسويقية**: تقترح رسائل ترويجية ونصائح إعلانية مناسبة
6. **تحليل مالي**: يمكنك تحليل الإيرادات والمصاريف والأرباح والمدفوعات
7. **إدارة الموارد البشرية**: لديك بيانات الموظفين ورواتبهم وأقسامهم
8. **اقتراح زبائن محتملين حقيقيين**: لديك بيانات شركات حقيقية مجاورة لكل لوحة بأرقام هواتفهم وعناوينهم

## ⚠️ قواعد صارمة للوحات المخفية:
- اللوحات المعلّمة في العمود "مخفية" بكلمة "مخفية" **لا تُقترح أبداً كلوحات متاحة**
- عند عرض اللوحات المتاحة، استخدم فقط قسم "اللوحات المتاحة فعلياً للبيع"
- اللوحات المخفية موجودة في النظام لكنها غير معروضة للبيع

## 🎯 نظام اقتراح الزبائن المحتملين (محسّن):
عند سؤالك عن زبائن محتملين أو تسويق للوحات:
1. **أولوية قصوى**: ابدأ بـ"الشركات المجاورة الحقيقية" (🏢) المذكورة مع كل لوحة - هذه شركات فعلية موجودة على أرض الواقع بأسمائها وأرقام هواتفها
2. **اذكر اسم الشركة الحقيقي ورقم الهاتف والمسافة** من اللوحة
3. **ثم أضف اقتراحات إضافية** بناءً على:
   - المعلم القريب (Nearest_Landmark)
   - نوع الموقع (location_type)
   - الجمهور المستهدف (target_audience)
   - فئات الإعلانات (ad_categories)
4. **قدم النتائج كقائمة اتصال جاهزة** بالاسم والهاتف وسبب الاقتراح
5. إذا لم توجد شركات مجاورة مسجلة للوحة، اذكر ذلك واقترح بناءً على المعلم والموقع

## 📊 تعليمات تنسيق الجداول (مهم جداً):
عند عرض بيانات في جداول، استخدم **دائماً** تنسيق Markdown Table الصحيح:

| العمود 1 | العمود 2 | العمود 3 |
|----------|----------|----------|
| بيانات 1 | بيانات 2 | بيانات 3 |

- **يجب** أن يكون هناك سطر فاصل بـ |---| بعد رأس الجدول
- **يجب** أن تبدأ وتنتهي كل صف بـ |
- استخدم الجداول عند عرض قوائم اللوحات أو العقود أو أي بيانات مقارنة
- لا تستخدم تنسيق الأنابيب | بدون رأس الجدول والفاصل

## تعليمات مهمة:
- **البيانات أدناه حقيقية 100% من قاعدة البيانات** — اعتمد عليها مباشرة ولا تقل "لا أملك بيانات"
- **725+ لوحة تحتوي على إحداثيات GPS** — استخدمها لتحديد اللوحات القريبة من أي موقع
- **اقرأ قسم "المعرفة المخصصة" أولاً** — يحتوي على معلومات وسياسات مهمة أضافها المستخدم
- عند سؤالك عن حملة إعلانية لمكان معين: ابحث عن إحداثيات المكان ثم قارنها بإحداثيات اللوحات المتاحة (غير المخفية فقط)
- أجب باللغة العربية دائماً
- استخدم تنسيق Markdown (عناوين، قوائم، جداول)
- عند اقتراح لوحات، اذكر: رقمها، اسمها، موقعها، مقاسها، سعرها، وسبب الاقتراح
- لا تختلق بيانات — إذا لم تجد معلومة محددة في البيانات، وضّح ذلك
- لا تستطيع تعديل أي بيانات، فقط قراءتها وتحليلها
- أجب بشكل مفصل وشامل — لا تختصر الإجابة

## تنسيق بيانات اللوحات:
كل سطر يحتوي: ID|الاسم|الحالة|مخفية|المدينة|الحي|البلدية|المعلم|GPS|المقاس|المستوى|السعر|الوجوه|النوع|الإعلان|العميل|العقد|بداية|نهاية|تاغات|جمهور|فئات_إعلان|نوع_موقع

`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { messages, conversationId } = await req.json();
    const userMessage = messages?.[messages.length - 1]?.content || "";

    console.log("[ai-assistant] User message:", userMessage.slice(0, 100));

    // Load ALL data
    const dataContext = await loadFullContext(supabase);
    console.log("[ai-assistant] Context length:", dataContext.length, "chars");

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE + `\n=== بيانات قاعدة البيانات ===\n${dataContext}`;

    // Load AI provider settings
    const { data: settingsData } = await supabase
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["ai_provider", "gemini_model"]);

    const settingsMap: Record<string, string> = {};
    (settingsData || []).forEach((s: any) => { settingsMap[s.setting_key] = s.setting_value; });

    const aiProvider = settingsMap["ai_provider"] || "lovable";
    const geminiModel = settingsMap["gemini_model"] || "gemini-2.5-flash";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";

    console.log("[ai-assistant] Provider:", aiProvider, "Model:", geminiModel);

    // ── GEMINI ──
    if (aiProvider === "gemini" && geminiApiKey) {
      console.log("[ai-assistant] Attempting Gemini...");
      const geminiContents = messages.map((msg: any) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;

      try {
        const geminiResp = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: geminiContents,
            generationConfig: { temperature: 0.7 },
          }),
        });

        if (geminiResp.ok) {
          console.log("[ai-assistant] Gemini response OK, streaming...");
          const reader = geminiResp.body!.getReader();
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();

          const stream = new ReadableStream({
            async start(controller) {
              const providerChunk = JSON.stringify({
                choices: [{ delta: { content: "" } }],
                provider: "gemini",
                model: geminiModel,
              });
              controller.enqueue(encoder.encode(`data: ${providerChunk}\n\n`));

              let buffer = "";
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });

                  let nlIdx: number;
                  while ((nlIdx = buffer.indexOf("\n")) !== -1) {
                    const line = buffer.slice(0, nlIdx).trim();
                    buffer = buffer.slice(nlIdx + 1);
                    if (!line.startsWith("data: ")) continue;
                    const jsonStr = line.slice(6);
                    if (jsonStr === "[DONE]") continue;
                    try {
                      const parsed = JSON.parse(jsonStr);
                      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                      if (text) {
                        const chunk = JSON.stringify({ choices: [{ delta: { content: text } }] });
                        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                      }
                    } catch { /* skip */ }
                  }
                }
              } catch (e) {
                console.error("[ai-assistant] Gemini stream error:", e);
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });

          return new Response(stream, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": "gemini" },
          });
        } else {
          const errText = await geminiResp.text();
          console.error("[ai-assistant] Gemini error:", geminiResp.status, errText.slice(0, 200));
          console.log("[ai-assistant] Falling back to Lovable AI...");
        }
      } catch (fetchErr) {
        console.error("[ai-assistant] Gemini fetch error:", fetchErr);
        console.log("[ai-assistant] Falling back to Lovable AI...");
      }
    }

    // ── LOVABLE AI GATEWAY (default/fallback) ──
    return await callLovableGateway(systemPrompt, messages, corsHeaders);
  } catch (e) {
    console.error("[ai-assistant] Fatal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callLovableGateway(systemPrompt: string, messages: any[], corsHeaders: Record<string, string>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("[ai-assistant] LOVABLE_API_KEY not configured");
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[ai-assistant] Using Lovable AI Gateway");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
      reasoning: {
        effort: "medium",
      },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (status === 402) {
      return new Response(JSON.stringify({ error: "Payment required" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const t = await response.text();
    console.error("[ai-assistant] AI gateway error:", status, t);
    return new Response(JSON.stringify({ error: "AI gateway error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const reader = response.body!.getReader();
  const encoder = new TextEncoder();
  let sentProvider = false;

  const stream = new ReadableStream({
    async start(controller) {
      if (!sentProvider) {
        const providerChunk = JSON.stringify({
          choices: [{ delta: { content: "" } }],
          provider: "lovable",
        });
        controller.enqueue(encoder.encode(`data: ${providerChunk}\n\n`));
        sentProvider = true;
      }
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (e) {
        console.error("[ai-assistant] Stream relay error:", e);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": "lovable" },
  });
}
