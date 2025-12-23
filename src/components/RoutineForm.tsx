import { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2, Users, Check, CalendarIcon, X } from 'lucide-react';
import { useCreateRoutineWithUnits } from '@/hooks/useRoutineMutations';
import { useUnits } from '@/hooks/useUnits';
import { useUnitManagers } from '@/hooks/useUnitManagers';
import { useProfiles } from '@/hooks/useProfiles';
import { cn } from '@/lib/utils';
import type { Enums } from '@/integrations/supabase/types';

type TaskFrequency = Enums<'task_frequency'>;

interface SubtaskData {
  title: string;
  assigned_to: string | null;
}

const frequencyOptions: { value: TaskFrequency; label: string }[] = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
];

const formSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  frequency: z.enum(['diaria', 'semanal', 'quinzenal', 'mensal'] as const),
  startDate: z.date({ required_error: 'Data de início é obrigatória' }),
  endDate: z.date().optional(),
  repeatForever: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export const RoutineForm = () => {
  const [open, setOpen] = useState(false);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<string>('');
  
  const createRoutine = useCreateRoutineWithUnits();
  const { data: units, isLoading: loadingUnits } = useUnits();
  const { data: unitManagers } = useUnitManagers();
  const { data: allProfiles } = useProfiles();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      frequency: 'semanal',
      startDate: new Date(),
      endDate: undefined,
      repeatForever: true,
    },
  });

  const repeatForever = form.watch('repeatForever');

  // Create a Set for O(1) lookup
  const selectedSet = useMemo(() => new Set(selectedUnitIds), [selectedUnitIds]);

  const getManagersForUnit = useCallback((unitId: string) => {
    return unitManagers?.filter((m) => m.unit_id === unitId) || [];
  }, [unitManagers]);

  // Get all profiles from selected units for subtask assignment
  const availableProfiles = useMemo(() => {
    if (!allProfiles || selectedUnitIds.length === 0) return [];
    return allProfiles.filter(p => 
      p.unit_id && selectedUnitIds.includes(p.unit_id)
    );
  }, [allProfiles, selectedUnitIds]);

  const toggleUnit = useCallback((unitId: string) => {
    setUnitError(null);
    setSelectedUnitIds(prev => {
      if (prev.includes(unitId)) {
        return prev.filter((id) => id !== unitId);
      }
      return [...prev, unitId];
    });
  }, []);

  const selectAllUnits = useCallback(() => {
    setUnitError(null);
    if (units) {
      setSelectedUnitIds(units.map((u) => u.id));
    }
  }, [units]);

  const deselectAllUnits = useCallback(() => {
    setSelectedUnitIds([]);
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

  const onSubmit = async (data: FormValues) => {
    if (selectedUnitIds.length === 0) {
      setUnitError('Selecione pelo menos uma unidade');
      return;
    }
    
    await createRoutine.mutateAsync({
      title: data.title,
      description: data.description,
      frequency: data.frequency,
      unitIds: selectedUnitIds,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
    });
    form.reset();
    setSelectedUnitIds([]);
    setSubtasks([]);
    setUnitError(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Rotina
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Criar Nova Rotina</DialogTitle>
          <DialogDescription>
            Configure uma nova rotina para as unidades selecionadas.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Checkpoint semanal" {...field} />
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
                      placeholder="Descreva a rotina..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequência</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a frequência" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recurrence Period */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de início</FormLabel>
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

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de término</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            disabled={repeatForever}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground",
                              repeatForever && "opacity-50"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            ) : (
                              <span>{repeatForever ? "Sem fim" : "Selecione"}</span>
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
                          disabled={(date) => date < (form.getValues('startDate') || new Date())}
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
              name="repeatForever"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">Repetir para sempre</FormLabel>
                    <FormDescription className="text-xs">
                      A rotina será criada indefinidamente sem data de término
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) {
                          form.setValue('endDate', undefined);
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Units Selection */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <FormLabel className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Unidades ({selectedUnitIds.length} selecionadas)
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
              
              {/* Native scroll container */}
              <div className="border border-border rounded-md overflow-y-auto max-h-32">
                <div className="p-3 space-y-1">
                  {loadingUnits ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : units && units.length > 0 ? (
                    units.map((unit) => {
                      const managers = getManagersForUnit(unit.id);
                      const isSelected = selectedSet.has(unit.id);
                      
                      return (
                        <div
                          key={unit.id}
                          onClick={() => toggleUnit(unit.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors",
                            isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary/50 border border-transparent'
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center flex-shrink-0",
                            isSelected ? 'bg-primary border-primary' : 'border-input'
                          )}>
                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{unit.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {managers.length > 0 
                                ? `Responsável: ${managers.map(m => m.profile?.full_name || m.profile?.email).join(', ')}`
                                : 'Sem responsável definido'
                              }
                            </p>
                          </div>
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
            </div>

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
                  <SelectTrigger className="w-[140px]">
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
                {selectedUnitIds.length === 0 
                  ? "Selecione unidades para ver os responsáveis disponíveis"
                  : "Os responsáveis só podem marcar suas próprias subtarefas"
                }
              </p>

              {subtasks.length > 0 && (
                <div className="space-y-2 border border-border rounded-lg p-3 max-h-32 overflow-y-auto">
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createRoutine.isPending}>
                {createRoutine.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Criar Rotina
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
