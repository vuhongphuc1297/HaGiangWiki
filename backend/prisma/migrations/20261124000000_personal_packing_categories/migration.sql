BEGIN;

CREATE TABLE "PackingCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PackingCategory_memberId_fkey" FOREIGN KEY ("memberId")
        REFERENCES "TripMember"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PackingCategory_memberId_nameKey_key" ON "PackingCategory"("memberId", "nameKey");
CREATE UNIQUE INDEX "PackingCategory_memberId_id_key" ON "PackingCategory"("memberId", "id");

ALTER TABLE "PackingItem"
    ADD COLUMN "categoryId" TEXT,
    ADD CONSTRAINT "PackingItem_category_personal" CHECK (
        "categoryId" IS NULL OR ("assignedToMemberId" IS NOT NULL AND NOT "isShared")
    ),
    ADD CONSTRAINT "PackingItem_assignedToMemberId_categoryId_fkey" FOREIGN KEY ("assignedToMemberId", "categoryId")
        REFERENCES "PackingCategory"("memberId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT;
