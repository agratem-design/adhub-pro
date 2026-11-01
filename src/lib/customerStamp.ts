export interface CustomerStamp {
  stamp_image?: string | null;
  stamp_enabled?: boolean;
  stamp_x?: number;
  stamp_y?: number;
  stamp_width?: number;
}

export function renderCustomerStamp(stamp?: CustomerStamp, isOffer = false): string {
  if (isOffer || !stamp?.stamp_enabled || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(stamp.stamp_image || '')) return '';
  // Fixed to the second-party box in the 2480 × 3508 contract template.
  // Ignore legacy per-customer coordinates so all customer stamps align consistently.
  const width = 300;
  const x = 360;
  const y = 3060;
  return `<image data-customer-stamp="true" href="${stamp.stamp_image}" x="${x}" y="${y}" width="${width}" height="${width}" preserveAspectRatio="xMidYMid meet" />`;
}
