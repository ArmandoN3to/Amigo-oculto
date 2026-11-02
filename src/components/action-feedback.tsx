"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Result = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export function useOperation() {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Result | null>(null);
  const router = useRouter();
  function run(
    operation: () => Promise<Result>,
    onSuccess?: (result: Result) => void,
  ) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await operation();
        setFeedback(result);
        if (result.ok) {
          onSuccess?.(result);
          router.refresh();
        }
      } catch {
        setFeedback({
          ok: false,
          message:
            "Não foi possível concluir agora. Confira sua conexão e tente novamente.",
        });
      }
    });
  }
  return { pending, feedback, run, clearFeedback: () => setFeedback(null) };
}

export function ActionFeedback({ feedback }: { feedback: Result | null }) {
  if (!feedback) return null;
  return (
    <Alert
      variant={feedback.ok ? "default" : "destructive"}
      role={feedback.ok ? "status" : "alert"}
      className={feedback.ok ? "border-primary/20 bg-primary/5" : ""}
    >
      <AlertDescription>
        <p>{feedback.message}</p>
        {feedback.fieldErrors ? (
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {[...new Set(Object.values(feedback.fieldErrors).flat())].map(
              (message) => <li key={message}>{message}</li>,
            )}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
