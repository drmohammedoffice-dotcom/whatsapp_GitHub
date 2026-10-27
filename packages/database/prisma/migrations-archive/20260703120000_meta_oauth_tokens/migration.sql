-- Meta OAuth: store encrypted user/page access tokens on MetaConnection

ALTER TABLE "MetaConnection" ADD COLUMN "user_access_token" TEXT;
ALTER TABLE "MetaConnection" ADD COLUMN "page_access_token" TEXT;
ALTER TABLE "MetaConnection" ADD COLUMN "user_access_token_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "MetaConnection_teamId_pageId_key" ON "MetaConnection"("teamId", "pageId");
