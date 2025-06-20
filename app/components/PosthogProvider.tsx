"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, useState } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    try {
      if (
        typeof window === "undefined" ||
        !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
        !process.env.NEXT_PUBLIC_POSTHOG_HOST
      )
        return;
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        person_profiles: "always",
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Return children directly during SSR, only wrap with PHProvider on client
  if (!isClient) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
