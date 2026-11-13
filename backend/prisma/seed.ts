import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database.js';

const tripId = 'demo_trip_hagiang_20261120';
const tuanUserId = 'demo_user_tuan';
const linhUserId = 'demo_user_linh';
const tuanMemberId = 'demo_member_tuan';
const linhMemberId = 'demo_member_linh';
const createdAt = new Date('2026-11-10T00:00:00.000Z');
const expenseDate = new Date('2026-11-20T05:00:00.000Z');

// Stable IDs make repeated seeds update only these demo records, never clear tables.
const stops = [
  { id: 'demo_stop_me_nau', name: 'Quán cơm Mẹ Nấu', category: 'Ăn uống', day: 0, orderIndex: 0, notes: 'Yên Minh · Ăn uống · Chưa có GPS' },
  { id: 'demo_stop_ha_giang', name: 'TP. Hà Giang', category: 'Ăn uống', day: 1, orderIndex: 1, arriveTime: '07:00', leaveTime: '08:00', notes: 'Ăn sáng & nhận xe' },
  { id: 'demo_stop_quan_ba', name: 'Cổng trời Quản Bạ', category: 'Ngắm cảnh', day: 1, orderIndex: 2, arriveTime: '09:30', leaveTime: '10:30', estimatedCost: 60_000n, latitude: 23.0567, longitude: 104.9876, notes: 'Dừng ngắm cảnh, mang áo khoác nhẹ.' },
  { id: 'demo_stop_yen_minh', name: 'Yên Minh', category: 'Ăn uống', day: 1, orderIndex: 3, arriveTime: '12:00', leaveTime: '13:30', notes: 'Ăn trưa & nghỉ ngơi' },
  { id: 'demo_stop_lung_cu', name: 'Cột cờ Lũng Cú', category: 'Tham quan', day: 2, orderIndex: 1, arriveTime: '08:30', leaveTime: '10:00', latitude: 23.3615, longitude: 105.3195 },
  { id: 'demo_stop_ma_pi_leng', name: 'Đèo Mã Pí Lèng', category: 'Ngắm cảnh', day: 2, orderIndex: 2, arriveTime: '14:00', leaveTime: '15:30' },
  { id: 'demo_stop_nho_que', name: 'Hẻm Tu Sản - Sông Nho Quế', category: 'Trải nghiệm', day: 2, orderIndex: 3, arriveTime: '16:00', leaveTime: '17:30' },
  { id: 'demo_stop_cho_dong_van', name: 'Chợ phiên Đồng Văn', category: 'Ăn vặt', day: 3, orderIndex: 1, arriveTime: '07:00', leaveTime: '08:30' },
  { id: 'demo_stop_dinh_vua_meo', name: 'Dinh Vua Mèo', category: 'Di tích', day: 3, orderIndex: 2, arriveTime: '09:30', leaveTime: '11:00' },
];

const expenses = [
  { id: 'demo_expense_homestay', payerMemberId: tuanMemberId, amount: 600_000n, title: 'Homestay', category: 'Homestay', splitType: 'EQUAL', idempotencyKey: 'seed:expense:homestay', stopId: null },
  { id: 'demo_expense_an_uong', payerMemberId: linhMemberId, amount: 200_000n, title: 'Ăn uống', category: 'Ăn uống', splitType: 'EQUAL', idempotencyKey: 'seed:expense:an-uong', stopId: 'demo_stop_yen_minh' },
  { id: 'demo_expense_ve', payerMemberId: tuanMemberId, amount: 100_000n, title: 'Vé tham quan', category: 'Vé tham quan', splitType: 'FOR_OTHER', idempotencyKey: 'seed:expense:ve', stopId: 'demo_stop_quan_ba' },
] satisfies Omit<Prisma.ExpenseCreateManyInput, 'tripId'>[];

