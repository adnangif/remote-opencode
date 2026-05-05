"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold">Remote Control</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to your account
        </p>
        <Button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          size="lg"
        >
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
