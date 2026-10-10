export const printEnabled = (value: unknown) => ['true', '1'].includes(String(value).toLowerCase());

/** Read every page so account balances are not truncated by the server row limit. */
export async function collectStatementRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const data: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await page(from, from + 499);
    if (result.error) throw result.error;
    data.push(...(result.data || []));
    if ((result.data?.length || 0) < 500) return { data, error: null };
  }
}

export function taskPrintAmounts(task: any, area = Number(task.total_area) || 0) {
  const printerRate = Number(task.printer_cost_per_meter ?? task.price_per_meter ?? 0);
  const cost = Number(task.printer_total_cost ?? task.total_cost ?? area * printerRate);
  const customerCost = Number(task.customer_total_amount ?? task.customer_total_cost ?? 0);
  const customerRate = Number(task.customer_price_per_meter ?? task.customer_cost_per_meter ?? (area > 0 ? customerCost / area : 0));
  return { cost, costPerMeter: printerRate || (area > 0 ? cost / area : 0), customerCost, customerRate };
}

export function contractPrintArea(contract: any, boards: any[], sizes: any[]) {
  const price = Number(contract.print_price_per_meter) || 0;
  if (price > 0 && Number(contract.print_cost) > 0) return Number(contract.print_cost) / price;
  const ids = new Set(String(contract.billboard_ids || contract.billboard_id || '').split(',').map(Number));
  const single = new Set(String(contract.single_face_billboards || '').split(',').map(Number));
  return boards.filter(b => ids.has(Number(b.ID))).reduce((sum, b) => {
    const size = sizes.find(s => s.name === b.Size);
    const parts = String(size?.print_size || b.Size || '').split(/[x×*]/).map(Number);
    const area = size?.print_size ? (parts[0] || 0) * (parts[1] || 0) :
      (Number(size?.width) || parts[0] || 0) * (Number(size?.height) || parts[1] || 0);
    return sum + area * (single.has(Number(b.ID)) ? 1 : Number(b.Faces_Count) || 1);
  }, 0);
}
