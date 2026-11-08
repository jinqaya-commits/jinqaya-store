import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;
function isJsonRecord(value: unknown): value is JsonRecord {
 return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function admin() {
 const supabase=await createClient();const {data:claims}=await supabase.auth.getClaims();
 if(!claims?.claims?.sub)return {response:NextResponse.json({error:"Unauthorized"},{status:401})};
 const {data:allowed,error}=await supabase.rpc("can_manage_catalog");
 if(error||allowed!==true)return {response:NextResponse.json({error:"Forbidden"},{status:403})};
 return {supabase,userId:claims.claims.sub as string};
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 const auth=await admin();if("response" in auth)return auth.response;
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid order ID"},{status:400});
 let body: unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
 if(!isJsonRecord(body))return NextResponse.json({error:"Invalid request"},{status:400});
 const description=typeof body.description==="string"?body.description.trim():"";
 if(description.length<10||description.length>5000)return NextResponse.json({error:"Description must be 10–5000 characters."},{status:400});
 const {data:order,error:orderError}=await auth.supabase.from("orders").select("id,customer_id,order_number,status,delivered_at").eq("id",id).maybeSingle();
 if(orderError||!order)return NextResponse.json({error:"Order not found."},{status:404});
 if(!order.delivered_at)return NextResponse.json({error:"A quality return request can only be opened after delivery is recorded."},{status:400});
 const delivered=new Date(order.delivered_at).getTime();
 if(Date.now()-delivered>7*24*60*60*1000)return NextResponse.json({error:"The 7-day return window has passed."},{status:400});
 const caseNumber="AS-"+Date.now().toString(36).toUpperCase();
 const {data:created,error}=await auth.supabase.from("after_sales_cases").insert({order_id:id,customer_id:order.customer_id,case_number:caseNumber,customer_description:description,reviewed_by:auth.userId}).select("*").single();
 if(error)return NextResponse.json({error:"Unable to create after-sales case."},{status:400});
 await auth.supabase.from("after_sales_case_events").insert({case_id:created.id,event_type:"case_created",description:"Quality issue case recorded by staff.",new_values:{case_number:caseNumber},created_by:auth.userId});
 return NextResponse.json({ok:true,case:created},{status:201});
}
