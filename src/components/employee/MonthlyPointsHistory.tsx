import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Star, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface MonthlyPoints {
  year: number;
  month: number;
  reporter_points: number;
  resolver_points: number;
  total_points: number;
  report_count: number;
  resolved_count: number;
}

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export function MonthlyPointsHistory({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [monthlyData, setMonthlyData] = useState<MonthlyPoints[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (user) {
      loadMonthlyPoints();
    }
  }, [user, selectedYear]);

  const loadMonthlyPoints = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('monthly_employee_points')
        .select('*')
        .eq('employee_id', user.id)
        .eq('year', selectedYear)
        .order('month', { ascending: false });

      if (error) throw error;

      setMonthlyData(data || []);
    } catch (error) {
      console.error('Error loading monthly points:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalYearPoints = monthlyData.reduce((sum, m) => sum + m.total_points, 0);
  const totalYearReports = monthlyData.reduce((sum, m) => sum + m.report_count, 0);
  const totalYearResolved = monthlyData.reduce((sum, m) => sum + m.resolved_count, 0);

  const maxPoints = Math.max(...monthlyData.map(m => m.total_points), 1);

  const availableYears = Array.from(
    new Set(monthlyData.map(m => m.year).concat([new Date().getFullYear()]))
  ).sort((a, b) => b - a);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50" dir="rtl">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <img
              src="/download_(1).png"
              alt="MASDAR STS Logo"
              className="h-10 object-contain"
            />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">نقاطي الشهرية</h1>
              <p className="text-sm text-gray-600">تتبع إنجازاتك على مدار العام</p>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border-r-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">إجمالي النقاط</p>
              <Star className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalYearPoints}</p>
            <p className="text-xs text-gray-500 mt-1">في {selectedYear}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-r-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">البلاغات المنشأة</p>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalYearReports}</p>
            <p className="text-xs text-gray-500 mt-1">بلاغ</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-r-4 border-teal-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">البلاغات المحلولة</p>
              <Award className="w-5 h-5 text-teal-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalYearResolved}</p>
            <p className="text-xs text-gray-500 mt-1">بلاغ</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            التفاصيل الشهرية - {selectedYear}
          </h2>

          {monthlyData.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد بيانات لهذا العام</p>
            </div>
          ) : (
            <div className="space-y-4">
              {MONTH_NAMES.map((monthName, index) => {
                const monthNum = index + 1;
                const monthData = monthlyData.find(m => m.month === monthNum);
                const isCurrentMonth = new Date().getMonth() === index && new Date().getFullYear() === selectedYear;

                if (!monthData || monthData.total_points === 0) {
                  return (
                    <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg opacity-50">
                      <div className="w-24 text-sm font-medium text-gray-500">{monthName}</div>
                      <div className="flex-1 text-sm text-gray-400">لا توجد نقاط</div>
                    </div>
                  );
                }

                const barWidth = (monthData.total_points / maxPoints) * 100;
                const prevMonthData = monthlyData.find(m => m.month === monthNum - 1);
                const change = prevMonthData ? monthData.total_points - prevMonthData.total_points : 0;

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg transition-all ${
                      isCurrentMonth
                        ? 'bg-blue-50 border-2 border-blue-300 shadow-md'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-24">
                        <p className="text-sm font-medium text-gray-900">{monthName}</p>
                        {isCurrentMonth && (
                          <span className="text-xs text-blue-600 font-medium">الشهر الحالي</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xl font-bold text-gray-900">{monthData.total_points}</span>
                          {change !== 0 && (
                            <span className={`text-xs font-medium flex items-center gap-1 ${
                              change > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {change > 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {Math.abs(change)}
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-gray-600 mr-28">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>نقاط التبليغ: {monthData.reporter_points}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-teal-500" />
                        <span>نقاط الحل: {monthData.resolver_points}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>البلاغات: {monthData.report_count}</span>
                      </div>
                      {monthData.resolved_count > 0 && (
                        <div className="flex items-center gap-1">
                          <span>المحلولة: {monthData.resolved_count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl p-6 border border-blue-200">
          <h3 className="text-lg font-bold text-gray-900 mb-3">كيف تحسب النقاط؟</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">1-3</div>
              <div>
                <p className="font-medium text-gray-900">نقاط التبليغ</p>
                <p className="text-gray-700">يحددها المشرف حسب جودة البلاغ</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">+1</div>
              <div>
                <p className="font-medium text-gray-900">حل المشكلة بنفسك</p>
                <p className="text-gray-700">نقطة إضافية عند حل بلاغك الخاص</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 bg-teal-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">+2</div>
              <div>
                <p className="font-medium text-gray-900">مساعدة الآخرين</p>
                <p className="text-gray-700">نقطتان عند حل بلاغ شخص آخر</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Star className="w-8 h-8 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">تجديد شهري</p>
                <p className="text-gray-700">ترتيبك يتجدد كل شهر</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
