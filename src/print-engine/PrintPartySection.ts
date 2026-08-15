/**
 * PrintPartySection
 * يولد HTML قسم الطرف (عميل/مورد)
 */

import { PartyData } from './types';

export function generatePartySection(partyData: PartyData): string {
  const additionalFieldsHtml = partyData.additionalFields
    ?.map(field => `<strong>${field.label}:</strong> ${field.value}<br>`)
    .join('') || '';

  return `
    <div class="party-section">
      <div class="party-title">${partyData.title}</div>
      <div class="party-details">
        <strong>الاسم:</strong> ${partyData.name}<br>
        ${partyData.company ? `<strong>الشركة:</strong> ${partyData.company}<br>` : ''}
        ${partyData.phone ? `<strong>الهاتف:</strong> ${partyData.phone}<br>` : ''}
        ${partyData.email ? `<strong>البريد الإلكتروني:</strong> ${partyData.email}<br>` : ''}
        ${additionalFieldsHtml}
        ${partyData.id ? `<strong>رقم العميل:</strong> ${partyData.id}` : ''}
      </div>
    </div>
  `;
}
