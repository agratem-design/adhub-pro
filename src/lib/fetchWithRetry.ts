/**
 * Utility for fetching data with automatic retry on network failures
 * Handles slow networks and temporary connection issues
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  timeout: 30000
};

/**
 * Wraps a Supabase query with retry logic
 * @param queryFn - The async function that performs the Supabase query
 * @param options - Retry configuration options
 * @returns The query result
 */
export async function fetchWithRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: any }> {
  const { maxRetries, initialDelay, maxDelay, timeout } = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  let lastError: any = null;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      // Race between the query and timeout
      const result = await Promise.race([
        queryFn(),
        timeoutPromise
      ]) as { data: T | null; error: any };

      // If we got a result (even with an error), return it
      if (result) {
        // Check for network-related errors that should trigger retry
        if (result.error && isRetryableError(result.error) && attempt < maxRetries) {
          console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries} after error:`, result.error.message);
          await sleep(delay);
          delay = Math.min(delay * 2, maxDelay);
          lastError = result.error;
          continue;
        }
        return result;
      }
    } catch (error: any) {
      console.log(`❌ Fetch attempt ${attempt + 1} failed:`, error.message);
      lastError = error;

      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await sleep(delay);
        delay = Math.min(delay * 2, maxDelay);
      }
    }
  }

  // All retries exhausted
  return {
    data: null,
    error: lastError || new Error('All retry attempts failed')
  };
}

/**
 * Check if an error is retryable (network issues, timeouts, etc.)
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;

  const errorMessage = String(error.message || error).toLowerCase();
  
  const retryablePatterns = [
    'network',
    'fetch',
    'timeout',
    'connection',
    'econnreset',
    'econnrefused',
    'enotfound',
    'socket',
    'quic',
    'protocol',
    'aborted',
    'err_network',
    'err_connection',
    'err_quic'
  ];

  return retryablePatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Batch fetch utility - fetches data in smaller chunks for large datasets
 */
export async function batchFetch<T>(
  fetchFn: (offset: number, limit: number) => Promise<{ data: T[] | null; error: any }>,
  options: { batchSize?: number; maxBatches?: number } = {}
): Promise<{ data: T[]; error: any }> {
  const { batchSize = 500, maxBatches = 20 } = options;
  const allData: T[] = [];
  let hasMore = true;
  let batchCount = 0;

  while (hasMore && batchCount < maxBatches) {
    const offset = batchCount * batchSize;
    const result = await fetchWithRetry(() => fetchFn(offset, batchSize));

    if (result.error) {
      console.error(`❌ Batch ${batchCount + 1} failed:`, result.error);
      // Return what we have so far
      return { data: allData, error: result.error };
    }

    if (result.data && result.data.length > 0) {
      allData.push(...result.data);
      hasMore = result.data.length === batchSize;
    } else {
      hasMore = false;
    }

    batchCount++;
  }

  return { data: allData, error: null };
}
