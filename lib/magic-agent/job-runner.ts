/**
 * Magic Agent - Job Runner Framework
 *
 * Handles background job execution in a serverless environment using lazy on-demand approach:
 * - Jobs trigger when users access data
 * - Check if cached data is stale (>age threshold)
 * - Run refresh asynchronously without blocking response
 * - Cache results for next request
 *
 * No external cron service needed - scales automatically with user activity
 */

import { JobContext, JobResult } from './types';

// ============================================================================
// JOB CONTEXT & RESULT MANAGEMENT
// ============================================================================

/**
 * In-memory job state tracking (would be Redis in production)
 * Maps: jobId -> { startedAt, completedAt, result }
 */
const jobStorage = new Map<string, {
  context: JobContext;
  result?: JobResult;
}>();

/**
 * In-memory cache for job results
 * Maps: cacheKey -> { data, timestamp }
 */
const jobCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

/**
 * Age thresholds for different job types (in milliseconds)
 */
export const JOB_THRESHOLDS = {
  PRICE_UPDATE: 2 * 60 * 60 * 1000, // 2 hours
  META_REFRESH: 6 * 60 * 60 * 1000, // 6 hours
  BANNED_LIST_CHECK: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// ============================================================================
// STALENESS CHECKING
// ============================================================================

/**
 * Check if cached data is stale and needs refresh
 *
 * @param cacheKey - Unique identifier for the data
 * @param maxAge - Maximum age in milliseconds before considering stale
 * @returns true if data is stale or doesn't exist
 */
export function isDataStale(cacheKey: string, maxAge: number): boolean {
  const cached = jobCache.get(cacheKey);
  if (!cached) return true;

  const age = Date.now() - cached.timestamp;
  return age > maxAge;
}

/**
 * Get cached data if available
 *
 * @param cacheKey - Unique identifier for the data
 * @returns Cached data or null if not found/expired
 */
export function getCachedData<T>(cacheKey: string, maxAge?: number): T | null {
  const cached = jobCache.get(cacheKey);
  if (!cached) return null;

  if (maxAge) {
    const age = Date.now() - cached.timestamp;
    if (age > maxAge) {
      jobCache.delete(cacheKey);
      return null;
    }
  }

  return cached.data as T;
}

/**
 * Set cached data with current timestamp
 *
 * @param cacheKey - Unique identifier for the data
 * @param data - Data to cache
 */
export function setCachedData(cacheKey: string, data: any): void {
  jobCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
}

// ============================================================================
// JOB EXECUTION
// ============================================================================

/**
 * Execute a job asynchronously without blocking
 *
 * Usage:
 *   // In API route
 *   const result = await executeJobAsync(
 *     'price_update',
 *     () => updatePrices(userId),
 *     { userId }
 *   );
 *   // Returns immediately, job runs in background
 *
 * @param jobType - Type of job ('price_update', 'meta_refresh', 'banned_list_check')
 * @param jobFn - Async function that performs the work
 * @param context - Job context (userId, etc.)
 * @returns Promise that resolves immediately with job ID
 */
export async function executeJobAsync(
  jobType: 'price_update' | 'meta_refresh' | 'banned_list_check',
  jobFn: () => Promise<{ itemsProcessed: number; itemsFailed?: number; error?: string }>,
  context?: { userId?: string }
): Promise<string> {
  const jobId = generateJobId();
  const jobContext: JobContext = {
    jobType,
    startedAt: new Date(),
    status: 'pending',
    userId: context?.userId,
  };

  // Store context
  jobStorage.set(jobId, { context: jobContext });

  // Fire off job asynchronously (don't await)
  runJobInBackground(jobId, jobFn, jobContext).catch(err => {
    console.error(`Job ${jobId} failed:`, err);
    const stored = jobStorage.get(jobId);
    if (stored) {
      stored.context.status = 'failed';
      stored.context.error = err.message;
      stored.context.completedAt = new Date();
    }
  });

  // Return immediately without waiting
  return jobId;
}

/**
 * Internal: Run job in background
 */
async function runJobInBackground(
  jobId: string,
  jobFn: () => Promise<{ itemsProcessed: number; itemsFailed?: number; error?: string }>,
  context: JobContext
): Promise<void> {
  context.status = 'running';

  const startTime = Date.now();
  const jobResult = await jobFn();

  const result: JobResult = {
    jobId,
    success: !jobResult.error,
    itemsProcessed: jobResult.itemsProcessed,
    itemsFailed: jobResult.itemsFailed || 0,
    startedAt: context.startedAt,
    completedAt: new Date(),
    error: jobResult.error,
  };

  context.status = 'completed';
  context.completedAt = new Date();

  const stored = jobStorage.get(jobId);
  if (stored) {
    stored.result = result;
  }

  const duration = Date.now() - startTime;
  console.log(`[Job ${jobId}] Completed in ${duration}ms:`, {
    success: result.success,
    itemsProcessed: result.itemsProcessed,
    itemsFailed: result.itemsFailed,
  });
}

// ============================================================================
// JOB COORDINATION PATTERN
// ============================================================================

/**
 * Smart data fetching pattern with auto-refresh
 *
 * Usage in API route:
 *   const data = await getDataWithAutoRefresh(
 *     'user-prices-' + userId,
 *     JOB_THRESHOLDS.PRICE_UPDATE,
 *     () => getPricesFromDatabase(userId),  // Return cached if fresh
 *     () => updatePricesInBackground(userId) // Refresh if stale
 *   );
 *
 * Returns: Cached data immediately (even if stale)
 * Triggers: Background refresh if data is stale
 * Result: Next request gets fresh data while first request doesn't wait
 *
 * @param cacheKey - Unique identifier for the data
 * @param maxAge - Max age before considering stale
 * @param fetchFn - Fetch current data from database
 * @param refreshFn - Refresh data in background
 * @returns Cached data or freshly fetched data
 */
export async function getDataWithAutoRefresh<T>(
  cacheKey: string,
  maxAge: number,
  fetchFn: () => Promise<T>,
  refreshFn: () => Promise<{ itemsProcessed: number; error?: string }>
): Promise<T> {
  // Try to get cached data
  const cached = getCachedData<T>(cacheKey, maxAge);
  if (cached) {
    // Even if stale, return it immediately
    // But trigger background refresh if needed
    if (isDataStale(cacheKey, maxAge)) {
      executeJobAsync(
        'price_update', // Will be parameterized in real implementation
        refreshFn,
        {}
      ).catch(err => console.error('Auto-refresh failed:', err));
    }
    return cached;
  }

  // No cached data - fetch fresh
  const fresh = await fetchFn();
  setCachedData(cacheKey, fresh);
  return fresh;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): JobContext | null {
  return jobStorage.get(jobId)?.context || null;
}

/**
 * Get job result (only available after completion)
 */
export function getJobResult(jobId: string): JobResult | null {
  return jobStorage.get(jobId)?.result || null;
}

/**
 * Clear old cache entries (call periodically)
 * Removes entries older than maxRetentionMs
 */
export function clearStaleCache(maxRetentionMs: number = 24 * 60 * 60 * 1000): number {
  let cleared = 0;
  const now = Date.now();

  jobCache.forEach((value, key) => {
    if (now - value.timestamp > maxRetentionMs) {
      jobCache.delete(key);
      cleared++;
    }
  });

  return cleared;
}

/**
 * Debug: Get cache stats
 */
export function getCacheStats() {
  return {
    cacheSize: jobCache.size,
    jobsTracked: jobStorage.size,
    oldestCacheEntry: Array.from(jobCache.values()).reduce(
      (min, entry) => Math.min(min, entry.timestamp),
      Date.now()
    ),
  };
}

// ============================================================================
// RATE LIMITING HELPER
// ============================================================================

/**
 * Rate limiter for jobs (prevent too many concurrent executions)
 */
class RateLimiter {
  private queue: Map<string, number> = new Map();

  /**
   * Check if job type can execute now
   * Returns true if enough time has passed since last execution
   */
  canExecute(jobType: string, minIntervalMs: number = 5000): boolean {
    const lastExecution = this.queue.get(jobType) || 0;
    const now = Date.now();

    if (now - lastExecution < minIntervalMs) {
      return false;
    }

    this.queue.set(jobType, now);
    return true;
  }

  /**
   * Get time until next allowed execution (ms)
   */
  getWaitTime(jobType: string, minIntervalMs: number = 5000): number {
    const lastExecution = this.queue.get(jobType) || 0;
    const now = Date.now();
    const wait = minIntervalMs - (now - lastExecution);
    return Math.max(0, wait);
  }
}

export const rateLimiter = new RateLimiter();

// ============================================================================
// BATCH JOB PROCESSING
// ============================================================================

/**
 * Process items in batches with progress tracking
 *
 * Usage:
 *   const results = await processBatch(
 *     cards,
 *     async (card) => updatePrice(card),
 *     { batchSize: 100, delayMs: 500 }
 *   );
 *
 * @param items - Array of items to process
 * @param processFn - Async function to process each item
 * @param options - Batch options
 * @returns Array of results
 */
export async function processBatch<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    delayMs?: number;
    onProgress?: (processed: number, total: number) => void;
  } = {}
): Promise<R[]> {
  const {
    batchSize = 100,
    delayMs = 0,
    onProgress,
  } = options;

  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processFn(item))
    );
    results.push(...batchResults);

    onProgress?.(results.length, items.length);

    if (delayMs > 0 && i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
