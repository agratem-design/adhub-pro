-- تحديث أسعار التركيب في جدول installation_print_pricing من جدول sizes
-- يجب تشغيل هذا السكريبت مرة واحدة لمزامنة الأسعار

DO $$
DECLARE
  size_record RECORD;
  updated_count INTEGER := 0;
BEGIN
  -- التحديث لكل حجم موجود
  FOR size_record IN 
    SELECT s.name, s.installation_price
    FROM sizes s
    WHERE s.installation_price IS NOT NULL
  LOOP
    UPDATE installation_print_pricing
    SET install_price = size_record.installation_price
    WHERE size = size_record.name;
    
    IF FOUND THEN
      updated_count := updated_count + 1;
      RAISE NOTICE 'Updated % to % د.ل', size_record.name, size_record.installation_price;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Total updated: % sizes', updated_count;
END $$;

-- عرض النتائج
SELECT 
  ipp.size,
  ipp.install_price as "سعر التركيب الحالي",
  s.installation_price as "سعر التركيب من sizes",
  CASE 
    WHEN ipp.install_price = s.installation_price THEN '✓ متطابق'
    ELSE '✗ مختلف'
  END as "الحالة"
FROM installation_print_pricing ipp
LEFT JOIN sizes s ON ipp.size = s.name
ORDER BY ipp.size;
