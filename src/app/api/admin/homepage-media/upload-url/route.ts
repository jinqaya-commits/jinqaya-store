import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, getR2Config } from "@/lib/r2";

export const runtime = "nodejs";
const allowedTypes: Record<string,string> = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/avif":"avif" };

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error:"Sign in required." }, { status:401 });
    const { data: allowed, error } = await supabase.rpc("can_manage_catalog");
    if (error || allowed !== true) return NextResponse.json({ error:"Catalog permission required." }, { status:403 });
    const body = await request.json() as { mediaKey?:string; contentType?:string; fileSize?:number };
    const { mediaKey, contentType, fileSize } = body;
    if (mediaKey !== "hero" && mediaKey !== "lifestyle") return NextResponse.json({ error:"Invalid homepage image slot." }, { status:400 });
    const extension = contentType ? allowedTypes[contentType] : undefined;
    if (!extension) return NextResponse.json({ error:"Unsupported image format." }, { status:400 });
    if (typeof fileSize !== "number" || !Number.isInteger(fileSize) || fileSize <= 0 || fileSize > 20*1024*1024) return NextResponse.json({ error:"Images must be larger than 0 bytes and 20 MB or smaller." }, { status:400 });
    const key = `homepage/${mediaKey}/${crypto.randomUUID()}.${extension}`;
    const config = getR2Config();
    const command = new PutObjectCommand({ Bucket:config.bucket, Key:key, ContentType:contentType, CacheControl:"public, max-age=31536000, immutable" });
    const uploadUrl = await getSignedUrl(getR2Client(), command, { expiresIn:300 });
    return NextResponse.json({ uploadUrl, storagePath:`r2://${key}`, expiresIn:300 });
  } catch (error) {
    console.error("Unable to create homepage media upload URL:", error);
    return NextResponse.json({ error:"Unable to prepare homepage image upload." }, { status:500 });
  }
}