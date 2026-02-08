import { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Download, ChevronDown, ChevronUp,
  Eye,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SafetyReport } from '../../types';
import {
  STATUS_LABELS, TYPE_LABELS, STATUS_DOT_COLORS,
  TYPE_BAR_COLORS, MONTH_NAMES_AR, formatDateTimeAr,
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

interface MonthData {
  month: number;
  year: number;
  label: string;
  reports: Report[];
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  uniqueEmployees: number;
}

export function AdminMonthlyReport({ onViewReport }: { onViewReport: (report: SafetyReport) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedMonth, setExpandedMonth] = useState<number | null>(new Date().getMonth());
  const [detailView, setDetailView] = useState<{ month: number; type: string } | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const { data, error } = await supabase
      .from('safety_reports')
      .select('*, employee:profiles!safety_reports_employee_id_fkey(full_name, email, department)')
      .order('created_at', { ascending: false });

    if (!error && data) setReports(data as Report[]);
    setIsLoading(false);
  };

  const availableYears = useMemo(() => {
    const years = new Set(reports.map((r) => new Date(r.created_at).getFullYear()));
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [reports]);

  const monthlyData = useMemo(() => {
    const data: MonthData[] = [];

    for (let m = 11; m >= 0; m--) {
      const monthReports = reports.filter((r) => {
        const d = new Date(r.created_at);
        return d.getMonth() === m && d.getFullYear() === selectedYear;
      });

      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      const employeeSet = new Set<string>();

      monthReports.forEach((r) => {
        byType[r.report_type] = (byType[r.report_type] || 0) + 1;
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        employeeSet.add(r.employee_id);
      });

      data.push({
        month: m,
        year: selectedYear,
        label: MONTH_NAMES_AR[m] + ' ' + selectedYear,
        reports: monthReports,
        byType,
        byStatus,
        uniqueEmployees: employeeSet.size,
      });
    }

    return data;
  }, [reports, selectedYear]);

  const totalYearReports = useMemo(
    () => monthlyData.reduce((s, m) => s + m.reports.length, 0),
    [monthlyData]
  );

  const handleExportMonth = async (md: MonthData) => {
    await exportReportsCsv(md.reports, `بلاغات_${md.label}.csv`);
  };

  const handleExportAll = () => {
    const rows = monthlyData.map((m) => ({
      month: m.label,
      total: m.reports.length,
      byType: m.byType,
      byStatus: m.byStatus,
    }));
    exportMonthlyCsv(rows);
  };

  const getDetailReports = () => {
    if (!detailView) return [];
    const md = monthlyData.find((m) => m.month === detailView.month);
    if (!md) return [];
    if (detailView.type === 'all') return md.reports;
    if (['pending', 'in_progress', 'closed'].includes(detailView.type)) {
      return md.reports.filter((r) => r.status === detailView.type);
    }
    return md.reports.filter((r) => r.report_type === detailView.type);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (detailView) {
    const detailReports = getDetailReports();
    const md = monthlyData.find((m) => m.month === detailView.month);
    const filterLabel =
      detailView.type === 'all'
        ? 'جميع البلاغات'
        : STATUS_LABELS[detailView.type] || TYPE_LABELS[detailView.type] || detailView.type;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => setDetailView(null)}
              className="text-sm text-blue-600 hover:text-blue-700 mb-1"
            >
              &rarr; العودة للتقرير الشهري
            </button>
            <h2 className="text-xl font-bold text-gray-900">{md?.label} - {filterLabel}</h2>
            <p className="text-gray-500 mt-1">{detailReports.length} بلاغ</p>
          </div>
          <button
            onClick={async () => await exportReportsCsv(detailReports, `بلاغات_${md?.label}_${filterLabel}.csv`)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            تصدير
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">رقم البلاغ</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">الموظف</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">النوع</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">الوصف</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">الموقع</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">الحالة</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">التاريخ</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detailReports.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onViewReport(r as unknown as SafetyReport)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.report_number}</td>
                    <td className="px-4 py-3">{r.employee?.full_name || '-'}</td>
                    <td className="px-4 py-3 text-xs">{TYPE_LABELS[r.report_type]}</td>
                    <td className="px-4 py-3 max-w-[250px] truncate">{r.description}</td>
                    <td className="px-4 py-3 text-xs">{r.location || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[r.status]}`} />
                        <span className="text-xs">{STATUS_LABELS[r.status]}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDateTimeAr(new Date(r.created_at))}
                    </td>
                    <td className="px-4 py-3">
                      <Eye className="w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">التقرير الشهري</h2>
          <p className="text-gray-500 mt-1">
            {totalYearReports} بلاغ في {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={handleExportAll}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            تصدير الملخص
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {monthlyData.map((md) => {
          const isExpanded = expandedMonth === md.month;
          const maxType = Math.max(...Object.values(md.byType), 1);

          return (
            <div
              key={md.month}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedMonth(isExpanded ? null : md.month)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-gray-900">{md.label}</span>
                  </div>
                  <span className="bg-blue-50 text-blue-700 text-sm font-bold px-3 py-1 rounded-lg">
                    {md.reports.length} بلاغ
                  </span>
                  <span className="text-sm text-gray-500">
                    {md.uniqueEmployees} موظف
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2">
                    {Object.entries(md.byStatus).map(([status, count]) => (
                      <span key={status} className="flex items-center gap-1 text-xs">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[status]}`} />
                        {count}
                      </span>
                    ))}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">حسب النوع</h4>
                      <div className="space-y-2">
                        {Object.entries(md.byType)
                          .sort(([, a], [, b]) => b - a)
                          .map(([type, count]) => (
                            <button
                              key={type}
                              onClick={() => setDetailView({ month: md.month, type })}
                              className="w-full flex items-center gap-3 group hover:bg-gray-50 rounded-lg p-2 transition-colors"
                            >
                              <span className="text-sm text-gray-600 w-28 text-right">{TYPE_LABELS[type]}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all duration-500 ${TYPE_BAR_COLORS[type]}`}
                                  style={{ width: `${(count / maxType) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold text-gray-900 w-8">{count}</span>
                              <Eye className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                            </button>
                          ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">حسب الحالة</h4>
                      <div className="grid grid-cols-3 gap-3">
                        {['pending', 'in_progress', 'closed'].map((status) => {
                          const count = md.byStatus[status] || 0;
                          return (
                            <button
                              key={status}
                              onClick={() => count > 0 && setDetailView({ month: md.month, type: status })}
                              className={`p-3 rounded-lg border text-center transition-colors ${
                                count > 0 ? 'hover:border-blue-300 cursor-pointer' : 'opacity-50 cursor-default'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1.5 mb-1">
                                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT_COLORS[status]}`} />
                                <span className="text-xs text-gray-600">{STATUS_LABELS[status]}</span>
                              </div>
                              <span className="text-xl font-bold text-gray-900">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {md.reports.length > 0 && (
                    <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => setDetailView({ month: md.month, type: 'all' })}
                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        عرض جميع بلاغات الشهر
                      </button>
                      <button
                        onClick={() => handleExportMonth(md)}
                        className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        تصدير بلاغات الشهر
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
