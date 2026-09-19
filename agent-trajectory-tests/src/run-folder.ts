import { randomBytes } from "node:crypto";

/**
 * A short, unique run id (4 random bytes as hex, e.g. `a1b2c3d4`) - one per
 * run, so two runs can be told apart at a glance even when their
 * display-friendly folder names collide (two runs started in the same
 * minute) or when a run is referenced outside its folder path (a log line,
 * a comparison table). Same shape as this harness's own background task
 * ids, deliberately - a short opaque handle, not meant to be decoded.
 */
export function generateRunId(): string {
  return randomBytes(4).toString("hex");
}

/**
 * Run-folder naming: `result-of-run-DD-MM-YY-HH-MMAM-<runId>` (local time,
 * 12-hour clock, AM/PM appended with no separator, then the run id) - the
 * display-friendly convention requested for `results/`. The date portion is
 * not meant to sort correctly as a plain string (a 05-10-26 run sorts
 * before a 19-09-26 run alphabetically despite being later chronologically)
 * - chronological ordering always goes through each folder's own
 * summary.json `runAt` (a real ISO timestamp), never through the folder
 * name. The trailing runId is what actually guarantees two runs never
 * collide on disk, even two started in the same minute.
 */
export function formatRunFolderName(date: Date, runId: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dd = pad(date.getDate());
  const mm = pad(date.getMonth() + 1);
  const yy = pad(date.getFullYear() % 100);
  let hour12 = date.getHours() % 12;
  if (hour12 === 0) hour12 = 12;
  const hh = pad(hour12);
  const min = pad(date.getMinutes());
  const ampm = date.getHours() < 12 ? "AM" : "PM";
  return `result-of-run-${dd}-${mm}-${yy}-${hh}-${min}${ampm}-${runId}`;
}
