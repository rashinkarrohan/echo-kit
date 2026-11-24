/** The parts of a transformers.js `progress_callback` event used here. */
export interface DownloadEvent {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
}

/**
 * Adds up the per-file progress events transformers.js sends while it fetches the speech model
 * (about 100 MB on the first run) into one loaded / total pair.
 */
export class DownloadProgress {
  private readonly files = new Map<string, { loaded: number; total: number }>();

  update(event: DownloadEvent): void {
    const { file, loaded, total } = event;
    if (file === undefined) return;
    if (event.status === "done") {
      const known = this.files.get(file);
      if (known) this.files.set(file, { loaded: known.total, total: known.total });
      return;
    }
    if (event.status !== "progress") return;
    if (!Number.isFinite(loaded) || !Number.isFinite(total)) return;
    const size = total as number;
    this.files.set(file, { loaded: Math.min(loaded as number, size), total: size });
  }

  totals(): { loaded: number; total: number } {
    let loaded = 0;
    let total = 0;
    for (const f of this.files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    return { loaded, total };
  }
}
