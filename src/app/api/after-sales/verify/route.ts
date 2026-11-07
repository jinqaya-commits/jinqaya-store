import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { newSessionToken,sha256,sessionCookieName } from "@/lib/after-sales-evidence";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 try{
  const body=await req.json();const orderNumber=String(body.orderNumber||"").trim().slice(0,80);const email=String(body.email||"").trim().toLowerCase().slice(0,254);const code=String(body.code||"").trim();
  if(!orderNumber||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\d{6}$/.test(code))return NextResponse.json({error:"Enter the six-digit code."},{status:400});
  const token=newSessionToken();const supabase=await createClient();
  const {data:orderId,error}=await supabase.rpc("verify_after_sales_email_code",{p_order_number:orderNumber,p_email:email,p_code:code,p_token_hash:sha256(token)});
  if(error||!orderId)return NextResponse.json({error:"The code is invalid or expired. Request a new code and try again."},{status:400});
  const response=NextResponse.json({ok:true,orderId});
  response.cookies.set(sessionCookieName,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/api/after-sales",maxAge:1800});
  return response;
 }catch{return NextResponse.json({error:"Unable to verify this code."},{status:500});}
}
