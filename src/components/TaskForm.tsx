import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, X, Loader2, Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { useUnits } from '@/hooks/useUnits';
import { useProfiles } from '@/hooks/useProfiles';
import { useCreateTaskWithUnits, type SubtaskData, type UnitAssignment } from '@/hooks/useTaskMutations';
import { useAuth } from '@/contexts/AuthContext';
import { useIsGestorOrAdmin } from '@/hooks/useUserRole';

const formSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200, 'Título muito longo'),
  description: z.string().max(1000, 'Descrição muito longa').optional(),
  priority: z.number().min(1).max(5),
  start_date: z.date().optional(),
  due_date: z.date().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface TaskFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const TaskForm = ({ onSuccess, onCancel }: TaskFormProps) => {
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<string>('');
  const [unitAssignments, setUnitAssignments] = useState<UnitAssignment[]>([]);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [parentAssignedTo, setParentAssignedTo] = useState<string>('');

  const { user } = useAuth();
  const { data: units, isLoading: loadingUnits } = useUnits();
  const { data: allProfiles } = useProfiles();
  const createTaskWithUnits = useCreateTaskWithUnits();
  const { isGestorOrAdmin } = useIsGestorOrAdmin();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 1,
    },
  });

  const selectedUnitIds = useMemo(() => unitAssignments.map(a => a.unitId), [unitAssignments]);
  const selectedSet = useMemo(() => new Set(selectedUnitIds), [selectedUnitIds]);

  // Profiles por unidade para dropdown de responsável
  const getProfilesForUnit = useCallback((unitId: string) => {
    return allProfiles?.filter(p => p.unit_id === unitId) || [];
  }, [allProfiles]);

  // Get all profiles from selected units for subtask assignment
  const availableProfiles = useMemo(() => {
    if (!allProfiles || selectedUnitIds.length === 0) return [];
    return allProfiles.filter(p => 
      p.unit_id && selectedUnitIds.includes(p.unit_id)
    );
  }, [allProfiles, selectedUnitIds]);

  const toggleUnit = useCallback((unitId: string) => {
    setUnitError(null);
    setUnitAssignments(prev => {
      if (prev.some(a => a.unitId === unitId)) {
        return prev.filter((a) => a.unitId !== unitId);
      }
      return [...prev, { unitId, assignedTo: null }];
    });
  }, []);

  const updateUnitAssignee = useCallback((unitId: string, assignedTo: string | null) => {
    setUnitAssignments(prev => 
      prev.map(a => a.unitId === unitId ? { ...a, assignedTo } : a)
    );
  }, []);

  const selectAllUnits = useCallback(() => {
    setUnitError(null);
    if (units) {
      setUnitAssignments(units.map((u) => ({ unitId: u.id, assignedTo: null })));
    }
  }, [units]);

  const deselectAllUnits = useCallback(() => {
    setUnitAssignments([]);
  }, []);

  const addSubtask = () => {
    if (newSubtaskTitle.trim()) {
      setSubtasks([...subtasks, { 
        title: newSubtaskTitle.trim(), 
        assigned_to: newSubtaskAssignee && newSubtaskAssignee !== 'none' ? newSubtaskAssignee : null 
      }]);
      setNewSubtaskTitle('');
      setNewSubtaskAssignee('');
    }
  };

  const removeSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const getProfileName = (profileId: string | null | undefined) => {
    if (!profileId) return null;
    const profile = allProfiles?.find(p => p.id === profileId);
    return profile?.full_name || profile?.email || null;
  };

  const onSubmit = async (data: FormData) => {
    // Usuários regulares não precisam selecionar unidades - tarefa será criada para eles mesmos
    // Gestores/Admins podem opcionalmente selecionar unidades
    
    // Se não for gestor/admin, força o usuário como responsável
    const effectiveParentAssignedTo = isGestorOrAdmin
      ? (parentAssignedTo && parentAssignedTo !== 'none' ? parentAssignedTo : null)
      : user?.id || null;

    await createTaskWithUnits.mutateAsync({
      title: data.title,
      description: data.description || null,
      priority: data.priority,
      start_date: data.start_date?.toISOString() || null,
      due_date: data.due_date?.toISOString() || null,
      parentAssignedTo: effectiveParentAssignedTo,
      unitAssignments,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
    });

    form.reset();
    setParentAssignedTo('');
    setSubtasks([]);
    setUnitAssignments([]);
    setUnitError(null);
    onSuccess?.();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex flex-col">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título da Tarefa</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Relatório mensal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva a tarefa..."
                  className="resize-none"
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prioridade</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(parseInt(v))}
                  defaultValue={field.value.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 - Baixa</SelectItem>
                    <SelectItem value="2">2 - Normal</SelectItem>
                    <SelectItem value="3">3 - Média</SelectItem>
                    <SelectItem value="4">4 - Alta</SelectItem>
                    <SelectItem value="5">5 - Urgente</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data de Início</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span>Selecione</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="due_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data de Vencimento</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < (form.getValues('start_date') || new Date())}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />

    {/* Responsável da Tarefa Mãe - Apenas para Gestor/Admin */}
    {isGestorOrAdmin && (
      <div className="space-y-2">
        <FormLabel>Responsável da Tarefa Mãe</FormLabel>
        <Select
          value={parentAssignedTo}
          onValueChange={setParentAssignedTo}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecionar responsável (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Eu mesmo (atual usuário)</SelectItem>
            {allProfiles?.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.full_name || profile.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          O responsável da tarefa mãe acompanha o progresso geral de todas as unidades.
        </p>
      </div>
    )}

        {/* Units Selection with Responsible - Apenas para Gestor/Admin */}
        {isGestorOrAdmin && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <FormLabel className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Unidades e Responsáveis ({unitAssignments.length} selecionadas) - Opcional
              </FormLabel>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllUnits}
                  className="text-xs h-7"
                >
                  Selecionar todas
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={deselectAllUnits}
                  className="text-xs h-7"
                >
                  Limpar
                </Button>
              </div>
            </div>
            
            <div className="flex-1 border border-border rounded-md overflow-y-auto min-h-0 max-h-48">
              <div className="p-3 space-y-2">
                {loadingUnits ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : units && units.length > 0 ? (
                  units.map((unit) => {
                    const isSelected = selectedSet.has(unit.id);
                    const assignment = unitAssignments.find(a => a.unitId === unit.id);
                    const unitProfiles = getProfilesForUnit(unit.id);
                    
                    return (
                      <div
                        key={unit.id}
                        className={cn(
                          "p-3 rounded-md transition-colors",
                          isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary/50 border border-transparent'
                        )}
                      >
                        <div 
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => toggleUnit(unit.id)}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center flex-shrink-0",
                            isSelected ? 'bg-primary border-primary' : 'border-input'
                          )}>
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{unit.name}</p>
                            <p className="text-xs text-muted-foreground">{unit.code}</p>
                          </div>
                        </div>
                        
                        {/* Dropdown de responsável - aparece quando unidade está selecionada */}
                        {isSelected && (
                          <div className="mt-2 ml-7">
                            <Select
                              value={assignment?.assignedTo || 'none'}
                              onValueChange={(value) => updateUnitAssignee(unit.id, value === 'none' ? null : value)}
                            >
                              <SelectTrigger className="w-full h-8 text-xs">
                                <SelectValue placeholder="Selecionar responsável" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sem responsável</SelectItem>
                                {unitProfiles.map((profile) => (
                                  <SelectItem key={profile.id} value={profile.id}>
                                    {profile.full_name || profile.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center py-4 text-muted-foreground text-sm">
                    Nenhuma unidade cadastrada
                  </p>
                )}
              </div>
            </div>
            {unitError && (
              <p className="text-sm font-medium text-destructive mt-1">{unitError}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Uma tarefa mãe será criada para você acompanhar o progresso geral, e tarefas individuais serão criadas para cada unidade.
            </p>
          </div>
        )}

        {/* Subtasks / Checklist */}
        <div className="space-y-3">
          <FormLabel>Subtarefas com Responsáveis</FormLabel>
          <div className="flex gap-2">
            <Input
              placeholder="Título da subtarefa..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSubtask();
                }
              }}
              className="flex-1"
            />
            <Select
              value={newSubtaskAssignee}
              onValueChange={setNewSubtaskAssignee}
              disabled={selectedUnitIds.length === 0}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {availableProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name || profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" onClick={addSubtask}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Os responsáveis das subtarefas só podem marcar suas próprias subtarefas como concluídas.
          </p>

          {subtasks.length > 0 && (
            <div className="space-y-2 border border-border rounded-lg p-3">
              {subtasks.map((subtask, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded"
                >
                  <span className="flex-1 text-sm">{subtask.title}</span>
                  {subtask.assigned_to && (
                    <Badge variant="secondary" className="text-xs">
                      {getProfileName(subtask.assigned_to)}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => removeSubtask(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={createTaskWithUnits.isPending}>
            {createTaskWithUnits.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Tarefa
          </Button>
        </div>
      </form>
    </Form>
  );
};
