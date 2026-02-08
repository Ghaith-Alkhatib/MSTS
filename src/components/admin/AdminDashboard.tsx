import { useState, useEffect, useMemo } from 'react';
import {
  LogOut, FileText, Clock, CheckCircle, Loader2,
  TrendingUp, Filter, BarChart3, CalendarDays, Download, X, Trash2, Search, Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { SafetyReport } from '../../types';
import { NotificationBell } from '../shared/NotificationBell';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminEmployeeStats } from './AdminEmployeeStats';
import { AdminMonthlyReport } from './AdminMonthlyReport';
import {
  STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, TYPE_COLORS, MONTH_NAMES_AR,
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

export function AdminDashboard({ onViewReport, onNavigateToReport }: {
  onViewReport: (report: SafetyReport) => void;
  onNavigateToReport?: (reportId: string) => void;
}) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [reports, setReports] = useState<ReportWithEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterEmployee, setFilterEmployee] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const [showInProgressPopup, setShowInProgressPopup] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'reports') {
      console.log('Active tab changed to reports, loading...');
      loadReports();
    }
  }, [activeTab]);

  useEffect(() => {
    console.log('Reports state updated:', reports.length, 'reports');
    console.log('Filtered reports:', filteredReports.length);
  }, [reports, filteredReports]);

  useEffect(() => {
    if (activeTab === 'reports') {
      const channel = supabase
        .channel('reports-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_reports' }, () => { loadReports(); })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [activeTab]);

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from('safety_reports')
        .select('*, employee:profiles!safety_reports_employee_id_fkey(full_name, email, department)')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error in loadReports:', error);
        throw error;
      }
      console.log('Loaded reports:', data);
      setReports(data as ReportWithEmployee[]);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('هل أنت متأكد من حذف هذا البلاغ؟')) return;
    setDeletingReportId(reportId);
    try {
      await supabase.from('report_responses').delete().eq('report_id', reportId);
      await supabase.from('report_images').delete().eq('report_id', reportId);
      await supabase.from('notifications').delete().eq('report_id', reportId);
      const { error } = await supabase.from('safety_reports').delete().eq('id', reportId);
      if (error) throw error;
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('حدث خطأ أثناء حذف البلاغ');
    } finally {
      setDeletingReportId(null);
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set(reports.map((r) => new Date(r.created_at).getFullYear()));
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [reports]);

  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, string>();
    reports.forEach((r) => { if (r.employee?.full_name) map.set(r.employee_id, r.employee.full_name); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'ar'));
  }, [reports]);

  const filteredReports = useMemo(() => {
    let filtered = [...reports];
    if (filterStatus !== 'all') filtered = filtered.filter((r) => r.status === filterStatus);
    if (filterType !== 'all') filtered = filtered.filter((r) => r.report_type === filterType);
    if (filterEmployee) filtered = filtered.filter((r) => r.employee_id === filterEmployee);
    if (filterMonth !== 'all') filtered = filtered.filter((r) => new Date(r.created_at).getMonth() === Number(filterMonth));
    if (filterYear !== 'all') filtered = filtered.filter((r) => new Date(r.created_at).getFullYear() === Number(filterYear));
    return filtered;
  }, [reports, filterStatus, filterType, filterEmployee, filterMonth, filterYear]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return {
      totalReports: reports.length,
      todayReports: reports.filter((r) => new Date(r.created_at).toDateString() === today).length,
      monthReports: reports.filter((r) => {
        const d = new Date(r.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }).length,
      pendingReports: reports.filter((r) => r.status === 'pending').length,
      inProgressReports: reports.filter((r) => r.status === 'in_progress').length,
    };
  }, [reports]);

  const pendingReports = useMemo(() => reports.filter((r) => r.status === 'pending'), [reports]);
  const inProgressReports = useMemo(() => reports.filter((r) => r.status === 'in_progress'), [reports]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'in_progress': return <Loader2 className="w-5 h-5 text-blue-500" />;
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
              <img src="/download_(1).png" alt="MASDAR STS Logo" className="h-12 object-contain" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">لوحة تحكم الإدارة</h1>
                <p className="text-sm text-gray-600">إدارة البلاغات والملاحظات</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell onNavigateToReport={onNavigateToReport} />
              <button onClick={signOut} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
                  activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
          <div className="space-y-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm text-gray-600">إجمالي البلاغات</p><p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalReports}</p></div>
                      <FileText className="w-10 h-10 text-blue-500" />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm text-gray-600">بلاغات اليوم</p><p className="text-3xl font-bold text-gray-900 mt-1">{stats.todayReports}</p></div>
                      <TrendingUp className="w-10 h-10 text-green-500" />
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm text-gray-600">بلاغات الشهر</p><p className="text-3xl font-bold text-gray-900 mt-1">{stats.monthReports}</p></div>
                      <CalendarDays className="w-10 h-10 text-teal-500" />
                    </div>
                  </div>
                  <button onClick={() => setShowPendingPopup(true)} className="bg-white rounded-xl shadow-sm p-6 hover:ring-2 hover:ring-yellow-400 transition-all text-right">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm text-gray-600">قيد الانتظار</p><p className="text-3xl font-bold text-yellow-600 mt-1">{stats.pendingReports}</p></div>
                      <Clock className="w-10 h-10 text-yellow-500" />
                    </div>
                  </button>
                  <button onClick={() => setShowInProgressPopup(true)} className="bg-white rounded-xl shadow-sm p-6 hover:ring-2 hover:ring-blue-400 transition-all text-right">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm text-gray-600">جاري العمل عليها</p><p className="text-3xl font-bold text-blue-600 mt-1">{stats.inProgressReports}</p></div>
                      <Loader2 className="w-10 h-10 text-blue-500" />
                    </div>
                  </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <Filter className="w-6 h-6" />
                      البلاغات ({filteredReports.length})
                    </h2>
                    <button
                      onClick={() => exportReportsCsv(filteredReports.map((r) => ({ ...r, employee: { full_name: r.employee.full_name, email: r.employee.email, department: r.employee.department } })))}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      تصدير
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="all">جميع الحالات</option>
                      <option value="pending">قيد الانتظار</option>
                      <option value="in_progress">جاري العمل عليها</option>
                      <option value="closed">مغلق</option>
                    </select>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="all">جميع الأنواع</option>
                      <option value="unsafe_act">سلوك غير آمن</option>
                      <option value="unsafe_condition">وضع غير آمن</option>
                      <option value="near_miss">حادث كاد أن يقع</option>
                      <option value="observation">ملاحظة عامة</option>
                    </select>
                    <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="">جميع الموظفين</option>
                      {uniqueEmployees.map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
                    </select>
                    <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="all">جميع الأشهر</option>
                      {MONTH_NAMES_AR.map((name, idx) => (<option key={idx} value={idx}>{name}</option>))}
                    </select>
                    <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="all">جميع السنوات</option>
                      {availableYears.map((y) => (<option key={y} value={y}>{y}</option>))}
                    </select>
                  </div>

                  {filteredReports.length === 0 ? (
                    <div className="text-center py-12"><FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">لا توجد بلاغات</p></div>
                  ) : (
                    <div className="space-y-4">
                      {filteredReports.map((report) => (
                        <div key={report.id} onClick={() => onViewReport(report as unknown as SafetyReport)} className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3 flex-wrap">
                                <span className="font-mono text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded">{report.report_number}</span>
                                <span className={`text-xs font-medium px-3 py-1 rounded ${TYPE_COLORS[report.report_type] || 'bg-gray-100 text-gray-800'}`}>{TYPE_LABELS[report.report_type] || report.report_type}</span>
                                <span className={`text-xs font-medium px-3 py-1 rounded border ${STATUS_COLORS[report.status] || 'bg-gray-100 text-gray-800'}`}>{STATUS_LABELS[report.status] || report.status}</span>
                              </div>
                              <p className="text-gray-700 mb-3 line-clamp-2">{report.description}</p>
                              <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                                <span>الموظف: {report.employee.full_name}</span>
                                {report.location && <span>الموقع: {report.location}</span>}
                                <span>{new Date(report.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mr-4">
                              {getStatusIcon(report.status)}
                              <button
                                onClick={(e) => handleDeleteReport(report.id, e)}
                                disabled={deletingReportId === report.id}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="حذف البلاغ"
                              >
                                {deletingReportId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {activeTab === 'analytics' && <AdminAnalytics onViewReport={onViewReport} />}
        {activeTab === 'employees' && <AdminEmployeeStats onViewReport={onViewReport} />}
        {activeTab === 'monthly' && <AdminMonthlyReport onViewReport={onViewReport} />}
      </main>

      {showPendingPopup && (
        <ReportListPopup title="البلاغات قيد الانتظار" reports={pendingReports} onClose={() => setShowPendingPopup(false)} onViewReport={(r) => { setShowPendingPopup(false); onViewReport(r as unknown as SafetyReport); }} getStatusIcon={getStatusIcon} />
      )}
      {showInProgressPopup && (
        <ReportListPopup title="البلاغات جاري العمل عليها" reports={inProgressReports} onClose={() => setShowInProgressPopup(false)} onViewReport={(r) => { setShowInProgressPopup(false); onViewReport(r as unknown as SafetyReport); }} getStatusIcon={getStatusIcon} />
      )}
    </div>
  );
}

function ReportListPopup({ title, reports, onClose, onViewReport, getStatusIcon }: {
  title: string;
  reports: ReportWithEmployee[];
  onClose: () => void;
  onViewReport: (r: ReportWithEmployee) => void;
  getStatusIcon: (s: string) => React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">{title} ({reports.length})</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] p-5 space-y-3">
          {reports.length === 0 ? (
            <div className="text-center py-8 text-gray-400"><Search className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>لا توجد بلاغات</p></div>
          ) : reports.map((report) => (
            <div key={report.id} onClick={() => onViewReport(report)} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                {getStatusIcon(report.status)}
                <span className="font-mono text-sm font-bold text-gray-900">{report.report_number}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${TYPE_COLORS[report.report_type]}`}>{TYPE_LABELS[report.report_type]}</span>
              </div>
              <p className="text-sm text-gray-700 line-clamp-2 mb-2">{report.description}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{report.employee.full_name}</span>
                <span>{new Date(report.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
