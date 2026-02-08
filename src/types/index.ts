export type UserRole = 'employee' | 'admin';

export type ReportType = 'unsafe_act' | 'unsafe_condition' | 'near_miss' | 'observation';

export type ReportStatus = 'pending' | 'in_review' | 'action_taken' | 'closed';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department: string | null;
  points: number;
  created_at: string;
  updated_at: string;
}

export interface SafetyReport {
  id: string;
  report_number: string;
  employee_id: string;
  report_type: ReportType;
  description: string;
  location: string | null;
  status: ReportStatus;
  points_awarded: number;
  resolved_by_id: string | null;
  resolved_by_name: string | null;
  created_at: string;
  updated_at: string;
  synced: boolean;
  employee?: Profile;
  images?: ReportImage[];
  responses?: ReportResponse[];
}

export interface ReportImage {
  id: string;
  report_id: string;
  image_url: string;
  created_at: string;
}

export interface ReportResponse {
  id: string;
  report_id: string;
  admin_id: string;
  response_text: string;
  corrective_action: string | null;
  created_at: string;
  admin?: Profile;
  images?: ResponseImage[];
}

export interface ResponseImage {
  id: string;
  response_id: string;
  image_url: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'report_update' | 'response_added' | 'status_changed';
  report_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface PendingReport {
  id: string;
  report_type: ReportType;
  description: string;
  location: string | null;
  images: string[];
  created_at: string;
}

export interface DashboardStats {
  total_reports: number;
  monthly_reports: number;
  pending_reports: number;
  points: number;
  rank?: number;
}

export interface AdminStats {
  total_reports: number;
  today_reports: number;
  monthly_reports: number;
  pending_reports: number;
  by_type: Record<ReportType, number>;
  by_status: Record<ReportStatus, number>;
  top_locations: Array<{ location: string; count: number }>;
  top_employees: Array<{ employee: Profile; count: number }>;
}

export interface LeaderboardEntry {
  profile: Profile;
  report_count: number;
  rank: number;
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  unsafe_act: 'سلوك غير آمن',
  unsafe_condition: 'وضع غير آمن',
  near_miss: 'حادث كاد أن يقع',
  observation: 'ملاحظة عامة',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'قيد الانتظار',
  in_review: 'قيد المراجعة',
  action_taken: 'تم اتخاذ إجراء',
  closed: 'مغلق',
};

export const POINTS_CONFIG = {
  REPORT_MIN: 1,
  REPORT_MAX: 3,
  RESOLVER_SELF_BONUS: 1,
  RESOLVER_OTHER_BONUS: 2,
};
