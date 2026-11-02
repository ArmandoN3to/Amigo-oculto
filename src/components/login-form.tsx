"use client";

import { useRouter } from "next/navigation";
import { loginAction } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionFeedback, useOperation } from "@/components/action-feedback";

export function LoginForm() {
  const { pending, feedback, run } = useOperation();
  const router = useRouter();
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(
          () =>
            loginAction({
              email: String(data.get("email")),
              password: String(data.get("password")),
            }),
          () => router.replace("/admin"),
        );
      }}
      aria-busy={pending}
    >
      <div className="space-y-2">
        <Label htmlFor="email">E-mail do organizador</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <ActionFeedback feedback={feedback} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
