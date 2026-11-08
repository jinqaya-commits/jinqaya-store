import { NextRequest,NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readBoundedJson } from "@/lib/after-sales-evidence";
export const dynamic="force-dynamic";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string;caseId:string}>}) {
 const supabase=await createClient();
 const {data:claims}=await supabase.auth.getClaims();
 if(!claims?.claims?.sub)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:allowed,error:permissionError}=await supabase.rpc("can_manage_catalog");
 if(permissionError||allowed!==true)return NextResponse.json({error:"Forbidden"},{status:403});
 const {id,caseId}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(caseId))return NextResponse.json({error:"Invalid ID"},{status:400});
 let body:unknown;
 try{body=await readBoundedJson<unknown>(request,8*1024);}
 catch(error){
  if(error instanceof Error&&error.message==="Request body is too large.")return NextResponse.json({error:"Request body is too large."},{status:413});
  return NextResponse.json({error:"Invalid request."},{status:400});
 }
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid request."},{status:400});
 const payload=body as Record<string,unknown>;
 const updateStatus=payload.status!==undefined;
 const updateResolution=payload.resolution!==undefined;
 const updateRefundStatus=payload.refundStatus!==undefined;
 if(!updateStatus&&!updateResolution&&!updateRefundStatus)return NextResponse.json({error:"No changes provided."},{status:400});
 if(updateStatus&&(typeof payload.status!=="string"||!["under_review","approved","rejected","resolved"].includes(payload.status)))return NextResponse.json({error:"Invalid case status."},{status:400});
 if(updateResolution&&(typeof payload.resolution!=="string"||payload.resolution.length>3000))return NextResponse.json({error:"Resolution is too long."},{status:400});
 if(updateRefundStatus&&(typeof payload.refundStatus!=="string"||!["not_started","pending_manual"].includes(payload.refundStatus)))return NextResponse.json({error:"Refund confirmation must use the order refund ledger action."},{status:400});
 const {data,error}=await supabase.rpc("admin_update_after_sales_case",{
  p_order_id:id,
  p_case_id:caseId,
  p_update_status:updateStatus,
  p_status:updateStatus?payload.status as string:null,
  p_update_resolution:updateResolution,
  p_resolution:updateResolution?(payload.resolution as string).trim():null,
  p_update_refund_status:updateRefundStatus,
  p_refund_status:updateRefundStatus?payload.refundStatus as string:null,
 });
 if(error){
  const message=error.message||"Unable to update case.";
  const status=message.includes("not found")?404:(message.includes("confirmed refund")||message.includes("pending manual refund")||message.includes("rejected case"))?409:400;
  return NextResponse.json({error:message},{status});
 }
 const result=data&&typeof data==="object"&&!Array.isArray(data)?data as {case?:unknown}:null;
 if(!result?.case)return NextResponse.json({error:"The database returned an unexpected case result."},{status:500});
 revalidatePath("/admin/after-sales");
 revalidatePath("/admin/orders");
 revalidatePath(`/admin/orders/${id}`);
 return NextResponse.json({ok:true,case:result.case});
}
