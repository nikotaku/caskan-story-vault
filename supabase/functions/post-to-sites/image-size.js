// Node/Vercelは実行時拡張子として.jsを要求し、Nodeのstrip-typesと
// Supabase Edgeは明示した.tsを読める。実装は1か所のまま両環境へ橋渡しする。
export * from "./image-size.ts";
