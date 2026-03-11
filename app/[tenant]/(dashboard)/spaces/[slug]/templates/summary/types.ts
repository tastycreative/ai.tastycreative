import type { BoardTask } from '../../../board';
import type { ColumnWithTasks } from '../../useSpaceBoard';

export interface SummaryTabProps {
  tasks: Record<string, BoardTask>;
  columns: Record<string, ColumnWithTasks>;
  columnOrder: string[];
  resolveMemberName: (id?: string) => string | undefined;
  onTaskClick?: (task: BoardTask) => void;
}
