import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, nextSession) => {
      applySession(nextSession);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        applySession(data.session);
      })
      .catch((error) => {
        console.error("Failed to load Supabase session", error);
        applySession(null);
      });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user, loading };
}
