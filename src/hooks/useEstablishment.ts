import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { fetchMyEstablishment, type Establishment } from "@/lib/api";

export function useSessionUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { userId, email, loading };
}

export function useMyEstablishment(userId: string | null) {
  return useQuery<Establishment | null>({
    queryKey: ["my-establishment", userId],
    queryFn: () => fetchMyEstablishment(userId as string),
    enabled: !!userId,
    staleTime: 30_000,
  });
}
