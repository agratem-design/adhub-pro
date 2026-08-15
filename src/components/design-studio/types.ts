export interface CanvasElement {
  id: string;
  type: 'text' | 'image' | 'icon';
  label: string;
  textKey: string;
  visible: boolean;
  fontSize: number;
  fontColor: string;
  fontWeight: string;
  alignment: 'left' | 'center' | 'right';
  x: number;
  y: number;
  customText?: string;
  fontFamily?: string;
  
  // Icon inside text element (group icon)
  icon?: string;
  iconColor?: string;
  iconSize?: number;
  iconBackground?: boolean;
  iconBgColor?: string;

  // Custom Image element
  url?: string;
  width?: number;
  height?: number;
  borderRadius?: number;

  // Custom Icon element
  iconName?: string;

  // Grouping
  groupId?: string;
  parentStrip?: 'panel' | 'location';

  // Composite multi-part text (e.g. "البلدية - المنطقة") with independent per-part styling
  parts?: {
    separator?: string;
    municipality?: { fontSize?: number; fontWeight?: string; fontColor?: string };
    region?: { fontSize?: number; fontWeight?: string; fontColor?: string };
  };
}

export interface ImageStyle {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  shadow: boolean;
  objectFit?: string;
}

export interface GlassPanelStyle {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  blur: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
  backgroundColor: string;
  shadow: boolean;
}

export interface CompanyInfo {
  name: string;
  subtitle: string;
  phone: string;
  website: string;
  logoUrl: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  canvas_width: number;
  canvas_height: number;
  bg_type: 'replica_blur' | 'solid' | 'gradient' | 'image';
  bg_color?: string;
  bg_image_url?: string;
  blur_amount: number;
  glass_panel_style: GlassPanelStyle & {
    locationStrip?: {
      visible: boolean;
      height: number;
      backgroundColor: string;
      textColor: string;
      fontSize: number;
      opacity?: number;
      blur?: number;
      borderWidth?: number;
      borderColor?: string;
      borderRadius?: number;
    };
    companyInfo?: CompanyInfo;
    layoutMode?: 'normal' | 'cover';
    coverTitle1?: string;
    coverTitle2?: string;
    coverBadge?: string;
    coverKicker?: string;
    coverCampaignName?: string;
    coverTagline?: string;
    coverCopyright?: string;
    coverFooterRight?: string;
    coverShow?: { clientInfo?: boolean; companyBrand?: boolean; kicker?: boolean; tagline?: boolean; badge?: boolean; copyright?: boolean; footerRight?: boolean; collage?: boolean };
  };
  text_elements: CanvasElement[];
  image_style: ImageStyle;
}

export interface GroupedContract {
  contract_id: string | number;
  taskIds: string[];
  teams: string[];
  created_at: string;
  customerName?: string;
  adType?: string;
  designImage?: string;
  totalItems?: number;
  photoItems?: number;
  photoStatus?: 'all' | 'partial' | 'none' | 'unknown';
}

export interface InstallationTask {
  id: string;
  contract_id: string | number;
  task_type: string;
  created_at: string;
  installation_teams: { team_name: string } | null;
}

export interface TaskItem {
  id: string;
  task_id: string;
  billboard_id: string | number;
  installation_date?: string;
  installed_image_url?: string;
  installed_image_face_a_url?: string;
  installed_image_face_b_url?: string;
  design_face_a?: string;
  design_face_b?: string;
}

export interface ItemDetails {
  customer_name: string;
  ad_type: string;
  municipality: string;
  region: string;
  landmark: string;
  billboard_code: string;
  size: string;
  installation_date: string;
  installed_image: string;
  installed_face_a: string;
  installed_face_b: string;
  company_name: string;
  company_subtitle: string;
  campaign_label: string;
  size_label: string;
  phone: string;
  website: string;
  [key: string]: string;
}
