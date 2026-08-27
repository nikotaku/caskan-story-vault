import assert from "node:assert/strict";
import test from "node:test";

import {
  clickWithDomFallback,
  clickWithScopedConfirmation,
  isConfirmedEstamaSubmission,
} from "../server/playwright-actions.ts";

type FakeLocator = {
  click: (options: { timeout: number }) => Promise<void>;
  evaluate: (callback: (element: HTMLElement) => unknown) => Promise<unknown>;
};

const createLocator = (clickError?: Error) => {
  const state = {
    clickOptions: [] as Array<{ timeout: number }>,
    evaluateCalls: 0,
    domClickCalls: 0,
    attributes: new Map<string, string>(),
  };
  const locator: FakeLocator = {
    async click(options) {
      state.clickOptions.push(options);
      if (clickError) throw clickError;
    },
    async evaluate(callback) {
      state.evaluateCalls += 1;
      return callback({
        click() {
          state.domClickCalls += 1;
        },
        setAttribute(name: string, value: string) {
          state.attributes.set(name, value);
        },
      } as HTMLElement);
    },
  };
  return { locator, state };
};

test("通常のPlaywrightクリックが成功したらDOMクリックを使わない", async () => {
  const { locator, state } = createLocator();

  await clickWithDomFallback(locator as never, 2_500);

  assert.deepEqual(state.clickOptions, [{ timeout: 2_500 }]);
  assert.equal(state.evaluateCalls, 0);
  assert.equal(state.domClickCalls, 0);
});

test("送信ボタンがviewport外ならDOMクリックへフォールバックする", async () => {
  const { locator, state } = createLocator(new Error(
    "locator.click: Timeout 15000ms exceeded. element is outside of the viewport",
  ));

  await clickWithDomFallback(locator as never, 15_000);

  assert.deepEqual(state.clickOptions, [{ timeout: 15_000 }]);
  assert.equal(state.evaluateCalls, 1);
  assert.equal(state.domClickCalls, 1);
});

test("別要素がpointer eventsを遮っていたらDOMクリックへフォールバックする", async () => {
  const { locator, state } = createLocator(new Error(
    "locator.click: Timeout 15000ms exceeded. subtree intercepts pointer events",
  ));

  await clickWithDomFallback(locator as never, 15_000);

  assert.equal(state.evaluateCalls, 1);
  assert.equal(state.domClickCalls, 1);
});

test("viewport・pointer interception以外のクリック失敗は再throwする", async () => {
  const clickError = new Error("locator.click: element is detached from the DOM");
  const { locator, state } = createLocator(clickError);

  await assert.rejects(
    clickWithDomFallback(locator as never, 15_000),
    (error) => error === clickError,
  );

  assert.equal(state.evaluateCalls, 0);
  assert.equal(state.domClickCalls, 0);
});

