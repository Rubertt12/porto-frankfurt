import { createClient } from "npm:@supabase/supabase-js@2";
const allowedOrigins = new Set([
  "https://porto-frankfurt.vercel.app",
  "https://porto-frankfurt-git-main-rubertts-projects.vercel.app",
  "https://porto-frankfurt-git-security-hardening-rubertts-projects.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
]);
const isAllowedOrigin = (origin: string) =>
  allowedOrigins.has(origin);
const corsHeaders = (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  return {
    ...(isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};
const out=(req:Request,v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{...corsHeaders(req),"Content-Type":"application/json"}});
function makePass(){const groups=["ABCDEFGHJKLMNPQRSTUVWXYZ","abcdefghijkmnopqrstuvwxyz","23456789","!@#$%*-_+"];const all=groups.join("");const b=new Uint32Array(28);crypto.getRandomValues(b);const a=groups.map((g,i)=>g[b[i]%g.length]);for(let i=a.length;i<28;i++)a.push(all[b[i]%all.length]);for(let i=a.length-1;i>0;i--){const j=b[(i+4)%b.length]%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a.join("");}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders(req)});
 if(req.method!=="POST")return out(req,{error:"Método não permitido."},405);
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return out(req,{error:"Sessão inválida."},401);
 const url=Deno.env.get("SUPABASE_URL")!;
 const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
 const caller=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:au,error:ae}=await caller.auth.getUser(token);
 if(ae||!au.user)return out(req,{error:"Sessão inválida."},401);
 let b:any;try{b=await req.json();}catch{return out(req,{error:"Dados inválidos."},400);}
 const cid=String(b.condominium_id||""),email=String(b.email||"").trim().toLowerCase(),name=String(b.full_name||"").trim(),phone=String(b.phone||"").trim(),role=String(b.role||"");
 if(!cid||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||name.length>120||phone.length>30||!["administrator","concierge","security","financial"].includes(role))return out(req,{error:"Informe nome, e-mail válido, telefone e função."},400);
 const {data:cp}=await admin.from("profiles").select("role").eq("id",au.user.id).maybeSingle();
 const {data:m,error:me}=await admin.from("condominium_members").select("role").eq("condominium_id",cid).eq("profile_id",au.user.id).eq("is_active",true).maybeSingle();
 if(!(cp?.role==="super_admin"||(!me&&["syndic","administrator"].includes(m?.role))))return out(req,{error:"Somente o administrador do condomínio pode cadastrar funcionários."},403);
 const {data:old,error:oe}=await admin.from("profiles").select("id,full_name").ilike("email",email).maybeSingle();
 if(oe)return out(req,{error:"Não foi possível consultar o cadastro."},500);
 let uid=old?.id||"",pass="",created=false;
 if(!uid){pass=makePass();const createdAt=new Date(Date.now()+5000).toISOString();const {data:u,error:ce}=await admin.auth.admin.createUser({email,password:pass,email_confirm:true,user_metadata:{full_name:name,name},app_metadata:{must_change_password:true,temporary_password_created_at:createdAt}});
 if(ce||!u.user)return out(req,{error:ce?.message||"Não foi possível criar a conta."},400);uid=u.user.id;created=true;
 const {error:pe}=await admin.from("profiles").update({full_name:name,phone,email}).eq("id",uid);
 if(pe){await admin.auth.admin.deleteUser(uid);return out(req,{error:"Não foi possível preparar o perfil."},500);}}
 const {error:le}=await admin.from("condominium_members").upsert({condominium_id:cid,profile_id:uid,role,is_active:true},{onConflict:"condominium_id,profile_id"});
 if(le){if(created)await admin.auth.admin.deleteUser(uid);return out(req,{error:"Não foi possível vincular o funcionário."},500);}
 return out(req,{ok:true,created,full_name:created?name:(old?.full_name||name),email,role,temporary_password:created?pass:null,message:created?"Conta criada. Copie a senha temporária e entregue ao funcionário.":"Conta existente vinculada. A senha atual foi preservada."});
});