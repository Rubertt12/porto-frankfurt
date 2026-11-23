import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bell, CalendarDays, DoorOpen, FileText, MessageSquare, Package, RefreshCw, Wallet } from 'lucide-react';
import { supabase } from './lib/supabase';

type Row = Record<string, any>;
type FeedItem = { id: string; kind: string; title: string; description: string; date: string; status?: string; amount?: number };

const SOURCES = [
  { table: 'packages', kind: 'package', label: 'Encomenda', icon: Package, order: 'created_at' },
  { table: 'visitor_logs', kind: 'visitor', label: 'Portaria', icon: DoorOpen, order: 'created_at' },
  { table: 'reservations', kind: 'reservation', label: 'Reserva', icon: CalendarDays, order: 'created_at' },
  { table: 'occurrences', kind: 'occurrence', label: 'Ocorrência', icon: AlertTriangle, order: 'created_at' },
  { table: 'announcements', kind: 'announcement', label: 'Comunicado', icon: MessageSquare, order: 'created_at' },
  { table: 'financial_transactions', kind: 'finance', label: 'Financeiro', icon: Wallet, order: 'created_at' },
  { table: 'resident_notifications', kind: 'notification', label: 'Notificação', icon: Bell, order: 'created_at' },
] as const;

const FILTERS = [
  ['all', 'Tudo'], ['package', 'Encomendas'], ['visitor', 'Portaria'],
  ['reservation', 'Reservas'], ['occurrence', 'Ocorrências'],
  ['announcement', 'Comunicados'], ['finance', 'Financeiro']
];

const dateLabel = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Data não informada' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
};

const statusLabel = (value?: string) => ({
  pending: 'Pendente', approved: 'Aprovada', rejected: 'Recusada', resolved: 'Resolvida',
  open: 'Aberta', awaiting_pickup: 'Aguardando retirada', picked_up: 'Retirada',
  cancelled: 'Cancelada', paid: 'Pago', published: 'Publicado'
}[String(value || '')] || value || '');

function describe(kind: string, row: Row): Pick<FeedItem, 'title' | 'description' | 'status' | 'amount'> {
  if (kind === 'package') return { title: 'Encomenda recebida', description: [row.recipient_name, row.carrier, row.tracking_code].filter(Boolean).join(' · '), status: row.status };
  if (kind === 'visitor') return { title: row.visitor_name || 'Acesso registrado', description: [row.visitor_type, row.company_name, row.purpose, row.vehicle_plate].filter(Boolean).join(' · '), status: row.exit_at ? 'Concluído' : 'Em andamento' };
  if (kind === 'reservation') return { title: 'Reserva de área comum', description: [row.purpose, row.starts_at ? dateLabel(row.starts_at) : ''].filter(Boolean).join(' · '), status: row.status };
  if (kind === 'occurrence') return { title: row.subject || 'Ocorrência registrada', description: row.description || '', status: row.status };
  if (kind === 'announcement') return { title: row.title || 'Comunicado', description: row.category || 'Aviso do condomínio', status: row.is_published ? 'Publicado' : 'Rascunho' };
  if (kind === 'finance') return { title: row.description || 'Movimentação financeira', description: [row.category, row.transaction_type === 'income' ? 'Receita' : 'Despesa', row.approval_status === 'approved' ? 'Aprovado para transparência' : 'Aguardando aprovação'].filter(Boolean).join(' · '), status: row.approval_status || row.status, amount: Number(row.amount || 0) };
  if (kind === 'notification') return { title: row.title || 'Notificação enviada', description: row.body || row.notification_type || '', status: row.is_read ? 'Lida' : 'Não lida' };
  return { title: row.action || 'Alteração registrada', description: [row.entity_table, row.details?.summary || row.entity_id].filter(Boolean).join(' · ') };
}

export default function ActivityCenter({ condominiumId }: { condominiumId: string }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !condominiumId) { setItems([]); setLoading(false); return; }
    setLoading(true); setError('');
    const results = await Promise.all(SOURCES.map(async source => {
      const response = await supabase!.from(source.table).select('*').eq('condominium_id', condominiumId).order(source.order, { ascending: false }).limit(25);
      return { source, ...response };
    }));
    const failed = results.filter(result => result.error);
    const merged: FeedItem[] = [];
    for (const result of results) {
      if (result.error || !result.data) continue;
      for (const row of result.data as Row[]) {
        const date = row.created_at || row.received_at || row.entry_at || row.starts_at || row.occurrence_date || row.published_at;
        if (!date) continue;
        const detail = describe(result.source.kind, row);
        merged.push({ id: result.source.kind + ':' + row.id, kind: result.source.kind, ...detail, date });
      }
    }
    merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(merged.slice(0, 100));
    if (failed.length) setError('Alguns módulos não puderam ser consultados por causa das permissões de acesso: ' + failed.map(x => x.source.label).join(', ') + '.');
    setLoading(false);
  }, [condominiumId]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => filter === 'all' ? items : items.filter(item => item.kind === filter), [items, filter]);
  const counts = useMemo(() => items.reduce((acc, item) => { acc[item.kind] = (acc[item.kind] || 0) + 1; return acc; }, {} as Record<string, number>), [items]);

  return <section className="activity-center">
    <div className="activity-intro">
      <div><span className="eyebrow">OPERAÇÃO · HISTÓRICO UNIFICADO</span><h2>Central de atividades</h2><p>Eventos recentes dos módulos do condomínio, organizados em uma única linha do tempo.</p></div>
      <button className="soft-btn" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'activity-spin' : ''}/> Atualizar</button>
    </div>
    <div className="activity-summary">
      <article><Activity/><b>{items.length}</b><span>Eventos recentes</span></article>
      <article><Package/><b>{counts.package || 0}</b><span>Encomendas</span></article>
      <article><AlertTriangle/><b>{counts.occurrence || 0}</b><span>Ocorrências</span></article>
      <article><Wallet/><b>{counts.finance || 0}</b><span>Movimentações financeiras</span></article>
    </div>
    <div className="activity-panel">
      <div className="activity-filter">{FILTERS.map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>
      {error && <div className="activity-warning">{error}</div>}
      {loading ? <div className="activity-empty">Carregando atividades…</div> : visible.length ? <div className="activity-timeline">{visible.map(item => {
        const source = SOURCES.find(x => x.kind === item.kind);
        const Icon = source?.icon || Activity;
        return <article className="activity-item" key={item.id}>
          <div className={'activity-item-icon ' + item.kind}><Icon size={17}/></div>
          <div className="activity-item-body"><div className="activity-item-heading"><b>{item.title}</b><time>{dateLabel(item.date)}</time></div><p>{item.description || 'Sem detalhes adicionais.'}</p><div className="activity-item-meta">{item.status && <span>{statusLabel(item.status)}</span>}{item.amount !== undefined && <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}</strong>}</div></div>
        </article>;
      })}</div> : <div className="activity-empty">Nenhuma atividade encontrada neste filtro.</div>}
    </div>
    <p className="activity-footnote">A linha do tempo mostra atividades da operação. Alterações técnicas do banco de dados permanecem no registro interno de auditoria e não aparecem aqui.</p>
  </section>;
}
