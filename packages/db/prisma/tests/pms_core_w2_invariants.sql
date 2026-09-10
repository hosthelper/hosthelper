BEGIN;

INSERT INTO "User" (id, phone, name, role, status, "createdAt", "updatedAt") VALUES
  ('pms-w2-user', '01000000001', 'PMS W2 Test Host', 'HOST', 'ACTIVE', now(), now());
INSERT INTO "HostProfile" (id, "userId", "createdAt", "updatedAt") VALUES
  ('pms-w2-host', 'pms-w2-user', now(), now());
INSERT INTO "Property" (id, "hostId", nickname, "addressLine1", district, "postalCode", lat, lng, pyeong, bedrooms, bathrooms, "keyHandover", active, "createdAt", "updatedAt") VALUES
  ('pms-w2-prop-a', 'pms-w2-host', 'A', 'A', '강남구', '00001', 37.5, 127.0, 10, 1, 1, 'LOCKBOX', true, now(), now()),
  ('pms-w2-prop-b', 'pms-w2-host', 'B', 'B', '마포구', '00002', 37.6, 126.9, 10, 1, 1, 'LOCKBOX', true, now(), now());
INSERT INTO "PmsPropertyConfig" (id, "propertyId", "createdAt", "updatedAt") VALUES
  ('pms-w2-config-a', 'pms-w2-prop-a', now(), now()),
  ('pms-w2-config-b', 'pms-w2-prop-b', now(), now());
INSERT INTO "PmsRoomType" (id, "pmsPropertyConfigId", code, name, "baseOccupancy", "maxOccupancy", "defaultInventory", "createdAt", "updatedAt") VALUES
  ('pms-w2-room-a', 'pms-w2-config-a', 'A', 'A', 1, 2, 1, now(), now()),
  ('pms-w2-room-b', 'pms-w2-config-b', 'B', 'B', 1, 2, 1, now(), now());
INSERT INTO "PmsRoomUnit" (id, "roomTypeId", code, "createdAt", "updatedAt") VALUES
  ('pms-w2-unit-a', 'pms-w2-room-a', 'A-101', now(), now());

DO $$
BEGIN
  BEGIN
    INSERT INTO "PmsReservation" (id, "pmsPropertyConfigId", "roomTypeId", source, status, "checkInDate", "checkOutDate", adults, children, currency, version, "createdAt", "updatedAt")
    VALUES ('pms-w2-cross-property', 'pms-w2-config-a', 'pms-w2-room-b', 'MANUAL', 'CONFIRMED', DATE '2026-10-01', DATE '2026-10-02', 1, 0, 'KRW', 1, now(), now());
    RAISE EXCEPTION 'expected cross-property reservation FK violation';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

INSERT INTO "PmsReservation" (id, "pmsPropertyConfigId", "roomTypeId", source, "externalReservationId", status, "checkInDate", "checkOutDate", adults, children, currency, version, "createdAt", "updatedAt") VALUES
  ('pms-w2-res-1', 'pms-w2-config-a', 'pms-w2-room-a', 'AIRBNB', 'ext-1', 'CONFIRMED', DATE '2026-10-01', DATE '2026-10-02', 1, 0, 'KRW', 1, now(), now()),
  ('pms-w2-res-2', 'pms-w2-config-a', 'pms-w2-room-a', 'MANUAL', NULL, 'CONFIRMED', DATE '2026-10-01', DATE '2026-10-02', 1, 0, 'KRW', 1, now(), now());

INSERT INTO "PmsReservationNight" (id, "reservationId", "stayDate", "roomTypeId", "roomUnitId", "occupiesInventory", "createdAt", "updatedAt")
VALUES ('pms-w2-night-1', 'pms-w2-res-1', DATE '2026-10-01', 'pms-w2-room-a', 'pms-w2-unit-a', true, now(), now());

DO $$
BEGIN
  BEGIN
    INSERT INTO "PmsReservationNight" (id, "reservationId", "stayDate", "roomTypeId", "occupiesInventory", "createdAt", "updatedAt")
    VALUES ('pms-w2-night-mismatch', 'pms-w2-res-1', DATE '2026-10-01', 'pms-w2-room-b', true, now(), now());
    RAISE EXCEPTION 'expected reservation-night room type FK violation';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "PmsReservationNight" (id, "reservationId", "stayDate", "roomTypeId", "roomUnitId", "occupiesInventory", "createdAt", "updatedAt")
    VALUES ('pms-w2-night-double', 'pms-w2-res-2', DATE '2026-10-01', 'pms-w2-room-a', 'pms-w2-unit-a', true, now(), now());
    RAISE EXCEPTION 'expected active room-unit/date unique violation';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "PmsReservation" (id, "pmsPropertyConfigId", "roomTypeId", source, "externalReservationId", status, "checkInDate", "checkOutDate", adults, children, currency, version, "createdAt", "updatedAt")
    VALUES ('pms-w2-ext-dup', 'pms-w2-config-a', 'pms-w2-room-a', 'AIRBNB', 'ext-1', 'CONFIRMED', DATE '2026-10-03', DATE '2026-10-04', 1, 0, 'KRW', 1, now(), now());
    RAISE EXCEPTION 'expected external reservation idempotency unique violation';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

INSERT INTO "PmsReservationEvent" (id, "reservationId", "eventType", "idempotencyKey", payload, "createdAt")
VALUES ('pms-w2-event-1', 'pms-w2-res-1', 'CREATED', 'event-key-1', '{}'::jsonb, now());

DO $$
BEGIN
  BEGIN
    INSERT INTO "PmsReservationEvent" (id, "reservationId", "eventType", "idempotencyKey", payload, "createdAt")
    VALUES ('pms-w2-event-dup', 'pms-w2-res-1', 'MODIFIED', 'event-key-1', '{}'::jsonb, now());
    RAISE EXCEPTION 'expected event idempotency unique violation';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

ROLLBACK;
