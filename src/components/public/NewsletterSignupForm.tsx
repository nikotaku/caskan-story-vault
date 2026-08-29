import { useState } from "react";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewsletterSignupFormProps {
  storeId: string | null;
}

export function NewsletterSignupForm({ storeId }: NewsletterSignupFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !storeId || submitting) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("newsletter-signup", {
        body: { email: email.trim(), name: name.trim(), storeId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "登録に失敗しました。");

      toast.success(data.message || "メルマガ登録が完了しました。");
      setEmail("");
      setName("");
    } catch (error) {
      console.error("Newsletter signup error", error);
      toast.error(error instanceof Error ? error.message : "登録に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="お名前（任意）"
          className="w-full px-4 py-3 rounded-lg border border-[var(--pub-light-border,#e5d5cc)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--pub-light-accent,#c49480)] focus:border-transparent"
          style={{ color: "var(--pub-light-text-strong,#5a5550)" }}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          required
          className="w-full px-4 py-3 rounded-lg border border-[var(--pub-light-border,#e5d5cc)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--pub-light-accent,#c49480)] focus:border-transparent"
          style={{ color: "var(--pub-light-text-strong,#5a5550)" }}
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !email.trim() || !storeId}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[var(--pub-light-accent,#c49480)] hover:bg-[#b08370] text-white font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Mail size={18} />
        {submitting ? "登録中..." : "メルマガに登録する"}
      </button>
      <p className="text-xs text-center" style={{ color: "var(--pub-light-text-muted,#a89586)" }}>
        登録後、いつでも配信停止できます。
      </p>
    </form>
  );
}
