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
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders(req)});
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return out(req,{error:"Sessão inválida."},401);
 const url=Deno.env.get("SUPABASE_URL")!;
 const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
 const caller=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:auth,error:authError}=await caller.auth.getUser(token);
 if(authError||!auth.user)return out(req,{error:"Sessão inválida."},401);
 const {data,error}=await admin.auth.admin.getUserById(auth.user.id);
 if(error||!data.user)return out(req,{error:"Não foi possível validar a conta."},400);
 const meta=data.user.app_metadata||{};
 if(meta.must_change_password!==true)return out(req,{error:"Esta conta não exige troca inicial de senha."},403);
 const created=Date.parse(String(meta.temporary_password_created_at||""));
 const updated=Date.parse(String(data.user.updated_at||""));
 if(!Number.isFinite(created)||!Number.isFinite(updated)||updated<=created)return out(req,{error:"Primeiro atualize sua senha pessoal para concluir o acesso."},409);
 const {error:updateError}=await admin.auth.admin.updateUserById(auth.user.id,{app_metadata:{...meta,must_change_password:false,temporary_password_created_at:null}});
 if(updateError)return out(req,{error:"Não foi possível concluir a ativação. Tente novamente."},500);
 return out(req,{ok:true,message:"Senha pessoal confirmada. Faça login novamente."});
});