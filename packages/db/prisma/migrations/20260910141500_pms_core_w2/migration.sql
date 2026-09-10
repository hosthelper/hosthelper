-- HostHelper PMS Core W2
-- Adds a lodging PMS source-of-truth without changing the existing cleaning Booking/Property flow.

CREATE TYPE "PmsReservationStatus" AS ENUM ('DRAFT','HELD','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','NO_SHOW');
CREATE TYPE "PmsReservationSource" AS ENUM ('DIRECT','BOOKING_ENGINE','AIRBNB','BOOKING_COM','AGODA','EXPEDIA','NAVER','MANUAL','OTHER');
CREATE TYPE "PmsRoomUnitStatus" AS ENUM ('ACTIVE','OUT_OF_ORDER','INACTIVE');
CREATE TYPE "PmsInventoryStopSellReason" AS ENUM ('NONE','MANUAL','MAINTENANCE','SOLD_OUT','CHANNEL_SYNC');
CREATE TYPE "PmsReservationEventType" AS ENUM ('CREATED','HELD','CONFIRMED','MODIFIED','CANCELLED','CHECKED_IN','CHECKED_OUT','NO_SHOW','INVENTORY_ALLOCATED','INVENTORY_RELEASED','CHANNEL_SYNCED');

CREATE TABLE "PmsPropertyConfig" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
  "currency" TEXT NOT NULL DEFAULT 'KRW',
  "checkInTime" TEXT NOT NULL DEFAULT '15:00',
  "checkOutTime" TEXT NOT NULL DEFAULT '11:00',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsPropertyConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PmsPropertyConfig_propertyId_key" ON "PmsPropertyConfig"("propertyId");
