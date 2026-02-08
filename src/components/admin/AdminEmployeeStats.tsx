import { useState, useEffect, useMemo } from 'react';
import {
  Users, Search, Download, ChevronDown, ChevronUp,
  FileText, Award, Clock, Eye,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SafetyReport } from '../../types';
import {
  STATUS_LABELS, TYPE_LABELS, STATUS_DOT_COLORS,
  formatDateAr,
} from '../../lib/adminHelpers';
import { exportEmployeeStatsCsv, exportReportsCsv } from '../../lib/exportUtils';

interface EmployeeProfile {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  points: number;
}

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
}

interface EmployeeData {
  profile: EmployeeProfile;
  reports: Report[];
  pending: number;
  inProgress: number;
  closed: number;
}

type SortKey = 'name' | 'total' | 'points' | 'pending';

export function AdminEmployeeStats({ onViewReport }: { onViewReport: (report: SafetyReport) => void }) {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [profilesRes, reportsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'employee'),
      supabase
        .from('safety_reports')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    const profiles = (profilesRes.data || []) as EmployeeProfile[];
    const allReports = (reportsRes.data || []) as Report[];

    setReports(allReports);

    const employeeMap = new Map<string, EmployeeData>();
    profiles.forEach((p) => {
      employeeMap.set(p.id, {
        profile: p,
        reports: [],
        pending: 0,
        inProgress: 0,
        closed: 0,
      });
    });

    allReports.forEach((r) => {
      const emp = employeeMap.get(r.employee_id);
      if (emp) {
        emp.reports.push(r);
        if (r.status === 'pending') emp.pending++;
        else if (r.status === 'in_progress') emp.inProgress++;
        else if (r.status === 'closed') emp.closed++;
      }
    });

    setEmployees(Array.from(employeeMap.values()));
    setIsLoading(false);
  };

  const filteredEmployees = useMemo(() => {
    let filtered = employees;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.profile.full_name.toLowerCase().includes(q) ||
          e.profile.email.toLowerCase().includes(q) ||
          (e.profile.department || '').toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'name':
          diff = a.profile.full_name.localeCompare(b.profile.full_name, 'ar');
          break;
        case 'total':
          diff = a.reports.length - b.reports.length;
          break;
        case 'points':
          diff = a.profile.points - b.profile.points;
          break;
        case 'pending':
          diff = a.pending - b.pending;
          break;
      }
      return sortAsc ? diff : -diff;
    });

    return filtered;
  }, [employees, searchQuery, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const handleExport = () => {
    exportEmployeeStatsCsv(
      filteredEmployees.map((e) => ({
        name: e.profile.full_name,
        email: e.profile.email,
        department: e.profile.department || '-',
        totalReports: e.reports.length,
        pending: e.pending,
        inProgress: e.inProgress,
        closed: e.closed,
        points: e.profile.points,
      }))
    );
  };

  const handleExportEmployeeReports = (emp: EmployeeData) => {
    exportReportsCsv(
      emp.reports.map((r) => ({
        ...r,
        employee: {
          full_name: emp.profile.full_name,
          email: emp.profile.email,
          department: emp.profile.department,
        },
      })),
      `بلاغات_${emp.profile.full_name}.csv`
    );
  };

  const handleViewReport = (reportId: string) => {
    const r = reports.find((rep) => rep.id === reportId);
    if (r) {
      onViewReport(r as unknown as SafetyReport);
    }
  };

  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortKey !== field) return <ChevronDown className="w-4 h-4 text-gray-300" />;
    return sortAsc ? (
      <ChevronUp className="w-4 h-4 text-blue-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-blue-600" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">إحصائيات الموظفين</h2>
          <p className="text-gray-500 mt-1">{employees.length} موظف مسجّل</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو البريد أو القسم..."
              className="w-full sm:w-72 pr-10 pl-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            تصدير
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MiniStat
          label="إجمالي الموظفين"
          value={employees.length}
          icon={<Users className="w-5 h-5" />}
          color="bg-blue-50 text-blue-600"
        />
        <MiniStat
          label="إجمالي البلاغات"
          value={reports.length}
          icon={<FileText className="w-5 h-5" />}
          color="bg-teal-50 text-teal-600"
        />
        <MiniStat
          label="متوسط البلاغات لكل موظف"
          value={employees.length > 0 ? (reports.length / employees.length).toFixed(1) : '0'}
          icon={<Award className="w-5 h-5" />}
          color="bg-orange-50 text-orange-600"
        />
        <MiniStat
          label="بلاغات قيد الانتظار"
          value={employees.reduce((s, e) => s + e.pending, 0)}
          icon={<Clock className="w-5 h-5" />}
          color="bg-yellow-50 text-yellow-600"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase">#</th>
                <th
                  className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase cursor-pointer select-none hover:text-blue-600"
                  onClick={() => handleSort('name')}
                >
                  <span className="flex items-center gap-1">الموظف <SortIcon field="name" /></span>
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase">القسم</th>
                <th
                  className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase cursor-pointer select-none hover:text-blue-600"
                  onClick={() => handleSort('total')}
                >
                  <span className="flex items-center gap-1">البلاغات <SortIcon field="total" /></span>
                </th>
                <th
                  className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase cursor-pointer select-none hover:text-blue-600"
                  onClick={() => handleSort('pending')}
                >
                  <span className="flex items-center gap-1">قيد الانتظار <SortIcon field="pending" /></span>
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase">الحالات</th>
                <th
                  className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase cursor-pointer select-none hover:text-blue-600"
                  onClick={() => handleSort('points')}
                >
                  <span className="flex items-center gap-1">النقاط <SortIcon field="points" /></span>
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.map((emp, idx) => (
                <EmployeeRow
                  key={emp.profile.id}
                  idx={idx + 1}
                  data={emp}
                  expanded={expandedEmployee === emp.profile.id}
                  onToggle={() =>
                    setExpandedEmployee(expandedEmployee === emp.profile.id ? null : emp.profile.id)
                  }
                  onExport={() => handleExportEmployeeReports(emp)}
                  onViewReport={handleViewReport}
                />
              ))}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>لا يوجد موظفين مطابقين للبحث</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label, value, icon, color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${color}`}>{icon}</div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function EmployeeRow({
  idx, data, expanded, onToggle, onExport, onViewReport,
}: {
  idx: number;
  data: EmployeeData;
  expanded: boolean;
  onToggle: () => void;
  onExport: () => void;
  onViewReport: (reportId: string) => void;
}) {
  return (
    <>
      <tr
        className="hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-5 py-4 text-sm text-gray-500">{idx}</td>
        <td className="px-5 py-4">
          <div>
            <p className="text-sm font-medium text-gray-900">{data.profile.full_name}</p>
            <p className="text-xs text-gray-500">{data.profile.email}</p>
          </div>
        </td>
        <td className="px-5 py-4 text-sm text-gray-600">{data.profile.department || '-'}</td>
        <td className="px-5 py-4">
          <span className="text-sm font-bold text-gray-900 bg-blue-50 px-3 py-1 rounded-lg">
            {data.reports.length}
          </span>
        </td>
        <td className="px-5 py-4">
          {data.pending > 0 ? (
            <span className="text-sm font-medium text-yellow-700 bg-yellow-50 px-3 py-1 rounded-lg">
              {data.pending}
            </span>
          ) : (
            <span className="text-sm text-gray-400">0</span>
          )}
        </td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-1.5">
            {data.inProgress > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{data.inProgress} جاري</span>
            )}
            {data.closed > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{data.closed} مغلق</span>
            )}
          </div>
        </td>
        <td className="px-5 py-4">
          <span className="text-sm font-bold text-teal-700">{data.profile.points}</span>
        </td>
        <td className="px-5 py-4">
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={8} className="bg-gray-50 px-5 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-800">بلاغات {data.profile.full_name}</h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport();
                  }}
                  className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  تصدير بلاغات الموظف
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-lg font-bold text-yellow-700">{data.pending}</p>
                  <p className="text-xs text-yellow-600">انتظار</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-lg font-bold text-blue-700">{data.inProgress}</p>
                  <p className="text-xs text-blue-600">جاري العمل</p>
                </div>
                <div className="text-center p-3 bg-gray-100 rounded-lg">
                  <p className="text-lg font-bold text-gray-700">{data.closed}</p>
                  <p className="text-xs text-gray-500">مغلق</p>
                </div>
              </div>

              {data.reports.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b">
                        <th className="text-right py-2 px-3">رقم البلاغ</th>
                        <th className="text-right py-2 px-3">النوع</th>
                        <th className="text-right py-2 px-3">الوصف</th>
                        <th className="text-right py-2 px-3">الحالة</th>
                        <th className="text-right py-2 px-3">التاريخ</th>
                        <th className="text-right py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.reports.slice(0, 10).map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-white cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewReport(r.id);
                          }}
                        >
                          <td className="py-2 px-3 font-mono text-xs">{r.report_number}</td>
                          <td className="py-2 px-3">
                            <span className="text-xs">{TYPE_LABELS[r.report_type] || r.report_type}</span>
                          </td>
                          <td className="py-2 px-3 max-w-[200px] truncate">{r.description}</td>
                          <td className="py-2 px-3">
                            <span className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[r.status]}`} />
                              <span className="text-xs">{STATUS_LABELS[r.status]}</span>
                            </span>
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-500">
                            {formatDateAr(new Date(r.created_at))}
                          </td>
                          <td className="py-2 px-3">
                            <Eye className="w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.reports.length > 10 && (
                    <p className="text-xs text-gray-400 text-center py-2">
                      +{data.reports.length - 10} بلاغات إضافية (استخدم التصدير للاطلاع على الكل)
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-4">لا توجد بلاغات لهذا الموظف</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
