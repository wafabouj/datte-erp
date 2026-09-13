-- CreateEnum
CREATE TYPE "ArticleProcess" AS ENUM ('WITH_PIT', 'PITTED');

-- CreateEnum
CREATE TYPE "ArticleTreatment" AS ENUM ('BRANCH', 'STANDARD', 'PACKAGED');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "process" "ArticleProcess",
ADD COLUMN     "treatment" "ArticleTreatment";
