/**
 * Safely executes Supabase queries in chunks to prevent URL length limits (HTTP 400 / 414 URI Too Long)
 * when filtering with .in('column', items) on large collections of IDs.
 */
export async function batchInQuery<T, K extends string | number = string | number>(
  items: K[],
  chunkSize = 35,
  queryFn: (chunk: K[]) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  if (!items || items.length === 0) return [];

  const uniqueItems = Array.from(new Set(items));
  if (uniqueItems.length <= chunkSize) {
    const res = await queryFn(uniqueItems);
    if (res.error) throw res.error;
    return res.data || [];
  }

  const chunks: K[][] = [];
  for (let i = 0; i < uniqueItems.length; i += chunkSize) {
    chunks.push(uniqueItems.slice(i, i + chunkSize));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const res = await queryFn(chunk);
      if (res.error) {
        console.error('Error in batch query chunk:', res.error);
        return [];
      }
      return res.data || [];
    })
  );

  return results.flat();
}
