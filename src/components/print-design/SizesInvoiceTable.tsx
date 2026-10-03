import { hexToRgba } from '@/hooks/useInvoiceSettingsSync';

export function renderSizesInvoiceTable(items: Array<{sizeName: string; widthMeters: number; heightMeters: number; facesCount: number; quantity: number; areaPerFace: number; totalArea: number}>, title: string, isLastTable: boolean, tokens: any) {
  const { primaryColor, secondaryColor, headerFontSize, bodyFontSize, tableText, tableHeaderBg, tableHeaderText, tableBorder, tableRowEven, tableRowOdd, tableRowOpacity, subtotalText, subtotalBg, totalBg, totalText, totalBillboards, totalArea, sizesSettings, individual } = tokens;

    if (items.length === 0) return null;

    const hasUnknownDimensions = items.some(item => !item.areaPerFace);
    const tableTotal = items.reduce((sum, item) => sum + item.totalArea, 0);
    const tableQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate column count for colspan
    let colCount = 3; // Base: #, المقاس, الكمية
    if (sizesSettings.showDimensions) colCount += 2;
    if (sizesSettings.showFacesCount) colCount += 1;
    if (sizesSettings.showAreaPerFace) colCount += 1;
    if (sizesSettings.showTotalArea) colCount += 1;

    return (
      <div style={{ marginBottom: isLastTable ? '0' : '16px', pageBreakInside: 'auto' }}>
        {/* Section Title */}
        <div
          className="section-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '10px',
            paddingBottom: '8px',
            borderBottom: `2px solid ${primaryColor}`,
            pageBreakAfter: 'avoid',
          }}>
          <span style={{
            fontSize: `${headerFontSize}px`,
            fontWeight: 'bold',
            color: primaryColor,
          }}>{title}</span>
          <span style={{
            fontSize: `${bodyFontSize}px`,
            color: tableText,
            opacity: 0.7,
            marginRight: 'auto',
          }}>({tableQuantity} لوحة)</span>
        </div>

        {/* Table */}
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: `${bodyFontSize}px`,
          pageBreakInside: 'auto',
        }}>
          <thead style={{ display: 'table-header-group' }}>
            <tr style={{ backgroundColor: tableHeaderBg }}>
              <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '6%' }}>#</th>
              <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '18%' }}>المقاس</th>
              {sizesSettings.showDimensions && (
                <>
                  <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '12%' }}>العرض (م)</th>
                  <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '12%' }}>الارتفاع (م)</th>
                </>
              )}
              {sizesSettings.showFacesCount && <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '10%' }}>الأوجه</th>}
              <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '10%' }}>الكمية</th>
              {sizesSettings.showAreaPerFace && <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '14%' }}>م² / وجه</th>}
              {sizesSettings.showTotalArea && <th style={{ padding: '12px 8px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '18%' }}>الإجمالي م²</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{
                breakInside: 'avoid',
                backgroundColor: hexToRgba(idx % 2 === 0 ? tableRowEven : tableRowOdd, tableRowOpacity * 100),
              }}>
                <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText }}>{idx + 1}</td>
                <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontWeight: '600' }}>
                  {item.sizeName}
                </td>
                {sizesSettings.showDimensions && (
                  <>
                    <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif' }}>
                      {item.widthMeters > 0 ? item.widthMeters.toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif' }}>
                      {item.heightMeters > 0 ? item.heightMeters.toFixed(2) : '—'}
                    </td>
                  </>
                )}
                {sizesSettings.showFacesCount && (
                  <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      backgroundColor: item.facesCount === 1 ? hexToRgba(secondaryColor, 15) : hexToRgba(primaryColor, 12),
                      color: item.facesCount === 1 ? secondaryColor : primaryColor,
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 'bold',
                      fontSize: `${bodyFontSize - 1}px`,
                    }}>{item.facesCount}</span>
                  </td>
                )}
                <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif', fontWeight: 'bold' }}>
                  {item.quantity}
                </td>
                {sizesSettings.showAreaPerFace && (
                  <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableText, fontFamily: 'Manrope, sans-serif' }}>
                    {item.areaPerFace > 0 ? item.areaPerFace.toFixed(2) : '—'}
                  </td>
                )}
                {sizesSettings.showTotalArea && (
                  <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: subtotalText, fontWeight: 'bold', fontFamily: 'Manrope, sans-serif' }}>
                    {item.totalArea > 0 ? item.totalArea.toFixed(2) : '—'}
                  </td>
                )}
              </tr>
            ))}
            {/* Subtotal Row */}
            <tr style={{ backgroundColor: subtotalBg }}>
              <td colSpan={sizesSettings.showDimensions ? (sizesSettings.showFacesCount ? 5 : 4) : (sizesSettings.showFacesCount ? 3 : 2)}
                style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 'bold', color: subtotalText, border: `1px solid ${tableBorder}` }}>
                إجمالي القسم{hasUnknownDimensions ? ' (المساحات المعروفة)' : ''}
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: subtotalText, border: `1px solid ${tableBorder}`, fontFamily: 'Manrope, sans-serif' }}>
                {tableQuantity}
              </td>
              {sizesSettings.showAreaPerFace && <td style={{ padding: '10px 8px', border: `1px solid ${tableBorder}` }}></td>}
              {sizesSettings.showTotalArea && (
                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: subtotalText, border: `1px solid ${tableBorder}`, fontFamily: 'Manrope, sans-serif' }}>
                  {tableTotal > 0 ? `${tableTotal.toFixed(2)} م²` : '—'}
                </td>
              )}
            </tr>

            {/* Grand Total Row - only on last table */}
            {isLastTable && individual.showTotalsSection && sizesSettings.showTotalArea && (
              <tr style={{ backgroundColor: totalBg }}>
                <td colSpan={colCount - 1}
                  style={{
                    padding: '14px 12px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: totalText,
                    border: `1px solid ${tableBorder}`,
                    fontSize: `${headerFontSize}px`,
                  }}>
                  الإجمالي الكلي ({totalBillboards} لوحة){tokens.hasMissingSizes ? ' — المساحات المعروفة' : ''}
                </td>
                <td style={{
                  padding: '14px 12px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: totalText,
                  border: `1px solid ${tableBorder}`,
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: `${headerFontSize + 2}px`,
                }}>
                  {totalArea > 0 ? `${totalArea.toFixed(2)} م²` : '—'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );

}
