import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Task, TaskPriority, TaskStatus } from './task.model';
import { TaskService } from './task.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly fb = inject(FormBuilder);

  readonly statuses: TaskStatus[] = ['Pending', 'In Progress', 'Done'];
  readonly priorities: TaskPriority[] = ['Low', 'Medium', 'High'];
  readonly sortOptions = [
    { value: 'scheduledDateAsc', label: 'Soonest first' },
    { value: 'scheduledDateDesc', label: 'Latest first' },
    { value: 'priorityDesc', label: 'Highest priority' },
    { value: 'durationDesc', label: 'Longest first' },
    { value: 'updatedAtDesc', label: 'Recently updated' },
    { value: 'titleAsc', label: 'Title A–Z' },
  ] as const;

  tasks: Task[] = [];
  loading = true;
  submitting = false;
  deletingId: string | null = null;
  completingId: string | null = null;
  error = '';
  editingId: string | null = null;
  searchTerm = '';
  statusFilter: 'All' | TaskStatus = 'All';
  priorityFilter: 'All' | TaskPriority = 'All';
  sortBy: (typeof this.sortOptions)[number]['value'] = 'scheduledDateAsc';
  viewMode: 'board' | 'calendar' = 'board';

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    status: ['Pending' as TaskStatus, Validators.required],
    priority: ['Medium' as TaskPriority, Validators.required],
    scheduledDate: ['', Validators.required],
    durationHours: [1, [Validators.required, Validators.min(0)]],
    durationMinutes: [0, [Validators.required, Validators.min(0), Validators.max(59)]],
  });

  constructor() {
    this.resetForm();
  }

  ngOnInit(): void {
    this.fetchTasks();
  }

  get filteredTasks(): Task[] {
    const search = this.searchTerm.trim().toLowerCase();

    return [...this.tasks]
      .filter((task) => this.statusFilter === 'All' || task.status === this.statusFilter)
      .filter((task) => this.priorityFilter === 'All' || task.priority === this.priorityFilter)
      .filter((task) => {
        if (!search) {
          return true;
        }

        return [
          task.title,
          task.description,
          task.status,
          task.priority,
          this.formatDate(task.scheduledDate),
        ]
          .join(' ')
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) => this.compareTasks(a, b));
  }

  get calendarGroups(): Array<{ date: string; tasks: Task[]; totalMinutes: number }> {
    const groups = new Map<string, Task[]>();

    for (const task of this.filteredTasks) {
      const key = task.scheduledDate;
      const current = groups.get(key) ?? [];
      current.push(task);
      groups.set(key, current);
    }

    return [...groups.entries()]
      .sort(([a], [b]) => this.toTime(a) - this.toTime(b))
      .map(([date, tasks]) => ({
        date,
        tasks,
        totalMinutes: tasks.reduce((sum, task) => sum + task.durationMinutes, 0),
      }));
  }

  get totalTasks(): number {
    return this.tasks.length;
  }

  get tasksThisWeek(): number {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);

    return this.tasks.filter((task) => {
      const date = new Date(task.scheduledDate);
      return date >= this.startOfDay(now) && date <= this.endOfDay(weekEnd);
    }).length;
  }

  get totalPlannedMinutes(): number {
    return this.tasks.reduce((sum, task) => sum + task.durationMinutes, 0);
  }

  get completedTasks(): number {
    return this.tasks.filter((task) => task.status === 'Done').length;
  }

  get highPriorityTasks(): number {
    return this.tasks.filter((task) => task.priority === 'High' && task.status !== 'Done').length;
  }

  get completionRate(): number {
    return this.totalTasks ? Math.round((this.completedTasks / this.totalTasks) * 100) : 0;
  }

  fetchTasks(): void {
    this.loading = true;
    this.error = '';

    this.taskService
      .getTasks()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (tasks) => {
          this.tasks = tasks;
        },
        error: () => {
          this.error = 'Could not load tasks. Check that the backend and MongoDB are running.';
        },
      });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const totalMinutes = Number(raw.durationHours) * 60 + Number(raw.durationMinutes);

    if (totalMinutes < 1) {
      this.error = 'Duration must be at least 1 minute.';
      return;
    }

    this.submitting = true;
    this.error = '';

    const payload: Omit<Task, '_id'> = {
      title: raw.title.trim(),
      description: raw.description.trim(),
      status: raw.status,
      priority: raw.priority,
      scheduledDate: raw.scheduledDate,
      durationMinutes: totalMinutes,
    };

    if (this.editingId) {
      const id = this.editingId;
      this.taskService
        .updateTask(id, payload)
        .pipe(finalize(() => (this.submitting = false)))
        .subscribe({
          next: (updatedTask) => {
            this.tasks = this.tasks.map((task) => (task._id === id ? updatedTask : task));
            this.resetForm();
          },
          error: () => {
            this.error = 'Could not update the task.';
          },
        });
      return;
    }

    this.taskService
      .createTask(payload)
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (createdTask) => {
          this.tasks = [createdTask, ...this.tasks];
          this.resetForm();
        },
        error: () => {
          this.error = 'Could not create the task.';
        },
      });
  }

  editTask(task: Task): void {
    const hours = Math.floor(task.durationMinutes / 60);
    const minutes = task.durationMinutes % 60;

    this.editingId = task._id ?? null;
    this.form.setValue({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      scheduledDate: task.scheduledDate.slice(0, 10),
      durationHours: hours,
      durationMinutes: minutes,
    });
  }

  markComplete(task: Task): void {
    if (!task._id || task.status === 'Done') {
      return;
    }

    this.completingId = task._id;
    this.error = '';

    this.taskService
      .completeTask(task._id)
      .pipe(finalize(() => (this.completingId = null)))
      .subscribe({
        next: (updatedTask) => {
          this.tasks = this.tasks.map((item) => (item._id === task._id ? updatedTask : item));
          if (this.editingId === task._id) {
            this.editingId = task._id;
            this.editTask(updatedTask);
          }
        },
        error: () => {
          this.error = 'Could not complete the task.';
        },
      });
  }

  deleteTask(task: Task): void {
    if (!task._id) {
      return;
    }

    this.deletingId = task._id;
    this.error = '';

    this.taskService
      .deleteTask(task._id)
      .pipe(finalize(() => (this.deletingId = null)))
      .subscribe({
        next: () => {
          this.tasks = this.tasks.filter((item) => item._id !== task._id);
          if (this.editingId === task._id) {
            this.resetForm();
          }
        },
        error: () => {
          this.error = 'Could not delete the task.';
        },
      });
  }

  resetForm(): void {
    this.editingId = null;
    this.form.reset({
      title: '',
      description: '',
      status: 'Pending',
      priority: 'Medium',
      scheduledDate: this.getTodayDateInputValue(),
      durationHours: 1,
      durationMinutes: 0,
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'All';
    this.priorityFilter = 'All';
    this.sortBy = 'scheduledDateAsc';
  }

  formatDuration(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours && minutes) {
      return `${hours}h ${minutes}m`;
    }
    if (hours) {
      return `${hours}h`;
    }
    return `${minutes}m`;
  }

  formatDate(dateValue: string): string {
    return new Date(dateValue).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  isOverdue(task: Task): boolean {
    return task.status !== 'Done' && this.startOfDay(new Date(task.scheduledDate)) < this.startOfDay(new Date());
  }

  trackByTaskId(_index: number, task: Task): string {
    return task._id ?? String(_index);
  }

  private compareTasks(a: Task, b: Task): number {
    switch (this.sortBy) {
      case 'scheduledDateDesc':
        return this.toTime(b.scheduledDate) - this.toTime(a.scheduledDate);
      case 'priorityDesc':
        return this.priorityRank(b.priority) - this.priorityRank(a.priority);
      case 'durationDesc':
        return b.durationMinutes - a.durationMinutes;
      case 'updatedAtDesc':
        return this.toTime(b.updatedAt) - this.toTime(a.updatedAt);
      case 'titleAsc':
        return a.title.localeCompare(b.title);
      case 'scheduledDateAsc':
      default:
        return this.toTime(a.scheduledDate) - this.toTime(b.scheduledDate);
    }
  }

  private priorityRank(priority: TaskPriority): number {
    switch (priority) {
      case 'High':
        return 3;
      case 'Medium':
        return 2;
      case 'Low':
      default:
        return 1;
    }
  }

  private toTime(value?: string): number {
    return value ? new Date(value).getTime() : 0;
  }

  private getTodayDateInputValue(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }
}
