const SUPABASE_URL = "https://imrxzkivwrkqbhqfbbes.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T0a9mtOIbupU5n_VAe9caw_xlnbbWfB";
const TARGET_TITLE = "清算明細をダウンロード（セラピスト送付用）";

function readAccessToken() {
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      const session = Array.isArray(value) ? value[0] : value;
      const token = session?.access_token || session?.currentSession?.access_token;
      if (typeof token === "string" && token) return token;
    } catch {
      // Ignore unrelated/local-storage entries.
    }
  }
  return "";
}

function selectedBusinessDate() {
  const text = document.querySelector("main")?.textContent || "";
  const match = text.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function clearanceCardText(button) {
  let node = button.parentElement;
  let candidate = "";
  while (node && node !== document.body) {
    const text = node.innerText || "";
    if (text.includes("セラピスト給与") && text.includes("投函方法・アナウンス")) {
      candidate = text;
      if (text.includes("清算済み") || text.includes("未清算")) return text;
    }
    node = node.parentElement;
  }
  return candidate;
}

function relabelButtons(root = document) {
  root.querySelectorAll?.(`button[title="${TARGET_TITLE}"]`).forEach((button) => {
    button.title = "清算明細をLINEグループへ共有";
    const textNodes = [...button.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
    const lastText = textNodes[textNodes.length - 1];
    if (lastText) lastText.textContent = "共有";
  });
}

async function sendClearance(button) {
  const token = readAccessToken();
  if (!token) throw new Error("ログイン情報を確認できません。再ログインしてください。");
  const date = selectedBusinessDate();
  const cardText = clearanceCardText(button);
  if (!date || !cardText) throw new Error("対象の清算明細を特定できませんでした。");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/notify-line-clearance`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ date, card_text: cardText }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success !== true) {
    throw new Error(body?.error || "LINE送信に失敗しました。");
  }
  return body;
}

const observer = new MutationObserver(() => relabelButtons());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("DOMContentLoaded", () => relabelButtons());

document.addEventListener("click", async (event) => {
  const button = event.target instanceof Element
    ? event.target.closest('button[title="清算明細をLINEグループへ共有"], button[title="清算明細をダウンロード（セラピスト送付用）"]')
    : null;
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (button.dataset.lineSending === "1") return;
  button.dataset.lineSending = "1";
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "送信中...";
  try {
    const result = await sendClearance(button);
    button.textContent = "送信済み";
    window.setTimeout(() => {
      button.textContent = originalText?.replace("明細", "共有") || "共有";
    }, 1400);
    if (result?.cast_name) console.info(`清算明細をLINE送信: ${result.cast_name}`);
  } catch (error) {
    console.error(error);
    window.alert(error instanceof Error ? error.message : "LINE送信に失敗しました。");
    button.textContent = originalText?.replace("明細", "共有") || "共有";
  } finally {
    button.disabled = false;
    delete button.dataset.lineSending;
  }
}, true);
