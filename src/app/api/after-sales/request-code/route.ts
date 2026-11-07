import { NextRequest,NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAfterSalesVerificationCode } from "@/lib/order-email";
import { newCode } from "@/lib/after-sales-evidence";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 try{
  const body=await req.json();const orderNumber=String(body.orderNumber||"").trim().slice(0,80);const email=String(body.email||"").trim().toLowerCase().slice(0,254);
  if(!orderNumber||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"Enter a valid order number and email."},{status:400});
  const code=newCode();const supabase=createAdminClient();
  const {data,error}=await supabase.rpc("create_after_sales_email_challenge",{p_order_number:orderNumber,p_email:email,p_code:code});
  if(error)throw error;
  if(data===true)await sendAfterSalesVerificationCode(email,code);
  return NextResponse.json({ok:true,message:"If the order details match an eligible delivered order, a verification code will be sent."});
 }catch{return NextResponse.json({error:"Unable to process this request. Please try again later."},{status:500});}
}
