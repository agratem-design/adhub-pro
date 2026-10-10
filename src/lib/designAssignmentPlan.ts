/** Keep each design's contiguous group within one billboard of the others. */
export function buildDesignAssignmentPlan(itemIds: string[], designIds: string[], distribute: boolean, quantities?: Record<string, number>) {
  if (!designIds.length) return [];
  if (!distribute) return itemIds.map(itemId => ({ itemId, designId: designIds[0] }));
  if (quantities && (designIds.some(id => !Number.isInteger(quantities[id]) || quantities[id] < 0) || designIds.reduce((sum, id) => sum + quantities[id], 0) !== itemIds.length)) {
    throw new Error('يجب أن يساوي مجموع الكميات عدد اللوحات المستهدفة.');
  }
  const base = Math.floor(itemIds.length / designIds.length);
  const remainder = itemIds.length % designIds.length;
  let offset = 0;
  return designIds.flatMap((designId, index) => {
    const count = quantities ? quantities[designId] : base + (index < remainder ? 1 : 0);
    const group = itemIds.slice(offset, offset + count).map(itemId => ({ itemId, designId }));
    offset += count;
    return group;
  });
}
