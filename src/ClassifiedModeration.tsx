import { useEffect, useState } from 'react';
import { Store, RefreshCw, Flag, EyeOff, Eye, CheckCircle2, Trash2 } from 'lucide-react';
import { supabase } from './lib/supabase';

type Row=Record<string,any>;
export default function ClassifiedModeration({condominiumId}:{condominiumId:string}) {
  const [ads,setAds]=useState<Row[]>([]);
  const [reports,setReports]=useState<Row[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const load=async()=>{
    if(!supabase||!condominiumId)return;
    setBusy(true);
    const [a,r]=await Promise.all([
      supabase.from('condominium_classifieds').select('id,title,seller_name,seller_unit_label,status,created_at').eq('condominium_id',condominiumId).order('created_at',{ascending:false}),
      supabase.from('classified_reports').select('*').eq('condominium_id',condominiumId).order('created_at',{ascending:false})
    ]);
    if(a.error||r.error)setMessage(a.error?.message||r.error?.message||'Não foi possível carregar os classificados.');
    setAds(a.data||[]);setReports(r.data||[]);setBusy(false);
  };
  useEffect(()=>{void load();},[condominiumId]);
  const hide=async(ad:Row)=>{
    if(!supabase)return;
    const next=ad.status==='paused'?'available':'paused';
    const {error}=await supabase.from('condominium_classifieds').update({status:next,updated_at:new Date().toISOString()}).eq('id',ad.id);
    setMessage(error?error.message:next==='paused'?'Anúncio ocultado do mural.':'Anúncio reativado.');
    if(!error)await load();
  };
  const resolve=async(report:Row,status:'reviewed'|'dismissed')=>{
    if(!supabase)return;
    const {error}=await supabase.from('classified_reports').update({status}).eq('id',report.id);
    setMessage(error?error.message:status==='reviewed'?'Denúncia marcada como analisada.':'Denúncia descartada.');
    if(!error)await load();
  };
  const remove=async(ad:Row)=>{
    if(!supabase||!window.confirm('Excluir este anúncio permanentemente?'))return;
    const {error}=await supabase.from('condominium_classifieds').delete().eq('id',ad.id);
    setMessage(error?error.message:'Anúncio excluído.');if(!error)await load();
  };
  const adById=Object.fromEntries(ads.map(x=>[x.id,x]));
  const pending=reports.filter(x=>x.status==='pending');
  return <section className="content-card classified-admin">
    <style>{`
      .classified-admin{padding:22px}.ca-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px}.ca-title{display:flex;align-items:center;gap:12px}.ca-icon{width:42px;height:42px;border-radius:13px;background:#eaf4e9;color:#276b49;display:grid;place-items:center}.ca-title b{display:block;font-size:16px}.ca-title small{display:block;color:#7b8a80;font-size:12px;margin-top:4px}.ca-refresh{border:1px solid #e1e9e1;background:#fff;border-radius:10px;padding:9px 12px;display:flex;align-items:center;gap:7px;cursor:pointer}.ca-banner{padding:10px 12px;background:#edf7ec;color:#326746;border-radius:10px;font-size:12px;margin:12px 0}.ca-summary{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}.ca-pill{background:#f3f7f2;border:1px solid #e3ebe2;border-radius:10px;padding:9px 12px;font-size:12px;color:#53665a}.ca-pill b{color:#1e6a46}.ca-section-title{font-size:14px;margin:22px 0 10px;color:#263a2e}.ca-list{display:grid;gap:9px}.ca-row{border:1px solid #e7ede6;border-radius:13px;padding:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#fff}.ca-row b{font-size:13px;color:#273a2f;display:block}.ca-row small{font-size:11px;color:#849187;display:block;margin-top:4px}.ca-actions{display:flex;gap:7px;flex-wrap:wrap}.ca-actions button{border:1px solid #e2e9e1;background:#fff;border-radius:9px;padding:8px 10px;font-size:11px;font-weight:700;color:#53645a;display:flex;align-items:center;gap:6px;cursor:pointer}.ca-actions .danger{color:#a44e4e}.ca-status{font-size:10px;font-weight:750;padding:5px 8px;border-radius:7px;background:#edf5ed;color:#39734d}.ca-status.pending{background:#fff5dc;color:#8b6a25}.ca-status.paused{background:#f8eaea;color:#9b5151}.ca-empty{padding:28px;border:1px dashed #dce6db;border-radius:13px;text-align:center;color:#849187;font-size:12px}
    `}</style>
    <div className="ca-head"><div className="ca-title"><span className="ca-icon"><Store size={20}/></span><div><b>Classificados do condomínio</b><small>Gerencie anúncios e denúncias enviadas pelos moradores.</small></div></div><button className="ca-refresh" onClick={load} disabled={busy}><RefreshCw size={15}/> Atualizar</button></div>
    {message&&<div className="ca-banner">{message}</div>}
    <div className="ca-summary"><span className="ca-pill"><b>{ads.length}</b> anúncios</span><span className="ca-pill"><b>{pending.length}</b> denúncias pendentes</span></div>
    <h3 className="ca-section-title">Denúncias recebidas</h3>
    {busy?<div className="ca-empty">Carregando…</div>:pending.length===0?<div className="ca-empty">Nenhuma denúncia pendente. Tudo tranquilo por aqui.</div>:<div className="ca-list">{pending.map(r=>{const ad=adById[r.classified_id]||{};return <article className="ca-row" key={r.id}><div><b>{ad.title||'Anúncio removido'}</b><small>{ad.seller_name||'Anunciante'} · {r.reason}</small><small>{new Date(r.created_at).toLocaleString('pt-BR')}</small></div><div className="ca-actions"><button onClick={()=>resolve(r,'reviewed')}><CheckCircle2 size={13}/> Analisada</button><button onClick={()=>resolve(r,'dismissed')}>Descartar</button>{ad.id&&<button onClick={()=>hide(ad)}><EyeOff size={13}/> Ocultar anúncio</button>}</div></article>;})}</div>}
    <h3 className="ca-section-title">Todos os anúncios</h3>
    {ads.length===0?<div className="ca-empty">Nenhum anúncio publicado.</div>:<div className="ca-list">{ads.map(ad=><article className="ca-row" key={ad.id}><div><b>{ad.title}</b><small>{ad.seller_name||'Anunciante'} · {ad.seller_unit_label||'Morador'} · {new Date(ad.created_at).toLocaleDateString('pt-BR')}</small></div><div className="ca-actions"><span className={'ca-status '+(ad.status==='paused'?'paused':'')}>{({available:'Disponível',reserved:'Reservado',sold:'Vendido',paused:'Oculto'} as any)[ad.status]||ad.status}</span><button onClick={()=>hide(ad)}>{ad.status==='paused'?<Eye size={13}/>:<EyeOff size={13}/>} {ad.status==='paused'?'Reativar':'Ocultar'}</button><button className="danger" onClick={()=>remove(ad)}><Trash2 size={13}/> Excluir</button></div></article>)}</div>}
  </section>;
}
