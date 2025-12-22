import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Loader2, Users } from 'lucide-react';
import { useCreateRoutineWithUnits } from '@/hooks/useRoutineMutations';
import { useUnits } from '@/hooks/useUnits';
import { useUnitManagers } from '@/hooks/useUnitManagers';
import type { Enums } from '@/integrations/supabase/types';

type TaskFrequency = Enums<'task_frequency'>;

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
  selectedUnits: z.array(z.string()).min(1, 'Selecione pelo menos uma unidade'),
});

type FormValues = z.infer<typeof formSchema>;

export const RoutineForm = () => {
  const [open, setOpen] = useState(false);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const createRoutine = useCreateRoutineWithUnits();
  const { data: units, isLoading: loadingUnits } = useUnits();
  const { data: unitManagers } = useUnitManagers();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      frequency: 'semanal',
      selectedUnits: [],
    },
  });

  const getManagersForUnit = (unitId: string) => {
    return unitManagers?.filter((m) => m.unit_id === unitId) || [];
  };

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev => {
      const newIds = prev.includes(unitId)
        ? prev.filter((id) => id !== unitId)
        : [...prev, unitId];
      form.setValue('selectedUnits', newIds);
      return newIds;
    });
  };

  const selectAllUnits = () => {
    if (units) {
      const allIds = units.map((u) => u.id);
      setSelectedUnitIds(allIds);
      form.setValue('selectedUnits', allIds);
    }
  };

  const deselectAllUnits = () => {
    setSelectedUnitIds([]);
    form.setValue('selectedUnits', []);
  };

  const onSubmit = async (data: FormValues) => {
    await createRoutine.mutateAsync({
      title: data.title,
      description: data.description,
      frequency: data.frequency,
      unitIds: data.selectedUnits,
    });
    form.reset();
    setSelectedUnitIds([]);
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Criar Nova Rotina</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-hidden flex flex-col">
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

            {/* Units Selection */}
            <FormField
              control={form.control}
              name="selectedUnits"
              render={() => (
                <FormItem className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between">
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
                  
                  <ScrollArea className="flex-1 border border-border rounded-md">
                    <div className="p-3 space-y-1">
                      {loadingUnits ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : units && units.length > 0 ? (
                        units.map((unit) => {
                          const managers = getManagersForUnit(unit.id);
                          const isSelected = selectedUnitIds.includes(unit.id);
                          
                          return (
                            <div
                              key={unit.id}
                              onClick={() => toggleUnit(unit.id)}
                              className={`
                                flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors
                                ${isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary/50 border border-transparent'}
                              `}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleUnit(unit.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
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
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />

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