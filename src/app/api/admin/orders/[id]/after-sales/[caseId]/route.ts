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
 if(body.refundStatus!==undefined){if(!["not_started","pending_manual"].includes(body.refundStatus))return NextResponse.json({error:"Refund confirmation must use the order refund ledger action."},{status:400});updates.refund_status=body.refundStatus;}
 if(!Object.keys(updates).length)return NextResponse.json({error:"No changes provided."},{status:400});
 const {data:previous}=await supabase.from("after_sales_cases").select("status,refund_status,resolution").eq("id",caseId).eq("order_id",id).maybeSingle();
 if(!previous)return NextResponse.json({error:"Case not found."},{status:404});
 if(previous.refund_status==="confirmed"&&updates.refund_status!==undefined)return NextResponse.json({error:"A confirmed refund cannot be changed."},{status:409});
 const {data:updated,error}=await supabase.from("after_sales_cases").update({...updates,updated_at:new Date().toISOString()}).eq("id",caseId).eq("order_id",id).select("*").single();
 if(error)return NextResponse.json({error:"Unable to update case. Check refund confirmation details."},{status:400});
 const eventType=updates.refund_status?"refund_status_changed":updates.status?"status_changed":"resolution_updated";
 await supabase.from("after_sales_case_events").insert({case_id:caseId,event_type:eventType,description:updates.refund_status?"Manual refund record updated.":updates.status?"Case status updated.":"Resolution notes updated.",old_values:previous,new_values:updates,created_by:claims.claims.sub});
 return NextResponse.json({ok:true,case:updated});
}
