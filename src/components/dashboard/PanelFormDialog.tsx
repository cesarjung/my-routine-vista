import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSectors } from '@/hooks/useSectors';
import { useUnits } from '@/hooks/useUnits';
import { useCreateDashboardPanel, useUpdateDashboardPanel, PanelFilters, DashboardPanel } from '@/hooks/useDashboardPanels';

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'atrasada', label: 'Atrasada' },
  { value: 'cancelada', label: 'Cancelada' },
];

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta Semana' },
  { value: 'month', label: 'Este Mês' },
  { value: 'quarter', label: 'Este Trimestre' },
  { value: 'year', label: 'Este Ano' },
  { value: 'all', label: 'Todos' },
];

const GROUP_BY_OPTIONS = [
  { value: 'unit', label: 'Por Unidade' },
  { value: 'responsible', label: 'Por Responsável' },
  { value: 'sector', label: 'Por Setor' },
];

interface PanelFormDialogProps {
  panel?: DashboardPanel;
  panelCount?: number;
  trigger?: React.ReactNode;
}

export const PanelFormDialog = ({ panel, panelCount = 0, trigger }: PanelFormDialogProps) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(panel?.title || '');
  const [sectorId, setSectorId] = useState<string>(panel?.filters.sector_id || '');
  const [unitId, setUnitId] = useState<string>(panel?.filters.unit_id || '');
  const [selectedStatus, setSelectedStatus] = useState<string[]>(panel?.filters.status || []);
  const [period, setPeriod] = useState<string>(panel?.filters.period || 'all');
  const [groupBy, setGroupBy] = useState<'unit' | 'responsible' | 'sector'>(panel?.filters.group_by || 'unit');

  const { data: sectors } = useSectors();
  const { data: units } = useUnits();
  const createPanel = useCreateDashboardPanel();
  const updatePanel = useUpdateDashboardPanel();

  const handleStatusToggle = (status: string) => {
    setSelectedStatus(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    const filters: PanelFilters = {
      sector_id: sectorId || null,
      unit_id: unitId || null,
      status: selectedStatus.length > 0 ? selectedStatus : undefined,
      period: period as PanelFilters['period'],
      group_by: groupBy
    };

    if (panel) {
      updatePanel.mutate({
        id: panel.id,
        title,
        filters
      }, {
        onSuccess: () => setOpen(false)
      });
    } else {
      createPanel.mutate({
        title,
        panel_type: 'summary',
        filters,
        display_config: {},
        order_index: panelCount
      }, {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        }
      });
    }
  };

  const resetForm = () => {
    setTitle('');
    setSectorId('');
    setUnitId('');
    setSelectedStatus([]);
    setPeriod('all');
    setGroupBy('unit');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-1">
            <Plus className="w-4 h-4" />
            Novo Painel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{panel ? 'Editar Painel' : 'Criar Painel Customizado'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Nome do Painel</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Tarefas Atrasadas por Unidade"
            />
          </div>

          <div className="space-y-2">
            <Label>Agrupar por</Label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'unit' | 'responsible' | 'sector')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_BY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Filtrar por Setor</Label>
            <Select value={sectorId || 'all'} onValueChange={(v) => setSectorId(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {sectors?.map(sector => (
                  <SelectItem key={sector.id} value={sector.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sector.color || '#6366f1' }} />
                      {sector.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Filtrar por Unidade</Label>
            <Select value={unitId || 'all'} onValueChange={(v) => setUnitId(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as unidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {units?.map(unit => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status das Tarefas</Label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`status-${opt.value}`}
                    checked={selectedStatus.includes(opt.value)}
                    onCheckedChange={() => handleStatusToggle(opt.value)}
                  />
                  <Label htmlFor={`status-${opt.value}`} className="text-sm font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
            {selectedStatus.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum selecionado = todos os status</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || createPanel.isPending || updatePanel.isPending}>
            {panel ? 'Salvar' : 'Criar Painel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
