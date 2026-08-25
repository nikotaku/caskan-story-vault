import assert from "node:assert/strict";
import test from "node:test";

import { clickWithDomFallback } from "../server/playwright-actions.ts";

type FakeLocator = {
  click: (options: { timeout: number }) => Promise<void>;
  evaluate: (callback: (element: HTMLElement) => unknown) => Promise<unknown>;
};

const createLocator = (clickError?: Error) => {
  const state = {
    clickOptions: [] as Array<{ timeout: number }>,
    evaluateCalls: 0,
    domClickCalls: 0,
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
