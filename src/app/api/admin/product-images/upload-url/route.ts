import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, getR2Config } from "@/lib/r2";

export const runtime = "nodejs";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const { data: canManage, error: permissionError } = await supabase.rpc("can_manage_catalog");
    if (permissionError || canManage !== true) {
      return NextResponse.json({ error: "Catalog permission required." }, { status: 403 });
    }

    const body = await request.json() as {
      productId?: string;
      fileName?: string;
      contentType?: string;
      fileSize?: number;
    };
    const { productId, fileName, contentType, fileSize } = body;

    if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) {
      return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    }
    const extension = contentType ? allowedTypes[contentType] : undefined;
    if (!extension) return NextResponse.json({ error: "Unsupported image format." }, { status: 400 });
    if (!Number.isInteger(fileSize) || !fileSize || fileSize > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Images must be 20 MB or smaller." }, { status: 400 });
    }

    const { data: product, error: productError } = await supabase
      .from("products").select("id").eq("id", productId).maybeSingle();
    if (productError || !product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const safeBase = (fileName || "product-image")
      .replace(/\\.[^.]*$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "product-image";
    const key = `${productId}/${crypto.randomUUID()}-${safeBase}.${extension}`;
    const config = getR2Config();
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    });
    const uploadUrl = await getSignedUrl(getR2Client(), command, { expiresIn: 300 });

    return NextResponse.json({ uploadUrl, storagePath: `r2://${key}`, expiresIn: 300 });
  } catch (error) {
    console.error("Unable to create R2 upload URL:", error);
    return NextResponse.json({ error: "Unable to prepare image upload." }, { status: 500 });
  }
}
