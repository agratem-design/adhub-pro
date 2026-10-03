# تدقيق ارتباط إعدادات الطباعة بالفواتير والإيصالات

تاريخ الفحص: 1 أكتوبر 2026.

## النتيجة
إعدادات الطباعة مرتبطة بمسارات رئيسية عديدة، لكنها ليست المصدر الوحيد الذي يحدد النتيجة النهائية. توجد طبقة مشتركة تتجاوز إعدادات النوع، وتجاوزات صريحة داخل قوالب نشطة، وحقول محفوظة لا تُستهلك في بعض مولدات الطباعة. لا يصح وصف النظام الحالي بأنه خاضع بالكامل للإعدادات.

## نطاق التحقق
مراجعة صفحة الإعدادات الفعلية المرتبطة بالمسار print-design، متجر الإعدادات، جسر تحويل الإعدادات، القاعدة المشتركة للفواتير، مولد المقاسات، وقوالب الفواتير والإيصالات ومراجع استدعائها. تشغيل 4 ملفات اختبارات تضم 12 اختبارًا، جميعها نجحت. لم تُقرأ القيم الحية من قاعدة البيانات ولم تُختبر كل الأزرار على النسخة المنشورة. لا تتضمن هذه المهمة تعديلًا لسلوك الطباعة.

## مسار الإعدادات
صفحة الإعدادات تحفظ في print_settings. بعض القوالب تقرأ عبر متجر React وusePrintTheme، وأخرى عبر getMergedInvoiceStylesAsync وجسر invoicePrintSettingsBridge. يوجد ربط لـ18 نوعًا في الجسر. كلا المسارين يطبقان applyOfficialInvoiceTemplate، الذي يجعل payment_receipt مصدر الحقول المشتركة.

## النتائج المؤكدة

1. **أولوية تصميم إيصال الاستلام تتجاوز تصميم النوع.** الدمج هو: الافتراضيات، ثم إعدادات المستند، ثم النمط المرجعي الثابت، ثم إعدادات إيصال الاستلام. لذلك قد تُحفظ ألوان أو خطوط لنوع معين ثم تُستبدل عند القراءة. المرجع: [src/lib/officialInvoiceTemplate.ts:43](<E:/adhub-pro-main (4)/adhub-pro-main/src/lib/officialInvoiceTemplate.ts:43>) و[src/store/printSettingsStore.ts:104](<E:/adhub-pro-main (4)/adhub-pro-main/src/store/printSettingsStore.ts:104>).

2. **الأسود الصريح يُحوَّل إلى عاجي.** إذا كان header_bg_color في التصميم المشترك #000 أو #000000، تُستبدل القيمة بـ#fffdf8. هذه ليست قيمة افتراضية عند الغياب، بل تغيير لاختيار محفوظ. المرجع: [src/lib/officialInvoiceTemplate.ts:48](<E:/adhub-pro-main (4)/adhub-pro-main/src/lib/officialInvoiceTemplate.ts:48>).

3. **الحفظ الفردي يحدّث التصميم المشترك أيضًا.** saveSettings يحفظ سجل النوع ومعه سجل payment_receipt عند تعديل نوع آخر، وينسخ إليه الحقول المشتركة. لذلك تغيير تصميم فاتورة المبيعات مثلًا قد يؤثر في المشتريات والعقود والإيصالات. المرجع: [src/store/printSettingsStore.ts:371](<E:/adhub-pro-main (4)/adhub-pro-main/src/store/printSettingsStore.ts:371>). هذا السلوك مثبت باختبار الحفظ الموجود.

4. **الثوابت موجودة حتى في القاعدة المشتركة.** حدود الترويسة وألوان بيانات المستند وأحجامها ثابتة في unifiedHeaderFooterCss، بما فيها #e8dfcc و#8a806d و#211d15. إعدادات لون وخلفية ومحاذاة بيانات المستند لا تصل إلى هذا الجزء عبر الجسر. المرجع: [src/lib/unifiedInvoiceBase.ts:719](<E:/adhub-pro-main (4)/adhub-pro-main/src/lib/unifiedInvoiceBase.ts:719>) و[src/lib/unifiedInvoiceBase.ts:772](<E:/adhub-pro-main (4)/adhub-pro-main/src/lib/unifiedInvoiceBase.ts:772>).

5. **هوامش الطباعة الفعلية تتجاوز الهوامش المحفوظة في مولد المقاسات.** إعدادات الصفحة تُقرأ في config، لكن @media print يفرض هامش صفحة 10mm وحشو حاوية 5mm. كشف الدفعات يضيف تجاوزًا خاصًا للطباعة الأفقية. المرجع: [src/lib/printMeasurementsHTML.ts:591](<E:/adhub-pro-main (4)/adhub-pro-main/src/lib/printMeasurementsHTML.ts:591>) و[src/components/billing/PaymentsStatementPrintDialog.tsx:265](<E:/adhub-pro-main (4)/adhub-pro-main/src/components/billing/PaymentsStatementPrintDialog.tsx:265>).

6. **إيصال الدفعة الموزعة مرتبط بالألوان، لكن الأحجام ليست كلها مرتبطة.** الترويسة والجداول وملخص الرصيد تستمد الألوان من config. أحجام خط الجدول 12px والعناوين 16px والمبلغ 24px، وخط الأرقام، مثبتة في قالب الإيصال؛ تغيير totals_value_font_size أو font_family لا يتحكم بكل هذه العناصر. المرجع: [src/components/billing/UnifiedReceiptPrint.tsx:468](<E:/adhub-pro-main (4)/adhub-pro-main/src/components/billing/UnifiedReceiptPrint.tsx:468>). كشف الدفعات كذلك يفرض خط Tajawal وحجم الجدول وحشوه بعد قراءة الإعدادات.

