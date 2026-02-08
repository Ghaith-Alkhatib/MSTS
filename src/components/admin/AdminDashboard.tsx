import { useState, useEffect } from 'react';
import {
  LogOut, FileText, Clock, AlertCircle, CheckCircle,
  Users, TrendingUp, Filter, BarChart3, CalendarDays, Download,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SafetyReport } from '../../types';
import { NotificationBell } from '../shared/NotificationBell';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminEmployeeStats } from './AdminEmployeeStats';
import { AdminMonthlyReport } from './AdminMonthlyReport';
import {
  STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, TYPE_COLORS,
} from '../../lib/adminHelpers';
import { exportReportsCsv } from '../../lib/exportUtils';

type AdminTab = 'reports' | 'analytics' | 'employees' | 'monthly';

interface ReportWithEmployee {
  id: string;
  report_number: string;
  report_type: string;
  description: string;
  location: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  points_awarded: number;
  employee_id: string;
  synced: boolean;
  employee: {
    full_name: string;
    email: string;
    department?: string | null;
  };
}

export function AdminDashboard({ onViewReport, onNavigateToReport }: { onViewReport: (report: SafetyReport) => void; onNavigateToReport?: (reportId: string) => void }) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [reports, setReports] = useState<ReportWithEmployee[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportWithEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [stats, setStats] = useState({
    totalReports: 0,
    todayReports: 0,
    monthReports: 0,
    pendingReports: 0,
    activeEmployees: 0,
  });

  useEffect(() => {
    if (activeTab === 'reports') loadReports();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'reports') {
      const channel = supabase
        .channel('reports-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_reports' }, () => {
          loadReports();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [activeTab]);

  useEffect(() => {
    applyFilters();
  }, [reports, filterStatus, filterType]);

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from('safety_reports')
        .select('*, employee:profiles(full_name, email, department)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reportsData = data as ReportWithEmployee[];
      setReports(reportsData);

      const now = new Date();
      const today = now.toDateString();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      setStats({
        totalReports: reportsData.length,
        todayReports: reportsData.filter((r) => new Date(r.created_at).toDateString() === today).length,
        monthReports: reportsData.filter((r) => {
          const d = new Date(r.created_at);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length,
        pendingReports: reportsData.filter((r) => r.status === 'pending').length,
        activeEmployees: new Set(reportsData.map((r) => r.employee_id)).size,
      });
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reports];
    if (filterStatus !== 'all') filtered = filtered.filter((r) => r.status === filterStatus);
    if (filterType !== 'all') filtered = filtered.filter((r) => r.report_type === filterType);
    setFilteredReports(filtered);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'in_review': return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'action_taken': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'closed': return <CheckCircle className="w-5 h-5 text-gray-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'reports', label: 'البلاغات', icon: <FileText className="w-4 h-4" /> },
    { id: 'analytics', label: 'الإحصائيات', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'employees', label: 'الموظفين', icon: <Users className="w-4 h-4" /> },
    { id: 'monthly', label: 'التقرير الشهري', icon: <CalendarDays className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <img
                src="/download_(1).png"
                alt="MASDAR STS Logo"
                className="h-12 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">لوحة تحكم الإدارة</h1>
                <p className="text-sm text-gray-600">إدارة البلاغات والملاحظات</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell onNavigateToReport={onNavigateToReport} />
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">تسجيل الخروج</span>
              </button>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto pb-px -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'reports' && (
          <ReportsTab
            filteredReports={filteredReports}
            stats={stats}
            isLoading={isLoading}
            filterStatus={filterStatus}
            filterType={filterType}
            onFilterStatus={setFilterStatus}
            onFilterType={setFilterType}
            onViewReport={onViewReport}
            getStatusIcon={getStatusIcon}
          />
        )}
        {activeTab === 'analytics' && <AdminAnalytics />}
        {activeTab === 'employees' && <AdminEmployeeStats />}
        {activeTab === 'monthly' && <AdminMonthlyReport />}
      </main>
    </div>
  );
}

function ReportsTab({
  filteredReports,
  stats,
  isLoading,
  filterStatus,
  filterType,
  onFilterStatus,
  onFilterType,
  onViewReport,
  getStatusIcon,
}: {
  filteredReports: ReportWithEmployee[];
  stats: { totalReports: number; todayReports: number; monthReports: number; pendingReports: number; activeEmployees: number };
  isLoading: boolean;
  filterStatus: string;
  filterType: string;
  onFilterStatus: (v: string) => void;
  onFilterType: (v: string) => void;
  onViewReport: (report: SafetyReport) => void;
  getStatusIcon: (status: string) => React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">إجمالي البلاغات</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalReports}</p>
            </div>
            <FileText className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">بلاغات اليوم</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.todayReports}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">بلاغات الشهر</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.monthReports}</p>
            </div>
            <CalendarDays className="w-10 h-10 text-teal-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">قيد الانتظار</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingReports}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">موظفين نشطين</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.activeEmployees}</p>
            </div>
            <Users className="w-10 h-10 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Filter className="w-6 h-6" />
            البلاغات
          </h2>
          <div className="flex gap-3 items-center">
            <select
              value={filterStatus}
              onChange={(e) => onFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">جميع الحالات</option>
              <option value="pending">قيد الانتظار</option>
              <option value="in_review">قيد المراجعة</option>
              <option value="action_taken">تم اتخاذ إجراء</option>
              <option value="closed">مغلق</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => onFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">جميع الأنواع</option>
              <option value="unsafe_act">سلوك غير آمن</option>
              <option value="unsafe_condition">وضع غير آمن</option>
              <option value="near_miss">حادث كاد أن يقع</option>
              <option value="observation">ملاحظة عامة</option>
            </select>
            <button
              onClick={() =>
                exportReportsCsv(
                  filteredReports.map((r) => ({
                    ...r,
                    employee: { full_name: r.employee.full_name, email: r.employee.email, department: r.employee.department },
                  }))
                )
              }
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              تصدير
            </button>
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">لا توجد بلاغات</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => onViewReport(report as unknown as SafetyReport)}
                className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="font-mono text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded">
                        {report.report_number}
                      </span>
                      <span className={`text-xs font-medium px-3 py-1 rounded ${TYPE_COLORS[report.report_type] || 'bg-gray-100 text-gray-800'}`}>
                        {TYPE_LABELS[report.report_type] || report.report_type}
                      </span>
                      <span className={`text-xs font-medium px-3 py-1 rounded border ${STATUS_COLORS[report.status] || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_LABELS[report.status] || report.status}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-3">{report.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                      <span>الموظف: {report.employee.full_name}</span>
                      {report.location && <span>الموقع: {report.location}</span>}
                      <span>
                        {new Date(report.created_at).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mr-4">
                    {getStatusIcon(report.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
