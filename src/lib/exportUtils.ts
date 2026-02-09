import { STATUS_LABELS, TYPE_LABELS } from './adminHelpers';
import { supabase } from './supabase';

interface ReportRow {
  report_number: string;
  report_type: string;
  description: string;
  location: string | null;
  status: string;
  created_at: string;
  points_awarded: number;
  employee?: { full_name: string; email: string; department?: string | null };
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(headers: string[], rows: string[][]): string {
  const bom = '\uFEFF';
  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvValue).join(','));
  return bom + [headerLine, ...dataLines].join('\n');
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportReportsCsv(reports: ReportRow[], filename?: string) {
  const employeeIds = [...new Set(reports.map(r => r.employee?.email).filter(Boolean))];
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', employeeIds);

  const employeeIdMap = new Map<string, string>();
  profilesData?.forEach(p => {
    employeeIdMap.set(p.email, p.id);
  });

  const employeeIdsArray = Array.from(new Set(Array.from(employeeIdMap.values())));
  const { data: pointsData } = await supabase
    .from('monthly_employee_points')
    .select('employee_id, total_points')
    .in('employee_id', employeeIdsArray);

  const pointsMap = new Map<string, number>();
  pointsData?.forEach((p) => {
    const current = pointsMap.get(p.employee_id) || 0;
    pointsMap.set(p.employee_id, current + (p.total_points || 0));
  });

  const headers = [
    'رقم البلاغ', 'النوع', 'الوصف', 'الموقع', 'الحالة',
    'اسم الموظف', 'البريد الإلكتروني', 'القسم', 'النقاط الكلية', 'تاريخ الإنشاء',
  ];

  const rows = reports.map((r) => {
    const employeeId = r.employee?.email ? employeeIdMap.get(r.employee.email) : null;
    const totalPoints = employeeId ? (pointsMap.get(employeeId) || 0) : 0;

    return [
      r.report_number,
      TYPE_LABELS[r.report_type] || r.report_type,
      r.description,
      r.location || '-',
      STATUS_LABELS[r.status] || r.status,
      r.employee?.full_name || '-',
      r.employee?.email || '-',
      r.employee?.department || '-',
      String(totalPoints),
      new Date(r.created_at).toLocaleDateString('ar-SA'),
    ];
  });

  const csv = buildCsv(headers, rows);
  const now = new Date();
  const defaultName = `تقرير_البلاغات_${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}.csv`;
  downloadCsv(csv, filename || defaultName);
}

interface EmployeeStatRow {
  name: string;
  email: string;
  department: string;
  totalReports: number;
  pending: number;
  inProgress: number;
  closed: number;
  points: number;
}

export function exportEmployeeStatsCsv(employees: EmployeeStatRow[]) {
  const headers = [
    'اسم الموظف', 'البريد الإلكتروني', 'القسم',
    'إجمالي البلاغات', 'قيد الانتظار', 'جاري العمل عليها', 'مغلق', 'النقاط',
  ];

  const rows = employees.map((e) => [
    e.name, e.email, e.department,
    String(e.totalReports), String(e.pending),
    String(e.inProgress), String(e.closed), String(e.points),
  ]);

  const csv = buildCsv(headers, rows);
  const now = new Date();
  downloadCsv(csv, `إحصائيات_الموظفين_${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}.csv`);
}

interface MonthlyRow {
  month: string;
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

export function exportMonthlyCsv(months: MonthlyRow[]) {
  const headers = [
    'الشهر', 'الإجمالي',
    'سلوك غير آمن', 'وضع غير آمن', 'حادث كاد أن يقع', 'ملاحظة عامة',
    'قيد الانتظار', 'جاري العمل عليها', 'مغلق',
  ];

  const rows = months.map((m) => [
    m.month, String(m.total),
    String(m.byType['unsafe_act'] || 0),
    String(m.byType['unsafe_condition'] || 0),
    String(m.byType['near_miss'] || 0),
    String(m.byType['observation'] || 0),
    String(m.byStatus['pending'] || 0),
    String(m.byStatus['in_progress'] || 0),
    String(m.byStatus['closed'] || 0),
  ]);

  const csv = buildCsv(headers, rows);
  const now = new Date();
  downloadCsv(csv, `تقرير_شهري_${now.getFullYear()}.csv`);
}
