import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { cpus } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Use CPUs - 1 as requested, minimum 1 worker
const DEFAULT_WORKER_COUNT = Math.max(1, cpus().length - 1);

export interface WorkerTask<TInput, TOutput> {
  id: string;
  type: "ts-parse" | "py-parse";
  input: TInput;
  resolve: (output: TOutput) => void;
  reject: (error: Error) => void;
}

export interface WorkerPoolOptions {
  workerCount?: number;
  maxQueueSize?: number;
}

/**
 * Worker Thread Pool for parallel parsing
 * 
 * Manages a pool of worker threads that can parse TypeScript and Python files
 * in parallel, utilizing multiple CPU cores for maximum performance.
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask<unknown, unknown>[] = [];
  private activeTasks = new Map<number, WorkerTask<unknown, unknown>>();
  private workerCount: number;
  private maxQueueSize: number;
  private taskIdCounter = 0;
  private terminated = false;

  constructor(options: WorkerPoolOptions = {}) {
    this.workerCount = options.workerCount ?? DEFAULT_WORKER_COUNT;
    this.maxQueueSize = options.maxQueueSize ?? 1000;
  }

  /**
   * Initialize the worker pool
   */
  async init(): Promise<void> {
    if (this.workers.length > 0) return;

    const workerPromises: Promise<void>[] = [];

    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker(join(__dirname, "parse-worker.js"), {
        workerData: { workerId: i },
      });

      const initPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Worker ${i} initialization timeout`));
        }, 30000);

        worker.once("message", (msg) => {
          if (msg.type === "ready") {
            clearTimeout(timeout);
            resolve();
          }
        });

        worker.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      worker.on("message", (msg) => this.handleWorkerMessage(i, msg));
      worker.on("error", (err) => this.handleWorkerError(i, err));
      worker.on("exit", (code) => this.handleWorkerExit(i, code));

      this.workers.push(worker);
      workerPromises.push(initPromise);
    }

    await Promise.all(workerPromises);
  }

  /**
   * Submit a task to the worker pool
   */
  async execute<TInput, TOutput>(
    type: "ts-parse" | "py-parse",
    input: TInput
  ): Promise<TOutput> {
    if (this.terminated) {
      throw new Error("Worker pool has been terminated");
    }

    if (this.taskQueue.length >= this.maxQueueSize) {
      throw new Error("Task queue is full");
    }

    const taskId = `${Date.now()}-${++this.taskIdCounter}`;

    return new Promise((resolve, reject) => {
      const task: WorkerTask<TInput, TOutput> = {
        id: taskId,
        type,
        input,
        resolve: resolve as (output: unknown) => void,
        reject,
      };

      this.taskQueue.push(task as WorkerTask<unknown, unknown>);
      this.processQueue();
    });
  }

  /**
   * Process the task queue by assigning tasks to available workers
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    // Find an available worker
    for (let i = 0; i < this.workers.length; i++) {
      if (!this.activeTasks.has(i)) {
        const task = this.taskQueue.shift();
        if (!task) return;

        this.activeTasks.set(i, task);
        this.workers[i].postMessage({
          type: task.type,
          id: task.id,
          input: task.input,
        });

        // Continue processing if there are more tasks
        if (this.taskQueue.length > 0) {
          this.processQueue();
        }
        return;
      }
    }
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerId: number, msg: unknown): void {
    const message = msg as { type: string; id: string; result?: unknown; error?: string };
    
    if (message.type === "ready") return;

    const task = this.activeTasks.get(workerId);
    if (!task || task.id !== message.id) return;

    this.activeTasks.delete(workerId);

    if (message.error) {
      task.reject(new Error(message.error));
    } else {
      task.resolve(message.result);
    }

    // Process next task
    this.processQueue();
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(workerId: number, err: Error): void {
    console.error(`Worker ${workerId} error:`, err);
    
    const task = this.activeTasks.get(workerId);
    if (task) {
      this.activeTasks.delete(workerId);
      task.reject(err);
    }

    // Restart the worker
    this.restartWorker(workerId);
  }

  /**
   * Handle worker exits
   */
  private handleWorkerExit(workerId: number, code: number): void {
    if (code !== 0 && !this.terminated) {
      console.error(`Worker ${workerId} exited with code ${code}`);
      this.restartWorker(workerId);
    }
  }

  /**
   * Restart a worker
   */
  private async restartWorker(workerId: number): Promise<void> {
    if (this.terminated) return;

    try {
      const oldWorker = this.workers[workerId];
      await oldWorker.terminate();

      const newWorker = new Worker(join(__dirname, "parse-worker.js"), {
        workerData: { workerId },
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Worker ${workerId} restart timeout`));
        }, 30000);

        newWorker.once("message", (msg) => {
          if ((msg as { type: string }).type === "ready") {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      newWorker.on("message", (msg) => this.handleWorkerMessage(workerId, msg));
      newWorker.on("error", (err) => this.handleWorkerError(workerId, err));
      newWorker.on("exit", (code) => this.handleWorkerExit(workerId, code));

      this.workers[workerId] = newWorker;
    } catch (err) {
      console.error(`Failed to restart worker ${workerId}:`, err);
    }
  }

  /**
   * Terminate all workers
   */
  async terminate(): Promise<void> {
    this.terminated = true;

    // Reject pending tasks
    for (const task of this.taskQueue) {
      task.reject(new Error("Worker pool terminated"));
    }
    this.taskQueue = [];

    for (const task of this.activeTasks.values()) {
      task.reject(new Error("Worker pool terminated"));
    }
    this.activeTasks.clear();

    // Terminate all workers
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    workerCount: number;
    queueLength: number;
    activeTasks: number;
  } {
    return {
      workerCount: this.workerCount,
      queueLength: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
    };
  }
}

// Singleton instance
let globalPool: WorkerPool | null = null;

/**
 * Get or create the global worker pool
 */
export async function getWorkerPool(): Promise<WorkerPool> {
  if (!globalPool) {
    globalPool = new WorkerPool();
    await globalPool.init();
  }
  return globalPool;
}

/**
 * Terminate the global worker pool
 */
export async function terminateWorkerPool(): Promise<void> {
  if (globalPool) {
    await globalPool.terminate();
    globalPool = null;
  }
}
