# Print System Refactoring Tracker

## Phase 0: Setup
- [x] Create REFACTOR_TRACKER.md

## Phase 1: Safe Cleanup (Dead Code Elimination)
- [x] Delete `src/lib/unifiedInvoiceGenerator.ts` (0 imports - safe)
- [x] Delete `src/hooks/useAccountStatementPDF.ts` (1 import)
- [x] Update `SendAccountStatementDialog.tsx` to inline PDF generation
- [x] Extract `numberToArabicWords` + utilities to `src/lib/printUtils.ts`
- [x] Update 13 files importing `numberToArabicWords`/`formatArabicNumber` from `@/print-engine` → `@/lib/printUtils`
- [x] Migrate `print-engine/universal/*` to `src/lib/printMeasurements*.ts`
- [x] Create `src/hooks/usePrintTheme.ts` as replacement for `@/print-engine/usePrintTheme`
- [x] Update 4 remaining consumers (PrintEnginePreview, UnifiedReceiptPrint, PaymentsStatementPrintDialog, OperatingDuesPrintDialog)
- [x] Delete `src/print-engine/` folder ✅ COMPLETE

## Phase 2: Refactor CompositeTaskInvoicePrint & Migrate Fragments
- [x] Migrate fragment functions (`unifiedHeaderFooterCss`, `unifiedHeaderHtml`, `unifiedFooterHtml`, `UnifiedPrintStyles`) into `src/lib/unifiedInvoiceBase.ts`
- [x] Update all 19 files importing from `unifiedPrintFragments.ts` to use `unifiedInvoiceBase.ts`
- [x] Update dynamic import in `Payments.tsx`
- [x] Delete `src/lib/unifiedPrintFragments.ts`
- [x] `src/components/Invoice/ContractInvoiceDialog.tsx` - already uses `unifiedInvoiceBase.ts`
- [x] `src/components/Contract/ContractInvoiceDialog.tsx` - already uses `unifiedInvoiceBase.ts`

## Phase 3: Rewrite InvoiceTemplates Monolith
- [x] Rewrite `src/components/billing/InvoiceTemplates.tsx` (1050→170 lines) - now a thin adapter to unified generators
- [x] Remove unused imports from `CustomerBilling.tsx` (pages + components)
- [x] Remove unused import from `PrintInstallationInvoice.tsx`
- [x] Delete `src/components/billing/ModernInvoiceTemplate.tsx` (used `@/print-engine`)
- [x] Assess `src/components/billing/ModernPrintInvoiceDialog.tsx` - UI dialog component, kept as-is

## ✅ REFACTORING COMPLETE

### Single Source of Truth Architecture:
- `src/lib/unifiedInvoiceBase.ts` — Core engine (resolveInvoiceStyles, wrapInDocument, legacy fragment compat)
- `src/lib/printMeasurements.ts` — Measurements print system (barrel export)
- `src/lib/printMeasurementsTypes.ts` — PrintConfig, PrintColumn, PrintTotalsItem types
- `src/lib/printMeasurementsConfig.ts` — createMeasurementsConfigFromSettings
- `src/lib/printMeasurementsHTML.ts` — generateMeasurementsHTML, openMeasurementsPrintWindow
- `src/lib/printUtils.ts` — Shared utilities (numberToArabicWords, formatArabicNumber, etc.)
- `src/hooks/usePrintTheme.ts` — Hook for loading print settings by document type
- `src/lib/printInvoiceGenerator.ts` — Print invoices
- `src/lib/purchaseInvoiceGenerator.ts` — Purchase invoices
- `src/lib/salesInvoiceGenerator.ts` — Sales invoices
- `src/lib/contractInvoiceGenerator.ts` — Contract invoices
- `src/lib/receiptGenerator.ts` — Receipts
- `src/lib/accountStatementGenerator.ts` — Account statements
- `src/lib/overdueNoticeGenerator.ts` — Overdue notices

---

## 📋 Post-Refactoring Health Report — 2026-03-06

### 1. Verification of Deletions
| Deleted Item | Status | Dangling Imports |
|---|---|---|
| `src/print-engine/` (entire folder) | ✅ Deleted | 0 — verified via grep |
| `src/lib/unifiedPrintFragments.ts` | ✅ Deleted | 0 — only comments reference the old name |
| `src/lib/unifiedInvoiceGenerator.ts` | ✅ Deleted | 0 |
| `src/components/billing/ModernInvoiceTemplate.tsx` | ✅ Deleted | 0 |

### 2. TypeScript & Build Health
- All `@/print-engine` imports replaced across 20+ files
- No new `any` types introduced (existing `any` in legacy code preserved)
- `usePrintTheme` hook simplified: returns `{ settings, isLoading }` (removed unused `theme` object)
- Build compiles without errors related to print system

### 3. Epic Status: **100% COMPLETE** ✅
- **Date Completed:** 2026-03-06
- **Total Files Modified:** ~35
- **Total Files Deleted:** 15+
- **Lines of Dead Code Removed:** ~3,000+

---

## 🔗 Epic: Settings UI & Print Engine Integration — 2026-03-06

### Phase 1: Schema & Types Alignment
- [x] Verified `print_settings` table already has all required columns: `header_style`, `header_swap`, `logo_size`, `table_header_bg_color`, `table_header_text_color`, `logo_size_preset`, etc.
- [x] TypeScript `PrintSettings` interface in `src/types/print-settings.ts` already matches DB schema
- [x] No migration needed — all columns exist

### Phase 2: Settings UI Wiring
- [x] `PrintSettingsPage.tsx` already wired: all tabs (Header, Table, Layout, Colors, Document) use `updateSetting()` → local state → `PrintEnginePreview` re-renders dynamically
- [x] Header Style selector (Classic/Modern/Centered/Simple/Minimal) updates `header_style`
- [x] Swap button toggles `header_swap`
- [x] Color pickers update `table_header_bg_color`, `table_header_text_color`, etc.
- [x] Save button patches all fields to `print_settings` table via `saveGlobalToAll` or `saveSettings`

### Phase 3: Print Engine Reactivity
- [x] `printMeasurementsConfig.ts` — passes `header_style` to config via `(config.header as any).headerStyle`
- [x] `printMeasurementsHTML.ts` — implements 5 header layouts: `classic`, `modern`, `centered`, `simple`, `minimal`
- [x] `unifiedInvoiceBase.ts` — `generateHeaderHTML()` now renders different DOM structures per `headerStyle`
- [x] `unifiedInvoiceBase.ts` — `resolveInvoiceStyles()` now reads `headerStyle` from bridge
- [x] `invoicePrintSettingsBridge.ts` — maps `ps.header_style` → `result.headerStyle`

### Status: **COMPLETE** ✅
