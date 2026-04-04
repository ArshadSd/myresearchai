import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, Zap, Shield, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const RAZORPAY_KEY = "rzp_test_SXjtYOK29LwkcB";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const plans = [
  {
    id: "basic" as const,
    name: "Basic",
    icon: Shield,
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "2 chats per day",
      "1 scheduler per month",
      "Unlock 1 day at a time",
      "Basic document analysis",
      "Community support",
    ],
    color: "from-muted to-muted/50",
    badge: null,
  },
  {
    id: "pro" as const,
    name: "Pro",
    icon: Zap,
    monthlyPrice: 100,
    yearlyPrice: 1000,
    features: [
      "5 chats per day",
      "3 schedulers per month",
      "Unlock up to 7 days at once",
      "Advanced document analysis",
      "Priority support",
      "All themes unlocked",
    ],
    color: "from-primary/20 to-primary/5",
    badge: "Popular",
  },
  {
    id: "premium" as const,
    name: "Premium",
    icon: Crown,
    monthlyPrice: 250,
    yearlyPrice: 2500,
    features: [
      "Unlimited chats",
      "Unlimited schedulers",
      "Unlimited day unlocks",
      "Advanced AI models",
      "Priority support 24/7",
      "All features unlocked",
      "Early access to new features",
    ],
    color: "from-yellow-500/20 to-amber-500/5",
    badge: "Best Value",
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const { user } = useAuth();
  const { subscription, currentPlan, refetch } = useSubscription();
  const { toast } = useToast();

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async (planId: "pro" | "premium", isTrial: boolean = false) => {
    if (!user) return;
    setProcessing(planId);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast({ title: "Error", description: "Payment gateway failed to load", variant: "destructive" }); setProcessing(null); return; }

      const billingCycle = yearly ? "yearly" : "monthly";
      
      if (isTrial) {
        // For trial, directly activate without payment
        const { data, error } = await supabase.functions.invoke("razorpay-verify", {
          body: {
            razorpay_order_id: `trial_${Date.now()}`,
            razorpay_payment_id: `trial_${Date.now()}`,
            razorpay_signature: "trial",
            plan: planId,
            billing_cycle: billingCycle,
            is_trial: true,
          },
        });
        
        // For trial, we skip signature verification on backend
        await refetch();
        toast({ title: "🎉 Trial Activated!", description: `Your 7-day ${planId} trial has started. Enjoy all features!` });
        setProcessing(null);
        return;
      }

      // Create order
      const { data: orderData, error: orderErr } = await supabase.functions.invoke("razorpay-order", {
        body: { plan: planId, billing_cycle: billingCycle },
      });

      if (orderErr || orderData?.error) {
        toast({ title: "Error", description: orderData?.error || "Failed to create order", variant: "destructive" });
        setProcessing(null);
        return;
      }

      const options = {
        key: RAZORPAY_KEY,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Research AI",
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan - ${billingCycle}`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          // Verify payment
          const { data: verifyData, error: verifyErr } = await supabase.functions.invoke("razorpay-verify", {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: planId,
              billing_cycle: billingCycle,
              is_trial: false,
            },
          });

          if (verifyErr || verifyData?.error) {
            toast({ title: "Verification Failed", description: "Payment could not be verified", variant: "destructive" });
          } else {
            await refetch();
            toast({ title: "🎉 Payment Successful!", description: `You're now on the ${planId} plan!` });
          }
          setProcessing(null);
        },
        prefill: { email: user.email },
        theme: { color: "#4F46E5" },
        modal: { ondismiss: () => setProcessing(null) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setProcessing(null);
    }
  };

  const isCurrentPlan = (planId: string) => currentPlan === planId;
  const isUpgrade = (planId: string) => {
    const order = ["basic", "pro", "premium"];
    return order.indexOf(planId) > order.indexOf(currentPlan);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-1">Unlock the full power of Research AI</p>
      </motion.div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn("text-sm font-medium", !yearly && "text-primary")}>Monthly</span>
        <Switch checked={yearly} onCheckedChange={setYearly} />
        <span className={cn("text-sm font-medium", yearly && "text-primary")}>
          Yearly <Badge variant="secondary" className="ml-1 text-xs">Save 17%</Badge>
        </span>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, i) => (
          <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className={cn(
              "relative overflow-hidden border-border/50 transition-all duration-300 hover:shadow-lg",
              isCurrentPlan(plan.id) && "ring-2 ring-primary",
              plan.id === "pro" && "border-primary/50"
            )}>
              {plan.badge && (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-primary text-primary-foreground text-xs">{plan.badge}</Badge>
                </div>
              )}
              <div className={cn("absolute inset-0 bg-gradient-to-b opacity-30", plan.color)} />
              <CardHeader className="relative pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <plan.icon className="h-6 w-6 text-primary" />
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    {plan.monthlyPrice === 0 ? "Free" : `₹${yearly ? plan.yearlyPrice : plan.monthlyPrice}`}
                  </span>
                  {plan.monthlyPrice > 0 && (
                    <span className="text-muted-foreground text-sm">/{yearly ? "year" : "month"}</span>
                  )}
                </div>
                {isCurrentPlan(plan.id) && (
                  <Badge variant="outline" className="w-fit mt-2 text-xs border-primary text-primary">Current Plan</Badge>
                )}
              </CardHeader>
              <CardContent className="relative space-y-4">
                <ul className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.id === "basic" ? (
                  isCurrentPlan("basic") ? (
                    <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>Downgrade not available</Button>
                  )
                ) : isCurrentPlan(plan.id) ? (
                  <Button variant="outline" className="w-full" disabled>
                    {subscription?.status === "trialing" ? "Trial Active" : "Current Plan"}
                  </Button>
                ) : isUpgrade(plan.id) ? (
                  <div className="space-y-2">
                    <Button
                      className="w-full gap-2"
                      onClick={() => handleSubscribe(plan.id as "pro" | "premium")}
                      disabled={processing !== null}
                    >
                      {processing === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {processing === plan.id ? "Processing..." : `Upgrade to ${plan.name}`}
                    </Button>
                    {currentPlan === "basic" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground hover:text-primary"
                        onClick={() => handleSubscribe(plan.id as "pro" | "premium", true)}
                        disabled={processing !== null}
                      >
                        Start 7-day free trial
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" disabled>N/A</Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Current subscription info */}
      {subscription && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Card className="border-border/50">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">Subscription Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Plan</p>
                  <p className="font-medium capitalize">{subscription.plan}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{subscription.status}</p>
                </div>
                {subscription.trial_ends_at && (
                  <div>
                    <p className="text-muted-foreground">Trial Ends</p>
                    <p className="font-medium">{new Date(subscription.trial_ends_at).toLocaleDateString()}</p>
                  </div>
                )}
                {subscription.current_period_end && (
                  <div>
                    <p className="text-muted-foreground">Next Billing</p>
                    <p className="font-medium">{new Date(subscription.current_period_end).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
