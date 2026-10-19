-- CreateTable
CREATE TABLE `orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderNumber` VARCHAR(191) NOT NULL,
    `branchId` INTEGER NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `customerArea` VARCHAR(191) NOT NULL,
    `orderType` ENUM('NEW', 'REPAIR') NOT NULL,
    `expectedDeliveryDate` DATETIME(3) NOT NULL,
    `priority` ENUM('NORMAL', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `advance` DECIMAL(12, 2) NULL,
    `estimate` DECIMAL(12, 2) NULL,
    `makerId` INTEGER NULL,
    `status` ENUM('DRAFT', 'NEW', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FINAL_CONFIRMED', 'DELIVERED', 'CLEANUP', 'ON_HOLD', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `metalId` INTEGER NULL,
    `categoryId` INTEGER NULL,
    `length` DECIMAL(10, 2) NULL,
    `lengthUnit` ENUM('INCH', 'CM') NULL,
    `size` VARCHAR(191) NULL,
    `weight` DECIMAL(10, 3) NULL,
    `purity` ENUM('K18', 'K22', 'K24') NULL,
    `description` VARCHAR(191) NULL,
    `existingJewelleryDescription` VARCHAR(191) NULL,
    `problemDescription` VARCHAR(191) NULL,
    `receivedItemDescription` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_orderNumber_key`(`orderNumber`),
    INDEX `orders_branchId_idx`(`branchId`),
    INDEX `orders_makerId_idx`(`makerId`),
    INDEX `orders_metalId_idx`(`metalId`),
    INDEX `orders_categoryId_idx`(`categoryId`),
    INDEX `orders_orderType_idx`(`orderType`),
    INDEX `orders_status_idx`(`status`),
    INDEX `orders_customerPhone_idx`(`customerPhone`),
    INDEX `orders_expectedDeliveryDate_idx`(`expectedDeliveryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_repair_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `repairTypeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_repair_types_repairTypeId_idx`(`repairTypeId`),
    UNIQUE INDEX `order_repair_types_orderId_repairTypeId_key`(`orderId`, `repairTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_media` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `mediaType` ENUM('IMAGE', 'VIDEO', 'AUDIO') NOT NULL,
    `mediaContext` ENUM('ORDER', 'BEFORE_REPAIR', 'CUSTOMER_WHATSAPP', 'MAKER_WHATSAPP') NOT NULL DEFAULT 'ORDER',
    `fileName` VARCHAR(191) NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_media_orderId_idx`(`orderId`),
    INDEX `order_media_mediaType_idx`(`mediaType`),
    INDEX `order_media_mediaContext_idx`(`mediaContext`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_makerId_fkey` FOREIGN KEY (`makerId`) REFERENCES `makers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_metalId_fkey` FOREIGN KEY (`metalId`) REFERENCES `metals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_repair_types` ADD CONSTRAINT `order_repair_types_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_repair_types` ADD CONSTRAINT `order_repair_types_repairTypeId_fkey` FOREIGN KEY (`repairTypeId`) REFERENCES `repair_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_media` ADD CONSTRAINT `order_media_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
