import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    console.log("[update-ai-memory] Starting memory update...");

    // Use COUNT queries instead of loading all rows
    const { count: totalBillboards } = await supabase.from("billboards").select("*", { count: "exact", head: true });
    const { count: totalContracts } = await supabase.from("Contract").select("*", { count: "exact", head: true });
    const { count: totalCustomers } = await supabase.from("customers").select("*", { count: "exact", head: true });

    console.log(`[update-ai-memory] Counts — billboards: ${totalBillboards}, contracts: ${totalContracts}, customers: ${totalCustomers}`);

    // Get all statuses and cities for aggregation (lightweight: only 2 columns)
    const { data: bbData } = await supabase.from("billboards").select("City, Status, Size, Level");

    const bb = bbData || [];
    const memories: { category: string; content: string; metadata: any }[] = [];

    // Billboard summary by city
    const cityMap: Record<string, { total: number; available: number; rented: number }> = {};
    bb.forEach((b: any) => {
      const city = b.City || "غير محدد";
      if (!cityMap[city]) cityMap[city] = { total: 0, available: 0, rented: 0 };
      cityMap[city].total++;
      const st = (b.Status || "").toLowerCase();
      if (st.includes("متاح") || st === "available") cityMap[city].available++;
      else cityMap[city].rented++;
    });

    const citySummary = Object.entries(cityMap)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([city, data]) => `${city}: ${data.total} لوحة (${data.available} متاحة، ${data.rented} مؤجرة)`)
      .join(" | ");

    memories.push({
      category: "billboard_summary",
      content: `إجمالي اللوحات: ${totalBillboards}. توزيع حسب المدن: ${citySummary}`,
      metadata: { cityMap, totalBillboards },
    });

    // Status breakdown
    const statusMap: Record<string, number> = {};
    bb.forEach((b: any) => {
      const s = b.Status || "غير محدد";
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    memories.push({
      category: "billboard_status",
      content: `توزيع اللوحات حسب الحالة: ${Object.entries(statusMap).map(([s, c]) => `${s}: ${c}`).join(", ")}`,
      metadata: { statusMap },
    });

    // Size breakdown
    const sizeMap: Record<string, number> = {};
    bb.forEach((b: any) => {
      const size = b.Size || "غير محدد";
      sizeMap[size] = (sizeMap[size] || 0) + 1;
    });
    memories.push({
      category: "billboard_sizes",
      content: `توزيع اللوحات حسب المقاس: ${Object.entries(sizeMap).map(([s, c]) => `${s}: ${c}`).join(", ")}`,
      metadata: { sizeMap },
    });

    // Contract summary using aggregation
    const now = new Date().toISOString().split("T")[0];
    const { count: activeContracts } = await supabase
      .from("Contract")
      .select("*", { count: "exact", head: true })
      .gte("End Date", now);

    const { data: revenueData } = await supabase.from("Contract").select("Total");
    const totalRevenue = (revenueData || []).reduce((sum: number, c: any) => sum + (c.Total || 0), 0);

    memories.push({
      category: "contract_insight",
      content: `إجمالي العقود: ${totalContracts}. عقود نشطة: ${activeContracts}. عقود منتهية: ${(totalContracts || 0) - (activeContracts || 0)}. إجمالي الإيرادات: ${totalRevenue.toLocaleString()} ل.د`,
      metadata: { total: totalContracts, active: activeContracts, totalRevenue },
    });

    // Top customers
    const { data: topCustomers } = await supabase
      .from("customers")
      .select("name, total_rent, contracts_count")
      .order("total_rent", { ascending: false })
      .limit(5);

    const topSummary = (topCustomers || [])
      .map((c: any) => `${c.name} (${(c.total_rent || 0).toLocaleString()} ل.د, ${c.contracts_count || 0} عقد)`)
      .join(" | ");

    memories.push({
      category: "customer_pattern",
      content: `إجمالي العملاء: ${totalCustomers}. أكبر 5 عملاء: ${topSummary}`,
      metadata: { totalCustomers },
    });

    // General stats
    const availableCount = bb.filter((b: any) => {
      const st = (b.Status || "").toLowerCase();
      return st.includes("متاح") || st === "available";
    }).length;

    memories.push({
      category: "general_stats",
      content: `إحصائيات عامة: ${totalBillboards} لوحة إعلانية، ${availableCount} متاحة، ${totalContracts} عقد، ${totalCustomers} عميل. آخر تحديث: ${new Date().toISOString()}`,
      metadata: { updatedAt: new Date().toISOString() },
    });

    // Clear and insert
    await supabase.from("ai_memory").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { error } = await supabase.from("ai_memory").insert(memories);
    if (error) {
      console.error("[update-ai-memory] Insert error:", error);
      throw error;
    }

    console.log("[update-ai-memory] Successfully updated", memories.length, "memory entries");

    return new Response(JSON.stringify({ success: true, entries: memories.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[update-ai-memory] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
