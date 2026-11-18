import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from './Button';

export function ConflictNotice({ onReload, busy, subject = 'chuyến đi', hasDraft = false }: {
  onReload: () => void; busy: boolean; subject?: 'chuyến đi' | 'điểm dừng' | 'khoản chi' | 'giao dịch chuyển trả'; hasDraft?: boolean;
}) {
  return <div role="alert" className="rounded-card border border-state-warning/30 bg-state-warning/10 p-4 text-sm leading-6 text-state-warning">
    <div className="flex items-start gap-2"><TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><h3 className="font-semibold">Dữ liệu vừa được cập nhật trên thiết bị khác</h3></div>
    <p className="mt-2">Bạn đồng hành của bạn vừa thay đổi thông tin {subject}. Vui lòng làm mới dữ liệu mới nhất trước khi tiếp tục.</p>
    {hasDraft && <p className="mt-2 text-xs leading-5">Bản nháp vẫn được giữ ở đây. Khi làm mới, form sửa sẽ đóng để tải bản mới nhất.</p>}
    <Button tone="secondary" className="mt-3 w-full" disabled={busy} onClick={onReload}><RefreshCw className={`size-4 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />Làm mới dữ liệu</Button>
  </div>;
}
