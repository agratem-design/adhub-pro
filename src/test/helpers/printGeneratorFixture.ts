import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { resolvePrintCardLayout, fitPrintCardText } from '@/lib/printCardLayout';
import { resolveInstallationFacesCount } from '@/lib/installationFaces';

const source = readFileSync('src/components/shared/printing/UnifiedPrintAllDialog.tsx', 'utf8');
const settingsSource = readFileSync('src/hooks/usePrintCustomization.ts', 'utf8');
const tableSource = readFileSync('src/hooks/useTablePrintSettings.ts', 'utf8');
const compile = (code: string) => ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
function initializer(sourceText: string, name: string) {
  const file = ts.createSourceFile('fixture.ts', sourceText, ts.ScriptTarget.Latest, true);
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(file) === name && declaration.initializer) return declaration.initializer.getText(file);
    }
  }
  throw new Error(`Missing settings: ${name}`);
}
export const cardSettings = new Function(`return ${initializer(settingsSource, 'defaultSettings')}`)();
export const tablePrintSettings = new Function(
  `const defaultColumns = ${initializer(tableSource, 'defaultColumns')}; return ${initializer(tableSource, 'defaultTablePrintSettings')}`,
)();
const helpers = source.slice(source.indexOf('  const parseDimensions ='), source.indexOf('  const { settings: customSettings'));
const generators = source.slice(source.indexOf('  const generatePrintHTML ='), source.indexOf('  const handlePrint ='));
const generatorCode = compile(helpers + generators);
const factories = new Map<string, Function>();

/** Exercise the actual generators while replacing only their I/O and React state. */
export function createPrintGeneratorFixture(overrides: Record<string, any> = {}) {
  const item = { id: 'test-item', billboard_id: 1, team_id: 'team', contract_number: 123,
    ad_type: 'حملة تجريبية طويلة', previous_ad: 'الحملة السابقة', installation_date: '2026-10-05',
    installed_image_face_a_url: '/photo-a.png', installed_image_face_b_url: '/photo-b.png',
    design_face_a: '/design-a.png', design_face_b: '/design-b.png', faces_to_install: 2 };
  const env: Record<string, any> = {
    window: { location: { origin: 'http://localhost:8080' } },
    filteredItems: [item],
    billboards: { 1: { ID: 1, Billboard_Name: 'TR-TC0017', Size: '13x5', Faces_Count: 2,
      Image_URL: '/original.png', City: 'طرابلس', Municipality: 'طرابلس المركز', District: 'طريق الشط',
      Nearest_Landmark: 'وسط جسر القبة الفلكية', GPS_Coordinates: '32.9,13.2', maintenance_status: 'ready' } },
    customSettings: cardSettings, tableSettings: tablePrintSettings,
    contextType: 'installation', contextNumber: 123, adType: 'حملة تجريبية طويلة',
    customerName: 'العميل التجريبي', companyName: 'الشركة التجريبية',
    resolvedTaskAdType: '', taskName: '', taskId: null, taskIds: [],
    includeDesigns: true, showDesignName: false, hideCustomerName: true, hideInstallDate: true,
    hideAdType: false, hideInstalledImages: false, showInstalledImages: false,
    showPreviousAd: false, showSizeDimensionLabels: false, printCityInsteadOfMunicipality: false,
    showTeamInContent: false, showTeamInHeader: false, showBillboardStatusOpt: false,
    showTeamFilter: true, selectedTeamIds: new Set(['team']), teams: { team: { team_name: 'الفريق التجريبي' } },
    printType: 'installation', printMode: 'cards', customBackgroundUrl: '/ipg.svg',
    dynamicDesignsMap: {}, previousAdsData: {}, installedImagesData: {}, sizeCutoutMap: {},
    maintenanceStatusesMap: { ready: { label: 'جاهزة', color: '#166534' } },
    sortBillboardsBySize: async (items: any[]) => items,
    resolveBillboardPreviousAds: async () => ({}), resolveBillboardDesigns: async () => ({}),
    resolveFacesCount: resolveInstallationFacesCount, resolveItemTeamId: (item: any) => item.team_id,
    createPinSvgUrl: () => ({ url: '' }), getBillboardStatus: () => ({ label: 'متاح' }),
    formatFacesCountArabic: (count: number) => count === 2 ? 'وجهين' : 'وجه واحد',
    QRCode: { toDataURL: async () => 'data:image/png;base64,qr' },
    getCleanDocumentTitle: () => 'اختبار الطباعة', getContextLabel: () => 'العقد',
    resolvePrintCardLayout, fitPrintCardText,
    ...overrides,
  };
  const keys = Object.keys(env).join(',');
  let run = factories.get(keys);
  if (!run) {
    run = new Function('env', `const {${keys}} = env; ${generatorCode}; return {generatePrintHTML, generateTablePrintHTML};`);
    factories.set(keys, run);
  }
  return { ...run(env), env } as {
    generatePrintHTML: () => Promise<string>; generateTablePrintHTML: () => Promise<string>; env: Record<string, any>;
  };
}
