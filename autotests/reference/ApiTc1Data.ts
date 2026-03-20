declare const process: { env: Record<string, string | undefined> };

export class ApiTc1Data {
  readonly clockEndpoint: string;
  readonly authHeaderName: string;
  readonly timeFormatPattern: RegExp;

  constructor(
    /** @env API_TC1_CLOCK_ENDPOINT — Clock test endpoint path */
    clockEndpoint = process.env.API_TC1_CLOCK_ENDPOINT ?? "/v1/test/clock",
  ) {
    this.clockEndpoint = clockEndpoint;
    this.authHeaderName = "API_SECRET_TOKEN";
    // Matches server time like 2026-03-02T17:19:33.65583421
    this.timeFormatPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+$/;
  }

  /** Shifts server time +1 day, returns ISO without timezone: YYYY-MM-DDTHH:mm:ss */
  computeFutureTime(serverTime: string): string {
    const date = new Date(serverTime);
    date.setDate(date.getDate() + 1);
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
  }

  /** Extracts YYYY-MM-DD date portion from a time string. */
  extractDate(timeString: string): string {
    return timeString.slice(0, 10);
  }

  /** Computes expected +1 day date string (YYYY-MM-DD) from server time. */
  computeFutureDate(serverTime: string): string {
    const date = new Date(serverTime);
    date.setDate(date.getDate() + 1);
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
}
