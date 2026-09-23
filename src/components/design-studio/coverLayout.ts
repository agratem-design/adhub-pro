/** Keep campaign copy inside the original glass focal area at every canvas size. */
export function fitCoverTitle(requestedSize: number, title: string, focalWidth: number): number {
  const length = Array.from(title.trim()).length;
  const lineAllowance = length > 70 ? 0.075 : length > 40 ? 0.10 : length > 22 ? 0.13 : 0.17;
  return Math.max(1, Math.min(requestedSize, focalWidth * lineAllowance));
}
