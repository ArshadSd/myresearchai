import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PlanType = "basic" | "pro" | "premium";

export interface Subscription {
  id: string;
  user_id: string;
  plan: PlanType;
  billing_cycle: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  razorpay_subscription_id: string | null;
  razorpay_payment_id: string | null;
}

export interface UsageInfo {
  chats_used: number;
  schedulers_created: number;
}

const PLAN_LIMITS = {
  basic: { chats_per_day: 2, schedulers_per_month: 1, max_unlock_per_day: 1 },
  pro: { chats_per_day: 5, schedulers_per_month: 3, max_unlock_per_day: 7 },
  premium: { chats_per_day: Infinity, schedulers_per_month: Infinity, max_unlock_per_day: Infinity },
};

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageInfo>({ chats_used: 0, schedulers_created: 0 });
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      // Check if subscription has expired
      if (data.current_period_end && new Date(data.current_period_end) < new Date()) {
        // Expired, downgrade to basic
        await supabase.from("subscriptions").update({ plan: "basic", status: "active", trial_ends_at: null }).eq("user_id", user.id);
        setSubscription({ ...data, plan: "basic", status: "active" } as Subscription);
      } else if (data.status === "trialing" && data.trial_ends_at && new Date(data.trial_ends_at) < new Date()) {
        await supabase.from("subscriptions").update({ plan: "basic", status: "active", trial_ends_at: null }).eq("user_id", user.id);
        setSubscription({ ...data, plan: "basic", status: "active" } as Subscription);
      } else {
        setSubscription(data as Subscription);
      }
    } else {
      // Create basic subscription for existing user
      const { data: newSub } = await supabase
        .from("subscriptions")
        .insert({ user_id: user.id, plan: "basic", status: "active" })
        .select()
        .single();
      if (newSub) setSubscription(newSub as Subscription);
    }

    // Fetch today's usage
    const today = new Date().toISOString().split("T")[0];
    const { data: usageData } = await supabase
      .from("daily_usage")
      .select("*")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle();

    if (usageData) {
      setUsage({ chats_used: usageData.chats_used, schedulers_created: usageData.schedulers_created });
    } else {
      setUsage({ chats_used: 0, schedulers_created: 0 });
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const currentPlan = (subscription?.plan as PlanType) || "basic";
  const limits = PLAN_LIMITS[currentPlan];

  const canCreateChat = () => usage.chats_used < limits.chats_per_day;

  const canCreateScheduler = () => {
    if (currentPlan === "premium") return true;
    // For basic/pro, check monthly scheduler count
    return true; // We'll check monthly in the component
  };

  const incrementChatUsage = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("daily_usage")
      .select("*")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle();

    if (existing) {
      await supabase.from("daily_usage").update({ chats_used: existing.chats_used + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("daily_usage").insert({ user_id: user.id, usage_date: today, chats_used: 1 });
    }
    setUsage(prev => ({ ...prev, chats_used: prev.chats_used + 1 }));
  };

  const incrementSchedulerUsage = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("daily_usage")
      .select("*")
      .eq("user_id", user.id)
      .eq("usage_date", today)
      .maybeSingle();

    if (existing) {
      await supabase.from("daily_usage").update({ schedulers_created: existing.schedulers_created + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("daily_usage").insert({ user_id: user.id, usage_date: today, schedulers_created: 1 });
    }
    setUsage(prev => ({ ...prev, schedulers_created: prev.schedulers_created + 1 }));
  };

  const getMonthlySchedulerCount = async (): Promise<number> => {
    if (!user) return 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from("schedulers")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startOfMonth);
    return count || 0;
  };

  return {
    subscription,
    usage,
    loading,
    currentPlan,
    limits,
    canCreateChat,
    canCreateScheduler,
    incrementChatUsage,
    incrementSchedulerUsage,
    getMonthlySchedulerCount,
    refetch: fetchSubscription,
  };
}
