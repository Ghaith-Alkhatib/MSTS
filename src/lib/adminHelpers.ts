export const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  in_review: 'قيد المراجعة',
  action_taken: 'تم اتخاذ إجراء',
  closed: 'مغلق',
};

export const TYPE_LABELS: Record<string, string> = {
  unsafe_act: 'سلوك غير آمن',
  unsafe_condition: 'وضع غير آمن',
  near_miss: 'حادث كاد أن يقع',
  observation: 'ملاحظة عامة',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  in_review: 'bg-blue-100 text-blue-800 border-blue-300',
  action_taken: 'bg-green-100 text-green-800 border-green-300',
  closed: 'bg-gray-100 text-gray-800 border-gray-300',
};

export const TYPE_COLORS: Record<string, string> = {
  unsafe_act: 'bg-red-100 text-red-800',
  unsafe_condition: 'bg-orange-100 text-orange-800',
  near_miss: 'bg-yellow-100 text-yellow-800',
  observation: 'bg-blue-100 text-blue-800',
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500',
  in_review: 'bg-blue-500',
  action_taken: 'bg-green-500',
  closed: 'bg-gray-400',
};

export const TYPE_BAR_COLORS: Record<string, string> = {
  unsafe_act: 'bg-red-500',
  unsafe_condition: 'bg-orange-500',
  near_miss: 'bg-amber-500',
  observation: 'bg-blue-500',
};

export const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export function formatDateAr(date: Date): string {
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTimeAr(date: Date): string {
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
