import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReportData {
  id: string;
  report_number: string;
  report_type: string;
  description: string;
  location: string;
  status: string;
  points_awarded: number;
  created_at: string;
  employee: {
    full_name: string;
    email: string;
    department: string;
  };
}

const TYPE_LABELS: Record<string, string> = {
  unsafe_act: "سلوك غير آمن",
  unsafe_condition: "وضع غير آمن",
  near_miss: "حادث كاد أن يقع",
  observation: "ملاحظة عامة",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "جاري العمل عليها",
  closed: "مغلق",
};

function generatePdfContent(reports: ReportData[]): string {
  const arabicDate = new Date().toLocaleDateString("ar-SA");

  let htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { width: 100%; padding: 20px; background: #f5f5f5; }
        .page { background: white; margin: 20px auto; padding: 40px; max-width: 900px; box-shadow: 0 0 10px rgba(0,0,0,0.1); page-break-after: always; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #1e40af; padding-bottom: 20px; }
        .header h1 { font-size: 24px; margin-bottom: 10px; color: #1e40af; }
        .header p { color: #666; font-size: 14px; }
        .date-info { text-align: center; margin-bottom: 30px; color: #666; }
        .report-item { margin-bottom: 40px; border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #fafafa; }
        .report-header { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb; }
        .report-number { font-weight: bold; color: #1e40af; font-size: 16px; }
        .report-status { padding: 5px 10px; border-radius: 4px; text-align: center; font-weight: bold; }
        .status-closed { background: #dcfce7; color: #166534; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-inprogress { background: #dbeafe; color: #0c4a6e; }
        .report-details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .detail-field { margin-bottom: 10px; }
        .detail-label { font-weight: bold; color: #1f2937; font-size: 13px; }
        .detail-value { color: #666; margin-top: 4px; word-wrap: break-word; }
        .description { margin-top: 20px; padding: 15px; background: white; border-right: 4px solid #1e40af; }
        .description-label { font-weight: bold; color: #1f2937; margin-bottom: 8px; }
        .description-text { color: #666; line-height: 1.8; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
  `;

  reports.forEach((report) => {
    const statusClass = report.status === "closed" ? "status-closed" : report.status === "pending" ? "status-pending" : "status-inprogress";
    const reportTypeLabel = TYPE_LABELS[report.report_type] || report.report_type;
    const statusLabel = STATUS_LABELS[report.status] || report.status;
    const createdDate = new Date(report.created_at).toLocaleDateString("ar-SA");

    htmlContent += `
      <div class="page">
        <div class="header">
          <h1>تقرير السلامة والصحة المهنية</h1>
          <p>نموذج تقرير رسمي</p>
        </div>

        <div class="date-info">
          <p>التاريخ: ${arabicDate}</p>
        </div>

        <div class="report-item">
          <div class="report-header">
            <div>
              <span class="report-number">رقم البلاغ: ${report.report_number}</span>
            </div>
            <div style="text-align: left;">
              <span class="report-status ${statusClass}">${statusLabel}</span>
            </div>
          </div>

          <div class="report-details">
            <div>
              <div class="detail-field">
                <span class="detail-label">نوع البلاغ:</span>
                <div class="detail-value">${reportTypeLabel}</div>
              </div>
              <div class="detail-field">
                <span class="detail-label">الموقع:</span>
                <div class="detail-value">${report.location || "-"}</div>
              </div>
            </div>
            <div>
              <div class="detail-field">
                <span class="detail-label">اسم الموظف المبلغ:</span>
                <div class="detail-value">${report.employee.full_name}</div>
              </div>
              <div class="detail-field">
                <span class="detail-label">القسم:</span>
                <div class="detail-value">${report.employee.department || "-"}</div>
              </div>
            </div>
          </div>

          <div class="report-details" style="margin-bottom: 0;">
            <div>
              <div class="detail-field">
                <span class="detail-label">النقاط المحصل عليها:</span>
                <div class="detail-value" style="font-weight: bold; color: #1e40af;">${report.points_awarded}</div>
              </div>
            </div>
            <div>
              <div class="detail-field">
                <span class="detail-label">تاريخ الإنشاء:</span>
                <div class="detail-value">${createdDate}</div>
              </div>
            </div>
          </div>

          <div class="description">
            <div class="description-label">وصف المشكلة:</div>
            <div class="description-text">${report.description}</div>
          </div>
        </div>

        <div class="footer">
          <p>تم إنشاء هذا التقرير بواسطة نظام إدارة البلاغات</p>
          <p>© جميع الحقوق محفوظة</p>
        </div>
      </div>
    `;
  });

  htmlContent += `
    </body>
    </html>
  `;

  return htmlContent;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { report_ids } = await req.json();

    if (!report_ids || !Array.isArray(report_ids) || report_ids.length === 0) {
      return new Response(JSON.stringify({ error: "report_ids مطلوب" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // جلب البلاغات
    const { data: reportsData, error } = await supabase
      .from("safety_reports")
      .select(
        `
        id,
        report_number,
        report_type,
        description,
        location,
        status,
        points_awarded,
        created_at,
        employee:profiles(full_name, email, department)
      `
      )
      .in("id", report_ids)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    if (!reportsData || reportsData.length === 0) {
      return new Response(JSON.stringify({ error: "لم يتم العثور على بلاغات" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlContent = generatePdfContent(reportsData as ReportData[]);

    return new Response(htmlContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "خطأ في المعالجة" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
