import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, X, Loader2 } from 'lucide-react';
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

import { useProfiles } from '@/hooks/useProfiles';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const formSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200, 'Título muito longo'),
  description: z.string().max(1000, 'Descrição muito longa').optional(),
  priority: z.number().min(1).max(5),
  start_date: z.date().optional(),
  due_date: z.date().optional(),
  parent_task_id: z.string().min(1, 'Selecione uma tarefa mãe'),
});

type FormData = z.infer<typeof formSchema>;

interface UserTaskFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const UserTaskForm = ({ onSuccess, onCancel }: UserTaskFormProps) => {
  const [subtasks, setSubtasks] = useState<{ title: string; assigned_to: string | null }[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const { data: allProfiles } = useProfiles();
  const { data: tasks } = useTasks();
  const queryClient = useQueryClient();

  // Get parent tasks (tasks with parent_task_id = null that are assigned to user's unit)
  const parentTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(t => t.parent_task_id !== null);
  }, [tasks]);

  // Get profiles from the same unit for subtask assignment
  const userProfile = useMemo(() => {
    return allProfiles?.find(p => p.id === user?.id);
  }, [allProfiles, user?.id]);

  const unitProfiles = useMemo(() => {
    if (!allProfiles || !userProfile?.unit_id) return [];
    return allProfiles.filter(p => p.unit_id === userProfile.unit_id);
  }, [allProfiles, userProfile?.unit_id]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 1,
      parent_task_id: '',
    },
  });

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
    if (!user?.id || !userProfile?.unit_id) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado ou sem unidade',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create task assigned to self
      const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: data.title,
          description: data.description || null,
          priority: data.priority,
          start_date: data.start_date?.toISOString() || null,
          due_date: data.due_date?.toISOString() || null,
          unit_id: userProfile.unit_id,
          assigned_to: user.id,
          created_by: user.id,
          parent_task_id: data.parent_task_id,
          status: 'pendente',
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Create subtasks if any
      if (subtasks.length > 0 && newTask) {
        const subtasksToInsert = subtasks.map((st, index) => ({
          task_id: newTask.id,
          title: st.title,
          assigned_to: st.assigned_to,
          order_index: index,
        }));

        const { error: subtasksError } = await supabase
          .from('subtasks')
          .insert(subtasksToInsert);

        if (subtasksError) {
          console.error('Error creating subtasks:', subtasksError);
        }
      }

      toast({
        title: 'Tarefa criada',
        description: 'Sua tarefa foi criada com sucesso.',
      });

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      form.reset();
      setSubtasks([]);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast({
        title: 'Erro ao criar tarefa',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="parent_task_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tarefa Mãe *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a tarefa mãe" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {parentTasks.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título da Tarefa *</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Minha tarefa" {...field} />
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

        {/* Subtasks */}
        <div className="space-y-3">
          <FormLabel>Subtarefas (opcional)</FormLabel>
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
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Eu mesmo</SelectItem>
                {unitProfiles.map((profile) => (
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

          {subtasks.length > 0 && (
            <div className="space-y-2">
              {subtasks.map((subtask, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-secondary/50 rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{subtask.title}</span>
                    {subtask.assigned_to && (
                      <Badge variant="outline" className="text-xs">
                        {getProfileName(subtask.assigned_to)}
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeSubtask(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Tarefa'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};
