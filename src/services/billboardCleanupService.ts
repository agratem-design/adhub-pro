import { supabase } from "@/integrations/supabase/client";

export interface ExpiredBillboard {
  ID: number;
  Billboard_Name: string;
  Status: string;
  Contract_Number: number;
  Customer_Name: string;
  Rent_End_Date: string;
  Rent_Start_Date: string;
  days_past_rent_end: number;
  issue_type: 'expired' | 'future_dates' | 'invalid_dates';
}

export class BillboardCleanupService {
  /**
   * جلب جميع اللوحات المنتهية الصلاحية والمشكوك فيها
   */
  static async getExpiredBillboards(): Promise<ExpiredBillboard[]> {
    try {
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .eq('Status', 'rented')
        .not('Rent_End_Date', 'is', null);

      if (error) {
        console.error('Error fetching billboards:', error);
        throw error;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // فلترة اللوحات المنتهية الصلاحية والمشكوك فيها
      const problematicBillboards = (data || [])
        .map(billboard => {
          if (!billboard.Rent_End_Date) return null;
          
          const endDate = new Date(billboard.Rent_End_Date);
          const startDate = billboard.Rent_Start_Date ? new Date(billboard.Rent_Start_Date) : null;
          
          let issueType: 'expired' | 'future_dates' | 'invalid_dates' = 'expired';
          let daysPastEnd = 0;

          // التحقق من التواريخ المستقبلية المشكوك فيها
          if (startDate && startDate > today && endDate > today) {
            // العقد في المستقبل لكن اللوحة تظهر كمنتهية - مشكلة في البيانات
            issueType = 'future_dates';
            daysPastEnd = 0;
          } else if (endDate < today) {
            // العقد منتهي فعلاً
            issueType = 'expired';
            daysPastEnd = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
          } else if (!startDate || isNaN(endDate.getTime())) {
            // تواريخ غير صالحة
            issueType = 'invalid_dates';
            daysPastEnd = 0;
          } else {
            // العقد ما زال ساري - لا يجب أن يظهر هنا
            return null;
          }

          return {
            ID: billboard.ID,
            Billboard_Name: billboard.Billboard_Name,
            Status: billboard.Status,
            Contract_Number: billboard.Contract_Number,
            Customer_Name: billboard.Customer_Name,
            Rent_End_Date: billboard.Rent_End_Date,
            Rent_Start_Date: billboard.Rent_Start_Date || '',
            days_past_rent_end: daysPastEnd,
            issue_type: issueType
          };
        })
        .filter(billboard => billboard !== null);

      return problematicBillboards;
    } catch (error) {
      console.error('Error in getExpiredBillboards:', error);
      throw error;
    }
  }

  /**
   * جلب اللوحات ذات التواريخ المستقبلية المشكوك فيها
   */
  static async getFutureDateBillboards(): Promise<ExpiredBillboard[]> {
    try {
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .eq('Status', 'rented')
        .not('Rent_Start_Date', 'is', null)
        .not('Rent_End_Date', 'is', null);

      if (error) {
        console.error('Error fetching future date billboards:', error);
        throw error;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // البحث عن اللوحات ذات التواريخ المستقبلية المشكوك فيها
      const futureDateBillboards = (data || [])
        .filter(billboard => {
          if (!billboard.Rent_Start_Date || !billboard.Rent_End_Date) return false;
          
          const startDate = new Date(billboard.Rent_Start_Date);
          const endDate = new Date(billboard.Rent_End_Date);
          
          // إذا كانت التواريخ في المستقبل لكن اللوحة تظهر كمشغولة
          return startDate > today && endDate > today;
        })
        .map(billboard => ({
          ID: billboard.ID,
          Billboard_Name: billboard.Billboard_Name,
          Status: billboard.Status,
          Contract_Number: billboard.Contract_Number,
          Customer_Name: billboard.Customer_Name,
          Rent_End_Date: billboard.Rent_End_Date,
          Rent_Start_Date: billboard.Rent_Start_Date,
          days_past_rent_end: 0,
          issue_type: 'future_dates' as const
        }));

      return futureDateBillboards;
    } catch (error) {
      console.error('Error in getFutureDateBillboards:', error);
      throw error;
    }
  }

  /**
   * تنظيف جميع اللوحات المنتهية الصلاحية
   */
  static async cleanupAllExpiredBillboards(): Promise<number> {
    try {
      const expiredBillboards = await this.getExpiredBillboards();
      
      if (expiredBillboards.length === 0) {
        return 0;
      }

      const billboardIds = expiredBillboards.map(b => b.ID);
      
      const { error } = await supabase
        .from('billboards')
        .update({
          Status: 'available',
          Contract_Number: null,
          Customer_Name: null,
          Rent_Start_Date: null,
          Rent_End_Date: null
        })
        .in('ID', billboardIds);

      if (error) {
        console.error('Error cleaning up billboards:', error);
        throw error;
      }

      // تسجيل عملية التنظيف
      await this.logCleanupOperation(expiredBillboards.length, 'manual');

      return expiredBillboards.length;
    } catch (error) {
      console.error('Error in cleanupAllExpiredBillboards:', error);
      throw error;
    }
  }

  /**
   * تنظيف لوحة واحدة
   */
  static async cleanupSingleBillboard(billboardId: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('billboards')
        .update({
          Status: 'available',
          Contract_Number: null,
          Customer_Name: null,
          Rent_Start_Date: null,
          Rent_End_Date: null
        })
        .eq('ID', billboardId);

      if (error) {
        console.error('Error cleaning single billboard:', error);
        throw error;
      }

      // تسجيل عملية التنظيف
      await this.logCleanupOperation(1, 'manual');
    } catch (error) {
      console.error('Error in cleanupSingleBillboard:', error);
      throw error;
    }
  }

  /**
   * البحث عن لوحة محددة بالاسم أو رقم العقد
   */
  static async searchBillboard(searchTerm: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .or(`Billboard_Name.ilike.%${searchTerm}%,Contract_Number.eq.${searchTerm}`);

      if (error) {
        console.error('Error searching billboard:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in searchBillboard:', error);
      throw error;
    }
  }

  /**
   * تسجيل عملية التنظيف
   */
  private static async logCleanupOperation(
    billboardsCount: number, 
    cleanupType: 'manual' | 'automatic'
  ): Promise<void> {
    try {
      // التحقق من وجود جدول السجلات
      const { error: insertError } = await supabase
        .from('cleanup_logs')
        .insert({
          cleanup_date: new Date().toISOString(),
          billboards_cleaned: billboardsCount,
          cleanup_type: cleanupType,
          notes: cleanupType === 'manual' ? 'Manual cleanup via admin panel' : 'Automatic daily cleanup'
        });

      if (insertError) {
        console.warn('Could not log cleanup operation:', insertError);
        // لا نرمي خطأ هنا لأن التسجيل اختياري
      }
    } catch (error) {
      console.warn('Error logging cleanup operation:', error);
    }
  }

  /**
   * جلب سجلات التنظيف الأخيرة
   */
  static async getCleanupLogs(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('cleanup_logs')
        .select('*')
        .order('cleanup_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching cleanup logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCleanupLogs:', error);
      return [];
    }
  }
}