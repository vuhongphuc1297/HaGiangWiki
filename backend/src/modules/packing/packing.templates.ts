export const personalPackingTemplate = [
  'Áo khoác gió chống nước / Áo ấm',
  'CCCD, Bằng lái xe & Giấy tờ xe máy',
  'Găng tay lái xe & Giày đi bộ bám đường',
  'Sạc dự phòng & Dây cáp điện thoại',
  'Thuốc cá nhân (Say xe, Cảm sốt, Tiêu hóa)',
  'Kính râm / Kính chống bụi đèo',
  'Đồ dùng vệ sinh cá nhân',
] as const;

export function packingTitleKey(title: string) {
  return title.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
}
