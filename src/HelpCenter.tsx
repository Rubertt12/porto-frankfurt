import {useEffect,useState} from 'react';
import {supabase} from './lib/supabase';
import {BookOpen,FileText,Phone,Plus,Trash2,Save,ExternalLink,ShieldCheck,Building2,RefreshCw} from 'lucide-react';

type HelpRule={id:string,title:string,body:string};
type HelpContact={id:string,label:string,phone:string,whatsapp?:string};
type HelpData={rules:HelpRule[],contacts:HelpContact[]};

const emptyData:HelpData={rules:[],contacts:[]};
const makeId=()=>crypto.randomUUID();

export default function HelpCenter({condominiumId,isAdmin=false,onManageDocuments}:any){
 const [data,setData]=useState<HelpData>(emptyData);
 const [documents,setDocuments]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [ruleTitle,setRuleTitle]=useState('');
 const [ruleBody,setRuleBody]=useState('');
 const [contactLabel,setContactLabel]=useState('');
 const [contactPhone,setContactPhone]=useState('');
 const [contactWhatsapp,setContactWhatsapp]=useState('');

 const load=async()=>{
  if(!supabase||!condominiumId){setLoading(false);return;}
  setLoading(true);setError('');
  const [settings,docs]=await Promise.all([
   supabase.from('condominium_settings').select('preferences').eq('condominium_id',condominiumId).maybeSingle(),
   supabase.from('documents').select('id,title,description,category,storage_path,created_at').eq('condominium_id',condominiumId).eq('is_visible_to_residents',true).is('apartment_id',null).order('created_at',{ascending:false}).limit(100)
  ]);
  if(settings.error)setError('Não foi possível carregar as orientações: '+settings.error.message);
  const stored=settings.data?.preferences?.help_center||{};
  setData({rules:Array.isArray(stored.rules)?stored.rules:[],contacts:Array.isArray(stored.contacts)?stored.contacts:[]});
  if(docs.error){setError(current=>current||'Não foi possível carregar os documentos: '+docs.error.message);setDocuments([]);}
  else{
   const rows=await Promise.all((docs.data||[]).map(async(doc:any)=>{
    if(!doc.storage_path||/^https?:\/\//i.test(doc.storage_path))return {...doc,url:doc.storage_path||''};
    const {data:signed}=await supabase!.storage.from('condo-documents').createSignedUrl(doc.storage_path,3600);
    return {...doc,url:signed?.signedUrl||''};
   }));
   setDocuments(rows);
  }
  setLoading(false);
 };
 useEffect(()=>{void load();},[condominiumId]);

 const persist=async(next:HelpData)=>{
  if(!supabase||!condominiumId)return;
  setSaving(true);setError('');setMessage('');
  const {data:current,error:readError}=await supabase.from('condominium_settings').select('preferences').eq('condominium_id',condominiumId).maybeSingle();
  if(readError){setError('Não foi possível ler as configurações: '+readError.message);setSaving(false);return;}
  const preferences={...(current?.preferences||{}),help_center:next};
  const {error:writeError}=await supabase.from('condominium_settings').upsert({condominium_id:condominiumId,preferences,updated_at:new Date().toISOString()},{onConflict:'condominium_id'});
  if(writeError)setError('Não foi possível salvar: '+writeError.message);
  else{setData(next);setMessage('Informações atualizadas para este condomínio.');}
  setSaving(false);
 };
 const addRule=()=>{if(!ruleTitle.trim()||!ruleBody.trim())return;void persist({...data,rules:[...data.rules,{id:makeId(),title:ruleTitle.trim(),body:ruleBody.trim()}]});setRuleTitle('');setRuleBody('');};
 const addContact=()=>{if(!contactLabel.trim()||!contactPhone.trim())return;void persist({...data,contacts:[...data.contacts,{id:makeId(),label:contactLabel.trim(),phone:contactPhone.trim(),whatsapp:contactWhatsapp.trim()}]});setContactLabel('');setContactPhone('');setContactWhatsapp('');};
 const removeRule=(id:string)=>void persist({...data,rules:data.rules.filter(x=>x.id!==id)});
 const removeContact=(id:string)=>void persist({...data,contacts:data.contacts.filter(x=>x.id!==id)});
 const normalizePhone=(value:string)=>value.replace(/[^\d+]/g,'');
 return <div className="content-card help-center">
  <div className="help-center-hero"><div><span className="eyebrow">INFORMAÇÕES DO CONDOMÍNIO</span><h2>Preciso de Ajuda</h2><p>Consulte documentos, regras de convivência e telefones úteis para falar com a equipe do condomínio.</p></div><span className="help-center-hero-icon"><BookOpen size={25}/></span></div>
  {error&&<div className="resident-feedback resident-feedback-error">{error}</div>}
  {message&&<div className="resident-feedback">{message}</div>}
  {loading?<div className="help-center-loading"><RefreshCw size={18}/> Carregando informações…</div>:<>
   <section className="help-center-section"><div className="help-center-heading"><span><FileText size={19}/></span><div><h3>Documentação</h3><p>Convenção, regimento interno, atas e outros documentos gerais.</p></div>{isAdmin&&<button className="soft-btn" onClick={onManageDocuments}>Gerenciar documentos</button>}</div>
    {documents.length?<div className="help-document-list">{documents.map(doc=><article key={doc.id}><span className="help-document-icon"><FileText size={18}/></span><div><b>{doc.title||'Documento do condomínio'}</b><small>{doc.category||'Documento'}{doc.description?' · '+doc.description:''}</small></div>{doc.url?<a href={doc.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Abrir</a>:<small>Arquivo indisponível</small>}</article>)}</div>:<div className="help-empty">Nenhum documento geral publicado. {isAdmin?'Use “Gerenciar documentos” para adicionar arquivos.':'A administração ainda não publicou documentos.'}</div>}
   </section>
   <section className="help-center-section"><div className="help-center-heading"><span><ShieldCheck size={19}/></span><div><h3>Regras do condomínio</h3><p>Orientações organizadas para facilitar a convivência.</p></div></div>
    {data.rules.length?<div className="help-rule-list">{data.rules.map(rule=><article key={rule.id}><div><b>{rule.title}</b><p>{rule.body}</p></div>{isAdmin&&<button className="icon-btn" aria-label="Excluir regra" onClick={()=>removeRule(rule.id)}><Trash2 size={16}/></button>}</article>)}</div>:<div className="help-empty">As regras do condomínio ainda não foram cadastradas.</div>}
    {isAdmin&&<div className="help-editor"><b>Adicionar regra</b><input value={ruleTitle} onChange={e=>setRuleTitle(e.target.value)} placeholder="Assunto (ex.: Horário de silêncio)"/><textarea value={ruleBody} onChange={e=>setRuleBody(e.target.value)} placeholder="Descreva a regra de forma clara…" rows={3}/><button className="primary-btn" disabled={saving||!ruleTitle.trim()||!ruleBody.trim()} onClick={addRule}><Plus size={15}/> Adicionar regra</button></div>}
   </section>
   <section className="help-center-section"><div className="help-center-heading"><span><Phone size={19}/></span><div><h3>Telefones úteis</h3><p>Contatos para solicitar apoio ou falar com a equipe.</p></div></div>
    {data.contacts.length?<div className="help-contact-list">{data.contacts.map(contact=><article key={contact.id}><span className="help-contact-icon"><Phone size={17}/></span><div><b>{contact.label}</b><small>{contact.phone}</small></div><div className="help-contact-actions"><a href={'tel:'+normalizePhone(contact.phone)}>Ligar</a>{contact.whatsapp&&<a href={'https://wa.me/'+normalizePhone(contact.whatsapp).replace(/^\+/,'')} target="_blank" rel="noreferrer">WhatsApp</a>}</div>{isAdmin&&<button className="icon-btn" aria-label="Excluir contato" onClick={()=>removeContact(contact.id)}><Trash2 size={16}/></button>}</article>)}</div>:<div className="help-empty">Nenhum telefone útil cadastrado.</div>}
    {isAdmin&&<div className="help-editor"><b>Adicionar contato</b><input value={contactLabel} onChange={e=>setContactLabel(e.target.value)} placeholder="Setor ou responsável (ex.: Portaria)"/><input value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="Telefone para ligação"/><input value={contactWhatsapp} onChange={e=>setContactWhatsapp(e.target.value)} placeholder="WhatsApp (opcional, com DDD)"/><button className="primary-btn" disabled={saving||!contactLabel.trim()||!contactPhone.trim()} onClick={addContact}><Plus size={15}/> Adicionar telefone</button></div>}
   </section>
   {isAdmin&&<p className="help-admin-note"><Building2 size={14}/> Estas informações pertencem somente a { 'este condomínio' } e ficam disponíveis aos moradores vinculados.</p>}
   {saving&&<small className="help-saving"><Save size={13}/> Salvando alterações…</small>}
  </>}
 </div>;
}
