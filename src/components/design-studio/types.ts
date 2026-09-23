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

  // Text background / Pill options (خلفية كبسولة أو شارة مخصصة للنص)
  textBackground?: boolean;
  textBgColor?: string;
  textBgPaddingX?: number;
  textBgPaddingY?: number;
  textBgRadius?: number;
  textBgBorder?: string;
  textBgBlur?: number;
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
  bgMode?: 'color' | 'image';
  bgImageUrl?: string;
  bgObjectFit?: 'fill' | 'cover' | 'contain';
  bgFlipY?: boolean;
  bgScale?: number;
  bgOffsetY?: number;
  showDividers?: boolean;
  dividerColor?: string;
}

export interface CompanyInfo {
  name: string;
  subtitle: string;
  phone: string;
  website: string;
  logoUrl: string;
}

export interface LocationStripStyle {
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
  bgMode?: 'color' | 'image';
  bgImageUrl?: string;
  bgObjectFit?: 'cover' | 'contain' | 'fill';
  showPinIcon?: boolean;
  textColorTheme?: string;
  x?: number;
  offsetY?: number;
  width?: number;
  bgFlipY?: boolean;
  bgScale?: number;
  bgOffsetY?: number;
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
    locationStrip?: LocationStripStyle;
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
  team_id?: string | null;
  team_name?: string;
  reinstallation_number?: number | null;
  status?: string;
  taskDesignImage?: string;
  totalItems?: number;
  photoItems?: number;
  installation_teams?: { team_name: string } | null;
  Contract?: any;
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
  
  // صور التركيب الميدانية (Installation Photos)
  installed_image: string;
  installed_face_a: string;
  installed_face_b: string;
  
  // تصاميم الإعلان الجرافيكية (Design Artworks)
  design_face_a?: string;
  design_face_b?: string;
  design_cutout?: string;
  design_main?: string;

  company_name: string;
  company_subtitle: string;
  campaign_label: string;
  size_label: string;
  phone: string;
  website: string;
  [key: string]: any;
}

export type ImageSourceType =
  | 'installed_face_a'
  | 'installed_face_b'
  | 'installed'
  | 'design_face_a'
  | 'design_face_b'
  | 'design_cutout'
  | 'face_a'
  | 'face_b';

export interface CompositeStudioTask {
  id: string;
  task_number: number;
  contract_id: number;
  contract_ids?: number[];
  customer_id?: string | null;
  customer_name?: string | null;
  task_type: 'new_installation' | 'reinstallation' | string;
  installation_task_id: string;
  print_task_id?: string | null;
  cutout_task_id?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  adType?: string;
  teamName?: string;
  printerName?: string;
  designImage?: string;
  installedImage?: string;
  totalBillboards?: number;
  completedBillboards?: number;
  photoStatus?: 'all' | 'partial' | 'none' | 'unknown';
}
