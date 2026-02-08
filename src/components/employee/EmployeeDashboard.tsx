import { useState, useEffect } from 'react';
import { LogOut, Plus, Trophy, AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { offlineSync } from '../../lib/offlineSync';
import { NotificationBell } from '../shared/NotificationBell';

interface Report {
  id: string;
  report_number: string;
  report_type: string;
  description: string;
  status: string;
  created_at: string;
  points_awarded: number;
}

export function EmployeeDashboard({ onCreateReport, onViewLeaderboard }: {
  onCreateReport: () => void;
  onViewLeaderboard: () => void;
}) {
  const { user, profile, signOut } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState({
    totalReports: 0,
    monthReports: 0,
    totalPoints: 0,
    pendingReports: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    if (user) {
      loadDashboard();
      const pending = offlineSync.getPendingReports();
      setPendingSync(pending.length);
    }
  }, [user]);

  const loadDashboard = async () => {
    if (!user) return;

    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const monthStart = new Date(currentYear, currentMonth, 1).toISOString();

      const { data: reportsData, error } = await supabase
        .from('safety_reports')
        .select('*')
        .eq('employee_id', user.id)
        .gte('created_at', monthStart)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const monthPoints = (reportsData || []).reduce((sum, r) => sum + (r.points_awarded || 0), 0);

      setReports(reportsData || []);
      setStats({
        totalReports: reportsData?.length || 0,
        monthReports: reportsData?.length || 0,
        totalPoints: monthPoints,
        pendingReports: reportsData?.filter(r => r.status === 'pending').length || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'in_review':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'action_taken':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'closed':
        return <CheckCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'قيد الانتظار';
      case 'in_review':
        return 'قيد المراجعة';
      case 'action_taken':
        return 'تم اتخاذ إجراء';
      case 'closed':
        return 'مغلق';
      default:
        return status;
    }
  };

  const getReportTypeText = (type: string) => {
    switch (type) {
      case 'unsafe_act':
        return 'سلوك غير آمن';
      case 'unsafe_condition':
        return 'وضع غير آمن';
      case 'near_miss':
        return 'حادث كاد أن يقع';
      case 'observation':
        return 'ملاحظة عامة';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/download_(1).png"
                alt="MASDAR STS Logo"
                className="h-12 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">MSTS Safety</h1>
                <p className="text-sm text-gray-600">مرحباً، {profile?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {pendingSync > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-orange-800">
              لديك {pendingSync} بلاغ بانتظار المزامنة. سيتم رفعها تلقائياً عند الاتصال بالإنترنت.
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 font-medium">
          إحصائيات الشهر الحالي - {new Date().toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">بلاغات الشهر</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.monthReports}</p>
              </div>
              <FileText className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">نقاط الشهر</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalPoints}</p>
              </div>
              <Trophy className="w-10 h-10 text-amber-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">قيد المراجعة</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingReports}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">مغلقة</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {reports.filter(r => r.status === 'closed').length}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={onCreateReport}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-8 hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Plus className="w-12 h-12 mx-auto mb-3" />
            <span className="text-xl font-bold">إنشاء بلاغ جديد</span>
            <p className="text-blue-100 text-sm mt-2">ساهم في تحسين السلامة</p>
          </button>

          <button
            onClick={onViewLeaderboard}
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl p-8 hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Trophy className="w-12 h-12 mx-auto mb-3" />
            <span className="text-xl font-bold">لوحة المتصدرين</span>
            <p className="text-amber-100 text-sm mt-2">اعرف ترتيبك بين الزملاء</p>
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">بلاغات هذا الشهر</h2>
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد بلاغات حتى الآن</p>
              <button
                onClick={onCreateReport}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                إنشاء أول بلاغ
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.slice(0, 5).map((report) => (
                <div
                  key={report.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {report.report_number}
                        </span>
                        <span className="text-sm text-gray-600">
                          {getReportTypeText(report.report_type)}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm line-clamp-2">{report.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(report.created_at).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mr-4">
                      {getStatusIcon(report.status)}
                      <span className="text-sm font-medium text-gray-700">
                        {getStatusText(report.status)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