const createScopedConfirmationPage = (hasModal: boolean, modalAppearsAfterChecks = 0) => {
  const submit = createLocator();
  const confirm = createLocator();
  let pageLocatorCalls = 0;
  const confirmLocator = {
    ...confirm.locator,
    async count() { return 1; },
    async isVisible() { return true; },
  };
  let modalChecks = 0;
  const modal = {
    async count() {
      modalChecks += 1;
      return hasModal && modalChecks > modalAppearsAfterChecks ? 1 : 0;
    },
    async isVisible() { return hasModal && modalChecks > modalAppearsAfterChecks; },
    locator() {
      return {
        filter() {
          return { last: () => confirmLocator };
        },
        last() {
          return confirmLocator;
        },
      };
    },
  };
  const page = {
    url() { return "https://estama.jp/tamathera/diary/"; },
    locator(selector: string) {
      pageLocatorCalls += 1;
      if (selector.includes("data-enka-origin-submit")) {
        return {
          async count() { return stateHasOrigin() ? 1 : 0; },
          async isVisible() { return stateHasOrigin(); },
        };
      }
      return { last: () => modal };
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
  };
  const stateHasOrigin = () => submit.state.attributes.get("data-enka-origin-submit") === "true";
  return { confirm, page, pageLocatorCalls: () => pageLocatorCalls, submit };
};

test("確認モーダルがなければ元の送信ボタンを1回だけ押す", async () => {
  const { confirm, page, pageLocatorCalls, submit } = createScopedConfirmationPage(false);

  await clickWithScopedConfirmation(page as never, submit.locator as never);

  assert.equal(submit.state.clickOptions.length, 1);
  assert.equal(confirm.state.clickOptions.length, 0);
  assert.equal(pageLocatorCalls(), 2);
});

test("確認操作は表示中モーダル内のボタンだけを1回押す", async () => {
  const { confirm, page, submit } = createScopedConfirmationPage(true);

  await clickWithScopedConfirmation(page as never, submit.locator as never);

  assert.equal(submit.state.clickOptions.length, 1);
  assert.equal(confirm.state.clickOptions.length, 1);
});

test("遅れて表示される確認モーダルを待って1回だけ確定する", async () => {
  const { confirm, page, submit } = createScopedConfirmationPage(true, 3);

  await clickWithScopedConfirmation(page as never, submit.locator as never);

  assert.equal(submit.state.clickOptions.length, 1);
  assert.equal(confirm.state.clickOptions.length, 1);
});

test("別ページ式の確認画面では元ボタンを再クリックせず確定する", async () => {
  const submit = createLocator();
  const confirm = createLocator();
  let currentUrl = "https://estama.jp/tamathera/diary/";
  const submitLocator = {
    ...submit.locator,
    async click(options: { timeout: number }) {
      await submit.locator.click(options);
      currentUrl = "https://estama.jp/tamathera/diary/confirm/";
    },
  };
  const confirmLocator = {
    ...confirm.locator,
    async count() { return 1; },
    async isVisible() { return true; },
  };
  const confirmationRoot = {
    async count() { return 1; },
    async isVisible() { return true; },
    locator() {
      return {
        filter() { return { last: () => confirmLocator }; },
        last() { return confirmLocator; },
      };
    },
  };
  const empty = {
    async count() { return 0; },
    async isVisible() { return false; },
    last() { return this; },
  };
  const page = {
    url() { return currentUrl; },
    locator(selector: string) {
      if (selector.includes("data-enka-origin-submit")) return empty;
      if (selector.startsWith("form:visible")) {
        return { filter() { return { last: () => confirmationRoot }; } };
      }
      return empty;
    },
    async waitForLoadState() {},
    async waitForTimeout() {},
  };

  const result = await clickWithScopedConfirmation(page as never, submitLocator as never);

  assert.equal(submit.state.clickOptions.length, 1);
  assert.equal(confirm.state.clickOptions.length, 1);
  assert.equal(result.confirmationClicked, true);
});

const baseEvidence = {
  initialUrl: "https://estama.jp/tamathera/diary/",
  currentUrl: "https://estama.jp/tamathera/diary/",
  submittedBody: "テスト本文",
  currentBody: "テスト本文",
  formVisible: true,
  successVisible: false,
  confirmationVisible: false,
};

test("送信後も同じ投稿フォームと本文のままなら成功扱いにしない", () => {
  assert.equal(isConfirmedEstamaSubmission(baseEvidence), false);
});

test("明示的な投稿完了表示があれば成功扱いにする", () => {
  assert.equal(isConfirmedEstamaSubmission({ ...baseEvidence, successVisible: true }), true);
});

test("日記URLで投稿フォームが消えたら成功扱いにする", () => {
  assert.equal(isConfirmedEstamaSubmission({ ...baseEvidence, formVisible: false, currentBody: null }), true);
});

test("日記URLで本文欄がリセットされたら成功扱いにする", () => {
  assert.equal(isConfirmedEstamaSubmission({ ...baseEvidence, currentBody: "" }), true);
});

test("本文が整形・変更されただけでは成功扱いにしない", () => {
  assert.equal(isConfirmedEstamaSubmission({ ...baseEvidence, currentBody: "テスト本文 " }), false);
  assert.equal(isConfirmedEstamaSubmission({ ...baseEvidence, currentBody: "別の本文" }), false);
});

test("確認・プレビューURLでフォームが消えても完了表示なしでは成功扱いにしない", () => {
  assert.equal(isConfirmedEstamaSubmission({
    ...baseEvidence,
    currentUrl: "https://estama.jp/tamathera/diary/confirm/",
    formVisible: false,
    currentBody: null,
  }), false);
  assert.equal(isConfirmedEstamaSubmission({
    ...baseEvidence,
    currentUrl: "https://estama.jp/tamathera/diary/preview/",
    formVisible: false,
    currentBody: null,
  }), false);
});

test("確認画面が残っている間は成功扱いにしない", () => {
  assert.equal(isConfirmedEstamaSubmission({
    ...baseEvidence,
    successVisible: true,
    confirmationVisible: true,
  }), false);
});

test("ログイン画面や外部URLへの遷移は成功扱いにしない", () => {
  assert.equal(isConfirmedEstamaSubmission({
    ...baseEvidence,
    currentUrl: "https://estama.jp/tamathera/login/",
    formVisible: false,
    currentBody: null,
  }), false);
  assert.equal(isConfirmedEstamaSubmission({
    ...baseEvidence,
    currentUrl: "https://example.com/tamathera/diary/",
    successVisible: true,
  }), false);
});
