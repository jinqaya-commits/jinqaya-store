import { NextRequest,NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newSessionToken,sha256,sessionCookieName,readBoundedJson } from "@/lib/after-sales-evidence";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 try{
  const body: unknown=await readBoundedJson<unknown>(req,8*1024);if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid request."},{status:400});const payload=body as Record<string,unknown>;if(typeof payload.orderNumber!=="string"||typeof payload.email!=="string"||typeof payload.code!=="string")return NextResponse.json({error:"Enter the six-digit code."},{status:400});const orderNumber=payload.orderNumber.trim().slice(0,80);const email=payload.email.trim().toLowerCase().slice(0,254);const code=payload.code.trim();
  if(!orderNumber||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\d{6}$/.test(code))return NextResponse.json({error:"Enter the six-digit code."},{status:400});
  const token=newSessionToken();const supabase=createAdminClient();
  const {data:orderId,error}=await supabase.rpc("verify_after_sales_email_code",{p_order_number:orderNumber,p_email:email,p_code:code,p_token_hash:sha256(token)});
  if(error||typeof orderId !== "string")return NextResponse.json({error:"The code is invalid or expired. Request a new code and try again."},{status:400});
  const response=NextResponse.json({ok:true,orderId});
  response.cookies.set(sessionCookieName,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/api/after-sales",maxAge:1800});
  return response;
 }catch(error){if(error instanceof Error&&error.message==="Request body is too large.")return NextResponse.json({error:"Request body is too large."},{status:413});if(error instanceof SyntaxError||error instanceof TypeError)return NextResponse.json({error:"Invalid request."},{status:400});return NextResponse.json({error:"Unable to verify this code."},{status:500});}
}
