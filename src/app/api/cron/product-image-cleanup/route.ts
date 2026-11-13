import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2Client, getR2Config } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CleanupItem = { id: string; storage_path: string };
type UploadIntentItem = { id: string; storage_path: string };
type RpcError = { message: string };
type RpcResult<T> = { data: T | null; error: RpcError | null };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    // Supabase RPC methods use the client instance as `this`; keep the method bound.
    const callCleanupRpc = supabase.rpc.bind(supabase) as unknown as <T>(name: string, args: Record<string, unknown>) => Promise<RpcResult<T>>;
    const { data, error } = await callCleanupRpc<CleanupItem[]>("claim_product_image_cleanup", { p_limit: 50 });
    if (error) throw error;

    const items = (data ?? []) as CleanupItem[];


    let deleted = 0;
    let skipped = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const path = item.storage_path;
        // A path may still be referenced if it was attached again after being queued.
        // Never delete an object while a product_images row points to it.
        const { data: references, error: referenceError } = await supabase
          .from("product_images")
          .select("id")
          .eq("storage_path", path)
          .limit(1);
        if (referenceError) throw referenceError;
        if (references?.length) {
          // Keep the queue row: the last reference may be removed concurrently.
          // Retrying later avoids losing the cleanup task in that race.
          const { error: retryError } = await callCleanupRpc<null>("fail_product_image_cleanup", {
            p_id: item.id,
            p_error: "Storage path is still referenced by a product image.",
          });
          if (retryError) throw retryError;
          skipped++;
          continue;
        }

        if (path.startsWith("r2://")) {
          const config = getR2Config();
          await getR2Client().send(new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: path.slice("r2://".length),
          }));
        } else if (path && !path.startsWith("http://") && !path.startsWith("https://")) {
          const { error: storageError } = await supabase.storage.from("product-images").remove([path]);
          if (storageError) throw storageError;
        }

        const { error: completeError } = await callCleanupRpc<null>("complete_product_image_cleanup", { p_id: item.id });
        if (completeError) throw completeError;
        deleted++;
      } catch (itemError) {
        failed++;
        const message = itemError instanceof Error ? itemError.message : "Unknown cleanup error";
        console.error("[product-image-cleanup] item failed", { id: item.id, message });
        const { error: failError } = await callCleanupRpc<null>("fail_product_image_cleanup", {
          p_id: item.id,
          p_error: message,
        });
        if (failError) console.error("[product-image-cleanup] unable to reschedule item", failError);
      }
    }

    const { data: uploadIntents, error: intentClaimError } =
      await callCleanupRpc<UploadIntentItem[]>("claim_product_image_upload_cleanup", { p_limit: 50 });
    if (intentClaimError) throw intentClaimError;

    let orphanDeleted = 0;
    let orphanSkipped = 0;
    let orphanFailed = 0;
    for (const intent of (uploadIntents ?? []) as UploadIntentItem[]) {
      try {
        const { data: references, error: referenceError } = await supabase
          .from("product_images")
          .select("id")
          .eq("storage_path", intent.storage_path)
          .limit(1);
        if (referenceError) throw referenceError;

        if (references?.length) {
          const { error: completeError } = await callCleanupRpc<null>(
            "complete_product_image_upload_cleanup",
            { p_id: intent.id },
          );
          if (completeError) throw completeError;
          orphanSkipped++;
          continue;
        }

        if (intent.storage_path.startsWith("r2://")) {
          const config = getR2Config();
          await getR2Client().send(new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: intent.storage_path.slice("r2://".length),
          }));
        } else {
          throw new Error("Unexpected non-R2 path in upload-intent cleanup.");
        }

        const { error: completeError } = await callCleanupRpc<null>(
          "complete_product_image_upload_cleanup",
          { p_id: intent.id },
        );
        if (completeError) throw completeError;
        orphanDeleted++;
      } catch (intentError) {
        orphanFailed++;
        const message = intentError instanceof Error ? intentError.message : "Unknown upload cleanup error";
        console.error("[product-image-cleanup] upload intent failed", { id: intent.id, message });
        const { error: failError } = await callCleanupRpc<null>("fail_product_image_upload_cleanup", {
          p_id: intent.id,
          p_error: message,
        });
        if (failError) console.error("[product-image-cleanup] unable to reschedule upload intent", failError);
      }
    }

    return NextResponse.json({
      ok: failed === 0 && orphanFailed === 0,
      claimed: items.length,
      deleted,
      skipped,
      failed,
      uploadIntentsClaimed: uploadIntents?.length ?? 0,
      orphanDeleted,
      orphanSkipped,
      orphanFailed,
    });
  } catch (error) {
    console.error("[product-image-cleanup] scheduled processing failed", error);
    return NextResponse.json({ error: "Product image cleanup failed." }, { status: 500 });
  }
}
