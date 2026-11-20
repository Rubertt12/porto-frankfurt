import {useMemo,useState} from 'react';
import {Search,X,ChevronDown} from 'lucide-react';
type Option={value:string;label:string;description?:string;search?:string};
type Props={options?:Option[];value?:string;onChange:(value:string)=>void;placeholder?:string;searchPlaceholder?:string;disabled?:boolean};
const normalize=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9@._-]+/g,' ').trim();
export default function SearchPicker({options=[],value='',onChange,placeholder='Selecione...',searchPlaceholder='Digite para pesquisar...',disabled=false}:Props){
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0);
 const selected=options.find(o=>String(o.value)===String(value));
 const filtered=useMemo(()=>{const terms=normalize(query).split(/\s+/).filter(Boolean);return options.filter(o=>{const hay=normalize([o.label,o.description,o.search].join(' '));return terms.every(term=>hay.includes(term));}).slice(0,100);},[options,query]);
 const choose=(option:Option)=>{onChange(option.value);setQuery('');setOpen(false);setActive(0);};
 return <div className="search-picker" style={{position:'relative',width:'100%'}}>
  <div style={{display:'flex',alignItems:'center',gap:8,border:'1px solid var(--border,#d9dee7)',borderRadius:10,background:'var(--surface,#fff)',padding:'0 10px',opacity:disabled?0.55:1}}>
   <Search size={16} style={{flexShrink:0,opacity:.55}}/>
   <input disabled={disabled} aria-label={placeholder} aria-expanded={open} aria-autocomplete="list" autoComplete="off" value={open?query:(selected?.label||'')} placeholder={open?searchPlaceholder:placeholder} onFocus={()=>{setOpen(true);setQuery('');setActive(0);}} onChange={e=>{setQuery(e.target.value);setOpen(true);setActive(0);}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);setQuery('');setActive(0);}else if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>Math.min(i+1,filtered.length-1));}else if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(i-1,0));}else if(e.key==='Enter'&&filtered.length){e.preventDefault();choose(filtered[active]||filtered[0]);}}} style={{border:0,outline:0,background:'transparent',width:'100%',minWidth:0,padding:'11px 0',color:'inherit',font:'inherit'}}/>
   {value&&<button type="button" disabled={disabled} onClick={()=>{onChange('');setQuery('');setOpen(false);}} aria-label="Limpar seleção" style={{border:0,background:'transparent',cursor:'pointer',opacity:.65,padding:4}}><X size={15}/></button>}
   <ChevronDown size={15} style={{opacity:.45,flexShrink:0}}/>
  </div>
  {open&&!disabled&&<><button type="button" aria-label="Fechar opções" onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:80,border:0,background:'transparent',padding:0}}/><div role="listbox" className="search-picker-options" style={{position:'absolute',zIndex:81,top:'calc(100% + 5px)',left:0,right:0,maxHeight:280,overflowY:'auto',background:'var(--surface,#fff)',border:'1px solid var(--border,#d9dee7)',borderRadius:10,boxShadow:'0 12px 32px rgba(0,0,0,.16)',padding:5}}>
   {filtered.length?filtered.map((o,i)=><button type="button" role="option" aria-selected={String(o.value)===String(value)} key={o.value} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>choose(o)} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 11px',border:0,borderRadius:7,background:i===active?'var(--accent-soft,rgba(60,120,100,.12))':'transparent',color:'inherit',cursor:'pointer'}}>
    <span style={{display:'block',fontWeight:600}}>{o.label}</span>{o.description&&<small style={{display:'block',opacity:.65,marginTop:2}}>{o.description}</small>}
   </button>):<div style={{padding:12,opacity:.65,fontSize:13}}>Nenhum resultado encontrado. Tente outro nome, e-mail, bloco ou unidade.</div>}
   {filtered.length>0&&<div style={{padding:'7px 10px',fontSize:11,opacity:.5,borderTop:'1px solid var(--border,#d9dee7)'}}>{filtered.length===100?'Mostrando os primeiros 100 resultados':filtered.length+' resultado(s)'}</div>}
  </div></>}
 </div>;
}
