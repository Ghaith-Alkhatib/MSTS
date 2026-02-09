import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, Send, Loader2, ImageIcon, User, Calendar, Upload, X, Star, UserCheck, Download, Check } from 'lucide-react';
import { SafetyReport } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { exportReportToPdf } from '../../lib/pdfExport';

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

interface EmployeeOption {
  id: string;
  full_name: string;
  department: string | null;
}

interface ReportResolver {
  id: string;
  resolver_id: string;
  points_awarded: number;
  resolver: {
    full_name: string;
  };
}

interface ReportWithDetails {
  id: string;
  report_number: string;
  report_type: string;
  description: string;
  location: string | null;
  status: string;
  points_awarded: number;
  resolved_by_id: string | null;
  resolved_by_name: string | null;
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
  report_resolvers?: ReportResolver[];
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
  const [pointsToAward, setPointsToAward] = useState<number>(0);
  const [selectedResolvers, setSelectedResolvers] = useState<string[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [responseText, setResponseText] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [responseImages, setResponseImages] = useState<File[]>([]);
  const [, setUploadingImages] = useState(false);

  useEffect(() => {
    loadReportDetails();
    loadEmployees();
  }, [report.id]);

  const loadReportDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('safety_reports')
        .select(`
          *,
          employee:profiles!safety_reports_employee_id_fkey(full_name, email, department),
          report_images(*),
          report_responses(*, admin:profiles!report_responses_admin_id_fkey(full_name), response_images(*)),
          report_resolvers(*, resolver:profiles!report_resolvers_resolver_id_fkey(full_name))
        `)
        .eq('id', report.id)
        .single();

      if (error) throw error;
      const details = data as ReportWithDetails;
      setReportDetails(details);
      setPointsToAward(details.points_awarded || 0);

      if (details.report_resolvers && details.report_resolvers.length > 0) {
        setSelectedResolvers(details.report_resolvers.map(r => r.resolver_id));
      }
    } catch (error) {
      console.error('Error loading report details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, department')
      .eq('role', 'employee')
      .order('full_name');

    if (!error && data) {
      setEmployees(data);
    }
  };

  const handleUpdateStatus = async () => {
    if (!reportDetails) return;

    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        points_awarded: pointsToAward,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'closed') {
        if (selectedResolvers.length === 0) {
          alert('يرجى تحديد الأشخاص الذين أغلقوا البلاغ');
          return;
        }

        const existingResolverIds = reportDetails.report_resolvers?.map(r => r.resolver_id) || [];
        const resolversToAdd = selectedResolvers.filter(id => !existingResolverIds.includes(id));
        const resolversToRemove = existingResolverIds.filter(id => !selectedResolvers.includes(id));

        for (const resolverId of resolversToAdd) {
          const bonusPoints = resolverId === reportDetails.employee_id ? 1 : 2;

          await supabase.from('report_resolvers').insert({
            report_id: report.id,
            resolver_id: resolverId,
            points_awarded: bonusPoints,
          });

          await supabase.rpc('increment', {
            row_id: resolverId,
            x: bonusPoints,
          });
        }

        for (const resolverId of resolversToRemove) {
          const resolverRecord = reportDetails.report_resolvers?.find(r => r.resolver_id === resolverId);
          if (resolverRecord) {
            await supabase.rpc('increment', {
              row_id: resolverId,
              x: -resolverRecord.points_awarded,
            });
            await supabase.from('report_resolvers').delete().eq('id', resolverRecord.id);
          }
        }
      }

      if (pointsToAward > 0 && pointsToAward !== reportDetails.points_awarded) {
        const diff = pointsToAward - reportDetails.points_awarded;
        if (diff !== 0) {
          await supabase.rpc('increment', {
            row_id: reportDetails.employee_id,
            x: diff,
          });
        }
      }

      const { error } = await supabase
        .from('safety_reports')
        .update(updateData)
        .eq('id', report.id);

