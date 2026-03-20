import type { Locator } from "@playwright/test";

/** RGB color entry extracted from a DOM element's computed styles. */
export interface ColorEntry {
  readonly property: string;
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Text content with its associated computed color. */
export interface ColoredTextEntry {
  readonly text: string;
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const COLOR_PROPERTIES = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "boxShadow",
  "textShadow",
  "outlineColor",
] as const;

const DESCENDANT_COLOR_PROPERTIES = [
  "color",
  "backgroundColor",
  "borderLeftColor",
] as const;

/** Parses "rgb(r, g, b)" or "rgba(r, g, b, a)" into {r, g, b}, or null. */
function parseRgb(raw: string): { r: number; g: number; b: number } | null {
  const match = raw.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/,
  );
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

/**
 * Deeply inspects a locator and its descendants (up to 200) for computed colors.
 * Checks the element itself, its ::before/::after pseudo-elements, and descendants.
 * Returns deduplicated color entries.
 */
export async function collectCandidateColors(
  locator: Locator,
): Promise<ColorEntry[]> {
  return locator.evaluate(
    (el: Element, props: { main: string[]; descendant: string[] }) => {
      const seen = new Set<string>();
      const results: ColorEntry[] = [];

      function parseColor(
        raw: string,
      ): { r: number; g: number; b: number } | null {
        const m = raw.match(
          /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/,
        );
        return m
          ? { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
          : null;
      }

      function addColor(property: string, raw: string): void {
        const parsed = parseColor(raw);
        if (!parsed) return;
        const key = `${property}-${parsed.r}-${parsed.g}-${parsed.b}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push({ property, ...parsed });
      }

      function inspectElement(target: Element, properties: string[]): void {
        const styles = window.getComputedStyle(target);
        for (const prop of properties) {
          addColor(prop, styles.getPropertyValue(prop));
        }
      }

      function inspectPseudo(
        target: Element,
        pseudo: "::before" | "::after",
      ): void {
        const styles = window.getComputedStyle(target, pseudo);
        const content = styles.getPropertyValue("content");
        if (content === "none" || content === '""') return;
        for (const prop of props.main) {
          addColor(`${pseudo}-${prop}`, styles.getPropertyValue(prop));
        }
      }

      // Inspect the root element and its pseudo-elements
      inspectElement(el, props.main);
      inspectPseudo(el, "::before");
      inspectPseudo(el, "::after");

      // Inspect descendants (up to 200)
      const descendants = el.querySelectorAll("*");
      const limit = Math.min(descendants.length, 200);
      for (let i = 0; i < limit; i++) {
        inspectElement(descendants[i], props.descendant);
      }

      return results;
    },
    {
      main: [...COLOR_PROPERTIES],
      descendant: [...DESCENDANT_COLOR_PROPERTIES],
    },
  );
}

/**
 * Walks all visible descendant elements of a locator and returns their text content
 * paired with their computed text color.
 */
export async function collectColoredText(
  locator: Locator,
): Promise<ColoredTextEntry[]> {
  return locator.evaluate((el: Element) => {
    const results: Array<{
      text: string;
      r: number;
      g: number;
      b: number;
    }> = [];
    const descendants = el.querySelectorAll("*");
    for (let i = 0; i < descendants.length; i++) {
      const child = descendants[i] as HTMLElement;
      // Skip invisible elements
      const styles = window.getComputedStyle(child);
      if (
        styles.display === "none" ||
        styles.visibility === "hidden" ||
        styles.opacity === "0"
      ) {
        continue;
      }
      const text = child.textContent?.trim();
      if (!text) continue;

      const colorStr = styles.color;
      const match = colorStr.match(
        /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/,
      );
      if (match) {
        results.push({
          text,
          r: Number(match[1]),
          g: Number(match[2]),
          b: Number(match[3]),
        });
      }
    }
    return results;
  });
}

/** Predicate: is this color predominantly red? (r > g && r > b) */
export function isRedDominant(entry: {
  r: number;
  g: number;
  b: number;
}): boolean {
  return entry.r > entry.g && entry.r > entry.b;
}

/** Predicate: is this color predominantly green? (g > r && g > b) */
export function isGreenDominant(entry: {
  r: number;
  g: number;
  b: number;
}): boolean {
  return entry.g > entry.r && entry.g > entry.b;
}
