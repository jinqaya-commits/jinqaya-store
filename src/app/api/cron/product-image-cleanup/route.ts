import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CleanupRow = { storage_path: string };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Cleanup is not configured." }, { status: 500 });
  }

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let s3: S3Client | null = null;
  let deleted = 0;
  let failed = 0;
  const { data: rows, error: listError } = await supabase.rpc(
    "list_product_image_cleanup_queue",
    { p_limit: 100 },
  );
  if (listError) {
    console.error("[product-image-cleanup] unable to list queue", listError);
    return NextResponse.json({ error: "Unable to read cleanup queue." }, { status: 500 });
  }

  for (const row of (rows ?? []) as CleanupRow[]) {
    const storagePath = row.storage_path;
    try {
      if (storagePath.startsWith("r2://")) {
        const account = process.env.R2_ACCOUNT_ID;
        const accessKey = process.env.R2_ACCESS_KEY_ID;
        const accessSecret = process.env.R2_SECRET_ACCESS_KEY;
        const bucket = process.env.R2_BUCKET_NAME;
        if (!account || !accessKey || !accessSecret || !bucket) {
          throw new Error("R2 product image storage is not configured.");
        }
        if (!s3) {
          s3 = new S3Client({
            region: "auto",
            endpoint: `https://${account}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId: accessKey, secretAccessKey: accessSecret },
          });
        }
        const key = storagePath.slice("r2://".length);
        if (!key || key.includes("..")) throw new Error("Invalid R2 object key.");
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } else {
        if (storagePath.startsWith("http://") || storagePath.startsWith("https://") || storagePath.includes("..")) {
          throw new Error("Invalid legacy product image storage path.");
        }
        const { error } = await supabase.storage.from("product-images").remove([storagePath]);
        if (error) throw error;
      }

      const { error: completeError } = await supabase.rpc("complete_product_image_cleanup", {
        p_storage_path: storagePath,
      });
      if (completeError) throw completeError;
      deleted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown cleanup error";
      console.error("[product-image-cleanup] retry scheduled", { storagePath, message });
      const { error: failError } = await supabase.rpc("fail_product_image_cleanup", {
        p_storage_path: storagePath,
        p_error_message: message,
      });
      if (failError) console.error("[product-image-cleanup] unable to record retry", failError);
      failed += 1;
    }
  }

  return NextResponse.json({ ok: failed === 0, processed: deleted + failed, deleted, failed });
}
