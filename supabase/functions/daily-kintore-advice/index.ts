import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-kintore-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LINE_ENDPOINT = "https://api.line.me/v2/bot/message/push";

type JsonRecord = Record<string, unknown>;

interface KintoreProfile {
  user_id: string;
  goals: string[] | null;
  weaknesses: string | null;
  notification_enabled: boolean;
  notification_time: string;
  timezone: string;
}

interface FitnessDigest {
  period: string;
  workouts: {
    days28: number;
    days7: number;
    volume28Kg: number;
    volume7Kg: number;
    totalSets28: number;
    trainedParts28: Record<string, number>;
    lastSession: string;
  };
  running: {
    days28: number;
    distance28Km: number;
    distance7Km: number;
  };
  meals: {
    recordedDays7: number;
    average7: { kcal: number; p: number; f: number; c: number } | null;
    targets: { kcal: number; p: number; f: number; c: number };
  };
  body: {
    latest: { date: string; weight: number | null; fat: number | null } | null;
    weightChange28: number | null;
    fatChange28: number | null;
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function addDays(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function localDateTime(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}`;
  const displayDate = new Intl.DateTimeFormat("ja-JP", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);
  return { date, time, displayDate };
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function buildDigest(stateValue: unknown, dateKey: string): FitnessDigest {
  const state = asRecord(stateValue);
  const workouts = asRecord(state.workouts);
  const runs = asRecord(state.runs);
  const meals = asRecord(state.meals);
  const body = asRecord(state.body);
  const targetsRaw = asRecord(state.targets);
  const exercises = asArray(state.exercises).map(asRecord);
  const exerciseById = new Map(exercises.map((exercise) => [String(exercise.id ?? ""), exercise]));
  const from28 = addDays(dateKey, -27);
  const from7 = addDays(dateKey, -6);

  let workoutDays28 = 0;
  let workoutDays7 = 0;
  let volume28Kg = 0;
  let volume7Kg = 0;
  let totalSets28 = 0;
  const trainedParts28: Record<string, number> = {};
  let lastSessionDate = "";
  let lastSessionNames: string[] = [];

  for (const key of Object.keys(workouts).sort()) {
    if (key < from28 || key > dateKey) continue;
    const entries = asArray(workouts[key]).map(asRecord);
    if (!entries.length) continue;
    workoutDays28 += 1;
    if (key >= from7) workoutDays7 += 1;
    const sessionNames: string[] = [];
    for (const entry of entries) {
      const exercise = exerciseById.get(String(entry.exerciseId ?? ""));
      const name = String(exercise?.name ?? entry.name ?? "種目名なし");
      const part = String(exercise?.part ?? entry.part ?? "その他");
      sessionNames.push(name);
      trainedParts28[part] = (trainedParts28[part] ?? 0) + 1;
      const sets = asArray(entry.sets).map(asRecord);
      totalSets28 += sets.length;
      for (const set of sets) {
        const volume = numberValue(set.w) * numberValue(set.r);
        volume28Kg += volume;
        if (key >= from7) volume7Kg += volume;
      }
    }
    lastSessionDate = key;
    lastSessionNames = [...new Set(sessionNames)].slice(0, 5);
  }

  let runDays28 = 0;
  let distance28Km = 0;
  let distance7Km = 0;
  for (const key of Object.keys(runs)) {
    if (key < from28 || key > dateKey) continue;
    const dayRuns = asArray(runs[key]).map(asRecord);
    if (!dayRuns.length) continue;
    runDays28 += 1;
    for (const run of dayRuns) {
      const distance = numberValue(run.distance);
      distance28Km += distance;
      if (key >= from7) distance7Km += distance;
    }
  }

  const mealTotals = { kcal: 0, p: 0, f: 0, c: 0 };
  let recordedMealDays = 0;
  for (const key of Object.keys(meals)) {
    if (key < from7 || key > dateKey) continue;
    const day = asRecord(meals[key]);
    let hasItems = false;
    for (const items of Object.values(day)) {
      for (const item of asArray(items).map(asRecord)) {
        hasItems = true;
        mealTotals.kcal += numberValue(item.kcal);
        mealTotals.p += numberValue(item.p);
        mealTotals.f += numberValue(item.f);
        mealTotals.c += numberValue(item.c);
      }
    }
    if (hasItems) recordedMealDays += 1;
  }

  const bodyRows = Object.keys(body)
    .filter((key) => key >= from28 && key <= dateKey)
    .sort()
    .map((key) => ({ key, value: asRecord(body[key]) }));
  const latestBody = bodyRows.at(-1);
  const firstBody = bodyRows.at(0);
  const latestWeight = latestBody ? numberValue(latestBody.value.weight) || null : null;
  const firstWeight = firstBody ? numberValue(firstBody.value.weight) || null : null;
  const latestFat = latestBody ? numberValue(latestBody.value.fat) || null : null;
  const firstFat = firstBody ? numberValue(firstBody.value.fat) || null : null;

  return {
    period: `${from28}〜${dateKey}`,
    workouts: {
      days28: workoutDays28,
      days7: workoutDays7,
      volume28Kg: Math.round(volume28Kg),
      volume7Kg: Math.round(volume7Kg),
      totalSets28,
      trainedParts28,
      lastSession: lastSessionDate
        ? `${lastSessionDate}: ${lastSessionNames.join("、")}`
        : "記録なし",
    },
    running: {
      days28: runDays28,
      distance28Km: round(distance28Km, 2),
      distance7Km: round(distance7Km, 2),
    },
    meals: {
      recordedDays7: recordedMealDays,
      average7: recordedMealDays
        ? {
            kcal: Math.round(mealTotals.kcal / recordedMealDays),
            p: round(mealTotals.p / recordedMealDays),
            f: round(mealTotals.f / recordedMealDays),
            c: round(mealTotals.c / recordedMealDays),
          }
        : null,
      targets: {
        kcal: numberValue(targetsRaw.kcal),
        p: numberValue(targetsRaw.p),
        f: numberValue(targetsRaw.f),
        c: numberValue(targetsRaw.c),
      },
    },
    body: {
      latest: latestBody
        ? { date: latestBody.key, weight: latestWeight, fat: latestFat }
        : null,
      weightChange28: latestWeight !== null && firstWeight !== null
        ? round(latestWeight - firstWeight)
        : null,
      fatChange28: latestFat !== null && firstFat !== null
        ? round(latestFat - firstFat)
        : null,
    },
  };
}

function weaknessAction(weaknesses: string): string {
  const value = weaknesses.trim().toLowerCase();
  if (!value) return "弱点を一つ入力すると、次回から今日の一歩をさらに具体化できます。";
  if (/痛|怪我|けが|しびれ|めまい|息苦|動悸/.test(value)) {
    return "痛みや強い不調を無視せず、今日は負荷を止めて回復を優先してください。続く場合は医療専門家へ相談しましょう。";
  }
  if (/睡眠|寝不足|夜更かし|眠/.test(value)) {
    return "就寝90分前の入浴・照明・スマホ終了時刻を一つ決め、今夜だけ実行して明朝の体感を記録しましょう。";
  }
  if (/背中|広背|懸垂/.test(value)) {
    return "背中は重量より肩甲骨の動きを優先し、軽いローイングか懸垂補助を丁寧に3セット行いましょう。";
  }
  if (/脚|足|下半身|スクワット/.test(value)) {
    return "下半身はフォームを崩さない重量で、スクワット系と片脚種目を各2〜3セット積み上げましょう。";
  }
  if (/胸|プレス|ベンチ/.test(value)) {
    return "胸は肩の違和感がない範囲で、プレス系の軌道を整え、最後の2回も同じフォームで終えましょう。";
  }
  if (/肩|腕|腹|体幹/.test(value)) {
    return "弱点部位を最初に10分だけ扱い、丁寧な反復を2〜3セット。量より継続できる基準を作りましょう。";
  }
  if (/人間関係|会話|コミュ|頼|孤独|仲間/.test(value)) {
    return "信頼できる一人に状況を短く共有し、助けてほしいことを一つ具体的に頼んでみましょう。";
  }
  if (/集中|時間|先延ばし|仕事|習慣/.test(value)) {
    return "最重要の作業を25分だけ予定に固定し、開始前にスマホを離して、終わったら実行の有無だけ記録しましょう。";
  }
  return "入力した弱点を『今日10分でできる行動』まで小さくし、一度実行して結果を一言記録しましょう。";
}

function buildPersonalizedAdvice(digest: FitnessDigest, weaknesses: string): string {
  const healthAction = digest.workouts.days7 === 0
    ? "今日は15分だけでも全身を動かし、再開のハードルを下げましょう。スクワット・プッシュ・体幹を無理のない強度で。"
    : digest.workouts.days7 >= 4
      ? "直近7日は十分動けています。今日は睡眠・水分・軽い散歩を優先し、疲労を抜くこともトレーニングにしてください。"
      : "直近の記録を踏まえ、今日は前回使っていない部位を中心に、余力を2回ほど残す強度で積み上げましょう。";
  const protein = digest.meals.average7?.p ?? 0;
  const proteinTarget = digest.meals.targets.p;
  const nutritionAction = digest.meals.recordedDays7 === 0
    ? "食事を1食だけでも記録し、判断材料を増やしましょう。"
    : proteinTarget > 0 && protein < proteinTarget * 0.8
      ? `平均たんぱく質は約${Math.round(protein)}gです。目標${Math.round(proteinTarget)}gへ、次の食事で魚・肉・卵・大豆のどれかを足しましょう。`
      : "食事記録は概ね目標に沿っています。野菜・水分・食事時間も整えて安定性を上げましょう。";
  const activityLine = `直近7日：筋トレ${digest.workouts.days7}日・負荷量${Math.round(digest.workouts.volume7Kg / 1000 * 10) / 10}t・ラン${digest.running.distance7Km}km。`;

  return [
    "【今日の最優先】",
    healthAction,
    activityLine,
    "",
    "【健康の最適化】",
    nutritionAction,
    "",
    "【国づくり】",
    "長期の構想を支えるのは、今日も約束を守れる体力と自己統治です。最重要の仕事を一つ決め、運動後の集中時間に着手しましょう。",
    "",
    "【居心地のいいコミュニティ】",
    "一人に感謝を言葉で伝え、相手の調子を一つ質問してください。強い共同体は小さな安心の反復から育ちます。",
    "",
    "【弱点への一歩】",
    weaknessAction(weaknesses),
  ].join("\n");
}

function generateAdvice(
  digest: FitnessDigest,
  weaknesses: string,
): { content: string; source: "rules" } {
  return { content: buildPersonalizedAdvice(digest, weaknesses), source: "rules" };
}

async function sendLine(message: string): Promise<void> {
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  const groupId = Deno.env.get("LINE_GROUP_ID");
  if (!token || !groupId) throw new Error("LINE credentials not configured");

  const response = await fetch(LINE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: "text", text: message.slice(0, 4900) }],
    }),
  });
  if (!response.ok) {
    throw new Error(`LINE send failed [${response.status}]: ${await response.text()}`);
  }
}

async function authenticateRequest(req: Request, service: ReturnType<typeof createClient>) {
  const cronSecret = req.headers.get("x-kintore-cron-secret");
  if (cronSecret) {
    const { data, error } = await service.rpc("verify_kintore_cron_secret", { candidate: cronSecret });
    if (!error && data === true) return { mode: "cron" as const, userId: null };
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const jwt = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (jwt) {
    const { data, error } = await service.auth.getUser(jwt);
    if (!error && data.user) return { mode: "user" as const, userId: data.user.id };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase environment is incomplete" }, 500);

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const auth = await authenticateRequest(req, service);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "run-due");
    const dryRun = body?.dryRun === true;

    if (auth.mode === "user" && !["test", "preview"].includes(action)) {
      return jsonResponse({ error: "User sessions may only test or preview advice" }, 403);
    }
    if (auth.mode === "cron" && action !== "run-due") {
      return jsonResponse({ error: "Cron may only run due advice" }, 403);
    }

    let profiles: KintoreProfile[] = [];
    if (auth.mode === "user") {
      const { data, error } = await service
        .from("kintore_profiles")
        .select("user_id,goals,weaknesses,notification_enabled,notification_time,timezone")
        .eq("user_id", auth.userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: "先に通知設定を保存してください" }, 409);
      profiles = [data as KintoreProfile];
    } else {
      const { data, error } = await service
        .from("kintore_profiles")
        .select("user_id,goals,weaknesses,notification_enabled,notification_time,timezone")
        .eq("notification_enabled", true);
      if (error) throw error;
      profiles = (data ?? []) as KintoreProfile[];
    }

    const now = new Date();
    const results: Array<Record<string, unknown>> = [];

    for (const profile of profiles) {
      const local = localDateTime(now, profile.timezone || "Asia/Tokyo");
      if (auth.mode === "cron" && timeToMinutes(local.time) < timeToMinutes(profile.notification_time)) {
        results.push({ userId: profile.user_id, status: "not-due" });
        continue;
      }

      const isTest = auth.mode === "user";
      let deliveryId: number | null = null;
      if (!dryRun && action !== "preview") {
        if (!isTest) {
          const { data: existing, error: existingError } = await service
            .from("kintore_advice_deliveries")
            .select("id,status,created_at")
            .eq("user_id", profile.user_id)
            .eq("advice_date", local.date)
            .maybeSingle();
          if (existingError) throw existingError;

          const isFreshGeneration = existing?.status === "generating"
            && Date.now() - new Date(existing.created_at).getTime() < 60 * 60 * 1000;
          if (existing?.status === "sent" || isFreshGeneration) {
            results.push({
              userId: profile.user_id,
              status: existing.status === "sent" ? "already-sent" : "already-running",
              date: local.date,
            });
            continue;
          }
          if (existing) {
            const { error: retryError } = await service
              .from("kintore_advice_deliveries")
              .update({
                status: "generating",
                content: null,
                generation_source: null,
                error_message: null,
                sent_at: null,
                created_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
            if (retryError) throw retryError;
            deliveryId = Number(existing.id);
          }
        }

        if (deliveryId === null) {
          const { data: delivery, error: insertError } = await service
            .from("kintore_advice_deliveries")
            .insert({
              user_id: profile.user_id,
              advice_date: isTest ? null : local.date,
              is_test: isTest,
              status: "generating",
            })
            .select("id")
            .single();
          if (insertError?.code === "23505") {
            results.push({ userId: profile.user_id, status: "already-running", date: local.date });
            continue;
          }
          if (insertError) throw insertError;
          deliveryId = Number(delivery.id);
        }
      }

      try {
        const { data: snapshot, error: snapshotError } = await service
          .from("kintore_snapshots")
          .select("state,synced_at")
          .eq("user_id", profile.user_id)
          .maybeSingle();
        if (snapshotError) throw snapshotError;

        const digest = buildDigest(snapshot?.state ?? {}, local.date);
        const generated = generateAdvice(digest, profile.weaknesses ?? "");
        const title = isTest ? "🧪 筋トレMEMO 通知テスト" : "🌱 今日のコンディション戦略";
        const message = `${title}\n${local.displayDate}\n\n${generated.content}`;

        if (!dryRun && action !== "preview") await sendLine(message);

        if (deliveryId !== null) {
          await service
            .from("kintore_advice_deliveries")
            .update({
              status: "sent",
              content: message,
              generation_source: generated.source,
              sent_at: new Date().toISOString(),
              error_message: null,
            })
            .eq("id", deliveryId);
        }
        results.push({
          userId: profile.user_id,
          status: action === "preview" || dryRun ? "previewed" : "sent",
          date: local.date,
          generationSource: generated.source,
          ...(auth.mode === "user" && (action === "preview" || dryRun) ? { message } : {}),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (deliveryId !== null) {
          await service
            .from("kintore_advice_deliveries")
            .update({ status: "failed", error_message: message.slice(0, 2000) })
            .eq("id", deliveryId);
        }
        console.error("daily-kintore-advice profile failed", profile.user_id, error);
        results.push({ userId: profile.user_id, status: "failed", error: message });
      }
    }

    return jsonResponse({ success: true, action, dryRun, processed: results.length, results });
  } catch (error) {
    console.error("daily-kintore-advice failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