const packingItems = [
  { id: 'demo_pack_ao_mua', title: 'Áo mưa', isShared: true, assignedToMemberId: tuanMemberId, isPacked: true },
  { id: 'demo_pack_so_cuu', title: 'Bộ sơ cứu', isShared: true, assignedToMemberId: linhMemberId, isPacked: true },
  { id: 'demo_pack_sac', title: 'Sạc dự phòng', isShared: true, assignedToMemberId: tuanMemberId, isPacked: false },
  { id: 'demo_pack_va_xe', title: 'Bộ vá xe', isShared: true, assignedToMemberId: linhMemberId, isPacked: false },
  { id: 'demo_pack_ao_tuan', title: 'Áo khoác', isShared: false, assignedToMemberId: tuanMemberId, isPacked: true },
  { id: 'demo_pack_ao_linh', title: 'Áo khoác', isShared: false, assignedToMemberId: linhMemberId, isPacked: true },
  { id: 'demo_pack_giay_to_tuan', title: 'Giấy tờ tùy thân', isShared: false, assignedToMemberId: tuanMemberId, isPacked: false },
  { id: 'demo_pack_giay_to_linh', title: 'Giấy tờ tùy thân', isShared: false, assignedToMemberId: linhMemberId, isPacked: false },
];

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function main() {
  await prisma.$transaction(async (tx) => {
    for (const user of [
      { id: tuanUserId, displayName: 'Tuấn (A)' },
      { id: linhUserId, displayName: 'Linh (B)' },
    ]) {
      await tx.user.upsert({ where: { id: user.id }, create: { ...user, createdAt }, update: user });
    }

    const trip = {
      id: tripId,
      title: 'Hà Giang · Explore the Loop',
      startDate: new Date('2026-11-20T00:00:00.000Z'),
      durationDays: 3,
      vehicle: 'XE_MAY',
      budget: 5_000_000n,
      timezone: 'Asia/Ho_Chi_Minh',
    };
    await tx.trip.upsert({ where: { id: tripId }, create: { ...trip, createdAt }, update: trip });

    for (const member of [
      { id: tuanMemberId, tripId, userId: tuanUserId, role: 'OWNER', nickname: 'Tuấn', status: 'ACTIVE', revokedAt: null },
      { id: linhMemberId, tripId, userId: linhUserId, role: 'MEMBER', nickname: 'Linh', status: 'ACTIVE', revokedAt: null },
    ]) {
      await tx.tripMember.upsert({ where: { id: member.id }, create: { ...member, joinedAt: createdAt }, update: member });
    }

    for (const stop of stops) {
      const data = {
        tripId,
        estimatedCost: 0n,
        latitude: null,
        longitude: null,
        arriveTime: null,
        leaveTime: null,
        notes: null,
        deletedAt: null,
        ...stop,
      };
      await tx.stop.upsert({ where: { id: stop.id }, create: { ...data, createdAt }, update: data });
    }

    for (const expense of expenses) {
      const data = { ...expense, tripId, deletedAt: null };
      await tx.expense.upsert({ where: { id: expense.id }, create: { ...data, createdAt: expenseDate }, update: data });
    }

    const transfer = {
      id: 'demo_transfer_linh_tuan',
      tripId,
      fromMemberId: linhMemberId,
      toMemberId: tuanMemberId,
      amount: 100_000n,
      transferDate: new Date('2026-11-20T06:00:00.000Z'),
      notes: 'Linh chuyển trả Tuấn 100.000đ; số còn nợ 200.000đ.',
      idempotencyKey: 'seed:transfer:linh-tuan',
      deletedAt: null,
    };
    await tx.settlementTransfer.upsert({ where: { id: transfer.id }, create: { ...transfer, createdAt: expenseDate }, update: transfer });

    for (const item of packingItems) {
      const data = { ...item, tripId };
      await tx.packingItem.upsert({ where: { id: item.id }, create: { ...data, createdAt }, update: data });
    }

    // Populate lifecycle tables without creating usable authentication tokens.
    for (const [id, userId] of [
      ['demo_session_tuan', tuanUserId],
      ['demo_session_linh', linhUserId],
    ] as const) {
      const session = {
        id, userId,
        tokenHash: hash(randomBytes(32).toString('hex')),
        expiresAt: new Date('2026-11-11T00:00:00.000Z'),
        revokedAt: createdAt,
        lastUsedAt: createdAt,
      };
      await tx.session.upsert({ where: { id }, create: { ...session, createdAt }, update: session });
    }

    const invite = {
      id: 'demo_invite_linh',
      tripId,
      createdByUserId: tuanUserId,
      tokenHash: hash(randomBytes(32).toString('hex')),
      expiresAt: new Date('2026-11-11T00:00:00.000Z'),
      usedAt: new Date('2026-11-10T01:00:00.000Z'),
      revokedAt: null,
    };
    await tx.tripInvite.upsert({ where: { id: invite.id }, create: { ...invite, createdAt }, update: invite });

    const request = { title: 'Homestay', amount: '600000', payerMemberId: tuanMemberId, splitType: 'EQUAL' };
    const record = {
      id: 'demo_idempotency_homestay',
      tripId,
      userId: tuanUserId,
      key: 'seed:expense:homestay',
      requestHash: hash(JSON.stringify(request)),
      responseStatus: 201,
      responseBody: { id: 'demo_expense_homestay', tripId, ...request },
      expiresAt: new Date('2026-11-21T00:00:00.000Z'),
    };
    await tx.idempotencyRecord.upsert({ where: { id: record.id }, create: { ...record, createdAt: expenseDate }, update: record });
  }, { timeout: 20_000 });

  console.info('Đã nạp dữ liệu mẫu Hà Giang: 2 người, 1 chuyến đi, 9 điểm dừng.');
  console.info('3 khoản chi = 900.000đ; Linh nợ Tuấn 300.000đ trước chuyển trả.');
  console.info('Đã chuyển trả 100.000đ; còn nợ 200.000đ. Hành lý: 4/8 đã xếp.');
  console.info('Session/mã mời mẫu đã hết hiệu lực; không sinh thông tin đăng nhập sử dụng được.');
  console.info('Chạy npm run db:verify để đối chiếu dữ liệu và ràng buộc thực tế.');
}

main()
  .catch((error: unknown) => {
    console.error('Không thể nạp dữ liệu mẫu:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
