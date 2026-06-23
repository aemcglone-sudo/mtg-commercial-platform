-- AlterTable: add role to users
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'enthusiast';

-- CreateTable: shops
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "phone" TEXT,
    "email" TEXT,
    "websiteUrl" TEXT,
    "customDomain" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "stripeAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable: shop_inventory
CREATE TABLE "shop_inventory" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "scryfallId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "setCode" TEXT NOT NULL,
    "collectorNumber" TEXT,
    "condition" TEXT NOT NULL,
    "foil" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'en',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceCents" INTEGER NOT NULL,
    "notes" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: shop_orders
CREATE TABLE "shop_orders" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "subtotalCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "fulfillmentType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: shop_order_items
CREATE TABLE "shop_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "inventoryId" TEXT,
    "cardName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,

    CONSTRAINT "shop_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shops_userId_key" ON "shops"("userId");
CREATE UNIQUE INDEX "shops_slug_key" ON "shops"("slug");
CREATE INDEX "shop_inventory_shopId_idx" ON "shop_inventory"("shopId");
CREATE INDEX "shop_inventory_scryfallId_idx" ON "shop_inventory"("scryfallId");
CREATE INDEX "shop_inventory_cardName_idx" ON "shop_inventory"("cardName");
CREATE INDEX "shop_orders_shopId_idx" ON "shop_orders"("shopId");
CREATE INDEX "shop_orders_buyerUserId_idx" ON "shop_orders"("buyerUserId");

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shop_inventory" ADD CONSTRAINT "shop_inventory_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "shop_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_inventoryId_fkey"
    FOREIGN KEY ("inventoryId") REFERENCES "shop_inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
