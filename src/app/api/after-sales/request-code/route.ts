import { NextRequest,NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAfterSalesVerificationCode } from "@/lib/order-email";
import { newCode, readBoundedJson } from "@/lib/after-sales-evidence";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 try{
  const body: unknown=await readBoundedJson<unknown>(req,8*1024);if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid request."},{status:400});const payload=body as Record<string,unknown>;if(typeof payload.orderNumber!=="string"||typeof payload.email!=="string")return NextResponse.json({error:"Enter a valid order number and email."},{status:400});const orderNumber=payload.orderNumber.trim().slice(0,80);const email=payload.email.trim().toLowerCase().slice(0,254);
  if(!orderNumber||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"Enter a valid order number and email."},{status:400});
  const code=newCode();const supabase=createAdminClient();
  const {data,error}=await supabase.rpc("create_after_sales_email_challenge",{p_order_number:orderNumber,p_email:email,p_code:code});
  if(error)throw error;
  if(data===true)await sendAfterSalesVerificationCode(email,code);
  return NextResponse.json({ok:true,message:"If the order details match an eligible delivered order, a verification code will be sent."});
 }catch(error){if(error instanceof Error&&error.message==="Request body is too large.")return NextResponse.json({error:"Request body is too large."},{status:413});if(error instanceof SyntaxError||error instanceof TypeError)return NextResponse.json({error:"Invalid request."},{status:400});return NextResponse.json({error:"Unable to process this request. Please try again later."},{status:500});}
}
