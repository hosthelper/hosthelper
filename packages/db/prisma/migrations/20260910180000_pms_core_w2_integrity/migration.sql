-- PMS Core W2 integrity hardening.
-- Keep these constraints in SQL because they protect the shared PMS ledger even when
-- callers bypass the application service layer.

-- A reservation's room type must belong to the same PMS property config.
ALTER TABLE "PmsRoomType"
  ADD CONSTRAINT "PmsRoomType_id_property_key" UNIQUE ("id", "pmsPropertyConfigId");

ALTER TABLE "PmsReservation"
  ADD CONSTRAINT "PmsReservation_roomType_property_fkey"
  FOREIGN KEY ("roomTypeId", "pmsPropertyConfigId")
  REFERENCES "PmsRoomType"("id", "pmsPropertyConfigId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- A reservation night must use the reservation's room type.
ALTER TABLE "PmsReservation"
  ADD CONSTRAINT "PmsReservation_id_roomType_key" UNIQUE ("id", "roomTypeId");

ALTER TABLE "PmsReservationNight"
  ADD CONSTRAINT "PmsReservationNight_reservation_roomType_fkey"
  FOREIGN KEY ("reservationId", "roomTypeId")
  REFERENCES "PmsReservation"("id", "roomTypeId")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- An allocated physical unit must belong to that same room type.
ALTER TABLE "PmsRoomUnit"
  ADD CONSTRAINT "PmsRoomUnit_id_roomType_key" UNIQUE ("id", "roomTypeId");

ALTER TABLE "PmsReservationNight"
  ADD CONSTRAINT "PmsReservationNight_roomUnit_roomType_fkey"
  FOREIGN KEY ("roomUnitId", "roomTypeId")
  REFERENCES "PmsRoomUnit"("id", "roomTypeId")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique indexes intentionally remain migration-owned because Prisma schema
-- cannot faithfully express their WHERE predicates. CI verifies their definitions in
-- packages/db/prisma/tests/pms_core_w2_invariants.sql to prevent schema drift.