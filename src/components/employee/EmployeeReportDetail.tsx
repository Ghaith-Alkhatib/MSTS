import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, Send, Loader2, ImageIcon, Calendar, Upload, X, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { STATUS_LABELS, STATUS_DOT_COLORS, TYPE_LABELS } from '../../lib/adminHelpers';

interface ReportImage {
  id: string;
  image_url: string;
  created_at: string;
}

interface ResponseImage {
  id: string;
  image_url: string;
  created_at: string;
}

interface Response {
  id: string;
  response_text: string;
  corrective_action: string | null;
  created_at: string;
  admin: { full_name: string };
  response_images?: ResponseImage[];
}

interface ReportWithDetails {
  id: string;
  report_number: string;
  report_type: string;
  description: string;
  location: string | null;
  status: string;
  points_awarded: number;
  resolved_by_name: string | null;
  resolved_by_id: string | null;
  employee_id: string;
  created_at: string;
  updated_at: string;
  report_images: ReportImage[];
  report_responses: Response[];
}

export function EmployeeReportDetail({ reportId, onBack }: {
  reportId: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [report, setReport] = useState<ReportWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [responseText, setResponseText] = useState('');
  const [responseImages, setResponseImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const loadReport = async () => {
    try {
      const { data, error } = await supabase
        .from('safety_reports')
        .select(`
          *,
          report_images(*),
          report_responses(*, admin:profiles!report_responses_admin_id_fkey(full_name), response_images(*))
        `)
        .eq('id', reportId)
        .single();

      if (error) throw error;
      setReport(data as ReportWithDetails);
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setResponseImages((prev) => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setResponseImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (responseId: string) => {
    for (const file of responseImages) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${responseId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('safety-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('safety-images')
        .getPublicUrl(fileName);

      await supabase.from('response_images').insert({
        response_id: responseId,
        image_url: publicUrl,
      });
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !responseText.trim()) return;

    setIsSubmitting(true);
    try {
      const { data: responseData, error } = await supabase
        .from('report_responses')
        .insert({
          report_id: reportId,
          admin_id: user.id,
          response_text: responseText,
          corrective_action: null,
        })
        .select()
        .single();

      if (error) throw error;

      if (responseImages.length > 0) {
        await uploadImages(responseData.id);
      }

      setResponseText('');
      setResponseImages([]);
      loadReport();
    } catch (error) {
      console.error('Error submitting response:', error);
      alert('حدث خطأ أثناء إرسال الرد');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  const isClosed = report.status === 'closed';
  const canReply = !isClosed;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
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
              <h1 className="text-2xl font-bold text-gray-900">تفاصيل البلاغ</h1>
              <p className="text-sm text-gray-600 font-mono">{report.report_number}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-sm font-medium px-4 py-2 rounded-lg ${
              report.report_type === 'unsafe_act' ? 'bg-red-100 text-red-800' :
              report.report_type === 'unsafe_condition' ? 'bg-orange-100 text-orange-800' :
              report.report_type === 'near_miss' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {TYPE_LABELS[report.report_type] || report.report_type}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT_COLORS[report.status]}`} />
              <span className="text-sm font-medium text-gray-700">
                {STATUS_LABELS[report.status] || report.status}
              </span>
            </span>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">
                {new Date(report.created_at).toLocaleDateString('ar-SA', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            {report.points_awarded > 0 && (
              <span className="text-sm font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-lg">
                {report.points_awarded} نقاط
              </span>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">الوصف</h2>
            <p className="text-gray-700 leading-relaxed">{report.description}</p>
          </div>

          {report.location && (
            <div>
              <div className="flex items-center gap-2 text-gray-700 mb-1">
                <MapPin className="w-5 h-5" />
                <h2 className="text-lg font-semibold">الموقع</h2>
              </div>
              <p className="text-gray-600">{report.location}</p>
            </div>
          )}

          {report.report_images && report.report_images.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-gray-700 mb-3">
                <ImageIcon className="w-5 h-5" />
                <h2 className="text-lg font-semibold">الصور المرفقة</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {report.report_images.map((img) => (
                  <img
                    key={img.id}
                    src={img.image_url}
                    alt="صورة البلاغ"
                    className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setSelectedImage(img.image_url)}
                  />
                ))}
              </div>
            </div>
          )}

          {isClosed && report.resolved_by_name && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 mb-1">
                <UserCheck className="w-5 h-5" />
                <h3 className="font-semibold">تم حل المشكلة بواسطة</h3>
              </div>
              <p className="text-green-700">{report.resolved_by_name}</p>
            </div>
          )}
        </div>

        {report.report_responses && report.report_responses.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 text-gray-700 mb-4">
              <Clock className="w-5 h-5" />
              <h2 className="text-lg font-semibold">الردود والإجراءات</h2>
            </div>
            <div className="space-y-4">
              {report.report_responses.map((response) => (
                <div key={response.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900">{response.admin.full_name}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(response.created_at).toLocaleDateString('ar-SA', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-gray-700 mb-2">{response.response_text}</p>
                  {response.corrective_action && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <p className="text-sm font-medium text-gray-700 mb-1">الإجراء التصحيحي:</p>
                      <p className="text-sm text-gray-600">{response.corrective_action}</p>
                    </div>
                  )}
                  {response.response_images && response.response_images.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <p className="text-sm font-medium text-gray-700 mb-2">الصور المرفقة:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {response.response_images.map((img) => (
                          <img
                            key={img.id}
                            src={img.image_url}
                            alt="صورة الرد"
                            className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setSelectedImage(img.image_url)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {canReply && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">إضافة رد</h2>
            <form onSubmit={handleSubmitResponse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الرد</label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={4}
                  placeholder="اكتب ردك أو ملاحظاتك..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">إرفاق صور (اختياري)</label>
                <div className="space-y-3">
                  <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                    <Upload className="w-5 h-5 text-gray-400 ml-2" />
                    <span className="text-gray-600">اختر صور للإرفاق</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                  {responseImages.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {responseImages.map((file, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`معاينة ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 left-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !responseText.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جارٍ الإرسال...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>إرسال الرد</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {isClosed && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
            هذا البلاغ مغلق ولا يمكن إضافة ردود جديدة
          </div>
        )}
      </main>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="صورة مكبرة"
            className="max-w-full max-h-full rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
