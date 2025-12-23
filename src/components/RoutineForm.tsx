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
import { useProfiles } from '@/hooks/useProfiles';
import { useIsGestorOrAdmin } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { Enums } from '@/integrations/supabase/types';

type TaskFrequency = Enums<'task_frequency'>;

interface UnitAssignment {
  unitId: string;
  assignedTo: string | null;
}

const frequencyOptions: { value: TaskFrequency; label: string }[] = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
];

const recurrenceModeOptions = [
  { value: 'schedule', label: 'Por Cronograma', description: 'Cria automaticamente um dia antes, mesmo que a atual não esteja concluída' },
  { value: 'on_completion', label: 'Ao Concluir', description: 'Só cria a próxima quando a atual for marcada como concluída' },
];

const formSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  frequency: z.enum(['diaria', 'semanal', 'quinzenal', 'mensal'] as const),
  recurrenceMode: z.enum(['schedule', 'on_completion'] as const),
  startDate: z.date({ required_error: 'Data de início é obrigatória' }),
  endDate: z.date().optional(),
  repeatForever: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export const RoutineForm = () => {
  const [open, setOpen] = useState(false);
  const [unitAssignments, setUnitAssignments] = useState<UnitAssignment[]>([]);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [parentAssignedTo, setParentAssignedTo] = useState<string>('');
  
  const { user } = useAuth();
  const { isGestorOrAdmin } = useIsGestorOrAdmin();
  const createRoutine = useCreateRoutineWithUnits();
  const { data: units, isLoading: loadingUnits } = useUnits();
  const { data: allProfiles } = useProfiles();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      frequency: 'semanal',
      recurrenceMode: 'schedule',
      startDate: new Date(),
      endDate: undefined,
      repeatForever: true,
    },
  });

  const repeatForever = form.watch('repeatForever');

  // Create a Set for O(1) lookup
  const selectedUnitIds = useMemo(() => unitAssignments.map(a => a.unitId), [unitAssignments]);
  const selectedSet = useMemo(() => new Set(selectedUnitIds), [selectedUnitIds]);

  // Get profiles for a specific unit
  const getProfilesForUnit = useCallback((unitId: string) => {
    if (!allProfiles) return [];
    return allProfiles.filter(p => p.unit_id === unitId);
  }, [allProfiles]);

  const toggleUnit = useCallback((unitId: string) => {
    setUnitError(null);
    setUnitAssignments(prev => {
      const exists = prev.find(a => a.unitId === unitId);
      if (exists) {
        return prev.filter(a => a.unitId !== unitId);
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
      setUnitAssignments(units.map(u => ({ unitId: u.id, assignedTo: null })));
    }
  }, [units]);

  const deselectAllUnits = useCallback(() => {
    setUnitAssignments([]);
  }, []);

  const getProfileName = (profileId: string | null | undefined) => {
    if (!profileId) return null;
    const profile = allProfiles?.find(p => p.id === profileId);
    return profile?.full_name || profile?.email || null;
  };

  const onSubmit = async (data: FormValues) => {
    // Usuários regulares não precisam selecionar unidades - rotina será criada para eles mesmos
    // Gestores/Admins podem opcionalmente selecionar unidades
    
    await createRoutine.mutateAsync({
      title: data.title,
      description: data.description,
      frequency: data.frequency,
      recurrenceMode: data.recurrenceMode,
      unitAssignments: unitAssignments,
      parentAssignedTo: isGestorOrAdmin 
        ? (parentAssignedTo && parentAssignedTo !== 'none' ? parentAssignedTo : null)
        : user?.id || null, // Usuário regular sempre é o responsável
    });
    form.reset();
    setUnitAssignments([]);
    setUnitError(null);
    setParentAssignedTo('');
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

            {/* Recurrence Mode */}
            <FormField
              control={form.control}
              name="recurrenceMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modo de Recorrência</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o modo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {recurrenceModeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {recurrenceModeOptions.find(o => o.value === field.value)?.description}
                  </p>
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

          {/* Responsável da Rotina/Tarefa Mãe - Apenas para Gestor/Admin */}
          {isGestorOrAdmin && (
            <div className="space-y-2">
              <FormLabel>Responsável da Rotina Mãe</FormLabel>
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
                O responsável da rotina mãe acompanha o progresso geral de todas as unidades.
              </p>
            </div>
          )}

            {/* Units Selection with Responsible per Unit - Apenas para Gestor/Admin */}
            {isGestorOrAdmin && (
              <div className="flex flex-col">
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
                
                {/* Native scroll container */}
                <div className="border border-border rounded-md overflow-y-auto max-h-60">
                  <div className="p-3 space-y-2">
                    {loadingUnits ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : units && units.length > 0 ? (
                      units.map((unit) => {
                        const isSelected = selectedSet.has(unit.id);
                        const assignment = unitAssignments.find(a => a.unitId === unit.id);
                        const profilesForUnit = getProfilesForUnit(unit.id);
                        
                        return (
                          <div
                            key={unit.id}
                            className={cn(
                              "rounded-md border transition-colors",
                              isSelected ? 'bg-primary/10 border-primary/30' : 'border-transparent hover:bg-secondary/50'
                            )}
                          >
                            <div
                              onClick={() => toggleUnit(unit.id)}
                              className="flex items-center gap-3 p-3 cursor-pointer"
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
                            
                            {/* Responsible dropdown - only show when unit is selected */}
                            {isSelected && (
                              <div className="px-3 pb-3 pt-0">
                                <div className="flex items-center gap-2 pl-7">
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">Responsável:</span>
                                  <Select
                                    value={assignment?.assignedTo || 'none'}
                                    onValueChange={(value) => updateUnitAssignee(unit.id, value === 'none' ? null : value)}
                                  >
                                    <SelectTrigger className="h-8 text-xs flex-1" onClick={(e) => e.stopPropagation()}>
                                      <SelectValue placeholder="Selecionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Sem responsável</SelectItem>
                                      {profilesForUnit.map((profile) => (
                                        <SelectItem key={profile.id} value={profile.id}>
                                          {profile.full_name || profile.email}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
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
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={createRoutine.isPending}
            >
              {createRoutine.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Rotina'
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
