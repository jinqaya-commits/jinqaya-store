import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createEvidenceReadUrl} from "@/lib/after-sales-evidence";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string;caseId:string}>}){
 const supabase=await createClient();const {data:claims}=await supabase.auth.getClaims();
 if(!claims?.claims?.sub)return NextResponse.json({error:"Unauthorized"},{status:401});
 const {data:allowed,error:permissionError}=await supabase.rpc("can_manage_catalog");
 if(permissionError||allowed!==true)return NextResponse.json({error:"Forbidden"},{status:403});
 const {id,caseId}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(caseId))return NextResponse.json({error:"Invalid ID"},{status:400});
 const {data:record,error}=await supabase.from("after_sales_cases").select("evidence_urls").eq("id",caseId).eq("order_id",id).maybeSingle();
 if(error||!record)return NextResponse.json({error:"Case not found"},{status:404});
 const keys=Array.isArray(record.evidence_urls)?record.evidence_urls.filter((x:string)=>typeof x==="string"&&x.startsWith(`after-sales/${id}/`)): [];
 try{const evidence=await Promise.all(keys.map(async(key:string)=>({key,url:await createEvidenceReadUrl(key),name:key.split("/").pop()||"Evidence"})));return NextResponse.json({evidence});}
 catch{return NextResponse.json({error:"Unable to load private evidence files."},{status:500});}
}
