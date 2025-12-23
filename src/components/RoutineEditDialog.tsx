import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

import { useUpdateRoutine, useDeleteRoutine } from '@/hooks/useRoutineMutations';
import { useIsGestorOrAdmin } from '@/hooks/useUserRole';
import type { Tables, Enums } from '@/integrations/supabase/types';

type Routine = Tables<'routines'>;
type TaskFrequency = Enums<'task_frequency'>;

const frequencyOptions: { value: TaskFrequency; label: string }[] = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
];

const formSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200, 'Título muito longo'),
  description: z.string().max(1000, 'Descrição muito longa').optional().nullable(),
  frequency: z.enum(['diaria', 'semanal', 'quinzenal', 'mensal', 'anual', 'customizada']),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface RoutineEditDialogProps {
  routine: Routine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RoutineEditDialog = ({ routine, open, onOpenChange }: RoutineEditDialogProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();
  const { isGestorOrAdmin } = useIsGestorOrAdmin();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    values: routine ? {
      title: routine.title,
      description: routine.description || '',
      frequency: routine.frequency,
      is_active: routine.is_active ?? true,
    } : undefined,
  });

  const onSubmit = async (data: FormData) => {
    if (!routine) return;

    await updateRoutine.mutateAsync({
      id: routine.id,
      data: {
        title: data.title,
        description: data.description || null,
        frequency: data.frequency,
        is_active: data.is_active,
      },
    });

    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!routine) return;
    await deleteRoutine.mutateAsync(routine.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  if (!routine) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Rotina</DialogTitle>
            <DialogDescription>
              Altere as informações da rotina
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === 'true')}
                        value={field.value ? 'true' : 'false'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="true">Ativa</SelectItem>
                          <SelectItem value="false">Inativa</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="flex justify-between sm:justify-between">
                {isGestorOrAdmin && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </Button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateRoutine.isPending}>
                    {updateRoutine.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rotina?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a rotina "{routine.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRoutine.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
