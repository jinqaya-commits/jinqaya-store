import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { getR2Client, getR2Config } from "@/lib/r2";

export const runtime="nodejs";
const allowedTypes:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif"};

export async function POST(request:Request){
  try{
    const supabase=await createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
    const {data:allowed,error:permissionError}=await supabase.rpc("can_manage_catalog");
    if(permissionError||allowed!==true)return NextResponse.json({error:"Catalog permission required."},{status:403});

    const body=await request.json() as {categoryId?:string;fileName?:string;contentType?:string;fileSize?:number};
    const {categoryId,fileName,contentType,fileSize}=body;
    if(!categoryId||!/^[0-9a-f-]{36}$/i.test(categoryId))return NextResponse.json({error:"Invalid collection."},{status:400});
    const extension=contentType?allowedTypes[contentType]:undefined;
    if(!extension)return NextResponse.json({error:"Unsupported image format."},{status:400});
    if(typeof fileSize!=="number"||!Number.isInteger(fileSize)||fileSize<=0||fileSize>20*1024*1024)return NextResponse.json({error:"Images must be larger than 0 bytes and 20 MB or smaller."},{status:400});

    const {data:category,error}=await supabase.from("categories").select("id").eq("id",categoryId).maybeSingle();
    if(error||!category)return NextResponse.json({error:"Collection not found."},{status:404});
    const rawName=(fileName||"collection-cover").split(/[\\/]/).pop()||"collection-cover";
    const safeBase=rawName.replace(/\.[^.]+$/,"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"collection-cover";
    const key=`categories/${categoryId}/${crypto.randomUUID()}-${safeBase}.${extension}`;
    const config=getR2Config();
    const command=new PutObjectCommand({Bucket:config.bucket,Key:key,ContentType:contentType,CacheControl:"public, max-age=31536000, immutable"});
    const uploadUrl=await getSignedUrl(getR2Client(),command,{expiresIn:300});
    return NextResponse.json({uploadUrl,storagePath:`r2://${key}`,expiresIn:300});
  }catch(error){
    console.error("Unable to create collection image upload URL:",error);
    return NextResponse.json({error:"Unable to prepare collection image upload."},{status:500});
  }
}