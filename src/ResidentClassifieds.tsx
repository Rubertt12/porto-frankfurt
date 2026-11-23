import { useEffect, useMemo, useState } from 'react';
import { Store, Search, Plus, ImagePlus, X, SlidersHorizontal, CheckCircle2, Pause, Pencil, Trash2, Flag, Eye, MessageCircle, Send } from 'lucide-react';
import { supabase } from './lib/supabase';

type Row = Record<string, any>;
const categories = ['Todos','Eletrônicos','Móveis e decoração','Casa e cozinha','Roupas e acessórios','Esporte e lazer','Livros e estudos','Serviços','Outros'];
const money = (value:any) => Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export default function ResidentClassifieds({userId,profile,apartment}:{userId:string;profile:Row;apartment:Row|null}) {
  const [rows,setRows] = useState<Row[]>([]);
  const [signedImages,setSignedImages] = useState<Record<string,string>>({});
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [search,setSearch] = useState('');
  const [category,setCategory] = useState('Todos');
  const [mineOnly,setMineOnly] = useState(false);
  const [modal,setModal] = useState(false);
  const [editingId,setEditingId] = useState<string|null>(null);
  const [photoFiles,setPhotoFiles] = useState<File[]>([]);
  const [message,setMessage] = useState('');
  const [interests,setInterests] = useState<Row[]>([]);
  const [conversations,setConversations] = useState<Row[]>([]);
  const [activeConversation,setActiveConversation] = useState<Row|null>(null);
  const [chatMessages,setChatMessages] = useState<Row[]>([]);
  const [chatDraft,setChatDraft] = useState('');
  const [interestDraft,setInterestDraft] = useState('');
  const [interestTarget,setInterestTarget] = useState<Row|null>(null);
  const [chatBusy,setChatBusy] = useState(false);
  const [draft,setDraft] = useState<Row>({title:'',description:'',category:'Outros',price:'',show_price:true,status:'available',images:[]});

  const load = async () => {
    if(!supabase || !apartment?.condominium_id) return;
    setLoading(true);
    const {data,error} = await supabase.from('condominium_classifieds').select('*').eq('condominium_id',apartment.condominium_id).order('created_at',{ascending:false});
    if(error){setMessage(error.message);setLoading(false);return;}
    const list = data||[];
    setRows(list);
    const [ir,cr] = await Promise.all([
      supabase.from('classified_interests').select('*').eq('condominium_id',apartment.condominium_id).or('buyer_profile_id.eq.'+userId+',seller_profile_id.eq.'+userId).order('created_at',{ascending:false}),
      supabase.from('classified_conversations').select('*').eq('condominium_id',apartment.condominium_id).or('buyer_profile_id.eq.'+userId+',seller_profile_id.eq.'+userId).order('created_at',{ascending:false})
    ]);
    if(!ir.error)setInterests(ir.data||[]);
    if(!cr.error)setConversations(cr.data||[]);
    const paths = [...new Set(list.flatMap((x:Row)=>x.images||[]))] as string[];
    const signed = await Promise.all(paths.map(async path=>{
      const {data} = await supabase!.storage.from('classifieds').createSignedUrl(path,3600);
      return [path,data?.signedUrl||''] as const;
    }));
    setSignedImages(Object.fromEntries(signed));
    setLoading(false);
  };

  useEffect(()=>{void load();},[apartment?.id]);

  const visibleRows = useMemo(()=>rows.filter(row=>{
    const own = row.seller_profile_id===userId;
    if(row.status==='paused'&&!own)return false;
    if(mineOnly&&!own)return false;
    if(category!=='Todos'&&row.category!==category)return false;
    const q=search.trim().toLowerCase();
    if(q&&!String(row.title+' '+row.description+' '+row.category+' '+(row.seller_name||'')).toLowerCase().includes(q))return false;
    return true;
  }),[rows,search,category,mineOnly,userId]);

  const openNew=()=>{setEditingId(null);setPhotoFiles([]);setDraft({title:'',description:'',category:'Outros',price:'',show_price:true,status:'available',images:[]});setModal(true);};
  const openEdit=(row:Row)=>{setEditingId(row.id);setPhotoFiles([]);setDraft({...row,price:row.price??'',images:row.images||[]});setModal(true);};
  const choosePhotos=(files:FileList|null)=>{
    if(!files)return;
    const chosen=Array.from(files);
    if(chosen.some(f=>!f.type.startsWith('image/'))){setMessage('Selecione somente imagens.');return;}
    if(chosen.some(f=>f.size>5*1024*1024)){setMessage('Cada foto pode ter no máximo 5 MB.');return;}
    if((draft.images?.length||0)+photoFiles.length+chosen.length>5){setMessage('O anúncio aceita até 5 fotos.');return;}
    setPhotoFiles(prev=>[...prev,...chosen]);
  };
  const removeExistingImage=(path:string)=>setDraft((d:Row)=>({...d,images:(d.images||[]).filter((x:string)=>x!==path)}));

  const save=async(e:any)=>{
    e.preventDefault();
    if(!supabase||!apartment?.id||!userId)return;
    if(!draft.title.trim()||!draft.description.trim()){setMessage('Preencha o título e a descrição.');return;}
    if(draft.show_price&&draft.price!==''&&(!Number.isFinite(Number(draft.price))||Number(draft.price)<0)){setMessage('Informe um valor válido ou escolha “A combinar”.');return;}
    setBusy(true);setMessage('');
    try{
      const uploaded:string[]=[];
      for(const file of photoFiles){
        const ext=file.name.split('.').pop()?.toLowerCase()||'jpg';
        const path=apartment.condominium_id+'/'+userId+'/'+crypto.randomUUID()+'.'+ext;
        const {error}=await supabase.storage.from('classifieds').upload(path,file,{contentType:file.type,upsert:false});
        if(error)throw error;
        uploaded.push(path);
      }
      const payload:Row={
        condominium_id:apartment.condominium_id,
        apartment_id:apartment.id,
        seller_profile_id:userId,
        seller_name:profile?.full_name||'Morador do condomínio',
        seller_unit_label:[apartment.block?'Bloco '+apartment.block:'',apartment.number?'Unidade '+apartment.number:''].filter(Boolean).join(' · ')||'Morador do condomínio',
        title:draft.title.trim(),
        description:draft.description.trim(),
        category:draft.category||'Outros',
        price:!draft.show_price||draft.price===''?null:Number(draft.price),
        show_price:!!draft.show_price,
        images:[...(draft.images||[]),...uploaded],
        status:draft.status||'available'
      };
      const result=editingId
        ? await supabase.from('condominium_classifieds').update(payload).eq('id',editingId).eq('seller_profile_id',userId)
        : await supabase.from('condominium_classifieds').insert(payload);
      if(result.error)throw result.error;
      setModal(false);setEditingId(null);setPhotoFiles([]);setMessage(editingId?'Anúncio atualizado.':'Anúncio publicado com sucesso.');await load();
    }catch(err){setMessage(err instanceof Error?err.message:String(err));}
    finally{setBusy(false);}
  };

  const updateStatus=async(row:Row,status:string)=>{
    if(!supabase)return;setBusy(true);
    const {error}=await supabase.from('condominium_classifieds').update({status,updated_at:new Date().toISOString()}).eq('id',row.id).eq('seller_profile_id',userId);
    if(error)setMessage(error.message);else{setMessage(status==='sold'?'Anúncio marcado como vendido.':status==='paused'?'Anúncio pausado.':'Anúncio reativado.');await load();}
    setBusy(false);
  };
  const remove=async(row:Row)=>{
    if(!supabase||!window.confirm('Excluir este anúncio permanentemente?'))return;
    setBusy(true);const {error}=await supabase.from('condominium_classifieds').delete().eq('id',row.id).eq('seller_profile_id',userId);
    if(error)setMessage(error.message);else{setMessage('Anúncio excluído.');await load();}setBusy(false);
  };
  const requestInterest=(row:Row)=>{
    if(row.seller_profile_id===userId)return;
    setInterestTarget(row);setInterestDraft('Olá! Tenho interesse neste anúncio. Ainda está disponível?');
  };
  const submitInterest=async()=>{
    if(!supabase||!apartment||!interestTarget)return;
    setChatBusy(true);setMessage('');
    try{
      const {data:i,error}=await supabase.from('classified_interests').insert({
        condominium_id:apartment.condominium_id,classified_id:interestTarget.id,
        buyer_profile_id:userId,seller_profile_id:interestTarget.seller_profile_id,
        buyer_apartment_id:apartment.id,seller_apartment_id:interestTarget.apartment_id,
        message:interestDraft.trim(),status:'pending'
      }).select('*').single();
      if(error)throw error;
      const {data:c,error:ce}=await supabase.from('classified_conversations').insert({
        condominium_id:apartment.condominium_id,classified_id:interestTarget.id,interest_id:i.id,
        buyer_profile_id:userId,seller_profile_id:interestTarget.seller_profile_id
      }).select('*').single();
      if(ce)throw ce;
      if(interestDraft.trim()){
        const {error:me}=await supabase.from('classified_messages').insert({
          condominium_id:apartment.condominium_id,conversation_id:c.id,sender_profile_id:userId,body:interestDraft.trim()
        });
        if(me)throw me;
      }
      const {error:ne}=await supabase.from('resident_notifications').insert({
        condominium_id:apartment.condominium_id,apartment_id:interestTarget.apartment_id,
        recipient_profile_id:interestTarget.seller_profile_id,notification_type:'classified_interest',
        title:'Novo interessado no seu anúncio',body:(profile?.full_name||'Um morador')+' demonstrou interesse em: '+interestTarget.title,created_by:userId
      });
      setInterestTarget(null);
      setMessage(ne?'Pedido registrado. O vendedor verá a solicitação nos Classificados.':'Interesse enviado! O vendedor foi notificado.');
      await load();
    }catch(err){setMessage(err instanceof Error?err.message:String(err));}
    finally{setChatBusy(false);}
  };
  const openChat=async(interest:Row)=>{
    if(!supabase)return;
    const c=conversations.find(x=>x.interest_id===interest.id);
    if(!c){setMessage('Conversa ainda não disponível. Atualize os Classificados.');return;}
    setActiveConversation({...c,interest});
    const {data,error}=await supabase.from('classified_messages').select('*').eq('conversation_id',c.id).order('created_at',{ascending:true});
    if(error)setMessage(error.message);else setChatMessages(data||[]);
  };
  const sendChatMessage=async(e:any)=>{
    e.preventDefault();if(!supabase||!activeConversation||!chatDraft.trim())return;
    setChatBusy(true);
    const {data,error}=await supabase.from('classified_messages').insert({
      condominium_id:apartment?.condominium_id,conversation_id:activeConversation.id,sender_profile_id:userId,body:chatDraft.trim()
    }).select('*').single();
    if(error)setMessage(error.message);else{setChatMessages(old=>[...old,data]);setChatDraft('');}
    setChatBusy(false);
  };
  const updateInterestStatus=async(i:Row,status:string)=>{
    if(!supabase)return;setChatBusy(true);
    const {error}=await supabase.from('classified_interests').update({status,updated_at:new Date().toISOString()}).eq('id',i.id).eq('seller_profile_id',userId);
    if(error)setMessage(error.message);else{setMessage(status==='accepted'?'Interesse aceito. Continue a negociação pela conversa.':'Solicitação recusada.');await load();}
    setChatBusy(false);
  };
  useEffect(()=>{
    if(!supabase||!activeConversation)return;
    const ch=supabase.channel('classified-chat-'+activeConversation.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'classified_messages',filter:'conversation_id=eq.'+activeConversation.id},payload=>{
        setChatMessages(old=>old.some(x=>x.id===payload.new.id)?old:[...old,payload.new as Row]);
      }).subscribe();
    return()=>{void supabase!.removeChannel(ch);};
  },[activeConversation?.id]);
  const report=async(row:Row)=>{
    const reason=window.prompt('Conte brevemente por que deseja denunciar este anúncio:');
    if(!reason?.trim()||!supabase||!apartment)return;
    const {error}=await supabase.from('classified_reports').insert({classified_id:row.id,condominium_id:apartment.condominium_id,reporter_profile_id:userId,reason:reason.trim()});
    setMessage(error?error.message:'Denúncia enviada à administração.');
  };

  if(!apartment)return <section className="resident-panel"><p>Seu usuário ainda não está vinculado a uma unidade.</p></section>;
  return <section className="resident-panel condo-classifieds">
    <style>{`
      .condo-classifieds{--cl-ink:#17251f;--cl-muted:#718078;--cl-line:#e5ece5;--cl-green:#1e7653;--cl-lime:#d9f58a}
      .cl-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
      .cl-title{display:flex;align-items:center;gap:12px}.cl-title-icon{width:44px;height:44px;border-radius:14px;background:#eaf4e9;color:#276b49;display:grid;place-items:center}.cl-title b{display:block;font-size:17px;color:var(--cl-ink)}.cl-title small{display:block;color:var(--cl-muted);font-size:12px;margin-top:4px}
      .cl-primary{border:0;border-radius:12px;background:#173c2d;color:#fff;padding:12px 16px;font-weight:750;display:inline-flex;align-items:center;gap:8px;cursor:pointer}.cl-primary:hover{background:#24563e}
      .cl-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:18px 0}.cl-search{position:relative;flex:1;min-width:190px}.cl-search svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#87958c}.cl-search input{width:100%;height:42px;border:1px solid var(--cl-line);border-radius:12px;padding:0 12px 0 39px;background:#fff;color:var(--cl-ink);outline:none}.cl-search input:focus,.cl-toolbar select:focus{border-color:#83b49a;box-shadow:0 0 0 3px #3d8a5b16}
      .cl-toolbar select{height:42px;border:1px solid var(--cl-line);border-radius:12px;background:#fff;padding:0 12px;color:#405148;max-width:100%}.cl-toggle{height:42px;border:1px solid var(--cl-line);border-radius:12px;padding:0 13px;background:#fff;color:#405148;display:inline-flex;align-items:center;gap:7px;cursor:pointer;font-weight:650}.cl-toggle.active{background:#edf6ed;border-color:#c6ddc8;color:#286b49}
      .cl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,235px),1fr));gap:15px}.cl-card{border:1px solid var(--cl-line);border-radius:17px;background:#fff;overflow:hidden;min-width:0;box-shadow:0 4px 18px #19352508}.cl-photo{height:170px;background:linear-gradient(135deg,#f1f5ef,#e7eee6);position:relative;display:grid;place-items:center;color:#91a097;overflow:hidden}.cl-photo img{width:100%;height:100%;object-fit:cover}.cl-photo-count{position:absolute;right:10px;bottom:10px;border-radius:8px;background:#10231dcc;color:#fff;padding:5px 8px;font-size:10px}.cl-card-body{padding:14px}.cl-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.cl-category{font-size:10px;font-weight:750;color:#39724e;background:#edf5ed;border-radius:7px;padding:5px 8px}.cl-status{font-size:10px;font-weight:750;color:#7b6a34;background:#faf4df;border-radius:7px;padding:5px 8px}.cl-status.sold{background:#f1f1f1;color:#777}.cl-status.paused{background:#f7eaea;color:#925151}.cl-card h3{font-size:15px;color:var(--cl-ink);margin:12px 0 6px;line-height:1.35}.cl-desc{font-size:12px;color:var(--cl-muted);line-height:1.55;min-height:38px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.cl-price{font-size:18px;font-weight:850;letter-spacing:-.04em;color:#1e6241;margin:12px 0}.cl-price.muted{font-size:14px;color:#65766b;font-weight:700}.cl-seller{display:flex;align-items:center;gap:9px;border-top:1px solid #eff2ee;padding-top:11px;margin-top:10px}.cl-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;background:#e8efe8;display:grid;place-items:center;color:#477257;font-size:11px;font-weight:800;flex:none}.cl-seller b{font-size:11px;display:block;color:#304138}.cl-seller small{font-size:10px;color:#8b978f;display:block;margin-top:3px}.cl-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.cl-actions button{border:1px solid var(--cl-line);background:#fff;color:#506057;border-radius:9px;padding:7px 9px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;gap:5px;cursor:pointer}.cl-actions button:hover{background:#f4f8f3}.cl-actions .danger{color:#a24e4e}.cl-empty{padding:42px 18px;text-align:center;border:1px dashed #d9e4d9;border-radius:16px;color:#78877d}.cl-empty svg{margin:0 auto 10px}.cl-empty b{display:block;color:#405248;margin-bottom:5px}.cl-banner{background:#edf7ec;border:1px solid #d7e9d5;color:#346847;border-radius:10px;padding:10px 12px;font-size:12px;margin:12px 0;display:flex;justify-content:space-between;gap:10px}.cl-banner button{border:0;background:none;color:inherit;cursor:pointer}
      .cl-interest-panel{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin:14px 0 20px}.cl-interest-box{border:1px solid var(--cl-line);border-radius:14px;background:#fbfdfb;padding:14px}.cl-interest-box h4{margin:0 0 10px;color:var(--cl-ink);font-size:13px}.cl-interest-row{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:9px 0;border-top:1px solid var(--cl-line);font-size:11px}.cl-interest-row strong{display:block;color:var(--cl-ink);font-size:12px}.cl-interest-row small{color:var(--cl-muted)}.cl-interest-actions{display:flex;gap:5px;flex-wrap:wrap}.cl-interest-actions button{border:1px solid var(--cl-line);border-radius:8px;background:#fff;padding:6px 8px;font-size:10px;font-weight:700;cursor:pointer}.cl-chat-list{display:grid;gap:10px;max-height:48vh;overflow:auto}.cl-chat-bubble{max-width:85%;padding:10px 12px;border-radius:13px;background:#eef4ee;color:#24382d;font-size:13px;line-height:1.45;align-self:flex-start}.cl-chat-bubble.mine{background:#173c2d;color:#fff;align-self:flex-end}.cl-chat-time{display:block;font-size:9px;opacity:.7;margin-top:4px}.cl-chat-form{display:flex;gap:8px;margin-top:14px}.cl-chat-form input{flex:1;min-width:0;border:1px solid #dfe8df;border-radius:11px;padding:11px}.cl-chat-form button{border:0;border-radius:11px;background:#173c2d;color:#fff;padding:0 15px;cursor:pointer}.cl-interest-form textarea{width:100%;min-height:100px;border:1px solid #dfe8df;border-radius:10px;padding:12px;font:inherit;resize:vertical}
      .cl-backdrop{position:fixed;inset:0;z-index:1000;background:#0b1711a6;display:flex;align-items:center;justify-content:center;padding:18px}.cl-modal{width:min(100%,620px);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:22px;box-shadow:0 25px 80px #0004}.cl-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.cl-modal-head h3{margin:0;color:#1d3025;font-size:20px}.cl-close{border:0;background:#f1f4f0;border-radius:10px;width:36px;height:36px;display:grid;place-items:center;cursor:pointer}.cl-form{display:grid;gap:13px}.cl-form label{display:grid;gap:6px;font-size:12px;font-weight:700;color:#405148}.cl-form input,.cl-form textarea,.cl-form select{width:100%;border:1px solid #dfe8df;border-radius:10px;padding:11px 12px;font:inherit;color:#1d3025;background:#fff;outline:none}.cl-form textarea{min-height:105px;resize:vertical}.cl-form .cl-check{display:flex;align-items:center;gap:9px;font-weight:600}.cl-form .cl-check input{width:17px;height:17px}.cl-price-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cl-photo-preview{display:flex;gap:8px;flex-wrap:wrap}.cl-photo-preview img{width:66px;height:66px;object-fit:cover;border-radius:9px}.cl-photo-preview button{border:0;background:#f5eeee;color:#9a5555;border-radius:8px;padding:4px 7px;font-size:10px;cursor:pointer}.cl-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:7px}.cl-secondary{border:1px solid #dfe8df;background:#fff;color:#53645a;border-radius:11px;padding:11px 15px;font-weight:700;cursor:pointer}
      @media(max-width:600px){.cl-head{align-items:flex-start}.cl-head .cl-primary{width:100%;justify-content:center}.cl-toolbar{display:grid;grid-template-columns:1fr 1fr}.cl-search{grid-column:1/-1}.cl-toolbar select,.cl-toggle{width:100%;justify-content:center}.cl-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.cl-photo{height:130px}.cl-card-body{padding:10px}.cl-card h3{font-size:13px}.cl-desc{font-size:11px}.cl-price{font-size:15px}.cl-actions button{font-size:9px;padding:6px 7px}.cl-price-row{grid-template-columns:1fr}.cl-modal{padding:17px}}
      @media(max-width:370px){.cl-grid{grid-template-columns:1fr}}
    `}</style>
    <div className="cl-head"><div className="cl-title"><span className="cl-title-icon"><Store size={21}/></span><div><b>Classificados do condomínio</b><small>Compre, venda e ofereça serviços entre moradores.</small></div></div><button className="cl-primary" onClick={openNew}><Plus size={17}/> Publicar anúncio</button></div>
    {message&&<div className="cl-banner">{message}<button onClick={()=>setMessage('')}><X size={15}/></button></div>}
    <div className="cl-toolbar"><div className="cl-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar produtos, serviços…"/></div><select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Filtrar categoria">{categories.map(x=><option key={x}>{x}</option>)}</select><button className={'cl-toggle '+(mineOnly?'active':'')} onClick={()=>setMineOnly(v=>!v)}><SlidersHorizontal size={15}/>{mineOnly?'Meus anúncios':'Todos os anúncios'}</button></div>
    {(interests.length>0||conversations.length>0)&&<div className="cl-interest-panel">
      <section className="cl-interest-box"><h4><MessageCircle size={15} style={{display:'inline',verticalAlign:'middle',marginRight:6}}/>Interesses recebidos ({interests.filter(x=>x.seller_profile_id===userId).length})</h4>
        {interests.filter(x=>x.seller_profile_id===userId).map(x=><div className="cl-interest-row" key={x.id}><div><strong>{rows.find(r=>r.id===x.classified_id)?.title||'Anúncio'}</strong><small>{x.message||'Morador demonstrou interesse'} · {x.status==='pending'?'Aguardando':x.status==='accepted'?'Aceito':'Encerrado'}</small></div><div className="cl-interest-actions"><button onClick={()=>void openChat(x)}>Conversar</button>{x.status==='pending'&&<><button onClick={()=>void updateInterestStatus(x,'accepted')}>Aceitar</button><button onClick={()=>void updateInterestStatus(x,'declined')}>Recusar</button></>}</div></div>)}
        {!interests.some(x=>x.seller_profile_id===userId)&&<small>Nenhum interessado por enquanto.</small>}
      </section>
      <section className="cl-interest-box"><h4><MessageCircle size={15} style={{display:'inline',verticalAlign:'middle',marginRight:6}}/>Minhas solicitações ({interests.filter(x=>x.buyer_profile_id===userId).length})</h4>
        {interests.filter(x=>x.buyer_profile_id===userId).map(x=><div className="cl-interest-row" key={x.id}><div><strong>{rows.find(r=>r.id===x.classified_id)?.title||'Anúncio'}</strong><small>{x.status==='pending'?'Aguardando vendedor':x.status==='accepted'?'Interesse aceito':'Solicitação encerrada'}</small></div><div className="cl-interest-actions"><button onClick={()=>void openChat(x)}>Abrir conversa</button></div></div>)}
        {!interests.some(x=>x.buyer_profile_id===userId)&&<small>Você ainda não solicitou nenhum produto.</small>}
      </section>
    </div>}
    {loading?<div className="cl-empty">Carregando classificados…</div>:visibleRows.length===0?<div className="cl-empty"><Store size={30}/><b>Nenhum anúncio por aqui ainda</b><span>{mineOnly?'Você ainda não publicou anúncios.':'Seja o primeiro a publicar algo para os moradores.'}</span></div>:<div className="cl-grid">{visibleRows.map(row=>{
      const own=row.seller_profile_id===userId;
      const myInterest=interests.find(i=>i.classified_id===row.id&&i.buyer_profile_id===userId);
      const firstImage=(row.images||[]).map((p:string)=>signedImages[p]).find(Boolean);
      const sellerName=row.seller_name||'Morador do condomínio';
      const initials=String(sellerName).split(' ').map((x:string)=>x[0]).slice(0,2).join('').toUpperCase();
      return <article className="cl-card" key={row.id}>
        <div className="cl-photo">{firstImage?<img src={firstImage} alt={row.title}/>:<ImagePlus size={34}/>}{(row.images||[]).length>1&&<span className="cl-photo-count">+{row.images.length-1} fotos</span>}</div>
        <div className="cl-card-body"><div className="cl-card-top"><span className="cl-category">{row.category}</span><span className={'cl-status '+(row.status==='sold'?'sold':row.status==='paused'?'paused':'')}>{row.status==='sold'?'Vendido':row.status==='reserved'?'Reservado':row.status==='paused'?'Pausado':'Disponível'}</span></div>
          <h3>{row.title}</h3><p className="cl-desc">{row.description}</p><div className={'cl-price '+(!row.show_price||row.price===null?'muted':'')}>{row.show_price&&row.price!==null?money(row.price):'A combinar'}</div>
          <div className="cl-seller"><span className="cl-avatar">{initials}</span><div><b>{sellerName}</b><small>{row.seller_unit_label||'Morador do condomínio'}</small></div></div>
          {own?<div className="cl-actions"><button onClick={()=>openEdit(row)}><Pencil size={12}/> Editar</button>{row.status==='available'||row.status==='reserved'?<button onClick={()=>updateStatus(row,'paused')}><Pause size={12}/> Pausar</button>:<button onClick={()=>updateStatus(row,'available')}><Eye size={12}/> Reativar</button>}{row.status!=='sold'&&<button onClick={()=>updateStatus(row,'sold')}><CheckCircle2 size={12}/> Vendido</button>}<button className="danger" onClick={()=>remove(row)}><Trash2 size={12}/> Excluir</button></div>:row.status==='available'&&<div className="cl-actions">{myInterest?<button onClick={()=>void openChat(myInterest)}><MessageCircle size={12}/> Ver conversa</button>:<button onClick={()=>void requestInterest(row)}><MessageCircle size={12}/> Tenho interesse</button>}<button onClick={()=>report(row)}><Flag size={12}/> Denunciar anúncio</button></div>}
        </div>
      </article>;
    })}</div>}
    {interestTarget&&<div className="cl-backdrop" onClick={()=>!chatBusy&&setInterestTarget(null)}><div className="cl-modal" onClick={e=>e.stopPropagation()}><div className="cl-modal-head"><h3>Demonstrar interesse</h3><button className="cl-close" onClick={()=>setInterestTarget(null)}><X size={18}/></button></div><p>Seu pedido será enviado ao vendedor de <b>{interestTarget.title}</b>.</p><label className="cl-interest-form">Mensagem para o vendedor<textarea maxLength={1000} value={interestDraft} onChange={e=>setInterestDraft(e.target.value)} placeholder="Escreva uma mensagem…"/></label><div className="cl-modal-actions"><button className="cl-secondary" onClick={()=>setInterestTarget(null)}>Cancelar</button><button className="cl-primary" disabled={chatBusy} onClick={()=>void submitInterest()}>{chatBusy?'Enviando…':'Enviar interesse'}</button></div></div></div>}
    {activeConversation&&<div className="cl-backdrop" onClick={()=>setActiveConversation(null)}><div className="cl-modal" onClick={e=>e.stopPropagation()}><div className="cl-modal-head"><h3>Conversa sobre {rows.find(r=>r.id===activeConversation.classified_id)?.title||'anúncio'}</h3><button className="cl-close" onClick={()=>setActiveConversation(null)}><X size={18}/></button></div><div className="cl-chat-list">{chatMessages.map(m=><div className={'cl-chat-bubble '+(m.sender_profile_id===userId?'mine':'')} key={m.id}>{m.body}<small className="cl-chat-time">{new Date(m.created_at).toLocaleString('pt-BR')}</small></div>)}{!chatMessages.length&&<p className="cl-empty">Envie a primeira mensagem para iniciar a conversa.</p>}</div><form className="cl-chat-form" onSubmit={sendChatMessage}><input value={chatDraft} onChange={e=>setChatDraft(e.target.value)} maxLength={2000} placeholder="Escreva sua mensagem…"/><button type="submit" disabled={chatBusy||!chatDraft.trim()}><Send size={16}/></button></form></div></div>}
    {modal&&<div className="cl-backdrop" onClick={()=>!busy&&setModal(false)}><div className="cl-modal" onClick={e=>e.stopPropagation()}><div className="cl-modal-head"><h3>{editingId?'Editar anúncio':'Novo anúncio'}</h3><button className="cl-close" onClick={()=>setModal(false)} disabled={busy}><X size={18}/></button></div>
      <form className="cl-form" onSubmit={save}><label>Título do anúncio<input required maxLength={100} value={draft.title||''} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Ex.: Bicicleta aro 29 em ótimo estado"/></label><label>Categoria<select value={draft.category||'Outros'} onChange={e=>setDraft({...draft,category:e.target.value})}>{categories.filter(x=>x!=='Todos').map(x=><option key={x}>{x}</option>)}</select></label><label>Descrição<textarea required maxLength={2000} value={draft.description||''} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Descreva o produto, estado de conservação ou detalhes do serviço…"/></label>
        <div className="cl-price-row"><label>Valor (R$)<input type="number" min="0" step="0.01" value={draft.price??''} disabled={!draft.show_price} onChange={e=>setDraft({...draft,price:e.target.value})} placeholder="Ex.: 250,00"/></label><label className="cl-check"><input type="checkbox" checked={!!draft.show_price} onChange={e=>setDraft({...draft,show_price:e.target.checked})}/> Exibir valor no anúncio</label></div>
        <label>Fotos (até 5, máximo 5 MB cada)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>choosePhotos(e.target.files)}/></label>
        <div className="cl-photo-preview">{(draft.images||[]).map((path:string)=><span key={path}><img src={signedImages[path]||''} alt="Foto atual"/><button type="button" onClick={()=>removeExistingImage(path)}>Remover</button></span>)}{photoFiles.map((f,i)=><span key={f.name+i}><img src={URL.createObjectURL(f)} alt="Nova foto"/><button type="button" onClick={()=>setPhotoFiles(prev=>prev.filter((_,idx)=>idx!==i))}>Remover</button></span>)}</div>
        <div className="cl-modal-actions"><button type="button" className="cl-secondary" onClick={()=>setModal(false)} disabled={busy}>Cancelar</button><button type="submit" className="cl-primary" disabled={busy}>{busy?'Salvando…':editingId?'Salvar alterações':'Publicar anúncio'}</button></div>
      </form>
    </div></div>}
  </section>;
}
