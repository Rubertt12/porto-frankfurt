import {useEffect,useMemo,useState} from 'react';
import {supabase} from './lib/supabase';
import {Building2,Plus,Settings2,Layers3,Home,ParkingCircle,Users,Package,CalendarDays,MessageSquare,AlertTriangle,Car,FileText,ChartNoAxesCombined,Shield,CheckCircle2,RefreshCw} from 'lucide-react';

type Condo=Record<string,any>;
const MODULES:any[]=[
 ['dashboard','Painel geral',ChartNoAxesCombined],['units','Blocos e apartamentos',Building2],['residents','Moradores',Users],['packages','Encomendas',Package],['reservations','Reservas',CalendarDays],['announcements','Comunicados',MessageSquare],['occurrences','Ocorrências e multas',AlertTriangle],['vehicles','Veículos',Car],['parking','Estacionamentos',ParkingCircle],['common_areas','Áreas comuns',Home],['documents','Documentos e boletos',FileText],['finance','Financeiro',Layers3],['visitors','Visitantes e portaria',Shield],['reports','Relatórios',ChartNoAxesCombined]
];
export default function PlatformPortfolio({profile,onOpen}:any){
 const [condos,C]=useState<Condo[]>([]),[portfolio,PF]=useState<Condo|null>(null),[modules,MD]=useState<Record<string,boolean>>({}),[selected,SEL]=useState<Condo|null>(null);
 const [loading,L]=useState(true),[saving,S]=useState(false),[showForm,F]=useState(false),[error,E]=useState(''),[success,OK]=useState('');
 const [form,V]=useState<any>({name:'',address:'',blocks:1,floors:5,unitsPerFloor:4,parkingSpaces:0,houses:0});
 const reload=async()=>{
  if(!supabase||!profile?.id)return;L(true);E('');
  const [pf,mem]=await Promise.all([
   supabase.from('condominium_portfolios').select('*').eq('owner_profile_id',profile.id).maybeSingle(),
   supabase.from('condominium_members').select('condominium_id,role,condominiums(id,name,slug,status,created_at)').eq('profile_id',profile.id).eq('is_active',true)
  ]);
  if(pf.error)E(pf.error.message);else PF(pf.data);
  if(mem.error)E(mem.error.message);
  const list=(mem.data||[]).map((m:any)=>Array.isArray(m.condominiums)?m.condominiums[0]:m.condominiums).filter(Boolean);
  C(list);
  if(selected){const {data}=await supabase.from('condominium_modules').select('module_key,enabled').eq('condominium_id',selected.id);MD(Object.fromEntries((data||[]).map((x:any)=>[x.module_key,x.enabled])));}
  L(false);
 };
 useEffect(()=>{reload();},[profile?.id]);
 const totals=useMemo(()=>({condos:condos.length,units:0,modules:Object.values(modules).filter(Boolean).length}),[condos,modules]);
 async function createCondo(e:any){
  e.preventDefault();if(!supabase||!profile?.id)return;S(true);E('');OK('');
  const slug=String(form.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')+'-'+Math.random().toString(36).slice(2,6);
  const {data:condo,error:ce}=await supabase.from('condominiums').insert({name:form.name.trim(),slug,created_by:profile.id}).select().single();
  if(ce||!condo){E(ce?.message||'Não foi possível criar o condomínio.');S(false);return;}
  const {error:me}=await supabase.from('condominium_members').insert({condominium_id:condo.id,profile_id:profile.id,role:'syndic',is_active:true});
  if(me){E('Condomínio criado, mas o vínculo de síndico falhou: '+me.message);S(false);await reload();return;}
  await supabase.from('condominium_settings').upsert({condominium_id:condo.id,structure:{blocks:Number(form.blocks),floors:Number(form.floors),units_per_floor:Number(form.unitsPerFloor),parking_spaces:Number(form.parkingSpaces),houses:Number(form.houses)},preferences:{}});
  const enabled=MODULES.map(([key])=>({condominium_id:condo.id,module_key:key,enabled:true}));
  const {error:modErr}=await supabase.from('condominium_modules').insert(enabled);
  const apartments:any[]=[];
  for(let b=1;b<=Number(form.blocks);b++)for(let f=1;f<=Number(form.floors);f++)for(let u=1;u<=Number(form.unitsPerFloor);u++)apartments.push({condominium_id:condo.id,block:String(b),floor:String(f),number:String(f*100+u),status:'vacant'});
  if(apartments.length){const {error:unitErr}=await supabase.from('apartments').insert(apartments);if(unitErr)E('Condomínio criado, mas a geração das unidades precisa ser revisada: '+unitErr.message);}
  if(modErr)E('Condomínio criado, mas os módulos precisam ser revisados: '+modErr.message);
  if(!modErr)OK('Condomínio criado e estrutura inicial cadastrada.');
  F(false);V({name:'',address:'',blocks:1,floors:5,unitsPerFloor:4,parkingSpaces:0,houses:0});await reload();S(false);
 }
 async function toggleModule(key:string,enabled:boolean){
  if(!supabase||!selected)return;const {error}=await supabase.from('condominium_modules').upsert({condominium_id:selected.id,module_key:key,enabled},{onConflict:'condominium_id,module_key'});
  if(error)E(error.message);else MD(old=>({...old,[key]:enabled}));
 }
 return <div className="portfolio-page">
  <div className="portfolio-hero"><div><span className="eyebrow">GESTÃO MULTICONDÔMINIO</span><h2>Central de Gestão</h2><p>Todos os empreendimentos sob sua responsabilidade, em uma única plataforma.</p></div><button className="primary-btn" onClick={()=>F(true)}><Plus size={17}/> Novo condomínio</button></div>
  {error&&<div className="error-banner">{error}</div>}{success&&<div className="success-banner"><CheckCircle2 size={16}/>{success}</div>}
  <div className="portfolio-stats"><article><Building2/><b>{condos.length}</b><span>Condomínios vinculados</span></article><article><Layers3/><b>{MODULES.length}</b><span>Módulos disponíveis</span></article><article><Shield/><b>Isolado</b><span>Dados por empreendimento</span></article></div>
  <div className="portfolio-layout"><section className="content-card"><div className="section-card-head"><div><b>Meus condomínios</b><small>Selecione um empreendimento para configurar seus módulos.</small></div><Building2 size={19}/></div>{loading?<div className="table-loading"><div className="spinner"/>Carregando condomínios…</div>:condos.length===0?<div className="empty-state"><Building2/><b>Nenhum condomínio vinculado</b><p>Crie o primeiro empreendimento para começar sua carteira.</p></div>:<div className="portfolio-condo-list">{condos.map(c=><button key={c.id} className={'portfolio-condo '+(selected?.id===c.id?'selected':'')} onClick={()=>SEL(c)}><span className="portfolio-condo-icon"><Building2/></span><span><b>{c.name}</b><small>{c.slug} · {c.status||'Ativo'}</small></span><span className="status-pill good">Acessível</span></button>)}</div>}</section>
  <section className="content-card"><div className="section-card-head"><div><b>{selected?selected.name:'Configuração modular'}</b><small>{selected?'Ative somente os recursos usados neste condomínio.':'Escolha um condomínio para configurar os módulos.'}</small></div><Settings2 size={19}/></div>{selected?<div className="portfolio-module-grid">{MODULES.map(([key,label,Icon])=><label className="portfolio-module" key={key}><span className="portfolio-module-icon"><Icon size={17}/></span><span><b>{label}</b><small>{modules[key]===false?'Desativado':'Disponível'}</small></span><input type="checkbox" checked={modules[key]!==false} onChange={e=>toggleModule(key,e.target.checked)}/></label>)}</div>:<div className="empty-state"><Layers3/><b>Módulos por condomínio</b><p>Selecione um empreendimento na lista para gerenciar os recursos disponíveis.</p></div>}</section></div>
  {showForm&&<div className="modal-backdrop" onClick={()=>F(false)}><form className="modal-card portfolio-form" onSubmit={createCondo} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">NOVO EMPREENDIMENTO</span><h2>Construir condomínio</h2></div><button type="button" className="icon-btn" onClick={()=>F(false)}>×</button></div><label>Nome do condomínio<input required value={form.name} onChange={e=>V({...form,name:e.target.value})} placeholder="Ex.: Residencial Jardim das Flores"/></label><label>Endereço<input value={form.address} onChange={e=>V({...form,address:e.target.value})} placeholder="Rua, número, cidade - UF"/></label><div className="portfolio-number-grid"><label>Blocos / torres<input type="number" min="1" max="100" required value={form.blocks} onChange={e=>V({...form,blocks:e.target.value})}/></label><label>Andares por bloco<input type="number" min="1" max="100" required value={form.floors} onChange={e=>V({...form,floors:e.target.value})}/></label><label>Apartamentos por andar<input type="number" min="1" max="100" required value={form.unitsPerFloor} onChange={e=>V({...form,unitsPerFloor:e.target.value})}/></label><label>Vagas de estacionamento<input type="number" min="0" max="10000" value={form.parkingSpaces} onChange={e=>V({...form,parkingSpaces:e.target.value})}/></label></div><div className="portfolio-preview"><b>Estrutura que será gerada</b><span>{Number(form.blocks)*Number(form.floors)*Number(form.unitsPerFloor)||0} apartamentos · {Number(form.blocks)||0} blocos · {Number(form.parkingSpaces)||0} vagas planejadas</span></div><p className="muted-copy">A criação gera o condomínio, seu vínculo de síndico, configurações e unidades. Os módulos começam ativos e podem ser ajustados depois.</p><div className="modal-actions"><button type="button" className="soft-btn" onClick={()=>F(false)}>Cancelar</button><button className="primary-btn" disabled={saving}>{saving?'Criando…':'Criar condomínio'}</button></div></form></div>}
 </div>;
}
