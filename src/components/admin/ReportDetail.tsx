import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, Send, Loader2, ImageIcon, User, Calendar, Upload, X } from 'lucide-react';
import { SafetyReport } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
  admin: {
    full_name: string;
  };
  response_images?: ResponseImage[];
}

interface ReportWithDetails {
  id: string;
  report_number: string;
  report_type: string;
  description: string;
  location: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  employee_id: string;
  employee: {
    full_name: string;
    email: string;
    department: string;
  };
  report_images: ReportImage[];
  report_responses: Response[];
}

export function ReportDetail({ report, onBack, onUpdate }: {
  report: SafetyReport;
  onBack: () => void;
  onUpdate: () => void;
}) {
  const { user } = useAuth();
  const [reportDetails, setReportDetails] = useState<ReportWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newStatus, setNewStatus] = useState<string>(report.status);
  const [responseText, setResponseText] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [responseImages, setResponseImages] = useState<File[]>([]);
  const [, setUploadingImages] = useState(false);

  useEffect(() => {
    loadReportDetails();
  }, [report.id]);

  const loadReportDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('safety_reports')
        .select(`
          *,
          employee:profiles!safety_reports_employee_id_fkey(full_name, email, department),
          report_images(*),
          report_responses(*, admin:profiles!report_responses_admin_id_fkey(full_name), response_images(*))
        `)
        .eq('id', report.id)
        .single();

      if (error) throw error;
      setReportDetails(data as ReportWithDetails);
    } catch (error) {
      console.error('Error loading report details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (newStatus === report.status) return;

    try {
      const { error } = await supabase
        .from('safety_reports')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', report.id);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setResponseImages((prev) => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setResponseImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadResponseImages = async (responseId: string) => {
    const uploadedUrls: string[] = [];

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

      uploadedUrls.push(publicUrl);

      await supabase.from('response_images').insert({
        response_id: responseId,
        image_url: publicUrl,
      });
    }

    return uploadedUrls;
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !responseText.trim()) return;

    setIsSubmitting(true);
    try {
      const { data: responseData, error } = await supabase
        .from('report_responses')
        .insert({
          report_id: report.id,
          admin_id: user.id,
          response_text: responseText,
          corrective_action: correctiveAction || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (responseImages.length > 0) {
        setUploadingImages(true);
        await uploadResponseImages(responseData.id);
      }

      setResponseText('');
      setCorrectiveAction('');
      setResponseImages([]);
      loadReportDetails();
      onUpdate();
    } catch (error) {
      console.error('Error submitting response:', error);
      alert('حدث خطأ أثناء إرسال الرد');
    } finally {
      setIsSubmitting(false);
      setUploadingImages(false);
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

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'unsafe_act':
        return 'bg-red-100 text-red-800';
      case 'unsafe_condition':
        return 'bg-orange-100 text-orange-800';
      case 'near_miss':
        return 'bg-yellow-100 text-yellow-800';
      case 'observation':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading || !reportDetails) {
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
              <p className="text-sm text-gray-600 font-mono">{reportDetails.report_number}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-sm font-medium px-4 py-2 rounded-lg ${getReportTypeColor(reportDetails.report_type)}`}>
              {getReportTypeText(reportDetails.report_type)}
            </span>
            <div className="flex items-center gap-2 text-gray-600">
              <User className="w-4 h-4" />
              <span className="text-sm">{reportDetails.employee.full_name}</span>
            </div>
            {reportDetails.employee.department && (
              <span className="text-sm text-gray-600">
                {reportDetails.employee.department}
              </span>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">
                {new Date(reportDetails.created_at).toLocaleDateString('ar-SA', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">الوصف</h2>
            <p className="text-gray-700 leading-relaxed">{reportDetails.description}</p>
          </div>

          {reportDetails.location && (
            <div>
              <div className="flex items-center gap-2 text-gray-700 mb-1">
                <MapPin className="w-5 h-5" />
                <h2 className="text-lg font-semibold">الموقع</h2>
              </div>
              <p className="text-gray-600">{reportDetails.location}</p>
            </div>
          )}

          {reportDetails.report_images && reportDetails.report_images.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-gray-700 mb-3">
                <ImageIcon className="w-5 h-5" />
                <h2 className="text-lg font-semibold">الصور المرفقة</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {reportDetails.report_images.map((img) => (
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

          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">تحديث الحالة</h2>
            <div className="flex items-center gap-3">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pending">قيد الانتظار</option>
                <option value="in_review">قيد المراجعة</option>
                <option value="action_taken">تم اتخاذ إجراء</option>
                <option value="closed">مغلق</option>
              </select>
              <button
                onClick={handleUpdateStatus}
                disabled={newStatus === report.status}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                تحديث
              </button>
            </div>
          </div>
        </div>

        {reportDetails.report_responses && reportDetails.report_responses.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 text-gray-700 mb-4">
              <Clock className="w-5 h-5" />
              <h2 className="text-lg font-semibold">الردود والإجراءات</h2>
            </div>
            <div className="space-y-4">
              {reportDetails.report_responses.map((response) => (
                <div key={response.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900">{response.admin.full_name}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(response.created_at).toLocaleDateString('ar-SA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
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
                placeholder="اكتب ردك على البلاغ..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">الإجراء التصحيحي (اختياري)</label>
              <textarea
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="اكتب الإجراء التصحيحي المتخذ..."
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
