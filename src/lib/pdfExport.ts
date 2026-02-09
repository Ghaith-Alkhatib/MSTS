interface ReportForPdf {
  report_number: string;
  report_type: string;
  description: string;
  location: string | null;
  status: string;
  points_awarded: number;
  created_at: string;
  updated_at: string;
  employee: {
    full_name: string;
    email: string;
    department?: string | null;
  };
  report_images?: Array<{ image_url: string }>;
  report_responses?: Array<{
    response_text: string;
    corrective_action: string | null;
    created_at: string;
    admin: {
      full_name: string;
    };
  }>;
  resolvers?: Array<{
    full_name: string;
    points_awarded: number;
  }>;
}

const getReportTypeText = (type: string) => {
  switch (type) {
    case 'unsafe_act': return 'سلوك غير آمن';
    case 'unsafe_condition': return 'وضع غير آمن';
    case 'near_miss': return 'حادث كاد أن يقع';
    case 'observation': return 'ملاحظة عامة';
    default: return type;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending': return 'قيد الانتظار';
    case 'in_progress': return 'جاري العمل عليها';
    case 'closed': return 'مغلق';
    default: return status;
  }
};

export const exportReportToPdf = (report: ReportForPdf) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بفتح النوافذ المنبثقة لتنزيل PDF');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>البلاغ ${report.report_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 40px;
          line-height: 1.8;
          color: #333;
          background: white;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid #2563eb;
        }
        .header h1 {
          color: #1e40af;
          font-size: 28px;
          margin-bottom: 10px;
        }
        .report-number {
          font-family: 'Courier New', monospace;
          font-size: 18px;
          font-weight: bold;
          color: #666;
          background: #f3f4f6;
          padding: 8px 16px;
          border-radius: 6px;
          display: inline-block;
        }
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 20px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e7eb;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }
        .info-item {
          background: #f9fafb;
          padding: 12px;
          border-radius: 6px;
          border-right: 4px solid #3b82f6;
        }
        .info-label {
          font-weight: bold;
          color: #4b5563;
          font-size: 14px;
          margin-bottom: 5px;
        }
        .info-value {
          color: #1f2937;
          font-size: 16px;
        }
        .badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: bold;
        }
        .badge-type {
          background: #dbeafe;
          color: #1e40af;
        }
        .badge-status {
          background: #d1fae5;
          color: #065f46;
        }
        .badge-pending {
          background: #fef3c7;
          color: #92400e;
        }
        .badge-progress {
          background: #dbeafe;
          color: #1e40af;
        }
        .description {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          border-right: 4px solid #10b981;
          margin-top: 10px;
          font-size: 16px;
          line-height: 1.8;
        }
        .response-item {
          background: #f3f4f6;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 15px;
          border-right: 4px solid #6366f1;
        }
        .response-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .response-admin {
          font-weight: bold;
          color: #4f46e5;
        }
        .response-date {
          color: #6b7280;
          font-size: 14px;
        }
        .response-text {
          margin-bottom: 10px;
          font-size: 15px;
        }
        .corrective-action {
          background: #fef3c7;
          padding: 12px;
          border-radius: 6px;
          margin-top: 10px;
          border-right: 3px solid #f59e0b;
        }
        .corrective-label {
          font-weight: bold;
          color: #92400e;
          margin-bottom: 5px;
          font-size: 14px;
        }
        .resolver-item {
          background: #d1fae5;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 10px;
          border-right: 4px solid #10b981;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .resolver-name {
          font-weight: bold;
          color: #065f46;
        }
        .resolver-points {
          background: #059669;
          color: white;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 14px;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>تقرير البلاغ الأمني</h1>
        <div class="report-number">${report.report_number}</div>
      </div>

      <div class="section">
        <div class="section-title">معلومات البلاغ</div>
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">نوع البلاغ</div>
            <div class="info-value">
              <span class="badge badge-type">${getReportTypeText(report.report_type)}</span>
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">الحالة</div>
            <div class="info-value">
              <span class="badge ${report.status === 'closed' ? 'badge-status' : report.status === 'pending' ? 'badge-pending' : 'badge-progress'}">
                ${getStatusText(report.status)}
              </span>
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">مقدم البلاغ</div>
            <div class="info-value">${report.employee.full_name}</div>
          </div>
          <div class="info-item">
            <div class="info-label">البريد الإلكتروني</div>
            <div class="info-value">${report.employee.email}</div>
          </div>
          ${report.employee.department ? `
          <div class="info-item">
            <div class="info-label">القسم</div>
            <div class="info-value">${report.employee.department}</div>
          </div>
          ` : ''}
          ${report.location ? `
          <div class="info-item">
            <div class="info-label">الموقع</div>
            <div class="info-value">${report.location}</div>
          </div>
          ` : ''}
          <div class="info-item">
            <div class="info-label">النقاط الممنوحة</div>
            <div class="info-value">${report.points_awarded} نقطة</div>
          </div>
          <div class="info-item">
            <div class="info-label">تاريخ الإنشاء</div>
            <div class="info-value">${new Date(report.created_at).toLocaleDateString('ar-SA', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">وصف البلاغ</div>
        <div class="description">${report.description}</div>
      </div>

      ${report.resolvers && report.resolvers.length > 0 ? `
      <div class="section">
        <div class="section-title">الموظفون الذين أغلقوا البلاغ</div>
        ${report.resolvers.map(resolver => `
          <div class="resolver-item">
            <div class="resolver-name">${resolver.full_name}</div>
            <div class="resolver-points">${resolver.points_awarded} نقطة</div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${report.report_responses && report.report_responses.length > 0 ? `
      <div class="section">
        <div class="section-title">الردود والإجراءات التصحيحية</div>
        ${report.report_responses.map(response => `
          <div class="response-item">
            <div class="response-header">
              <span class="response-admin">${response.admin.full_name}</span>
              <span class="response-date">${new Date(response.created_at).toLocaleDateString('ar-SA', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </div>
            <div class="response-text">${response.response_text}</div>
            ${response.corrective_action ? `
            <div class="corrective-action">
              <div class="corrective-label">الإجراء التصحيحي:</div>
              <div>${response.corrective_action}</div>
            </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
      ` : ''}

      <div class="footer">
        <p>تم إنشاء هذا التقرير بواسطة نظام إدارة البلاغات الأمنية - MASDAR STS</p>
        <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
        window.onafterprint = function() {
          window.close();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
