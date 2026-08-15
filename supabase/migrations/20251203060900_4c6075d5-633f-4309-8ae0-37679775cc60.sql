-- حذف الـ trigger الذي يسبب مشكلة ambiguous billboard_id
DROP TRIGGER IF EXISTS trigger_cleanup_billboard_on_contract_delete ON "Contract";

-- حذف الدالة المرتبطة به
DROP FUNCTION IF EXISTS cleanup_billboard_on_contract_delete();