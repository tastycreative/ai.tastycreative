/**
 * Migration Script: Remove "PGT Completed" and "Flyer Completed" columns
 *
 * This script removes the deprecated columns from OTP/PTR boards:
 *   - Moves items in "PGT Completed" → "Flyer Team"
 *   - Moves items in "Flyer Completed" → "QA"
 *   - Deletes the empty columns
 *   - Re-orders remaining column positions sequentially
 *
 * Run with: npx tsx scripts/migrate-remove-pgt-flyer-completed-columns.ts
 *
 * Modes:
 *   DRY_RUN=true  - Preview changes without making them (default)
 *   DRY_RUN=false - Actually execute the migration
 */

import { PrismaClient } from "../lib/generated/prisma";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const DRY_RUN = process.env.DRY_RUN !== "false";
const prisma = new PrismaClient();

const COLUMNS_TO_REMOVE = [
  { name: "PGT Completed", moveTo: "Flyer Team" },
  { name: "Flyer Completed", moveTo: "QA" },
];

async function main() {
  console.log("=".repeat(60));
  console.log(DRY_RUN ? "🔍 DRY RUN MODE — no changes will be made" : "🚀 LIVE MODE — changes will be applied");
  console.log("=".repeat(60));
  console.log();

  // Find all boards that have the deprecated columns
  const deprecatedColumns = await prisma.boardColumn.findMany({
    where: {
      name: { in: COLUMNS_TO_REMOVE.map((c) => c.name), mode: "insensitive" },
    },
    include: {
      items: { select: { id: true, title: true } },
      board: { select: { id: true, name: true, workspace: { select: { id: true, name: true } } } },
    },
  });

  if (deprecatedColumns.length === 0) {
    console.log("✅ No deprecated columns found. Nothing to migrate.");
    return;
  }

  console.log(`Found ${deprecatedColumns.length} deprecated column(s) across boards:\n`);

  let totalItemsMoved = 0;
  let totalColumnsDeleted = 0;

  // Group by board for cleaner processing
  const boardMap = new Map<string, typeof deprecatedColumns>();
  for (const col of deprecatedColumns) {
    const existing = boardMap.get(col.boardId) ?? [];
    existing.push(col);
    boardMap.set(col.boardId, existing);
  }

  for (const [boardId, columns] of boardMap) {
    const board = columns[0].board;
    console.log(`📋 Board: "${board.name}" (workspace: "${board.workspace?.name ?? "unknown"}")`);

    for (const col of columns) {
      const rule = COLUMNS_TO_REMOVE.find(
        (r) => r.name.toLowerCase() === col.name.toLowerCase()
      );
      if (!rule) continue;

      // Find the target column on this board
      const targetColumn = await prisma.boardColumn.findFirst({
        where: {
          boardId,
          name: { equals: rule.moveTo, mode: "insensitive" },
        },
        select: { id: true, name: true },
      });

      if (!targetColumn) {
        console.log(`  ⚠️  "${col.name}" — target column "${rule.moveTo}" not found on this board, skipping`);
        continue;
      }

      console.log(`  🗑️  "${col.name}" → items (${col.items.length}) will move to "${targetColumn.name}"`);

      if (col.items.length > 0) {
        for (const item of col.items) {
          console.log(`      • [${item.id}] ${item.title}`);
        }

        if (!DRY_RUN) {
          // Move all items to the target column
          await prisma.boardItem.updateMany({
            where: { columnId: col.id },
            data: { columnId: targetColumn.id, updatedAt: new Date() },
          });

          // Record history for each moved item
          for (const item of col.items) {
            await prisma.boardItemHistory.create({
              data: {
                itemId: item.id,
                userId: "system",
                action: "updated",
                field: "columnId",
                oldValue: col.name,
                newValue: targetColumn.name,
              },
            });
          }
        }

        totalItemsMoved += col.items.length;
      }

      if (!DRY_RUN) {
        await prisma.boardColumn.delete({ where: { id: col.id } });
      }

      totalColumnsDeleted++;
    }

    // Re-order remaining columns on this board
    const remainingColumns = await prisma.boardColumn.findMany({
      where: { boardId },
      orderBy: { position: "asc" },
      select: { id: true, name: true, position: true },
    });

    console.log(`  📐 Re-ordering ${remainingColumns.length} remaining columns:`);
    for (let i = 0; i < remainingColumns.length; i++) {
      const col = remainingColumns[i];
      const needsUpdate = col.position !== i;
      console.log(`      ${i}: "${col.name}" ${needsUpdate ? `(was ${col.position})` : "(ok)"}`);
      if (!DRY_RUN && needsUpdate) {
        await prisma.boardColumn.update({
          where: { id: col.id },
          data: { position: i },
        });
      }
    }

    console.log();
  }

  console.log("=".repeat(60));
  console.log(`Summary:`);
  console.log(`  Columns removed: ${totalColumnsDeleted}`);
  console.log(`  Items moved:     ${totalItemsMoved}`);
  console.log(DRY_RUN ? "\n⚠️  DRY RUN — run with DRY_RUN=false to apply." : "\n✅ Migration complete.");
  console.log("=".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
