# مراجعة مسارات PDF

الملف المرفق صفحة واحدة، وبياناته تؤكد أنه مولّد بواسطة jsPDF 4.2.1. محرك الفواتير يستخدم html2canvas؛ اختلاف المعاينة لا يعود إلى غياب المكتبة. ظهر في الملف غياب الشعار، ولا يمكن الجزم بسبب غيابه دون تشغيل بيانات الإيصال الفعلية في المتصفح.

## المسارات

- النافذة الموحدة: UnifiedPrintDialog → htmlToPdfBlobOptimized. أصبحت تستخدم HTML مستند المعاينة المحمّل عبر iframeToPdfBlobOptimized؛ التحميل والرفع وواتساب يشتركون في المسار نفسه.
- معاينة الطباعة العامة: PrintPreviewDialog → iframeToPdfBlob.
- فواتير المهام والتركيب: UnifiedTaskInvoice → saveHtmlDocAsPdf للتحميل، وhtmlToPdfBlob للإرسال.
- نافذة الطباعة المستقلة: printWindowHelper تحتوي محرك canvas وjsPDF مستقلًا.
- تقارير ReportView: saveHtmlAsPdf / html2pdf.
- تصدير مباشر مستقل: ContractPDFDialog، ModernPrintInvoiceDialog، SendAccountStatementDialog بنسختيه، BillboardPrintDialog، BillboardPrintIndividual، ContractInvoiceDialog، UnifiedPrintAllDialog، MunicipalityStickers، useAccountStatementPDF، SendTeamInstallationReportDialog، SendBillboardPDFWhatsApp.
- مشاركة مستندات اللوحات: PrintAllContractBillboardsDialog وpdfDriveWhatsApp يستخدمان htmlToPdfBlob.

قائمة الاستدعاءات الكاملة مع مواقعها في pdf-export-paths-2026-10-02.txt.

## التعديل والتحقق

أزيل فرض height:auto على جميع صور التصدير؛ كان يغيّر الأبعاد المعتمدة في المعاينة. يستخدم تصدير النافذة الموحدة المستند المحمّل، مع محرك التقسيم إلى صفحات، وهوامش إضافية صفرية لأن القالب يتضمن هوامشه. لم تُوحّد المسارات المستقلة كلها بعد. تم فحص PDF المرفق بصريًا، لكن لم يُنتج إيصال جديد من بيانات المستخدم للتحقق من التطابق النهائي.