7. **إيصالات نشطة تقرأ إعدادات نوع آخر وتحتوي ألوانًا ثابتة.** إيصال فريق التركيب يستدعي receipt بدل team_payment، مع أن الجسر يدعم team_payment. كما يثبت خطًا ولون المبلغ #FFD700. إيصال العهدة يستدعي custody، المرتبط بكشف العهدة، ويثبت لون المبلغ الذهبي أيضًا. المراجع: [src/components/teams/TeamPaymentReceiptDialog.tsx:64](<E:/adhub-pro-main (4)/adhub-pro-main/src/components/teams/TeamPaymentReceiptDialog.tsx:64>) و[src/components/teams/TeamPaymentReceiptDialog.tsx:252](<E:/adhub-pro-main (4)/adhub-pro-main/src/components/teams/TeamPaymentReceiptDialog.tsx:252>) و[src/components/custody/CustodyReceiptPrint.tsx:58](<E:/adhub-pro-main (4)/adhub-pro-main/src/components/custody/CustodyReceiptPrint.tsx:58>) و[src/components/custody/CustodyReceiptPrint.tsx:153](<E:/adhub-pro-main (4)/adhub-pro-main/src/components/custody/CustodyReceiptPrint.tsx:153>). مراجع استخدامهما موجودة في InstallationTeamAccounts وCustodyManagement.

8. **معاينة صفحة الإعدادات ليست ضمانًا لمطابقة كل الفواتير.** المعاينة تستخدم generateMeasurementsHTML وبيانات تجريبية، بينما فواتير عديدة تستخدم unifiedInvoiceBase أو قوالب خاصة. وقد تطبق القوالب تجاوزات بعد قراءة الإعدادات. المرجع: [src/components/print-design/PrintEnginePreview.tsx:235](<E:/adhub-pro-main (4)/adhub-pro-main/src/components/print-design/PrintEnginePreview.tsx:235>).

9. **ربط عرض السعر يحتاج تصحيحًا.** generateQuoteHTML يطلب resolveInvoiceStyles('contract') بدل offer؛ لذلك إعدادات quotation الخاصة لا تكون مصدره المباشر. المرجع: [src/lib/quoteGenerator.ts:121](<E:/adhub-pro-main (4)/adhub-pro-main/src/lib/quoteGenerator.ts:121>).

10. **حقول ظاهرة في الإعدادات غير مطبقة في بعض المسارات.** show_document_number وshow_document_date وdate_format وdocument_info_* موجودة في PrintSettings، لكن مولد المقاسات يبني رقم المستند والتاريخ مباشرة ولا يفحص حقول الإخفاء. config.notes كذلك يثبت ألوان الملاحظات وأحجامها بدل ربطها بخصائص الملاحظات. المراجع: [src/lib/printMeasurementsHTML.ts:681](<E:/adhub-pro-main (4)/adhub-pro-main/src/lib/printMeasurementsHTML.ts:681>) و[src/lib/printMeasurementsConfig.ts:168](<E:/adhub-pro-main (4)/adhub-pro-main/src/lib/printMeasurementsConfig.ts:168>).

## تغطية المسارات
| المسار | مصدر الإعدادات | الحكم |
|---|---|---|
| مبيعات / مشتريات / عقد / خدمات الطباعة | resolveInvoiceStyles ثم الجسر والقاعدة المشتركة | مرتبط، مع أولوية التصميم المشترك وثوابت في القاعدة |
| الإيصال الموحد للدفعة الموزعة | usePrintSettingsByType ثم مولد المقاسات | الألوان مرتبطة؛ بعض الخطوط والأحجام مثبتة |
| كشف الدفعات والإيصالات | إعدادات payment_receipt ثم مولد المقاسات | مرتبط، مع تجاوزات تخطيط وخط وهوامش |
| فواتير المهام المجمعة | getMergedInvoiceStylesAsync('composite_task') ثم قالب خاص | ارتباط جزئي؛ توجد ألوان وأحجام ثابتة في القالب |
| إيصال فريق التركيب | receipt | مرتبط بالنوع غير المناسب، مع ثوابت |
| إيصال العهدة | custody | مرتبط بإعدادات الكشف، مع ثوابت |
| عرض السعر عبر quoteGenerator | contract | مرتبط بإعدادات العقد بدل عرض السعر |

توجد ملفات أخرى ذات تنسيق مستقل، منها ExpensesPrintDialog وPrintInstallationInvoice، لكن لم يظهر استدعاء نشط لها في البحث، لذلك لا تُعد دليلًا على سلوك واجهة مستخدمة حاليًا دون تتبع إضافي.

## ترتيب الإصلاح المقترح
1. تحديد أولوية واضحة: إعدادات مشتركة عامة، ثم إعدادات خاصة لكل نوع؛ ومنع تحويل اللون الأسود أو استبدال قيمة محفوظة بالنمط المرجعي.
2. فصل الحفظ الفردي عن تطبيق التصميم على الجميع، وتوضيح العملية في الواجهة.
3. تصحيح مفاتيح الأنواع للإيصالات وعرض السعر.
4. ربط الألوان والخطوط والأحجام والهوامش وخيارات الإخفاء الفعلية بالإعدادات، بما فيها القوالب الخاصة.
5. جعل المعاينة تستخدم مولد كل نوع الحقيقي، وإضافة اختبارات تغيير إعدادات ثم فحص مخرجات الطباعة الفعلية لكل نوع.

القيم الافتراضية عند غياب الإعداد مقبولة؛ المشكلة هي الثوابت التي تستبدل قيمة محفوظة أو تجعل خيارًا ظاهرًا غير مؤثر.
