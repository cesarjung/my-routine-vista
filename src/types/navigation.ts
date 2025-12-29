export type ViewMode = 'list' | 'kanban' | 'calendar' | 'gantt';

export type NavigationContext =
  | { type: 'all-sectors' }
  | { type: 'my-tasks' }
  | { type: 'sector'; sectorId: string; folder?: string; frequency?: string }
  | { type: 'dashboard' }
  | { type: 'settings' };

export interface NavigationState {
  context: NavigationContext;
  viewMode: ViewMode;
}
