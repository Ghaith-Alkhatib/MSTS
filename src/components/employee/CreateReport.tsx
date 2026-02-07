import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, X, MapPin, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { offlineSync } from '../../lib/offlineSync';

type ReportType = 'unsafe_act' | 'unsafe_condition' | 'near_miss' | 'observation';

export function CreateReport({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('observation');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImages(prev => [...prev, dataUrl]);
      };

      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      if (isOffline) {
        const reportId = crypto.randomUUID();
        const imageIds = images.map((_, idx) => `${reportId}-${idx}`);

        images.forEach((dataUrl, idx) => {
          offlineSync.saveOfflineImage(imageIds[idx], dataUrl);
        });

        offlineSync.savePendingReport({
          id: reportId,
          report_type: reportType,
          description,
          location: location || null,
          images: imageIds,
          created_at: new Date().toISOString(),
        });

        setSubmitSuccess(true);
        setTimeout(() => {
          onBack();
        }, 2000);
      } else {
        const reportNumber = `HSE-${Date.now().toString().slice(-8)}`;

        const { data: newReport, error } = await supabase
          .from('safety_reports')
          .insert({
            report_number: reportNumber,
            employee_id: user.id,
            report_type: reportType,
            description,
            location: location || null,
            status: 'pending',
            points_awarded: images.length > 0 ? 15 : 10,
          })
          .select()
          .single();

        if (error) throw error;

        if (images.length > 0 && newReport) {
          const bucket = supabase.storage.from('safety-images');

          for (let i = 0; i < images.length; i++) {
            const blob = await fetch(images[i]).then(r => r.blob());
            const fileName = `${newReport.id}/${Date.now()}-${i}.jpg`;

            const { error: uploadError } = await bucket.upload(fileName, blob);

            if (!uploadError) {
              const { data: urlData } = bucket.getPublicUrl(fileName);

              await supabase.from('report_images').insert({
                report_id: newReport.id,
                image_url: urlData.publicUrl,
              });
            }
          }
        }

        await supabase.rpc('increment', {
          row_id: user.id,
          x: images.length > 0 ? 15 : 10
        });

        setSubmitSuccess(true);
        setTimeout(() => {
          onBack();
        }, 2000);
      }
    } catch (error) {
      console.error('Error creating report:', error);
      alert('حدث خطأ أثناء إنشاء البلاغ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reportTypes = [
    { value: 'unsafe_act', label: 'سلوك غير آمن', color: 'bg-red-100 text-red-800 border-red-300' },
    { value: 'unsafe_condition', label: 'وضع غير آمن', color: 'bg-orange-100 text-orange-800 border-orange-300' },
    { value: 'near_miss', label: 'حادث كاد أن يقع', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { value: 'observation', label: 'ملاحظة عامة', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  ];

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">تم إنشاء البلاغ بنجاح</h2>
          <p className="text-gray-600">
            {isOffline
              ? 'سيتم رفع البلاغ تلقائياً عند الاتصال بالإنترنت'
              : 'شكراً لمساهمتك في تحسين السلامة'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
              <h1 className="text-2xl font-bold text-gray-900">إنشاء بلاغ جديد</h1>
              {isOffline && (
                <p className="text-sm text-orange-600">وضع عدم الاتصال - سيتم الحفظ محلياً</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">نوع البلاغ</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {reportTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setReportType(type.value as ReportType)}
                  className={`px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                    reportType === type.value
                      ? type.color
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الوصف</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={5}
              placeholder="اكتب وصف مفصل للملاحظة..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline ml-1" />
              الموقع (اختياري)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="مثال: منطقة التركيب - القطاع A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Camera className="w-4 h-4 inline ml-1" />
              الصور
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleImageCapture}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">انقر لالتقاط أو اختيار صور</p>
            </button>

            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img}
                      alt={`صورة ${idx + 1}`}
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جارٍ الإرسال...</span>
              </>
            ) : (
              <span>إنشاء البلاغ</span>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
