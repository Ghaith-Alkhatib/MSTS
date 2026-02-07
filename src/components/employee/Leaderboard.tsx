import { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, Medal, Award, Star, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface LeaderboardEntry {
  id: string;
  full_name: string;
  email: string;
  department: string;
  points: number;
  report_count: number;
  rank: number;
}

export function Leaderboard({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [period]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          department,
          points
        `)
        .eq('role', 'employee')
        .order('points', { ascending: false });

      const { data: profiles, error: profilesError } = await query;
      if (profilesError) throw profilesError;

      const now = new Date();
      let startDate: Date;

      if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
      } else {
        startDate = new Date(0);
      }

      const leaderboardData: LeaderboardEntry[] = await Promise.all(
        profiles.map(async (profile, index) => {
          const { count } = await supabase
            .from('safety_reports')
            .select('*', { count: 'exact', head: true })
            .eq('employee_id', profile.id)
            .gte('created_at', startDate.toISOString());

          return {
            ...profile,
            report_count: count || 0,
            rank: index + 1,
          };
        })
      );

      leaderboardData.sort((a, b) => {
        if (b.report_count !== a.report_count) {
          return b.report_count - a.report_count;
        }
        return b.points - a.points;
      });

      leaderboardData.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      setLeaderboard(leaderboardData);

      const currentUserRank = leaderboardData.find(entry => entry.id === user?.id);
      setUserRank(currentUserRank || null);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-8 h-8 text-yellow-500" />;
      case 2:
        return <Medal className="w-8 h-8 text-gray-400" />;
      case 3:
        return <Award className="w-8 h-8 text-orange-600" />;
      default:
        return <Star className="w-8 h-8 text-gray-300" />;
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
      case 3:
        return 'bg-gradient-to-r from-orange-400 to-orange-600 text-white';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getBadgeTitle = (points: number) => {
    if (points >= 100) return '🏆 بطل السلامة الذهبي';
    if (points >= 50) return '🥈 بطل السلامة الفضي';
    if (points >= 20) return '🥉 بطل السلامة البرونزي';
    return '⭐ مساهم في السلامة';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50" dir="rtl">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
              <h1 className="text-2xl font-bold text-gray-900">لوحة المتصدرين</h1>
              <p className="text-sm text-gray-600">أبطال السلامة</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {userRank && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">ترتيبك الحالي</p>
                <p className="text-4xl font-bold">#{userRank.rank}</p>
                <p className="text-blue-100 text-sm mt-2">{getBadgeTitle(userRank.points)}</p>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-6 h-6" />
                  <span className="text-2xl font-bold">{userRank.report_count}</span>
                  <span className="text-blue-100">بلاغ</span>
                </div>
                <div className="flex items-center gap-3">
                  <Star className="w-6 h-6" />
                  <span className="text-2xl font-bold">{userRank.points}</span>
                  <span className="text-blue-100">نقطة</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              المتصدرون
            </h2>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'month' | 'year' | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="month">هذا الشهر</option>
              <option value="year">هذا العام</option>
              <option value="all">الكل</option>
            </select>
          </div>

          {leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد بيانات حتى الآن</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaderboard.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                    entry.id === user?.id
                      ? 'bg-blue-50 border-2 border-blue-300 shadow-md'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className={`flex items-center justify-center w-16 h-16 rounded-full ${getRankBadge(entry.rank)}`}>
                    {entry.rank <= 3 ? (
                      <div className="text-2xl font-bold">#{entry.rank}</div>
                    ) : (
                      <div className="text-xl font-medium">#{entry.rank}</div>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{entry.full_name}</h3>
                    {entry.department && (
                      <p className="text-sm text-gray-600">{entry.department}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{getBadgeTitle(entry.points)}</p>
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl font-bold text-gray-900">{entry.report_count}</span>
                      <span className="text-sm text-gray-600">بلاغ</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500" />
                      <span className="text-lg font-semibold text-gray-700">{entry.points}</span>
                    </div>
                  </div>

                  {entry.rank <= 3 && (
                    <div className="mr-2">
                      {getRankIcon(entry.rank)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-6 border border-amber-200">
          <h3 className="text-lg font-bold text-gray-900 mb-3">نظام النقاط</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">10</div>
              <span className="text-gray-700">بلاغ بدون صورة</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">15</div>
              <span className="text-gray-700">بلاغ مع صورة</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold">20</div>
              <span className="text-gray-700">نقاط إضافية عند الإغلاق</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="w-8 h-8 text-amber-600" />
              <span className="text-gray-700">100+ نقطة = بطل ذهبي</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
