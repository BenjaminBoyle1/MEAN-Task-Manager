export type TaskStatus = 'Pending' | 'In Progress' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High';

export interface Task {
  _id?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  scheduledFor: string;
  durationMinutes: number;
  createdAt?: string;
  updatedAt?: string;
}
