-- CreateTable
CREATE TABLE "states" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "abbreviation" VARCHAR(2) NOT NULL,
    "fipsCode" VARCHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counties" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "fipsCode" VARCHAR(5),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courts" (
    "id" TEXT NOT NULL,
    "countyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "judges" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "termStart" TIMESTAMP(3),
    "termEnd" TIMESTAMP(3),
    "selectionMethod" TEXT,
    "appointingAuthority" TEXT,
    "education" TEXT,
    "priorExperience" TEXT,
    "politicalAffiliation" TEXT,
    "sourceUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "judges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "states_name_key" ON "states"("name");

-- CreateIndex
CREATE UNIQUE INDEX "states_slug_key" ON "states"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "states_abbreviation_key" ON "states"("abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "states_fipsCode_key" ON "states"("fipsCode");

-- CreateIndex
CREATE UNIQUE INDEX "counties_fipsCode_key" ON "counties"("fipsCode");

-- CreateIndex
CREATE INDEX "counties_stateId_idx" ON "counties"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "counties_stateId_slug_key" ON "counties"("stateId", "slug");

-- CreateIndex
CREATE INDEX "courts_countyId_idx" ON "courts"("countyId");

-- CreateIndex
CREATE UNIQUE INDEX "courts_countyId_slug_key" ON "courts"("countyId", "slug");

-- CreateIndex
CREATE INDEX "judges_courtId_idx" ON "judges"("courtId");

-- CreateIndex
CREATE INDEX "judges_fullName_idx" ON "judges"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "judges_courtId_slug_key" ON "judges"("courtId", "slug");

-- AddForeignKey
ALTER TABLE "counties" ADD CONSTRAINT "counties_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "counties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "judges" ADD CONSTRAINT "judges_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
