import { supabase } from './supabase';
import { PendingReport } from '../types';

const PENDING_REPORTS_KEY = 'pending_safety_reports';
const OFFLINE_IMAGES_KEY = 'offline_images';

export const offlineSync = {
  savePendingReport(report: PendingReport): void {
    const pending = this.getPendingReports();
    pending.push(report);
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(pending));
  },

  getPendingReports(): PendingReport[] {
    const data = localStorage.getItem(PENDING_REPORTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  removePendingReport(id: string): void {
    const pending = this.getPendingReports();
    const filtered = pending.filter((r) => r.id !== id);
    localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(filtered));
  },

  saveOfflineImage(id: string, dataUrl: string): void {
    const images = this.getOfflineImages();
    images[id] = dataUrl;
    localStorage.setItem(OFFLINE_IMAGES_KEY, JSON.stringify(images));
  },

  getOfflineImages(): Record<string, string> {
    const data = localStorage.getItem(OFFLINE_IMAGES_KEY);
    return data ? JSON.parse(data) : {};
  },

  removeOfflineImage(id: string): void {
    const images = this.getOfflineImages();
    delete images[id];
    localStorage.setItem(OFFLINE_IMAGES_KEY, JSON.stringify(images));
  },

  async syncPendingReports(userId: string): Promise<{ success: number; failed: number }> {
    const pending = this.getPendingReports();
    let success = 0;
    let failed = 0;

    for (const report of pending) {
      try {
        const { data: newReport, error } = await supabase
          .from('safety_reports')
          .insert({
            employee_id: userId,
            report_type: report.report_type,
            description: report.description,
            location: report.location,
            status: 'pending',
            synced: true,
          })
          .select()
          .maybeSingle();

        if (error || !newReport) {
          failed++;
          continue;
        }

        if (report.images && report.images.length > 0) {
          for (const imageId of report.images) {
            const offlineImages = this.getOfflineImages();
            const dataUrl = offlineImages[imageId];

            if (dataUrl) {
              const blob = await fetch(dataUrl).then((r) => r.blob());
              const fileName = `${newReport.id}/${imageId}.jpg`;

              const { error: uploadError } = await supabase.storage
                .from('safety-images')
                .upload(fileName, blob);

              if (!uploadError) {
                const { data: urlData } = supabase.storage
                  .from('safety-images')
                  .getPublicUrl(fileName);

                await supabase.from('report_images').insert({
                  report_id: newReport.id,
                  image_url: urlData.publicUrl,
                });

                this.removeOfflineImage(imageId);
              }
            }
          }
        }

        this.removePendingReport(report.id);
        success++;
      } catch (error) {
        console.error('Sync error:', error);
        failed++;
      }
    }

    return { success, failed };
  },

  isOnline(): boolean {
    return navigator.onLine;
  },
};
