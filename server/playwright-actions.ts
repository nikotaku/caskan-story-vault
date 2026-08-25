import type { Locator } from "playwright-core";

const RECOVERABLE_CLICK_ERROR = /intercepts pointer events|outside of the viewport/i;

export async function clickWithDomFallback(action: Locator, timeout = 5_000) {
  try {
    await action.click({ timeout });
    return "pointer" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!RECOVERABLE_CLICK_ERROR.test(message)) throw error;

    await action.evaluate((element) => (element as HTMLElement).click());
    return "dom" as const;
  }
}
