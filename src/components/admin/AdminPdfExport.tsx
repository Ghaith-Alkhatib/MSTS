import { useState } from 'react';
import { FileText, Download, X } from 'lucide-react';
import { SafetyReport } from '../../types';
import { supabase } from '../../lib/supabase';

interface AdminPdfExportProps {
  isOpen: boolean;
  onClose: () => void;
  reports: SafetyReport[];
}

export function AdminPdfExport({ isOpen, onClose, reports }: AdminPdfExportProps) {
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReports = reports.filter(r =>
    r.report_number.includes(searchTerm) ||
    r.employee?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleReportSelection = (reportId: string) => {
    setSelectedReports(prev =>
      prev.includes(reportId)
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedReports.length === filteredReports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(filteredReports.map(r => r.id));
    }
  };

  const handleExportPdf = async () => {
    if (selectedReports.length === 0) {
      alert('يرجى اختيار بلاغ واحد على الأقل');
      return;
    }

    setIsDownloading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report-pdf`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ report_ids: selectedReports }),
      });

      if (!response.ok) {
        throw new Error('فشل في إنشاء PDF');
      }

      const htmlContent = await response.text();

      // استخدام html2pdf إذا كان متاحاً، أو طباعة مباشرة
      const printWindow = window.open('', '', 'width=1000,height=800');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
      }

      setSelectedReports([]);
      onClose();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('حدث خطأ أثناء تصدير PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">تصدير البلاغات كـ PDF</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <input
              type="text"
              placeholder="بحث برقم البلاغ أو اسم الموظف أو الموقع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedReports.length === filteredReports.length && filteredReports.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">اختر الكل</span>
            </label>
            <span className="text-sm text-gray-600">
              {selectedReports.length} من {filteredReports.length} محدد
            </span>
          </div>

          <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
            {filteredReports.length === 0 ? (
              <p className="text-center text-gray-500 py-6">لا توجد بلاغات</p>
            ) : (
              filteredReports.map((report) => (
                <label
                  key={report.id}
                  className="flex items-start gap-3 p-3 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedReports.includes(report.id)}
                    onChange={() => toggleReportSelection(report.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{report.report_number}</p>
                    <p className="text-sm text-gray-600">
                      {report.employee?.full_name} {report.employee?.department ? `(${report.employee.department})` : ''}
                    </p>
                    {report.location && (
                      <p className="text-sm text-gray-500">{report.location}</p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${
                    report.status === 'closed' ? 'bg-green-100 text-green-800' :
                    report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {report.status === 'closed' ? 'مغلق' : report.status === 'pending' ? 'قيد الانتظار' : 'جاري العمل'}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200 flex-shrink-0 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleExportPdf}
            disabled={selectedReports.length === 0 || isDownloading}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            {isDownloading ? 'جاري الإنشاء...' : `تصدير ${selectedReports.length} بلاغ`}
          </button>
        </div>
      </div>
    </div>
  );
}
