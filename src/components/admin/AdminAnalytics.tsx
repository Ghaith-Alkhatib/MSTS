import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, FileText, CheckCircle,
  Users, MapPin, Calendar, Download, Minus, Trophy, Award,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
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

export function AdminAnalytics() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const { data, error } = await supabase
      .from('safety_reports')
      .select('*, employee:profiles(full_name, email, department)')
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
    const data: Array<{
      month: number;
      label: string;
      total: number;
      byType: Record<string, number>;
      byStatus: Record<string, number>;
    }> = [];

    for (let m = 0; m < 12; m++) {
      const monthReports = yearReports.filter((r) => new Date(r.created_at).getMonth() === m);
      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};

      monthReports.forEach((r) => {
        byType[r.report_type] = (byType[r.report_type] || 0) + 1;
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      });

      data.push({ month: m, label: MONTH_NAMES_AR[m], total: monthReports.length, byType, byStatus });
    }
    return data;
  }, [yearReports]);

  const maxMonthly = useMemo(
    () => Math.max(...monthlyData.map((d) => d.total), 1),
    [monthlyData]
  );

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = yearReports.filter(
      (r) => new Date(r.created_at).getMonth() === now.getMonth()
    );
    const prevMonth = yearReports.filter(
      (r) => new Date(r.created_at).getMonth() === now.getMonth() - 1
    );
    const growth =
      prevMonth.length > 0
        ? Math.round(((thisMonth.length - prevMonth.length) / prevMonth.length) * 100)
        : thisMonth.length > 0
          ? 100
          : 0;

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byLocation: Record<string, number> = {};

    yearReports.forEach((r) => {
      byType[r.report_type] = (byType[r.report_type] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (r.location) {
        byLocation[r.location] = (byLocation[r.location] || 0) + 1;
      }
    });

    const topLocations = Object.entries(byLocation)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const totalEmployees = new Set(yearReports.map((r) => r.employee_id)).size;
    const closedCount = byStatus['closed'] || 0;
    const resolutionRate = yearReports.length > 0 ? Math.round((closedCount / yearReports.length) * 100) : 0;

    const avgResponseTime = calculateAvgDays(yearReports);

    const employeeReportCounts: Record<string, { name: string; department: string | null; count: number }> = {};
    yearReports.forEach((r) => {
      if (!employeeReportCounts[r.employee_id]) {
        employeeReportCounts[r.employee_id] = {
          name: r.employee?.full_name || 'غير معروف',
          department: r.employee?.department || null,
          count: 0,
        };
      }
      employeeReportCounts[r.employee_id].count++;
    });

    const topEmployees = Object.entries(employeeReportCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count);

    return {
      total: yearReports.length,
      thisMonth: thisMonth.length,
      growth,
      byType,
      byStatus,
      topLocations,
      totalEmployees,
      resolutionRate,
      avgResponseTime,
      topEmployees,
    };
  }, [yearReports]);

  function calculateAvgDays(reps: Report[]): number {
    const closedReports = reps.filter((r) => r.status === 'closed' || r.status === 'action_taken');
    if (closedReports.length === 0) return 0;
    const totalDays = closedReports.reduce((sum, r) => {
      const created = new Date(r.created_at);
      const now = new Date();
      return sum + Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(totalDays / closedReports.length);
  }

  const handleExportAll = () => exportReportsCsv(yearReports, `تقرير_${selectedYear}.csv`);

  const handleExportMonthly = () => {
    const rows = monthlyData.map((m) => ({
      month: m.label + ' ' + selectedYear,
      total: m.total,
      byType: m.byType,
      byStatus: m.byStatus,
    }));
    exportMonthlyCsv(rows);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">الإحصائيات والتحليلات</h2>
          <p className="text-gray-500 mt-1">نظرة شاملة على أداء نظام السلامة</p>
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
            تصدير الكل
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="إجمالي البلاغات"
          value={stats.total}
          icon={<FileText className="w-6 h-6" />}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="بلاغات هذا الشهر"
          value={stats.thisMonth}
          icon={<Calendar className="w-6 h-6" />}
          color="bg-teal-50 text-teal-600"
          trend={stats.growth}
        />
        <StatCard
          label="نسبة الإنجاز"
          value={`${stats.resolutionRate}%`}
          icon={<CheckCircle className="w-6 h-6" />}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="الموظفون المبلّغون"
          value={stats.totalEmployees}
          icon={<Users className="w-6 h-6" />}
          color="bg-orange-50 text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900">البلاغات الشهرية - {selectedYear}</h3>
            <button
              onClick={handleExportMonthly}
              className="text-sm text-gray-500 hover:text-teal-600 flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              تصدير
            </button>
          </div>
          <div className="flex items-end gap-2 h-56">
            {monthlyData.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-gray-700">{m.total || ''}</span>
                <div className="w-full flex flex-col items-center">
                  <div
                    className="w-full max-w-[32px] bg-blue-500 rounded-t-md transition-all duration-500 hover:bg-blue-600"
                    style={{ height: `${(m.total / maxMonthly) * 180}px`, minHeight: m.total > 0 ? 4 : 0 }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 mt-1">{m.label.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-5">حسب النوع</h3>
          <div className="space-y-4">
            {Object.entries(stats.byType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{TYPE_LABELS[type] || type}</span>
                      <span className="font-semibold text-gray-900">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-700 ${TYPE_BAR_COLORS[type] || 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {Object.keys(stats.byType).length === 0 && (
              <p className="text-gray-400 text-center py-4">لا توجد بيانات</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-5">حسب الحالة</h3>
          <div className="space-y-3">
            {Object.entries(stats.byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${STATUS_DOT_COLORS[status] || 'bg-gray-400'}`} />
                    <span className="text-sm text-gray-700 flex-1">{STATUS_LABELS[status] || status}</span>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                    <div className="w-24 bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${STATUS_DOT_COLORS[status] || 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-left">{pct}%</span>
                  </div>
                );
              })}
            {Object.keys(stats.byStatus).length === 0 && (
              <p className="text-gray-400 text-center py-4">لا توجد بيانات</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gray-600" />
            أكثر المواقع بلاغات
          </h3>
          {stats.topLocations.length > 0 ? (
            <div className="space-y-3">
              {stats.topLocations.map(([location, count], idx) => (
                <div key={location} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-gray-800 flex-1">{location}</span>
                  <span className="text-sm font-bold text-gray-900 bg-white px-3 py-1 rounded-lg shadow-sm">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">لا توجد بيانات مواقع</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            أعلى الموظفين بلاغات
          </h3>
          {stats.topEmployees.length > 0 ? (
            <div className="space-y-3">
              {stats.topEmployees.slice(0, 5).map((emp, idx) => {
                const medals = ['bg-yellow-400', 'bg-gray-400', 'bg-orange-400'];
                return (
                  <div key={emp.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className={`w-8 h-8 rounded-full ${idx < 3 ? medals[idx] : 'bg-blue-100'} ${idx < 3 ? 'text-white' : 'text-blue-700'} text-sm font-bold flex items-center justify-center`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                      {emp.department && (
                        <p className="text-xs text-gray-500">{emp.department}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-900 bg-white px-3 py-1 rounded-lg shadow-sm">
                      {emp.count} بلاغ
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">لا توجد بيانات</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Award className="w-5 h-5 text-teal-600" />
            إجمالي البلاغات لكل موظف
          </h3>
          {stats.topEmployees.length > 0 ? (
            <div className="overflow-y-auto max-h-80 space-y-2">
              {stats.topEmployees.map((emp) => {
                const pct = stats.total > 0 ? Math.round((emp.count / stats.total) * 100) : 0;
                return (
                  <div key={emp.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 truncate flex-1 ml-3">{emp.name}</span>
                      <span className="font-semibold text-gray-900 whitespace-nowrap">{emp.count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-teal-500 transition-all duration-700"
                        style={{ width: `${stats.topEmployees[0]?.count > 0 ? (emp.count / stats.topEmployees[0].count) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">لا توجد بيانات</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-900 mb-5">ملخص الأداء</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center p-5 bg-blue-50 rounded-xl">
            <p className="text-3xl font-bold text-blue-700">{stats.avgResponseTime}</p>
            <p className="text-sm text-blue-600 mt-1">متوسط أيام المعالجة</p>
          </div>
          <div className="text-center p-5 bg-green-50 rounded-xl">
            <p className="text-3xl font-bold text-green-700">{stats.resolutionRate}%</p>
            <p className="text-sm text-green-600 mt-1">نسبة الإنجاز</p>
          </div>
          <div className="text-center p-5 bg-orange-50 rounded-xl">
            <p className="text-3xl font-bold text-orange-700">
              {yearReports.length > 0 ? (yearReports.length / 12).toFixed(1) : 0}
            </p>
            <p className="text-sm text-orange-600 mt-1">متوسط البلاغات شهرياً</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon, color, trend,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
        {trend !== undefined && (
          <span
            className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-full ${
              trend > 0
                ? 'bg-green-50 text-green-700'
                : trend < 0
                  ? 'bg-red-50 text-red-700'
                  : 'bg-gray-50 text-gray-500'
            }`}
          >
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
