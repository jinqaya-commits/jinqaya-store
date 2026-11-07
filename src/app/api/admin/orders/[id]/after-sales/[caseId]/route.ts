import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic="force-dynamic";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string;caseId:string}>}) {
 const supabase=await createClient();const {data:claims}=await supabase.auth.getClaims();
 if(!claims?.claims?.sub)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:allowed,error:permissionError}=await supabase.rpc("can_manage_catalog");
 if(permissionError||allowed!==true)return NextResponse.json({error:"Forbidden"},{status:403});
 const {id,caseId}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(caseId))return NextResponse.json({error:"Invalid ID"},{status:400});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
 const updates:any={};
 if(body.status!==undefined){if(!["under_review","approved","rejected","resolved"].includes(body.status))return NextResponse.json({error:"Invalid case status"},{status:400});updates.status=body.status;updates.reviewed_by=claims.claims.sub;updates.reviewed_at=new Date().toISOString();if(body.status==="resolved")updates.resolved_at=new Date().toISOString();}
 if(body.resolution!==undefined){if(typeof body.resolution!=="string"||body.resolution.length>3000)return NextResponse.json({error:"Resolution is too long"},{status:400});updates.resolution=body.resolution.trim()||null;}
 if(body.refundStatus!==undefined){if(!["not_started","pending_manual","confirmed"].includes(body.refundStatus))return NextResponse.json({error:"Invalid refund status"},{status:400});updates.refund_status=body.refundStatus;if(body.refundStatus==="confirmed"){const amount=Number(body.refundAmount);if(!Number.isFinite(amount)||amount<0)return NextResponse.json({error:"Enter the amount actually refunded."},{status:400});updates.refund_amount=amount;updates.refund_reference=typeof body.refundReference==="string"?body.refundReference.trim().slice(0,200)||null:null;updates.refund_confirmed_at=new Date().toISOString();}else{updates.refund_confirmed_at=null;}}
 if(!Object.keys(updates).length)return NextResponse.json({error:"No changes provided."},{status:400});
 const {data:previous}=await supabase.from("after_sales_cases").select("status,refund_status,resolution").eq("id",caseId).eq("order_id",id).maybeSingle();
 if(!previous)return NextResponse.json({error:"Case not found."},{status:404});
 const {data:updated,error}=await supabase.from("after_sales_cases").update({...updates,updated_at:new Date().toISOString()}).eq("id",caseId).eq("order_id",id).select("*").single();
 if(error)return NextResponse.json({error:"Unable to update case. Check refund confirmation details."},{status:400});
 const eventType=updates.refund_status?"refund_status_changed":updates.status?"status_changed":"resolution_updated";
 await supabase.from("after_sales_case_events").insert({case_id:caseId,event_type:eventType,description:updates.refund_status?"Manual refund record updated.":updates.status?"Case status updated.":"Resolution notes updated.",old_values:previous,new_values:updates,created_by:claims.claims.sub});
 return NextResponse.json({ok:true,case:updated});
}
