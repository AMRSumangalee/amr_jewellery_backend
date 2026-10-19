
import fs from "node:fs/promises";
import path from "node:path";

import prisma from "../config/database.js";

const getPreviousMonthRange = (now = new Date()) => {
  // Use the calendar month in the configured server timezone.
  // The scheduler below uses Asia/Kolkata.
  const year = now.getFullYear();
  const month = now.getMonth();

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return { start, end };
};

const getMediaPath = (media) => {
  if (!media.storageKey) return null;

  const folderByType = {
    IMAGE: "images",
    VIDEO: "videos",
    AUDIO: "audio",
  };

  const folder = folderByType[media.mediaType];

  if (!folder) return null;

  // Prevent a stored filename from escaping its upload directory.
  const fileName = path.basename(media.storageKey);

  return path.resolve(process.cwd(), "uploads", folder, fileName);
};

export const cleanupPreviousMonthDeliveredOrders = async () => {
  const dryRun = process.env.MONTHLY_CLEANUP_DRY_RUN !== "false";

  const { start, end } = getPreviousMonthRange();

  console.log("\n===== MONTHLY DELIVERED ORDER CLEANUP =====");
  console.log("Period start:", start.toISOString());
  console.log("Period end:", end.toISOString());
  console.log("Dry run:", dryRun);

  // Only select orders that:
  // 1. Are currently DELIVERED.
  // 2. Have a DELIVERED history entry during the previous month.
  const candidates = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      statusHistory: {
        some: {
          toStatus: "DELIVERED",
          createdAt: {
            gte: start,
            lt: end,
          },
        },
      },
    },
    select: {
      id: true,
      orderNumber: true,
      media: {
        select: {
          storageKey: true,
          mediaType: true,
        },
      },
    },
  });

  console.log("Matching orders:", candidates.length);

  if (candidates.length === 0) {
    console.log("No eligible delivered orders found.");
    return {
      dryRun,
      matched: 0,
      deleted: 0,
      filesDeleted: 0,
    };
  }

  for (const order of candidates) {
    console.log(
      `${dryRun ? "[DRY RUN]" : "[CLEANUP]"} ${order.orderNumber} (ID: ${order.id})`,
    );
  }

  // Dry-run never deletes database records or physical files.
  if (dryRun) {
    console.log(
      "Dry run complete. Set MONTHLY_CLEANUP_DRY_RUN=false only after reviewing the logs.",
    );

    return {
      dryRun: true,
      matched: candidates.length,
      deleted: 0,
      filesDeleted: 0,
    };
  }

  const deletedMedia = [];

  // Recheck eligibility inside the transaction before deleting.
  await prisma.$transaction(async (tx) => {
    for (const candidate of candidates) {
      const eligible = await tx.order.findFirst({
        where: {
          id: candidate.id,
          status: "DELIVERED",
          statusHistory: {
            some: {
              toStatus: "DELIVERED",
              createdAt: {
                gte: start,
                lt: end,
              },
            },
          },
        },
        select: {
          id: true,
          media: {
            select: {
              storageKey: true,
              mediaType: true,
            },
          },
        },
      });

      if (!eligible) {
        console.log(
          `Skipping order ${candidate.orderNumber}: it no longer matches the cleanup conditions.`,
        );
        continue;
      }

      // Your Prisma schema has cascade deletes for order media,
      // repair types and status history.
      await tx.order.delete({
        where: { id: eligible.id },
      });

      deletedMedia.push(...eligible.media);
    }
  });

  // Delete physical files only after the database transaction succeeds.
  let filesDeleted = 0;

  for (const media of deletedMedia) {
    const filePath = getMediaPath(media);

    if (!filePath) continue;

    try {
      await fs.unlink(filePath);
      filesDeleted++;
      console.log("Deleted media:", filePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log("Media file already missing:", filePath);
      } else {
        // The database order is already deleted. Log failures so
        // leftover files can be cleaned up manually.
        console.error(
          "MEDIA CLEANUP FAILED:",
          filePath,
          error.message,
        );
      }
    }
  }

  console.log("Orders matched:", candidates.length);
  console.log("Orders deleted:", deletedMedia.length >= 0
    ? "See successful transaction and cleanup logs"
    : 0);
  console.log("Media files deleted:", filesDeleted);
  console.log("===== CLEANUP COMPLETE =====\n");

  return {
    dryRun: false,
    matched: candidates.length,
    filesDeleted,
  };
};
