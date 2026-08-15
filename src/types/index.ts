export interface Billboard {
  // Supabase/legacy fields (required fields)
  ID: number;
  Billboard_Name: string;
  City: string;
  District: string;
  Size: string;
  Status: string;
  Price: string;
  Level: string;
  Image_URL: string;
  GPS_Coordinates: string;
  GPS_Link: string;
  Nearest_Landmark: string;
  Faces_Count: string;
  
  // Optional Supabase fields
  Municipality?: string;
  Contract_Number?: number;
  Customer_Name?: string;
  Rent_Start_Date?: string;
  Rent_End_Date?: string;
  Days_Count?: string;
  Review?: string;
  Category_Level?: string;
  Ad_Type?: string;
  Order_Size?: number | string;
  '@IMAGE'?: string;
  GPS_Link_Click?: string;
  'المقاس مع الدغاية'?: string;

  // App-level normalized fields (all optional for compatibility)
  id?: string;
  name?: string;
  location?: string;
  size?: string;
  price?: number;
  installationPrice?: number;
  status?: 'available' | 'rented' | 'maintenance';
  city?: string;
  district?: string;
  municipality?: string;
  coordinates?: { lat: number; lng: number } | string;
  image?: string;
  description?: string;
  contractNumber?: string;
  clientName?: string;
  expiryDate?: string;
  nearExpiry?: boolean;
  remainingDays?: number;
  adType?: string;
  level?: string;
}

export interface Contract {
  id?: number;
  Contract_Number?: string | number;
  'Contract Number'?: string;
  'Customer Name'?: string;
  'Contract Date'?: string;
  Duration?: string;
  'End Date'?: string;
  'Ad Type'?: string;
  'Total Rent'?: number;
  'Installation Cost'?: number;
  Total?: string;
  'Payment 1'?: string;
  'Payment 2'?: string;
  'Payment 3'?: string;
  'Total Paid'?: string;
  Remaining?: string;
  Level?: string;
  Phone?: string;
  Company?: string;
  'Print Status'?: string;
  Discount?: number;
  'Renewal Status'?: string;
  'Actual 3% Fee'?: string;
  '3% Fee'?: string;
  // Database schema fields
  customer_name?: string;
  start_date?: string;
  end_date?: string;
  rent_cost?: number;
  status?: string;
}

export interface ContractData {
  id?: string;
  Contract_Number?: string;
  customer_name?: string;
  'Customer Name'?: string;
  ad_type?: string;
  'Ad Type'?: string;
  start_date?: string;
  'Contract Date'?: string;
  end_date?: string;
  'End Date'?: string;
  rent_cost?: number;
  'Total Rent'?: number;
  billboards?: any[];
  phoneNumber?: string;
  duration_months?: number;
}

export interface Pricing {
  id?: number;
  size: string;
  Billboard_Level: string;
  Customer_Category: string;
  One_Day: number | null;
  One_Month: number | null;
  '2_Months': number | null;
  '3_Months': number | null;
  '6_Months': number | null;
  Full_Year: number | null;
}

export interface BookingRequest {
  id: string;
  userId: string;
  billboards: Billboard[];
  totalPrice: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  notes?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'customer' | 'admin' | 'user';
  company?: string;
  pricingCategory?: string | null;
  allowedCustomers?: string[] | null;
  price_tier?: string | null;
  allowed_clients?: string[] | null;
  pricing_category?: string | null;
  allowed_customers?: string[] | null;
}

export interface PricingConfig {
  rentPrices: Record<string, number>;
  installationPrices: Record<string, number>;
}