ALTER TABLE "PmsPropertyConfig" ADD CONSTRAINT "PmsPropertyConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PmsRoomType" (
  "id" TEXT NOT NULL,
  "pmsPropertyConfigId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "baseOccupancy" INTEGER NOT NULL,
  "maxOccupancy" INTEGER NOT NULL,
  "defaultInventory" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsRoomType_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PmsRoomType_occupancy_check" CHECK ("baseOccupancy" > 0 AND "maxOccupancy" >= "baseOccupancy"),
  CONSTRAINT "PmsRoomType_inventory_check" CHECK ("defaultInventory" >= 0)
);
CREATE UNIQUE INDEX "PmsRoomType_property_code_key" ON "PmsRoomType"("pmsPropertyConfigId","code");
CREATE INDEX "PmsRoomType_property_active_idx" ON "PmsRoomType"("pmsPropertyConfigId","active");
ALTER TABLE "PmsRoomType" ADD CONSTRAINT "PmsRoomType_property_fkey" FOREIGN KEY ("pmsPropertyConfigId") REFERENCES "PmsPropertyConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PmsRoomUnit" (
  "id" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "floor" TEXT,
  "status" "PmsRoomUnitStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsRoomUnit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PmsRoomUnit_roomType_code_key" ON "PmsRoomUnit"("roomTypeId","code");
CREATE INDEX "PmsRoomUnit_roomType_status_idx" ON "PmsRoomUnit"("roomTypeId","status");
ALTER TABLE "PmsRoomUnit" ADD CONSTRAINT "PmsRoomUnit_roomType_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "PmsRoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PmsGuest" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "nationality" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsGuest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PmsGuest_phone_idx" ON "PmsGuest"("phone");
CREATE INDEX "PmsGuest_email_idx" ON "PmsGuest"("email");

CREATE TABLE "PmsReservation" (
  "id" TEXT NOT NULL,
  "pmsPropertyConfigId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "primaryGuestId" TEXT,
  "source" "PmsReservationSource" NOT NULL DEFAULT 'MANUAL',
  "externalReservationId" TEXT,
  "status" "PmsReservationStatus" NOT NULL DEFAULT 'DRAFT',
  "checkInDate" DATE NOT NULL,
  "checkOutDate" DATE NOT NULL,
  "adults" INTEGER NOT NULL DEFAULT 1,
  "children" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'KRW',
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PmsReservation_dates_check" CHECK ("checkOutDate" > "checkInDate"),
  CONSTRAINT "PmsReservation_guests_check" CHECK ("adults" > 0 AND "children" >= 0),
  CONSTRAINT "PmsReservation_amount_check" CHECK ("totalAmount" IS NULL OR "totalAmount" >= 0)
);
CREATE UNIQUE INDEX "PmsReservation_source_external_key" ON "PmsReservation"("source","externalReservationId") WHERE "externalReservationId" IS NOT NULL;
CREATE INDEX "PmsReservation_property_dates_idx" ON "PmsReservation"("pmsPropertyConfigId","checkInDate","checkOutDate");
CREATE INDEX "PmsReservation_roomType_status_idx" ON "PmsReservation"("roomTypeId","status");
ALTER TABLE "PmsReservation" ADD CONSTRAINT "PmsReservation_property_fkey" FOREIGN KEY ("pmsPropertyConfigId") REFERENCES "PmsPropertyConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsReservation" ADD CONSTRAINT "PmsReservation_roomType_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "PmsRoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsReservation" ADD CONSTRAINT "PmsReservation_guest_fkey" FOREIGN KEY ("primaryGuestId") REFERENCES "PmsGuest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PmsReservationNight" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "stayDate" DATE NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "roomUnitId" TEXT,
  "occupiesInventory" BOOLEAN NOT NULL DEFAULT true,
  "nightlyRate" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsReservationNight_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PmsReservationNight_rate_check" CHECK ("nightlyRate" IS NULL OR "nightlyRate" >= 0)
);
CREATE UNIQUE INDEX "PmsReservationNight_reservation_date_key" ON "PmsReservationNight"("reservationId","stayDate");
CREATE UNIQUE INDEX "PmsReservationNight_room_unit_date_active_key" ON "PmsReservationNight"("roomUnitId","stayDate") WHERE "roomUnitId" IS NOT NULL AND "occupiesInventory" = true;
CREATE INDEX "PmsReservationNight_roomType_date_idx" ON "PmsReservationNight"("roomTypeId","stayDate");
ALTER TABLE "PmsReservationNight" ADD CONSTRAINT "PmsReservationNight_reservation_fkey" FOREIGN KEY ("reservationId") REFERENCES "PmsReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsReservationNight" ADD CONSTRAINT "PmsReservationNight_roomType_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "PmsRoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PmsReservationNight" ADD CONSTRAINT "PmsReservationNight_roomUnit_fkey" FOREIGN KEY ("roomUnitId") REFERENCES "PmsRoomUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PmsInventoryDay" (
  "id" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "inventoryDate" DATE NOT NULL,
  "totalUnits" INTEGER NOT NULL,
  "heldUnits" INTEGER NOT NULL DEFAULT 0,
  "soldUnits" INTEGER NOT NULL DEFAULT 0,
  "stopSell" BOOLEAN NOT NULL DEFAULT false,
  "stopSellReason" "PmsInventoryStopSellReason" NOT NULL DEFAULT 'NONE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsInventoryDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PmsInventoryDay_nonnegative_check" CHECK ("totalUnits" >= 0 AND "heldUnits" >= 0 AND "soldUnits" >= 0),
  CONSTRAINT "PmsInventoryDay_capacity_check" CHECK ("heldUnits" + "soldUnits" <= "totalUnits")
);
CREATE UNIQUE INDEX "PmsInventoryDay_roomType_date_key" ON "PmsInventoryDay"("roomTypeId","inventoryDate");
CREATE INDEX "PmsInventoryDay_date_stopSell_idx" ON "PmsInventoryDay"("inventoryDate","stopSell");
ALTER TABLE "PmsInventoryDay" ADD CONSTRAINT "PmsInventoryDay_roomType_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "PmsRoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PmsReservationEvent" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "eventType" "PmsReservationEventType" NOT NULL,
  "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "source" TEXT,
  "idempotencyKey" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PmsReservationEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PmsReservationEvent_idempotency_key" ON "PmsReservationEvent"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX "PmsReservationEvent_reservation_created_idx" ON "PmsReservationEvent"("reservationId","createdAt");
ALTER TABLE "PmsReservationEvent" ADD CONSTRAINT "PmsReservationEvent_reservation_fkey" FOREIGN KEY ("reservationId") REFERENCES "PmsReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Allocation invariants deliberately live in the PMS ledger:
-- 1) inventory cannot exceed room-type capacity
-- 2) a room unit cannot occupy the same stay date twice while active
-- 3) channel/direct reservations share the same Reservation/Inventory tables
