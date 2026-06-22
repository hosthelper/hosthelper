-- CreateTable
CREATE TABLE "VideoAnalysis" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "videoTitle" TEXT,
    "author" TEXT,
    "language" TEXT,
    "hasTranscript" BOOLEAN NOT NULL DEFAULT false,
    "tldr" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "topics" JSONB NOT NULL,
    "contentType" TEXT NOT NULL,
    "confidence" DECIMAL(4,3),
    "payload" JSONB NOT NULL,
    "llmCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoAnalysis_llmCallId_key" ON "VideoAnalysis"("llmCallId");

-- CreateIndex
CREATE INDEX "VideoAnalysis_platform_createdAt_idx" ON "VideoAnalysis"("platform", "createdAt");

-- AddForeignKey
ALTER TABLE "VideoAnalysis" ADD CONSTRAINT "VideoAnalysis_llmCallId_fkey" FOREIGN KEY ("llmCallId") REFERENCES "LLMCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
