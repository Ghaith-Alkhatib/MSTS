import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, FileText, CheckCircle,
  Users, Calendar, Download, Minus, ChevronDown, ChevronUp, X, Eye,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SafetyReport } from '../../types';
import {
  STATUS_LABELS, TYPE_LABELS, TYPE_BAR_COLORS,
  STATUS_DOT_COLORS, MONTH_NAMES_AR,
} from '../../lib/adminHelpers';
import { exportReportsCsv, exportMonthlyCsv } from '../../lib/exportUtils';

interface Report {
  id: string;
  report_number: string;
  report_type: string;
  description: string;
  location: string | null;
  status: string;
  created_at: string;
  points_awarded: number;
  employee_id: string;
  employee: { full_name: string; email: string; department: string | null };
}

export function AdminAnalytics({ onViewReport }: { onViewReport: (report: SafetyReport) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    const { data, error } = await supabase
      .from('safety_reports')
      .select('*, employee:profiles!safety_reports_employee_id_fkey(full_name, email, department)')
      .order('created_at', { ascending: false });
    if (!error && data) setReports(data as Report[]);
    setIsLoading(false);
  };

  const yearReports = useMemo(
    () => reports.filter((r) => new Date(r.created_at).getFullYear() === selectedYear),
    [reports, selectedYear]
  );

  const availableYears = useMemo(() => {
    const years = new Set(reports.map((r) => new Date(r.created_at).getFullYear()));
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [reports]);

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const monthReports = yearReports.filter((r) => new Date(r.created_at).getMonth() === m);
      const byType: Record<string, number> = {};
      monthReports.forEach((r) => { byType[r.report_type] = (byType[r.report_type] || 0) + 1; });
      return { month: m, label: MONTH_NAMES_AR[m], total: monthReports.length, byType };
    });
  }, [yearReports]);

  const maxMonthly = useMemo(() => Math.max(...monthlyData.map((d) => d.total), 1), [monthlyData]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = yearReports.filter((r) => new Date(r.created_at).getMonth() === now.getMonth());
    const prevMonth = yearReports.filter((r) => new Date(r.created_at).getMonth() === now.getMonth() - 1);
    const growth = prevMonth.length > 0
      ? Math.round(((thisMonth.length - prevMonth.length) / prevMonth.length) * 100)
      : thisMonth.length > 0 ? 100 : 0;

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    yearReports.forEach((r) => {
      byType[r.report_type] = (byType[r.report_type] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });

    const closedCount = byStatus['closed'] || 0;
    const resolutionRate = yearReports.length > 0 ? Math.round((closedCount / yearReports.length) * 100) : 0;

    const employeeReportCounts: Record<string, { name: string; department: string | null; count: number; months: Set<number> }> = {};
    reports.forEach((r) => {
      if (!employeeReportCounts[r.employee_id]) {
        employeeReportCounts[r.employee_id] = { name: r.employee?.full_name || '', department: r.employee?.department, count: 0, months: new Set() };
      }
      employeeReportCounts[r.employee_id].count++;
      employeeReportCounts[r.employee_id].months.add(new Date(r.created_at).getMonth());
    });

    const topEmployees = Object.entries(employeeReportCounts)
      .map(([id, data]) => ({ id, ...data, monthsList: Array.from(data.months) }))
      .sort((a, b) => b.count - a.count);

    const totalEmployees = new Set(reports.map((r) => r.employee_id)).size;

    return { total: reports.length, thisMonth: thisMonth.length, growth, byType, byStatus, resolutionRate, topEmployees, totalEmployees };
  }, [yearReports, reports]);

  const handleExportAll = () => exportReportsCsv(yearReports, `تقرير_${selectedYear}.csv`);
  const handleExportMonthly = () => {
    exportMonthlyCsv(monthlyData.map((m) => ({
      month: m.label + ' ' + selectedYear, total: m.total, byType: m.byType, byStatus: {},
    })));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">الإحصائيات والتحليلات</h2>
          <p className="text-gray-500 mt-1">نظرة شاملة على أداء نظام السلامة</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            {availableYears.map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
          <button onClick={handleExportAll} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors">
            <Download className="w-4 h-4" />تصدير الكل
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="إجمالي البلاغات" value={stats.total} icon={<FileText className="w-6 h-6" />} color="bg-blue-50 text-blue-600" />
        <StatCard label="بلاغات هذا الشهر" value={stats.thisMonth} icon={<Calendar className="w-6 h-6" />} color="bg-teal-50 text-teal-600" trend={stats.growth} />
        <StatCard label="نسبة الإنجاز" value={`${stats.resolutionRate}%`} icon={<CheckCircle className="w-6 h-6" />} color="bg-green-50 text-green-600" />
        <button onClick={() => setShowEmployeeModal(true)} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-right hover:ring-2 hover:ring-orange-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600"><Users className="w-6 h-6" /></div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalEmployees}</p>
          <p className="text-sm text-gray-500 mt-1">الموظفون المبلّغون</p>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900">البلاغات الشهرية - {selectedYear}</h3>
            <button onClick={handleExportMonthly} className="text-sm text-gray-500 hover:text-teal-600 flex items-center gap-1"><Download className="w-4 h-4" />تصدير</button>
          </div>
          <div className="flex items-end gap-2 h-56">
            {monthlyData.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-gray-700">{m.total || ''}</span>
                <div className="w-full flex flex-col items-center">
                  <div className="w-full max-w-[32px] bg-blue-500 rounded-t-md transition-all duration-500 hover:bg-blue-600" style={{ height: `${(m.total / maxMonthly) * 180}px`, minHeight: m.total > 0 ? 4 : 0 }} />
                </div>
                <span className="text-[10px] text-gray-500 mt-1">{m.label.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-5">حسب النوع</h3>
          <div className="space-y-4">
            {Object.entries(stats.byType).sort(([, a], [, b]) => b - a).map(([type, count]) => {
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{TYPE_LABELS[type] || type}</span>
                    <span className="font-semibold text-gray-900">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all duration-700 ${TYPE_BAR_COLORS[type] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(stats.byType).length === 0 && <p className="text-gray-400 text-center py-4">لا توجد بيانات</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-5">حسب الحالة</h3>
          <div className="space-y-3">
            {Object.entries(stats.byStatus).sort(([, a], [, b]) => b - a).map(([status, count]) => {
              const pct = yearReports.length > 0 ? Math.round((count / yearReports.length) * 100) : 0;
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${STATUS_DOT_COLORS[status] || 'bg-gray-400'}`} />
                  <span className="text-sm text-gray-700 flex-1">{STATUS_LABELS[status] || status}</span>
                  <span className="text-sm font-bold text-gray-900">{count}</span>
                  <div className="w-24 bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all duration-500 ${STATUS_DOT_COLORS[status] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-10 text-left">{pct}%</span>
                </div>
              );
            })}
            {Object.keys(stats.byStatus).length === 0 && <p className="text-gray-400 text-center py-4">لا توجد بيانات</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-5">ملخص الأداء</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-5 bg-green-50 rounded-xl">
              <p className="text-3xl font-bold text-green-700">{stats.resolutionRate}%</p>
              <p className="text-sm text-green-600 mt-1">نسبة الإنجاز</p>
            </div>
            <div className="text-center p-5 bg-orange-50 rounded-xl">
              <p className="text-3xl font-bold text-orange-700">{yearReports.length > 0 ? (yearReports.length / 12).toFixed(1) : 0}</p>
              <p className="text-sm text-orange-600 mt-1">متوسط شهرياً</p>
            </div>
            <div className="text-center p-5 bg-blue-50 rounded-xl">
              <p className="text-3xl font-bold text-blue-700">{stats.totalEmployees}</p>
              <p className="text-sm text-blue-600 mt-1">موظفين مبلّغين</p>
            </div>
          </div>
        </div>
      </div>

      {showEmployeeModal && (
        <EmployeeReportingModal employees={stats.topEmployees} onClose={() => setShowEmployeeModal(false)} reports={reports} onViewReport={onViewReport} />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, trend }: { label: string; value: number | string; icon: React.ReactNode; color: string; trend?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-50 text-green-700' : trend < 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function EmployeeReportingModal({ employees, onClose, reports, onViewReport }: {
  employees: Array<{ id: string; name: string; department: string | null; count: number; monthsList: number[] }>;
  onClose: () => void;
  reports: Report[];
  onViewReport: (report: SafetyReport) => void;
}) {
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">الموظفون المبلّغون ({employees.length})</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="overflow-y-auto max-h-[70vh] p-5 space-y-3">
          {employees.map((emp) => {
            const isExpanded = expandedEmp === emp.id;
            const empReports = reports.filter((r) => r.employee_id === emp.id);
            return (
              <div key={emp.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedEmp(isExpanded ? null : emp.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">{emp.name.charAt(0)}</div>
                    <div>
                      <p className="font-medium text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.department || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg">{emp.count} بلاغ</span>
                    <span className="text-xs text-gray-500">{emp.monthsList.map((m) => MONTH_NAMES_AR[m].slice(0, 3)).join(', ')}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-2">
                    {empReports.slice(0, 10).map((r) => (
                      <div key={r.id} onClick={() => { onClose(); onViewReport(r as unknown as SafetyReport); }} className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-blue-50 cursor-pointer transition-colors">
                        <Eye className="w-4 h-4 text-gray-400" />
                        <span className="font-mono text-xs">{r.report_number}</span>
                        <span className="text-xs text-gray-600 flex-1 truncate">{r.description}</span>
                        <span className="text-xs text-gray-500">{MONTH_NAMES_AR[new Date(r.created_at).getMonth()]}</span>
                      </div>
                    ))}
                    {empReports.length > 10 && <p className="text-xs text-gray-400 text-center">+{empReports.length - 10} بلاغات إضافية</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
