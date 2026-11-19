import { useEffect, useMemo, useState } from 'react';
import { Building2, Home, Users, Package, CalendarDays, Car, Wallet, Megaphone, AlertTriangle, Plus, Database, HardDrive, CheckCircle2 } from 'lucide-react';
import { createLocalCondominium, getLocalDatabase, listLocalCondominiums, localDashboardStats, type LocalCondominium } from '../lib/localDatabase';
import './localWorkspace.css';

type Stats = Record<string, number>;

const modules = [
  { id: 'units', label: 'Unidades', icon: Home },
  { id: 'residents', label: 'Moradores', icon: Users },
  { id: 'packages', label: 'Encomendas', icon: Package },
  { id: 'reservations', label: 'Reservas', icon: CalendarDays },
  { id: 'vehicles', label: 'Veículos e vagas', icon: Car },
  { id: 'finance', label: 'Financeiro', icon: Wallet },
  { id: 'announcements', label: 'Comunicados', icon: Megaphone },
  { id: 'occurrences', label: 'Ocorrências', icon: AlertTriangle },
];

export default function LocalWorkspace() {
  const [condominiums, setCondominiums] = useState<LocalCondominium[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('Porto Frankfurt - Ambiente de testes');
  const [address, setAddress] = useState('');
  const [blocks, setBlocks] = useState(2);
  const [floors, setFloors] = useState(4);
  const [unitsPerFloor, setUnitsPerFloor] = useState(4);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const activeCondo = useMemo(() => condominiums.find(c => c.id === activeId) ?? null, [condominiums, activeId]);

  async function refresh() {
    setLoading(true);
    try {
      await getLocalDatabase();
      const rows = await listLocalCondominiums();
      setCondominiums(rows);
      const nextId = activeId && rows.some(row => row.id === activeId) ? activeId : rows[0]?.id ?? null;
      setActiveId(nextId);
      if (nextId) setStats(await localDashboardStats(nextId));
      else setStats({});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível abrir o banco local.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!activeId) { setStats({}); return; }
    void localDashboardStats(activeId).then(setStats).catch(error => setMessage(String(error)));
  }, [activeId]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const id = await createLocalCondominium({
        name,
        address,
        blocksCount: blocks,
        floorsPerBlock: floors,
        apartmentsPerFloor: unitsPerFloor,
      });
      const db = await getLocalDatabase();
      const areas = [
        ['Salão de festas', 'party_room', 60],
        ['Quiosque', 'kiosk', 20],
        ['Quadra esportiva', 'sports_court', 30],
        ['Churrasqueira', 'barbecue', 15],
      ] as const;
      for (const area of areas) {
        await db.execute('INSERT OR IGNORE INTO common_areas (condominium_id, name, area_type, capacity) VALUES (?, ?, ?, ?)', [id, area[0], area[1], area[2]]);
      }
      const parkingCount = Math.max(1, blocks * unitsPerFloor * floors);
      for (let i = 1; i <= parkingCount; i++) {
        await db.execute('INSERT OR IGNORE INTO parking_spaces (condominium_id, space_code, status) VALUES (?, ?, ?)', [id, `V-${String(i).padStart(3, '0')}`, 'available']);
      }
      setActiveId(id);
      setShowCreate(false);
      setName('');
      setAddress('');
      setMessage('Condomínio criado no banco local. Nenhum dado foi enviado à internet.');
      await refresh();
      setActiveId(id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao criar condomínio.');
    } finally {
      setBusy(false);
    }
  }

  const totalUnits = stats.apartments ?? 0;
  return (
    <div className="desktop-shell">
      <aside className="desktop-sidebar">
        <div className="desktop-brand"><div className="desktop-brand-mark"><Building2 size={22}/></div><div><strong>Porto Frankfurt</strong><span>Desktop · Offline</span></div></div>
        <div className="desktop-mode"><HardDrive size={15}/><span>Banco local SQLite</span><i/></div>
        <div className="desktop-nav-caption">GESTÃO CONDOMINIAL</div>
        <button className="desktop-nav active"><Building2 size={18}/> Visão geral</button>
        {modules.map(item => <button className="desktop-nav" key={item.id} onClick={() => setMessage(`O módulo ${item.label} está na fila de integração local.`)}><item.icon size={18}/>{item.label}<span className="desktop-nav-soon">Em integração</span></button>)}
        <div className="desktop-sidebar-bottom"><Database size={17}/><span>Armazenamento neste computador</span></div>
      </aside>
      <main className="desktop-main">
        <header className="desktop-topbar"><div><span className="desktop-eyebrow">AMBIENTE DE DESENVOLVIMENTO</span><h1>Central de gestão</h1></div><div className="desktop-top-actions"><span className="desktop-local-pill"><i/> Sem conexão necessária</span><div className="desktop-avatar">PF</div></div></header>
        <section className="desktop-content">
          {message && <div className="desktop-message"><CheckCircle2 size={17}/>{message}<button onClick={() => setMessage('')}>×</button></div>}
          <div className="desktop-section-head"><div><h2>Seus condomínios</h2><p>Cadastre estruturas e teste operações sem tocar na produção.</p></div><button className="desktop-primary" onClick={() => setShowCreate(true)}><Plus size={17}/> Novo condomínio</button></div>
          {loading ? <div className="desktop-empty">Preparando o banco SQLite local...</div> : condominiums.length === 0 ? (
            <div className="desktop-welcome"><div className="desktop-welcome-icon"><Building2 size={32}/></div><h2>Seu ambiente local está pronto</h2><p>Crie um condomínio de teste. Blocos, apartamentos, áreas comuns e vagas serão gerados automaticamente.</p><button className="desktop-primary" onClick={() => setShowCreate(true)}><Plus size={17}/> Criar primeiro condomínio</button></div>
          ) : (
            <>
              <div className="desktop-condo-select">
                <label htmlFor="desktop-condo">Condomínio selecionado</label>
                <select id="desktop-condo" value={activeId ?? ''} onChange={e => setActiveId(Number(e.target.value))}>{condominiums.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                {activeCondo && <span>{activeCondo.address || 'Endereço não informado'}</span>}
              </div>
              <div className="desktop-stats-grid">
                <article><span>Unidades</span><strong>{totalUnits}</strong><small>Geradas pela estrutura</small></article>
                <article><span>Moradores</span><strong>{stats.residents ?? 0}</strong><small>Cadastros locais</small></article>
                <article><span>Encomendas</span><strong>{stats.packages ?? 0}</strong><small>Registros locais</small></article>
                <article><span>Reservas</span><strong>{stats.reservations ?? 0}</strong><small>Solicitações locais</small></article>
              </div>
              <div className="desktop-section-head desktop-module-heading"><div><h2>Módulos do sistema</h2><p>Os próximos módulos serão conectados ao SQLite nesta versão desktop.</p></div></div>
              <div className="desktop-module-grid">{modules.map(item => <button key={item.id} onClick={() => setMessage(`O módulo ${item.label} será habilitado na próxima etapa de integração.`)}><div><item.icon size={20}/></div><strong>{item.label}</strong><span>Preparado para integração <span>↗</span></span></button>)}</div>
            </>
          )}
          <footer className="desktop-footer"><span><HardDrive size={14}/> Dados armazenados localmente</span><span>Porto Frankfurt Desktop · Versão inicial</span></footer>
        </section>
      </main>
      {showCreate && <div className="desktop-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowCreate(false); }}><form className="desktop-modal" onSubmit={handleCreate}><div className="desktop-modal-head"><div><span className="desktop-eyebrow">NOVA ESTRUTURA</span><h2>Criar condomínio de teste</h2></div><button type="button" onClick={() => setShowCreate(false)}>×</button></div><label>Nome do condomínio<input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Porto Frankfurt"/></label><label>Endereço<input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, número, cidade"/></label><div className="desktop-form-grid"><label>Blocos<input type="number" min="1" max="26" value={blocks} onChange={e => setBlocks(Number(e.target.value))}/></label><label>Andares por bloco<input type="number" min="1" max="60" value={floors} onChange={e => setFloors(Number(e.target.value))}/></label><label>Apartamentos por andar<input type="number" min="1" max="30" value={unitsPerFloor} onChange={e => setUnitsPerFloor(Number(e.target.value))}/></label></div><div className="desktop-generation-note">Serão criados automaticamente <strong>{blocks * floors * unitsPerFloor} apartamentos</strong>, áreas comuns básicas e vagas de estacionamento.</div><div className="desktop-modal-actions"><button type="button" className="desktop-secondary" onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit" className="desktop-primary" disabled={busy}>{busy ? 'Criando...' : 'Criar no banco local'}</button></div></form></div>}
    </div>
  );
}
