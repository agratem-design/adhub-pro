import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PrintSettingsProvider } from "@/store";
import { SystemDialogProvider } from "@/contexts/SystemDialogContext";
import { AppShell as MainLayout } from "@/components/Layout/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PrintPreviewDialog } from "@/components/print/PrintPreviewDialog";
import { AppThemeLoader } from "@/components/AppThemeLoader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionTimeoutGuard } from "@/components/SessionTimeoutGuard";
import { NetworkStatusNotifier } from "@/components/NetworkStatusNotifier";
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt";
import { DesktopBackupNotifier } from "@/components/DesktopBackupNotifier";
import { LocalStackNotifier } from "@/components/LocalStackNotifier";

// Use HashRouter in desktop / file:// environments to ensure robust client-side routing
const isDesktopEnv = typeof window !== 'undefined' && (window.location.protocol === 'file:' || !!window.desktopAPI);
const RouterComponent = isDesktopEnv ? HashRouter : BrowserRouter;


// Retry wrapper for lazy imports — handles momentary re-optimizations and stale chunk errors
function lazyRetry(importFn: () => Promise<any>) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (err) {
      // First try a quick in-memory retry in case dev server was briefly re-optimizing deps
      try {
        await new Promise((resolve) => setTimeout(resolve, 350));
        return await importFn();
      } catch (retryErr) {
        const routeKey = typeof window !== 'undefined' ? `chunk_reload_${window.location.pathname}` : 'chunk_reload';
        const reloadCount = parseInt(sessionStorage.getItem(routeKey) || '0', 10);
        
        // Only allow one reload attempt per route to prevent infinite loops
        if (reloadCount < 1) {
          sessionStorage.setItem(routeKey, String(reloadCount + 1));
          window.location.reload();
          return new Promise(() => {});
        }
        
        sessionStorage.removeItem(routeKey);
        throw retryErr;
      }
    }
  });
}

