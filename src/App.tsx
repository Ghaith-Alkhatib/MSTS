import { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/auth/Login';
import { Register } from './components/auth/Register';
import { EmployeeDashboard } from './components/employee/EmployeeDashboard';
import { EmployeeReportDetail } from './components/employee/EmployeeReportDetail';
import { CreateReport } from './components/employee/CreateReport';
import { Leaderboard } from './components/employee/Leaderboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ReportDetail } from './components/admin/ReportDetail';
import { SafetyReport } from './types';
import { supabase } from './lib/supabase';

type View = 'dashboard' | 'create-report' | 'leaderboard' | 'report-detail' | 'employee-report-detail';

function AppContent() {
  const { user, profile, role, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedReport, setSelectedReport] = useState<SafetyReport | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const handleNavigateToReport = useCallback(async (reportId: string) => {
    if (role === 'admin') {
      const { data, error } = await supabase
        .from('safety_reports')
        .select('*')
        .eq('id', reportId)
        .maybeSingle();

      if (!error && data) {
        setSelectedReport(data as SafetyReport);
        setCurrentView('report-detail');
      }
    } else {
      setSelectedReportId(reportId);
      setCurrentView('employee-report-detail');
    }
  }, [role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return authMode === 'login' ? (
      <Login onToggleMode={() => setAuthMode('register')} />
    ) : (
      <Register onToggleMode={() => setAuthMode('login')} />
    );
  }

  if (role === 'admin') {
    if (currentView === 'report-detail' && selectedReport) {
      return (
        <ReportDetail
          report={selectedReport}
          onBack={() => {
            setCurrentView('dashboard');
            setSelectedReport(null);
          }}
          onUpdate={() => {
            setCurrentView('dashboard');
            setSelectedReport(null);
          }}
        />
      );
    }

    return (
      <AdminDashboard
        onViewReport={(report) => {
          setSelectedReport(report);
          setCurrentView('report-detail');
        }}
        onNavigateToReport={handleNavigateToReport}
      />
    );
  }

  switch (currentView) {
    case 'create-report':
      return (
        <CreateReport
          onBack={() => setCurrentView('dashboard')}
        />
      );
    case 'leaderboard':
      return (
        <Leaderboard
          onBack={() => setCurrentView('dashboard')}
        />
      );
    case 'employee-report-detail':
      if (selectedReportId) {
        return (
          <EmployeeReportDetail
            reportId={selectedReportId}
            onBack={() => {
              setCurrentView('dashboard');
              setSelectedReportId(null);
            }}
          />
        );
      }
      return null;
    default:
      return (
        <EmployeeDashboard
          onCreateReport={() => setCurrentView('create-report')}
          onViewLeaderboard={() => setCurrentView('leaderboard')}
          onViewReport={(reportId) => {
            setSelectedReportId(reportId);
            setCurrentView('employee-report-detail');
          }}
        />
      );
  }
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
