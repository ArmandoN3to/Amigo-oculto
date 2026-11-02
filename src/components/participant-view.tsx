"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { ParticipantPage } from "@/lib/types";
import { saveWishlistAction } from "@/server/actions";
import { GiftMark } from "@/components/family-shell";
import { Button } from "@/components/ui/button";
import { RecipientReveal } from "@/components/recipient-reveal";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { wishlistItems, WISHLIST_ITEM_MAX_LENGTH, WISHLIST_MAX_LENGTH } from "@/lib/wishlist";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActionFeedback, useOperation } from "@/components/action-feedback";

export function ParticipantView({
  token,
  participant,
}: {
  token: string;
  participant: ParticipantPage;
}) {
  const [wishlist, setWishlist] = useState(participant.self.wishlistText);
  const [suggestion, setSuggestion] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef(false);
  const { pending, feedback, run, clearFeedback } = useOperation();
  const items = wishlistItems(wishlist);
  const nextWishlist = [...items, suggestion.trim()].join("\n");
  const listFull = nextWishlist.length > WISHLIST_MAX_LENGTH;

  useEffect(() => {
    if (!pending && restoreFocus.current) {
      inputRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [pending]);

  function saveItems(nextItems: string[], added = false) {
    if (pending) return;
    const text = nextItems.join("\n");
    run(() => saveWishlistAction({ token, wishlistText: text, expectedWishlistText: wishlist }), () => {
      setWishlist(text);
      if (added) setSuggestion("");
      restoreFocus.current = true;
    });
  }
  return (
    <div className="space-y-7">
      <section
        className="rounded-2xl bg-primary p-6 text-primary-foreground sm:p-8"
        aria-labelledby="draw-heading"
      >
        <GiftMark className="mb-4 size-9 text-[#e8cc93]" />
        <h2 id="draw-heading" className="text-2xl font-semibold">
          {participant.recipient
            ? "Seu amigo oculto está aqui"
            : "A surpresa está sendo preparada"}
        </h2>
        {participant.recipient ? (
          <RecipientReveal key={participant.recipient.name + participant.recipient.emoji} recipient={participant.recipient} />
        ) : (
          <p className="mt-3 max-w-lg leading-relaxed text-white/85">
            Enquanto o organizador prepara o sorteio, você já pode deixar suas
            sugestões abaixo. Seu resultado também chegará por e-mail.
          </p>
        )}
      </section>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>O que você gostaria de ganhar?</CardTitle>
          <CardDescription>
            Adicione uma ideia por vez. Você pode incluir tamanho, cor ou outro
            detalhe em cada sugestão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            aria-busy={pending}
            onSubmit={(e) => {
              e.preventDefault();
              if (suggestion.trim() && !listFull) saveItems([...items, suggestion.trim()], true);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="wishlist-suggestion">Nova sugestão</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  id="wishlist-suggestion"
                  name="suggestion"
                  className="h-11 flex-1"
                  placeholder="Ex.: camiseta azul, tamanho M"
                  maxLength={WISHLIST_ITEM_MAX_LENGTH}
                  value={suggestion}
                  disabled={pending}
                  onChange={(e) => { setSuggestion(e.target.value); clearFeedback(); }}
                  aria-describedby="wishlist-help wishlist-count"
                />
                <Button type="submit" className="h-11 shrink-0" disabled={pending || !suggestion.trim() || listFull}>
                  Adicionar
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id="wishlist-help" className="text-sm text-muted-foreground">
                Até 120 caracteres por sugestão.
              </p>
              <span id="wishlist-count" className="text-xs tabular-nums text-muted-foreground">
                {suggestion.length}/{WISHLIST_ITEM_MAX_LENGTH}
              </span>
            </div>
            {listFull ? <p role="alert" className="text-sm text-destructive">Sua lista atingiu o limite de 5.000 caracteres. Remova uma sugestão para adicionar outra.</p> : null}
            {items.length ? (
              <ul aria-label="Suas sugestões salvas" className="divide-y divide-border">
                {items.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 py-3">
                    <p className="min-w-0 flex-1 break-words pt-2 text-sm leading-relaxed [overflow-wrap:anywhere]">{item}</p>
                    <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" disabled={pending} aria-label={`Remover sugestão: ${item}`} onClick={() => saveItems(items.filter((_, itemIndex) => itemIndex !== index))}>
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : <p className="py-3 text-sm text-muted-foreground">Você ainda não adicionou sugestões. Comece com algo que gostaria de ganhar.</p>}
            {pending ? <p role="status" className="text-sm text-muted-foreground">Salvando alteração…</p> : null}
            <ActionFeedback feedback={feedback} />
            <p className="text-sm text-muted-foreground">Você pode adicionar ou remover sugestões mesmo depois do sorteio.</p>
          </form>
        </CardContent>
      </Card>
      <p className="px-1 text-sm leading-relaxed text-muted-foreground">
        Guarde este link para voltar quando quiser. Ele dá acesso às suas
        sugestões e ao seu resultado, então mantenha-o só com você.
      </p>
    </div>
  );
}