// ---- Lazy-loaded pages ----
const Index = lazyRetry(() => import("./pages/Index"));
const Dashboard = lazyRetry(() => import("./pages/Dashboard"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const Contracts = lazyRetry(() => import("./pages/Contracts"));
const Tasks = lazyRetry(() => import("./pages/Tasks"));
const ContractCreate = lazyRetry(() => import("./pages/ContractCreate"));
const ContractEdit = lazyRetry(() => import("./pages/ContractEdit"));
const ContractView = lazyRetry(() => import("./pages/ContractView"));
const ContractExpensesPage = lazyRetry(() => import("./pages/ContractExpensesPage"));
const EventsContracts = lazyRetry(() => import("./pages/EventsContracts"));
const EventContractEdit = lazyRetry(() => import("./pages/EventContractEdit"));
const Billboards = lazyRetry(() => import("./pages/Billboards"));
const BillboardCleanup = lazyRetry(() => import("./pages/BillboardCleanup"));
const BillboardMaintenance = lazyRetry(() => import("./pages/BillboardMaintenance"));
const Users = lazyRetry(() => import("./pages/Users"));
const PricingList = lazyRetry(() => import("./pages/PricingList"));
const Settings = lazyRetry(() => import("./pages/Settings"));
const Reports = lazyRetry(() => import("./pages/Reports"));
const Expenses = lazyRetry(() => import("./pages/Expenses"));
const Salaries = lazyRetry(() => import("./pages/Salaries"));
const EmployeeDetail = lazyRetry(() => import("./pages/EmployeeDetail"));
const Customers = lazyRetry(() => import("./pages/Customers"));
const CustomerBilling = lazyRetry(() => import("./pages/CustomerBilling"));
const CustomerMerge = lazyRetry(() => import("./pages/CustomerMerge"));
const BookingRequests = lazyRetry(() => import("./pages/BookingRequests"));
const SharedBillboards = lazyRetry(() => import("./pages/SharedBillboards"));
const SharedCompanies = lazyRetry(() => import("./pages/SharedCompanies"));
const OverduePayments = lazyRetry(() => import("./pages/OverduePayments"));
const AccountOverduePayments = lazyRetry(() => import("./pages/AccountOverduePayments"));
const ExpenseManagement = lazyRetry(() => import("./pages/ExpenseManagement"));
const ExpensesReport = lazyRetry(() => import("./pages/ExpensesReport"));
const PrintedInvoicesPage = lazyRetry(() => import("./pages/PrintedInvoicesPage"));
const PaymentsReceiptsPage = lazyRetry(() => import("./pages/PaymentsReceiptsPage"));
const InstallationTeams = lazyRetry(() => import("./pages/InstallationTeams"));
const InstallationTeamAccounts = lazyRetry(() => import("./pages/InstallationTeamAccounts"));
const DatabaseBackup = lazyRetry(() => import("./pages/DatabaseBackup"));
const MessagingSettings = lazyRetry(() => import("./pages/MessagingSettings"));
const CurrencySettings = lazyRetry(() => import("./pages/CurrencySettings"));
const Printers = lazyRetry(() => import("./pages/Printers"));
const InstallationTasks = lazyRetry(() => import("./pages/InstallationTasks"));
const RemovalTasks = lazyRetry(() => import("./pages/RemovalTasks"));
const MunicipalityStats = lazyRetry(() => import("./pages/MunicipalityStats"));
const PrintTasks = lazyRetry(() => import("./pages/PrintTasks"));
const CutoutTasks = lazyRetry(() => import("./pages/CutoutTasks"));
const PrinterAccounts = lazyRetry(() => import("./pages/PrinterAccounts"));
const PDFTemplateSettings = lazyRetry(() => import("./pages/PDFTemplateSettings"));
const FriendBillboards = lazyRetry(() => import("./pages/FriendBillboards"));
const FriendCompanyAccounts = lazyRetry(() => import("./pages/FriendCompanyAccounts"));
const CompositeTasks = lazyRetry(() => import("./pages/CompositeTasks"));
const Revenue = lazyRetry(() => import("./pages/Revenue"));
const SystemSettings = lazyRetry(() => import("./pages/SystemSettings"));
const SiteAppearance = lazyRetry(() => import("./pages/SiteAppearance"));
const CustodyManagement = lazyRetry(() => import("./pages/CustodyManagement"));
const OffersPage = lazyRetry(() => import("./pages/OffersPage"));
const OfferEdit = lazyRetry(() => import("./pages/OfferEdit"));
const MunicipalityStickers = lazyRetry(() => import("./pages/MunicipalityStickers"));
const MunicipalityRentPrices = lazyRetry(() => import("./pages/MunicipalityRentPrices"));
const MunicipalityBillboardOrganizer = lazyRetry(() => import("./pages/MunicipalityBillboardOrganizer"));
const DelayedBillboards = lazyRetry(() => import("./pages/DelayedBillboards"));
const ExtendedBillboards = lazyRetry(() => import("./pages/ExtendedBillboards"));
const PricingFactors = lazyRetry(() => import("./pages/PricingFactors"));
const PrintSettingsPage = lazyRetry(() => import("./pages/PrintSettingsPage"));
const DesignStudio = lazyRetry(() => import("./pages/DesignStudio"));
const ContractTermsSettings = lazyRetry(() => import("./pages/ContractTermsSettings"));
const RolesManagement = lazyRetry(() => import("./pages/RolesManagement"));
const BillboardPrintSettings = lazyRetry(() => import("./pages/BillboardPrintSettings"));
const BillboardPrintSettingsNew = lazyRetry(() => import("./pages/BillboardPrintSettingsNew"));
const QuickPrintSettings = lazyRetry(() => import("./pages/QuickPrintSettings"));
const BillboardPhotosGallery = lazyRetry(() => import("./pages/BillboardPhotosGallery"));
const BulkWhatsApp = lazyRetry(() => import("./pages/BulkWhatsApp"));
const RephotographyBillboards = lazyRetry(() => import("./pages/RephotographyBillboards"));
const ActivityLogPage = lazyRetry(() => import("./pages/ActivityLog"));
const FieldPhotoGallery = lazyRetry(() => import("./pages/FieldPhotoGallery"));
const AiAssistant = lazyRetry(() => import("./pages/AiAssistant"));
const FontSettings = lazyRetry(() => import("./pages/FontSettings"));

const SmartDistribution = lazyRetry(() => import("./pages/SmartDistribution"));
const ImageGallery = lazyRetry(() => import("./pages/ImageGallery"));
const KpiDashboard = lazyRetry(() => import("./pages/KpiDashboard"));
const OfflineSetup = lazyRetry(() => import("./pages/OfflineSetup"));
const ProfitabilityReports = lazyRetry(() => import("./pages/ProfitabilityReports"));
const DatabaseSetup = lazyRetry(() => import("./pages/DatabaseSetup"));
const CompanyManagement = lazyRetry(() => import("./pages/CompanyManagement"));
const LogoManagement = lazyRetry(() => import("./pages/LogoManagement"));
const ExportContentSettings = lazyRetry(() => import("./pages/ExportContentSettings"));
const ExportPricingList = lazyRetry(() => import("./pages/ExportPricingList"));
const ContractClosureSimulator = lazyRetry(() => import("./pages/ContractClosureSimulator"));
const GoogleDriveUploaderPage = lazyRetry(() => import("./pages/GoogleDriveUploaderPage"));

// ---- Loading fallback ----
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
  </div>
);

// ---- Admin routes config (path → component → permission) ----
const adminRoutes: { path: string; Component: React.LazyExoticComponent<any>; permission?: string }[] = [
  { path: "billboards", Component: Billboards, permission: "billboards" },
  { path: "billboard-cleanup", Component: BillboardCleanup, permission: "billboard_cleanup" },
  { path: "billboard-maintenance", Component: BillboardMaintenance, permission: "billboard_maintenance" },
  { path: "shared-billboards", Component: SharedBillboards, permission: "shared_billboards" },
  { path: "friend-billboards", Component: FriendBillboards, permission: "friend_billboards" },
  { path: "friend-accounts", Component: FriendCompanyAccounts, permission: "friend_accounts" },
  { path: "delayed-billboards", Component: DelayedBillboards, permission: "delayed_billboards" },
  { path: "extended-billboards", Component: ExtendedBillboards, permission: "extended_billboards" },
  { path: "contracts", Component: Contracts, permission: "contracts" },
  { path: "contracts/new", Component: ContractCreate, permission: "contracts" },
  { path: "contracts/edit", Component: ContractEdit, permission: "contracts" },
  { path: "contracts/view/:id", Component: ContractView, permission: "contracts" },
  { path: "contracts/:contractId/expenses", Component: ContractExpensesPage, permission: "contracts" },
  { path: "events-contracts", Component: EventsContracts, permission: "contracts" },
  { path: "events-contracts/new", Component: EventContractEdit, permission: "contracts" },
  { path: "events-contracts/edit/:id", Component: EventContractEdit, permission: "contracts" },
  { path: "customers", Component: Customers, permission: "customers" },
  { path: "customer-billing", Component: CustomerBilling, permission: "customer_billing" },
  { path: "customer-merge", Component: CustomerMerge, permission: "customer_merge" },
  { path: "overdue-payments", Component: OverduePayments, permission: "overdue_payments" },
  { path: "account-overdue-payments", Component: AccountOverduePayments, permission: "overdue_payments" },
  { path: "booking-requests", Component: BookingRequests, permission: "booking_requests" },
  { path: "users", Component: Users, permission: "users" },
  { path: "roles", Component: RolesManagement, permission: "roles" },
  { path: "pricing", Component: PricingList, permission: "pricing" },
  { path: "pricing-factors", Component: PricingFactors, permission: "pricing_factors" },
  { path: "offers", Component: OffersPage, permission: "offers" },
  { path: "offers/create", Component: OfferEdit, permission: "offers" },
  { path: "offers/edit/:id", Component: OfferEdit, permission: "offers" },
  { path: "reports", Component: Reports, permission: "reports" },
  { path: "tasks", Component: Tasks, permission: "tasks" },
  { path: "installation-tasks", Component: InstallationTasks, permission: "installation_tasks" },
  { path: "removal-tasks", Component: RemovalTasks, permission: "removal_tasks" },
  { path: "print-tasks", Component: PrintTasks, permission: "print_tasks" },
  { path: "cutout-tasks", Component: CutoutTasks, permission: "cutout_tasks" },
  { path: "composite-tasks", Component: CompositeTasks, permission: "composite_tasks" },
  { path: "installation-teams", Component: InstallationTeams, permission: "installation_teams" },
  { path: "installation-team-accounts", Component: InstallationTeamAccounts, permission: "installation_team_accounts" },
  { path: "expenses", Component: Expenses, permission: "expenses" },
  { path: "expense-management", Component: ExpenseManagement, permission: "expenses" },
  { path: "expenses-report", Component: ExpensesReport, permission: "expenses" },
  { path: "salaries", Component: Salaries, permission: "salaries" },
  { path: "employees/:id", Component: EmployeeDetail, permission: "salaries" },
  { path: "custody-management", Component: CustodyManagement, permission: "custody" },
  { path: "printers", Component: Printers, permission: "printers" },
  { path: "printer-accounts", Component: PrinterAccounts, permission: "printer_accounts" },
  { path: "shared-companies", Component: SharedCompanies, permission: "shared_companies" },
  { path: "company-management", Component: CompanyManagement, permission: "shared_companies" },
  { path: "logo-management", Component: LogoManagement, permission: "shared_companies" },
  { path: "printed-invoices-page", Component: PrintedInvoicesPage, permission: "printed_invoices_page" },
  { path: "payments-receipts-page", Component: PaymentsReceiptsPage, permission: "payments" },
  { path: "revenue", Component: Revenue, permission: "revenue" },
  { path: "municipality-stickers", Component: MunicipalityStickers, permission: "municipality_stickers" },
  { path: "municipality-stats", Component: MunicipalityStats, permission: "municipality_stats" },
  { path: "municipality-rent-prices", Component: MunicipalityRentPrices, permission: "municipality_rent_prices" },
  { path: "municipality-organizer", Component: MunicipalityBillboardOrganizer, permission: "municipality_organizer" },
  { path: "smart-distribution", Component: SmartDistribution, permission: "smart_distribution" },
  { path: "kpi-dashboard", Component: KpiDashboard, permission: "kpi_dashboard" },
  { path: "profitability-reports", Component: ProfitabilityReports, permission: "profitability_reports" },
  { path: "settings", Component: Settings, permission: "settings" },
  { path: "system-settings", Component: SystemSettings, permission: "system_settings" },
  { path: "print-design", Component: PrintSettingsPage, permission: "print_design" },
  { path: "design-studio", Component: DesignStudio, permission: "tasks" },
  { path: "contract-terms", Component: ContractTermsSettings, permission: "contract_terms" },
  { path: "pdf-templates", Component: PDFTemplateSettings, permission: "pdf_templates" },
  { path: "billboard-print-settings", Component: BillboardPrintSettingsNew, permission: "billboard_print_settings" },
  { path: "billboard-print-settings-old", Component: BillboardPrintSettings, permission: "billboard_print_settings" },
  { path: "quick-print-settings", Component: QuickPrintSettings, permission: "quick_print_settings" },
  
  { path: "database-backup", Component: DatabaseBackup, permission: "database_backup" },
  { path: "messaging-settings", Component: MessagingSettings, permission: "messaging_settings" },
  { path: "currency-settings", Component: CurrencySettings, permission: "currency_settings" },
  { path: "database-setup", Component: DatabaseSetup, permission: "database_setup" },
  { path: "image-gallery", Component: ImageGallery, permission: "image_gallery" },
  { path: "billboard-photos", Component: BillboardPhotosGallery, permission: "billboards" },
  { path: "bulk-whatsapp", Component: BulkWhatsApp, permission: "messaging_settings" },
  { path: "rephotography", Component: RephotographyBillboards, permission: "billboards" },
  { path: "activity-log", Component: ActivityLogPage, permission: "activity_log" },
  { path: "field-photos", Component: FieldPhotoGallery, permission: "billboards" },
  { path: "ai-assistant", Component: AiAssistant, permission: "ai_assistant" },
  { path: "site-appearance", Component: SiteAppearance, permission: "site_appearance" },
  { path: "font-settings", Component: FontSettings, permission: "site_appearance" },
  { path: "offline-setup", Component: OfflineSetup, permission: "database_setup" },
  { path: "export-content-settings", Component: ExportContentSettings, permission: "settings" },
  { path: "export-pricing", Component: ExportPricingList, permission: "pricing" },
  { path: "contract-closure-simulator", Component: ContractClosureSimulator, permission: "contracts" },
  { path: "drive-uploader", Component: GoogleDriveUploaderPage, permission: "settings" },
];

// ---- QueryClient with caching ----
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <PrintSettingsProvider>
            <SystemDialogProvider>
              <AppThemeLoader />
              <Toaster />
              <DesktopBackupNotifier />
              <LocalStackNotifier />
              <PrintPreviewDialog />
              <NetworkStatusNotifier />
              <PwaUpdatePrompt />
              
              <RouterComponent future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AuthProvider>
                  <SessionTimeoutGuard />
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
                      <Route path="/auth" element={<Navigate to="/" replace />} />

                      {/* Dashboard */}
                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute requiredPermission="dashboard">
                            <MainLayout><Dashboard /></MainLayout>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute requiredPermission="dashboard">
                            <MainLayout><Dashboard /></MainLayout>
                          </ProtectedRoute>
                        }
                      />

                      {/* Admin routes from config array */}
                      {adminRoutes.map(({ path, Component, permission }) => (
                        <Route
                          key={path}
                          path={`/admin/${path}`}
                          element={
                            <ProtectedRoute requiredPermission={permission}>
                              <MainLayout><Component /></MainLayout>
                            </ProtectedRoute>
                          }
                        />
                      ))}

                      {/* Catch-all */}
                      <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
                    </Routes>
                  </Suspense>
                </AuthProvider>
              </RouterComponent>
            </SystemDialogProvider>
          </PrintSettingsProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
