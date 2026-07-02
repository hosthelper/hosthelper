import { PrismaClient, UserRole, UserStatus, KycStatus, KeyHandover } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding...');

  await prisma.matchingWeights.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });

  const skills = [
    { code: 'LINEN_CHANGE', label: '린넨 교체' },
    { code: 'DEEP_CLEAN', label: '딥 클리닝' },
    { code: 'WINDOW', label: '창문 청소' },
    { code: 'IRON', label: '다림질' },
    { code: 'KITCHEN', label: '주방 청소' },
    { code: 'BATHROOM', label: '욕실 청소' },
  ];
  for (const s of skills) {
    await prisma.skill.upsert({ where: { code: s.code }, update: {}, create: s });
  }

  await prisma.pricingRule.upsert({
    where: { id: 'default-seoul' },
    update: {},
    create: {
      id: 'default-seoul',
      name: '서울 기본 단가',
      baseFee: 50000,
      perPyeong: 3000,
      bedroomAdd: 10000,
      nightSurcharge: 1.3,
      holidaySurcharge: 1.2,
    },
  });

  const host = await prisma.user.upsert({
    where: { phone: '01099990001' },
    update: {},
    create: {
      phone: '01099990001',
      name: '김호스트',
      role: UserRole.HOST,
      status: UserStatus.ACTIVE,
      phoneVerified: true,
      hostProfile: { create: { businessName: '강남 STR' } },
    },
  });

  const cleaner = await prisma.user.upsert({
    where: { phone: '01099990002' },
    update: {},
    create: {
      phone: '01099990002',
      name: '박매니저',
      role: UserRole.CLEANER,
      status: UserStatus.ACTIVE,
      phoneVerified: true,
      cleanerProfile: {
        create: {
          bio: '호텔 하우스키핑 7년',
          yearsExperience: 7,
          baseLat: 37.4979,
          baseLng: 127.0276,
          kycStatus: KycStatus.APPROVED,
          rating: 4.8,
          ratingCount: 24,
          completedJobs: 24,
          rebookingRate: 0.55,
          declineRate: 0.04,
        },
      },
    },
  });

  const hostProfile = await prisma.hostProfile.findUniqueOrThrow({ where: { userId: host.id } });

  await prisma.property.upsert({
    where: { id: 'seed-property-1' },
    update: {},
    create: {
      id: 'seed-property-1',
      hostId: hostProfile.id,
      nickname: '청담 스카이뷰 #301',
      addressLine1: '서울 강남구 삼성로 100',
      addressLine2: '301호',
      district: '강남구',
      postalCode: '06129',
      lat: 37.5172,
      lng: 127.0473,
      pyeong: 22,
      bedrooms: 2,
      bathrooms: 1,
      keyHandover: KeyHandover.SMART_LOCK,
      keyInstructions: '도어록 1234#',
    },
  });

  // 키퍼 가용 스케줄: 오늘부터 14일간 매일 08:00~20:00 (KST 기준 근사)
  // 없으면 매칭 availability 필터가 후보 0명을 반환하므로 데모 필수.
  const cleanerProfile = await prisma.cleanerProfile.findUniqueOrThrow({
    where: { userId: cleaner.id },
  });
  const existing = await prisma.availability.count({
    where: { cleanerId: cleanerProfile.id },
  });
  if (existing === 0) {
    const days = Array.from({ length: 14 }, (_, i) => i);
    await prisma.availability.createMany({
      data: days.map((i) => {
        const day = new Date();
        day.setDate(day.getDate() + i);
        const startsAt = new Date(day);
        startsAt.setHours(8, 0, 0, 0);
        const endsAt = new Date(day);
        endsAt.setHours(20, 0, 0, 0);
        return { cleanerId: cleanerProfile.id, startsAt, endsAt };
      }),
    });
  }

  console.log('Seed complete:', { host: host.id, cleaner: cleaner.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
