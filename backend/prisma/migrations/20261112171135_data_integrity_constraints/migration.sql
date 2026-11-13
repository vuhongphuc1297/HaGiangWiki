-- Prisma 6 does not express CHECK constraints in schema.prisma.
-- Keep them in a separate migration so PostgreSQL protects direct writes too.
ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_durationDays_positive" CHECK ("durationDays" > 0),
  ADD CONSTRAINT "Trip_budget_nonnegative" CHECK ("budget" >= 0),
  ADD CONSTRAINT "Trip_version_positive" CHECK ("version" >= 1),
  ADD CONSTRAINT "Trip_vehicle_valid" CHECK ("vehicle" IN ('XE_MAY', 'O_TO', 'MAY_BAY'));

ALTER TABLE "TripMember"
  ADD CONSTRAINT "TripMember_role_valid" CHECK ("role" IN ('OWNER', 'MEMBER')),
  ADD CONSTRAINT "TripMember_status_valid" CHECK ("status" IN ('ACTIVE', 'REVOKED'));

ALTER TABLE "Stop"
  ADD CONSTRAINT "Stop_day_nonnegative" CHECK ("day" >= 0),
  ADD CONSTRAINT "Stop_orderIndex_nonnegative" CHECK ("orderIndex" >= 0),
  ADD CONSTRAINT "Stop_estimatedCost_nonnegative" CHECK ("estimatedCost" >= 0),
  ADD CONSTRAINT "Stop_version_positive" CHECK ("version" >= 1),
  ADD CONSTRAINT "Stop_coordinates_valid" CHECK (
    ("latitude" IS NULL AND "longitude" IS NULL)
    OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL
      AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
  ),
  ADD CONSTRAINT "Stop_arriveTime_valid" CHECK ("arriveTime" IS NULL OR "arriveTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "Stop_leaveTime_valid" CHECK ("leaveTime" IS NULL OR "leaveTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "Expense_version_positive" CHECK ("version" >= 1),
  ADD CONSTRAINT "Expense_splitType_valid" CHECK ("splitType" IN ('EQUAL', 'FOR_OTHER', 'PERSONAL'));

ALTER TABLE "SettlementTransfer"
  ADD CONSTRAINT "SettlementTransfer_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "SettlementTransfer_distinct_members" CHECK ("fromMemberId" <> "toMemberId");

ALTER TABLE "PackingItem"
  ADD CONSTRAINT "PackingItem_version_positive" CHECK ("version" >= 1);

ALTER TABLE "IdempotencyRecord"
  ADD CONSTRAINT "IdempotencyRecord_responseStatus_valid" CHECK ("responseStatus" BETWEEN 100 AND 599);
