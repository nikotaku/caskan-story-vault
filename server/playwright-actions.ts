import type { Locator, Page } from "playwright-core";

const RECOVERABLE_CLICK_ERROR = /intercepts pointer events|outside of the viewport/i;
const ORIGIN_SUBMIT_ATTRIBUTE = "data-enka-origin-submit";
const ESTAMA_HOST = /^(?:www\.)?estama\.jp$/i;

export type SubmissionEvidence = {
  initialUrl: string;
  currentUrl: string;
  submittedBody: string;
  currentBody: string | null;
  formVisible: boolean;
  successVisible: boolean;
  confirmationVisible: boolean;
};

export function isConfirmedEstamaSubmission(evidence: SubmissionEvidence) {
  let current: URL;
  try {
    current = new URL(evidence.currentUrl);
  } catch {
    return false;
  }
  const isEstama = current.protocol === "https:" && ESTAMA_HOST.test(current.hostname);
  const isSoulDiary = /^\/tamathera\/diary(?:\/|$)/i.test(current.pathname);
  const isConfirmationPath = /\/(?:confirm|confirmation|preview|check)(?:\/|$)/i.test(current.pathname);
  const isSoulArea = /^\/tamathera(?:\/|$)/i.test(current.pathname)
    && !/^\/tamathera\/login(?:\/|$)/i.test(current.pathname);

  if (!isEstama || !isSoulArea || evidence.confirmationVisible) return false;
  if (evidence.successVisible) return true;
  if (!isSoulDiary || isConfirmationPath) return false;
  if (!evidence.formVisible) return true;
  return evidence.currentBody !== null && evidence.currentBody.trim() === "";
}

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

export async function clickWithScopedConfirmation(page: Page, submit: Locator) {
  const initialUrl = page.url();
  await submit.evaluate((element) => element.setAttribute("data-enka-origin-submit", "true"));
  await clickWithDomFallback(submit);
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForTimeout(250);

  // Never search the whole page for a second submit action: while navigation is
  // settling that can resolve to the original button and create a duplicate.
  const modal = page.locator([
    '[role="dialog"]:visible',
    'dialog[open]',
    '[aria-modal="true"]:visible',
    '.modal:visible',
    '.swal2-container:visible',
  ].join(",")).last();
  let modalVisible = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    modalVisible = await modal.count() > 0 && await modal.isVisible().catch(() => false);
    if (modalVisible) break;
    if (page.url() !== initialUrl) break;
    if (attempt < 19) await page.waitForTimeout(250);
  }
  let confirmationClicked = false;
  if (modalVisible) {
    const textConfirm = modal.locator('button, a').filter({
      hasText: /^\s*(?:確定|はい|投稿する|保存する)\s*$/,
    }).last();
    const inputConfirm = modal.locator([
      'input[type="submit"][value="確定"]',
      'input[type="submit"][value="はい"]',
      'input[type="submit"][value="投稿する"]',
      'input[type="submit"][value="保存する"]',
    ].join(",")).last();
    const confirm = await textConfirm.count() ? textConfirm : inputConfirm;
    if (await confirm.count() && await confirm.isVisible()) {
      await clickWithDomFallback(confirm);
      confirmationClicked = true;
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    } else {
      throw new Error("確認画面の確定ボタンが見つかりません");
    }
  } else {
    // Some Estama versions use a full-page confirmation instead of a modal.
    // Only search after the original marked button disappeared (or navigation
    // occurred), so the original submit can never be clicked a second time.
    const origin = page.locator(`[${ORIGIN_SUBMIT_ATTRIBUTE}="true"]`);
    const originStillVisible = await origin.count() > 0 && await origin.isVisible().catch(() => false);
    if (page.url() !== initialUrl || !originStillVisible) {
      const confirmationRoot = page.locator('form:visible, main:visible, [role="main"]:visible').filter({
        hasText: /投稿内容の確認|内容を確認|以下の内容|この内容で(?:投稿|登録|保存)/,
      }).last();
      if (await confirmationRoot.count() && await confirmationRoot.isVisible().catch(() => false)) {
        const textConfirm = confirmationRoot.locator('button, a').filter({
          hasText: /^\s*(?:確定|はい|この内容で投稿(?:する)?|投稿する|保存する)\s*$/,
        }).last();
        const inputConfirm = confirmationRoot.locator([
          'input[type="submit"][value="確定"]',
          'input[type="submit"][value="はい"]',
          'input[type="submit"][value="この内容で投稿"]',
          'input[type="submit"][value="投稿する"]',
          'input[type="submit"][value="保存する"]',
        ].join(",")).last();
        const confirm = await textConfirm.count() ? textConfirm : inputConfirm;
        if (!await confirm.count() || !await confirm.isVisible().catch(() => false)) {
          throw new Error("確認画面の確定ボタンが見つかりません");
        }
        await clickWithDomFallback(confirm);
        confirmationClicked = true;
        await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      }
    }
  }
  await page.waitForTimeout(800);
  return { initialUrl, confirmationClicked };
}