      if (error) throw error;
      await loadReportDetails();
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
      case 'unsafe_act': return 'سلوك غير آمن';
      case 'unsafe_condition': return 'وضع غير آمن';
      case 'near_miss': return 'حادث كاد أن يقع';
      case 'observation': return 'ملاحظة عامة';
      default: return type;
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'unsafe_act': return 'bg-red-100 text-red-800';
      case 'unsafe_condition': return 'bg-orange-100 text-orange-800';
      case 'near_miss': return 'bg-yellow-100 text-yellow-800';
      case 'observation': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading || !reportDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">...</p>
        </div>
      </div>
    );
  }

  const isClosed = reportDetails.status === 'closed';

  const handleDownloadPdf = () => {
    if (!reportDetails) return;

    const reportForPdf = {
      report_number: reportDetails.report_number,
      report_type: reportDetails.report_type,
      description: reportDetails.description,
      location: reportDetails.location,
      status: reportDetails.status,
      points_awarded: reportDetails.points_awarded,
      created_at: reportDetails.created_at,
      updated_at: reportDetails.updated_at,
      employee: reportDetails.employee,
      report_images: reportDetails.report_images,
      report_responses: reportDetails.report_responses,
      resolvers: reportDetails.report_resolvers?.map(r => ({
        full_name: r.resolver.full_name,
        points_awarded: r.points_awarded,
      })),
    };

    exportReportToPdf(reportForPdf);
  };

  const toggleResolver = (resolverId: string) => {
    setSelectedResolvers(prev =>
      prev.includes(resolverId)
        ? prev.filter(id => id !== resolverId)
        : [...prev, resolverId]
    );
  };

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
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              title="تنزيل PDF"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
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
              <span className="text-sm text-gray-600">{reportDetails.employee.department}</span>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">
                {new Date(reportDetails.created_at).toLocaleDateString('ar-SA', {
                  year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
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

          {isClosed && reportDetails.report_resolvers && reportDetails.report_resolvers.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 mb-3">
                <UserCheck className="w-5 h-5" />
                <h3 className="font-semibold">الموظفون الذين أغلقوا البلاغ</h3>
              </div>
              <div className="space-y-2">
                {reportDetails.report_resolvers.map((resolver) => (
                  <div key={resolver.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <span className="text-green-700 font-medium">{resolver.resolver.full_name}</span>
                    <span className="text-green-600 text-sm bg-green-100 px-3 py-1 rounded-full">
                      +{resolver.points_awarded} نقطة
                    </span>
                  </div>
                ))}
              </div>
              {reportDetails.points_awarded > 0 && (
                <p className="text-green-600 text-sm mt-3">
                  النقاط الممنوحة للتقرير: {reportDetails.points_awarded}
                </p>
              )}
            </div>
          )}

          {!isClosed && (
            <div className="border-t pt-6 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900">تحديث البلاغ</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الحالة</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="pending">قيد الانتظار</option>
                  <option value="in_progress">جاري العمل عليها</option>
                  <option value="closed">مغلق</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Star className="w-4 h-4 inline ml-1" />
                  تقييم البلاغ (نقاط)
                </label>
                <div className="flex items-center gap-3">
                  {[1, 2, 3].map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setPointsToAward(pts)}
                      className={`flex-1 py-3 rounded-lg border-2 font-bold text-lg transition-all ${
                        pointsToAward === pts
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {pts} {pts === 1 ? 'نقطة' : 'نقاط'}
                    </button>
                  ))}
                  {pointsToAward > 0 && (
                    <button
                      type="button"
                      onClick={() => setPointsToAward(0)}
                      className="px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-all text-sm"
                    >
                      بدون نقاط
                    </button>
                  )}
                </div>
              </div>

              {newStatus === 'closed' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-4">
                  <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    من أغلق هذه المشكلة؟ (يمكن اختيار أكثر من موظف)
                  </h3>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {[reportDetails.employee, ...employees.filter(e => e.id !== reportDetails.employee_id)]
                      .map((emp) => {
                        const isReporter = emp.id === reportDetails.employee_id;
                        const isSelected = selectedResolvers.includes(emp.id);
                        const bonusPoints = isReporter ? 1 : 2;

                        return (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => toggleResolver(emp.id)}
                            className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-white shadow-md'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-gray-900">
                                  {emp.full_name}
                                  {isReporter && (
                                    <span className="text-xs text-blue-600 mr-2">(مقدم البلاغ)</span>
                                  )}
                                </div>
                                {emp.department && (
                                  <div className="text-xs text-gray-500">{emp.department}</div>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-medium text-blue-600">
                              +{bonusPoints} نقطة
                            </span>
                          </button>
                        );
                      })}
                  </div>

                  {selectedResolvers.length > 0 && (
                    <div className="bg-white p-3 rounded-lg border border-blue-300">
                      <p className="text-sm text-blue-900">
                        عدد الموظفين المحددين: <span className="font-bold">{selectedResolvers.length}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleUpdateStatus}
                disabled={newStatus === 'closed' && selectedResolvers.length === 0}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                تحديث البلاغ
              </button>
            </div>
          )}
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

        {!isClosed && (
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
                    <span>...</span>
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
