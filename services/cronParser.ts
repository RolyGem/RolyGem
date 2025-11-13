/**
 * Checks if a job is due to run based on a cron-like schedule string.
 * This is a simplified parser and doesn't support all cron features.
 * Format: "minute hour day-of-month month day-of-week"
 * - `*`: any value
 * - `*
 * 
 * 
 * 
 * 
 * 
 * /n`: every n
 *
 * @param schedule The cron-like schedule string.
 * @param lastRun Optional timestamp of the last run.
 * @returns True if the job is due.
 */

export function isJobDue(schedule: string, lastRun?: number): boolean {
  const now = new Date();
  
  // Throttle: Don't run more than once per minute.
  if (lastRun && (now.getTime() - lastRun) < 60000) {
    return false;
  }
  
  const parts = schedule.split(' ');
  if (parts.length !== 5) {
    // FIX: Add backticks for template literal string.
    console.error(`Invalid cron string: ${schedule}`);
    return false;
  }

  const [min, hour, dayOfMonth, month, dayOfWeek] = parts;

  const check = (value: number, part: string) => {
    if (part === '*') return true;
    if (part.startsWith('*/')) {
        const n = parseInt(part.substring(2));
        return value % n === 0;
    }
    return parseInt(part) === value;
  };
  
  try {
    return (
      check(now.getMinutes(), min) &&
      check(now.getHours(), hour) &&
      check(now.getDate(), dayOfMonth) &&
      check(now.getMonth() + 1, month) &&
      check(now.getDay(), dayOfWeek)
    );
  } catch (e) {
      // FIX: Add backticks for template literal string.
      console.error(`Error parsing cron string "${schedule}":`, e);
      return false;
  }
}
