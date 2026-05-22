-- CreateEnum
CREATE TYPE "DecisionKind" AS ENUM ('DISPUTE_TRIAGE', 'PRICING_OVERRIDE', 'MATCHING_WEIGHT_CHANGE', 'CLEANER_KYC', 'PAYOUT_HOLD_RELEASE', 'POLICY_CHANGE');

-- CreateEnum
CREATE TYPE "DecisionMaker" AS ENUM ('AI', 'OPS_HUMAN', 'HOST', 'CLEANER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'OVERRIDDEN', 'EXECUTED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "kind" "DecisionKind" NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "proposedBy" "DecisionMaker" NOT NULL,
    "decidedBy" "DecisionMaker",
    "status" "DecisionStatus" NOT NULL DEFAULT 'PROPOSED',
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "confidence" DECIMAL(4,3),
    "llmCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMCall" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheCreationInputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadInputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsdMicro" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LLMCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Decision_llmCallId_key" ON "Decision"("llmCallId");

-- CreateIndex
CREATE INDEX "Decision_kind_status_createdAt_idx" ON "Decision"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Decision_subjectType_subjectId_idx" ON "Decision"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "LLMCall_purpose_createdAt_idx" ON "LLMCall"("purpose", "createdAt");

-- CreateIndex
CREATE INDEX "LLMCall_model_createdAt_idx" ON "LLMCall"("model", "createdAt");

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_llmCallId_fkey" FOREIGN KEY ("llmCallId") REFERENCES "LLMCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
