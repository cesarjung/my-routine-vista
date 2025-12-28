
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
    Calendar,
    Users,
    Flag,
    Clock,
    Check,
    Circle,
    Loader2,
    Trash2,
    Pencil,
    X,
    Building2,
    RefreshCw
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { useUpdateTask, useDeleteTask } from '@/hooks/useTaskMutations';
import { TaskEditDialog } from './TaskEditDialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from './ui/alert-dialog';

interface TaskDetailPanelProps {
    task: any; // Using any for now to handle Joined Task type easily, or refine to TaskWithDetails
    onClose: () => void;
}

const priorityConfig: Record<number, { label: string; className: string }> = {
    1: { label: 'Baixa', className: 'text-muted-foreground' },
    2: { label: 'Normal', className: 'text-foreground' },
    3: { label: 'Média', className: 'text-warning' },
    4: { label: 'Alta', className: 'text-orange-500' },
    5: { label: 'Urgente', className: 'text-destructive' },
};

const statusConfig: Record<string, { label: string; className: string }> = {
    pendente: { label: 'Pendente', className: 'bg-warning/20 text-warning border-warning/30' },
    em_andamento: { label: 'Em Andamento', className: 'bg-primary/20 text-primary border-primary/30' },
    concluida: { label: 'Concluída', className: 'bg-success/20 text-success border-success/30' },
    atrasada: { label: 'Atrasada', className: 'bg-destructive/20 text-destructive border-destructive/30' },
    cancelada: { label: 'Cancelada', className: 'bg-muted text-muted-foreground border-muted' },
    nao_aplicavel: { label: 'N/A', className: 'bg-secondary text-muted-foreground border-secondary' },
};

export const TaskDetailPanel = ({ task, onClose }: TaskDetailPanelProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const deleteMutation = useDeleteTask();
    const updateMutation = useUpdateTask();

    // Local state for quick edit
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || '');

    const handleSaveChanges = async () => {
        try {
            await updateMutation.mutateAsync({
                id: task.id,
                updates: { title, description }
            });
            setIsEditing(false);
        } catch (e) {
            console.error("Failed to update task", e);
        }
    };

    const statusInfo = statusConfig[task.status] || statusConfig.pendente;
    const priorityInfo = priorityConfig[task.priority || 1] || priorityConfig[1];

    return (
        <div className="bg-card border-l border-border h-full flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-6 border-b border-border">
                <div className="flex items-start justify-between mb-4">
                    {isEditing ? (
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-xl font-semibold"
                            placeholder="Título da tarefa"
                        />
                    ) : (
                        <h2 className="text-xl font-semibold text-foreground">{task.title}</h2>
                    )}

                    <div className="flex items-center gap-2">
                        {!isEditing && (
                            <>
                                <Button variant="ghost" size="sm" onClick={() => setEditDialogOpen(true)} title="Edição completa">
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                                            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => { deleteMutation.mutate(task.id); onClose(); }} className="bg-destructive text-destructive-foreground">
                                                Excluir
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </>
                        )}
                        {isEditing && (
                            <>
                                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                                <Button size="sm" onClick={handleSaveChanges}>
                                    <Check className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
                    </div>
                </div>

                {/* Quick Info Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                    {/* Status */}
                    <div className="flex items-center gap-3">
                        <Circle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="outline" className={cn("ml-auto", statusInfo.className)}>{statusInfo.label}</Badge>
                    </div>

                    {/* Priority */}
                    <div className="flex items-center gap-3">
                        <Flag className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Prioridade</span>
                        <span className={cn("ml-auto font-medium", priorityInfo.className)}>{priorityInfo.label}</span>
                    </div>

                    {/* Unit */}
                    <div className="flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Unidade</span>
                        <span className="ml-auto text-foreground truncate max-w-[120px]" title={task.unit?.name}>{task.unit?.name || '---'}</span>
                    </div>

                    {/* Due Date */}
                    <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Vencimento</span>
                        <span className="ml-auto text-foreground">{task.due_date ? format(new Date(task.due_date), 'dd/MM', { locale: ptBR }) : '---'}</span>
                    </div>
                </div>

                {!isEditing && (
                    <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setIsEditing(true)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar rapidamente
                    </Button>
                )}
            </div>

            {/* Description */}
            <div className="p-6 border-b border-border flex-1 overflow-auto">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Descrição</h3>
                {isEditing ? (
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={6}
                        className="resize-none"
                    />
                ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{task.description || 'Sem descrição.'}</p>
                )}

                {/* Assignees List */}
                <div className="mt-8">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Responsáveis</h3>
                    <div className="space-y-3">
                        {task.assignees && task.assignees.length > 0 ? (
                            task.assignees.map((assignee: any) => (
                                <div key={assignee.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback>{assignee.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        {assignee.avatar_url && <img src={assignee.avatar_url} alt={assignee.full_name} />}
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{assignee.full_name}</span>
                                        <span className="text-xs text-muted-foreground">Responsável</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">Nenhum responsável atribuído.</p>
                        )}
                    </div>
                </div>
            </div>

            <TaskEditDialog
                task={task}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
            />
        </div>
    );
};
