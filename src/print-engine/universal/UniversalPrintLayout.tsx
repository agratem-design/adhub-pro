/**
 * Universal Print Layout Component
 * مكون التخطيط الموحد للطباعة
 */

import React, { useEffect, useMemo } from 'react';
import {
  PrintConfig,
  PrintColumn,
  PrintTotalsItem,
  PrintDocumentData,
  PrintPartyData,
  UniversalPrintLayoutProps,
} from './types';
import { injectPrintStyles, removePrintStyles } from './generateDynamicStyles';

/**
 * Header Section Component
 */
const PrintHeader: React.FC<{
  config: PrintConfig;
  documentData: PrintDocumentData;
}> = ({ config, documentData }) => {
  if (!config.header.enabled) return null;

  return (
    <header className="universal-print-header">
      {/* Logo with absolute positioning */}
      {config.header.logo.enabled && config.header.logo.url && (
        <div className="universal-print-logo">
          <img src={config.header.logo.url} alt="Logo" />
        </div>
      )}

      {/* Title with absolute positioning */}
      {config.header.title.enabled && (
        <h1 className="universal-print-title">
          {documentData.title || config.header.title.text}
        </h1>
      )}

      {/* Document Info (number, date) */}
      {config.header.documentInfo.enabled && (
        <div className="universal-print-doc-info">
          {documentData.documentNumber && (
            <div className="universal-print-doc-info-item">
              <span className="universal-print-doc-info-label">{documentData.documentNumberLabel ?? 'رقم المستند'}:</span>
              <span>{documentData.documentNumber}</span>
            </div>
          )}
          {documentData.date && (
            <div className="universal-print-doc-info-item">
              <span className="universal-print-doc-info-label">التاريخ:</span>
              <span>{documentData.date}</span>
            </div>
          )}
          {documentData.additionalInfo?.map((info, idx) => (
            <div key={idx} className="universal-print-doc-info-item">
              <span className="universal-print-doc-info-label">{info.label}:</span>
              <span>{info.value}</span>
            </div>
          ))}
        </div>
      )}
    </header>
  );
};

/**
 * Company Info Section
 */
const CompanyInfo: React.FC<{ config: PrintConfig }> = ({ config }) => {
  if (!config.companyInfo.enabled) return null;

  return (
    <div className="universal-print-company">
      {config.companyInfo.name && (
        <div className="universal-print-company-name">{config.companyInfo.name}</div>
      )}
      {config.companyInfo.subtitle && <div>{config.companyInfo.subtitle}</div>}
      {config.companyInfo.address && <div>{config.companyInfo.address}</div>}
      {config.companyInfo.phone && <div>{config.companyInfo.phone}</div>}
    </div>
  );
};

/**
 * Party Info Section (Customer/Supplier)
 */
const PartyInfo: React.FC<{
  config: PrintConfig;
  partyData?: PrintPartyData;
}> = ({ config, partyData }) => {
  if (!config.partyInfo.enabled || !partyData) return null;

  return (
    <div className="universal-print-party">
      <div className="universal-print-party-title">{partyData.title}</div>
      <div className="universal-print-party-content">
        <div className="universal-print-party-row">
          <span className="universal-print-party-label">الاسم:</span>
          <span>{partyData.name}</span>
        </div>
        {partyData.company && (
          <div className="universal-print-party-row">
            <span className="universal-print-party-label">الشركة:</span>
            <span>{partyData.company}</span>
          </div>
        )}
        {partyData.phone && (
          <div className="universal-print-party-row">
            <span className="universal-print-party-label">الهاتف:</span>
            <span>{partyData.phone}</span>
          </div>
        )}
        {partyData.email && (
          <div className="universal-print-party-row">
            <span className="universal-print-party-label">البريد:</span>
            <span>{partyData.email}</span>
          </div>
        )}
        {partyData.additionalFields?.map((field, idx) => (
          <div key={idx} className="universal-print-party-row">
            <span className="universal-print-party-label">{field.label}:</span>
            <span>{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Dynamic Table with tfoot-integrated totals
 */
const PrintTable: React.FC<{
  config: PrintConfig;
  columns: PrintColumn[];
  rows: Record<string, any>[];
  totals?: PrintTotalsItem[];
  totalsTitle?: string;
}> = ({ config, columns, rows, totals, totalsTitle }) => {
  const colCount = columns.length;

  return (
    <table className="universal-print-table">
      <thead>
        <tr>
          {columns.map((col, idx) => (
            <th
              key={col.key}
              className={col.align ? `align-${col.align}` : ''}
              style={{ width: col.width }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx}>
            {columns.map((col) => {
              const value = row[col.key];
              const displayValue = col.format ? col.format(value) : value;
              return (
                <td
                  key={col.key}
                  className={col.align ? `align-${col.align}` : ''}
                >
                  {displayValue}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>

      {/* Totals Section - Integrated in tfoot */}
      {config.totals.enabled && totals && totals.length > 0 && (
        <tfoot>
          <tr>
            {/* Empty cells to push totals to the right */}
            <td colSpan={colCount - 1} className="empty-cell"></td>
            <td>
              <div className="universal-print-totals-box">
                {totalsTitle && (
                  <div className="universal-print-totals-title">{totalsTitle}</div>
                )}
                {totals.map((item, idx) => (
                  <div
                    key={idx}
                    className={`universal-print-totals-row ${item.highlight ? 'highlight' : ''}`}
                  >
                    <span className="universal-print-totals-label">{item.label}</span>
                    <span
                      className="universal-print-totals-value"
                      style={{ fontWeight: item.bold ? 'bold' : 'normal' }}
                    >
                      {typeof item.value === 'number'
                        ? item.value.toLocaleString('ar-SA')
                        : item.value}
                    </span>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
};

/**
 * Notes Section
 */
const NotesSection: React.FC<{
  config: PrintConfig;
  notes?: string;
}> = ({ config, notes }) => {
  const content = notes || config.notes.content;
  if (!config.notes.enabled || !content) return null;

  return (
    <div className="universal-print-notes">
      <div className="universal-print-notes-title">{config.notes.title}</div>
      <div>{content}</div>
    </div>
  );
};

/**
 * Footer Section
 */
const PrintFooter: React.FC<{ config: PrintConfig }> = ({ config }) => {
  if (!config.footer.enabled) return null;

  return (
    <footer className="universal-print-footer">
      {config.footer.text && <div>{config.footer.text}</div>}
      {config.footer.showPageNumber && (
        <div className="universal-print-page-number">
          {config.footer.pageNumberFormat.replace('{page}', '1')}
        </div>
      )}
    </footer>
  );
};

/**
 * UniversalPrintLayout - Main Component
 * مكون التخطيط الرئيسي للطباعة
 */
export const UniversalPrintLayout: React.FC<UniversalPrintLayoutProps> = ({
  config,
  documentData,
  partyData,
  columns,
  rows,
  totals,
  totalsTitle,
  notes,
  className = '',
}) => {
  // Inject styles on mount
  useEffect(() => {
    injectPrintStyles(config);
    return () => {
      removePrintStyles();
    };
  }, [config]);

  return (
    <div className={`universal-print-page ${className}`}>
      <PrintHeader config={config} documentData={documentData} />
      <CompanyInfo config={config} />
      <PartyInfo config={config} partyData={partyData} />
      <PrintTable
        config={config}
        columns={columns}
        rows={rows}
        totals={totals}
        totalsTitle={totalsTitle}
      />
      <NotesSection config={config} notes={notes} />
      <PrintFooter config={config} />
    </div>
  );
};

export default UniversalPrintLayout;
