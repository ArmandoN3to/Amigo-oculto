"use client";

import { useMemo, useState } from "react";
import type { ParticipantPage } from "@/lib/types";
import { DEFAULT_PARTICIPANT_EMOJI } from "@/lib/emoji";
import { wishlistItems } from "@/lib/wishlist";
import { Button } from "@/components/ui/button";
import { EmojiBurstButton } from "@/components/ui/button-32";
import { WishlistPhotoLink } from "@/components/wishlist-photo-link";

export function RecipientReveal({ token, recipient }: { token: string; recipient: NonNullable<ParticipantPage["recipient"]> }) {
  const [revealed, setRevealed] = useState(false);
  const emojis = useMemo(() => [recipient.emoji || DEFAULT_PARTICIPANT_EMOJI], [recipient.emoji]);
  const items = wishlistItems(recipient.wishlistText);
  return <>
    {!revealed ? <p className="mb-6 mt-3 max-w-lg leading-relaxed text-white/85">
      Encontre um lugar tranquilo e descubra quem vai receber seu presente.
    </p> : null}
    {/* Keep the button and its portal mounted while the result appears. */}
    <EmojiBurstButton variant="secondary" className={revealed ? "mt-5" : undefined}
      emojis={emojis} onReact={() => setRevealed(true)} aria-expanded={revealed} aria-controls="recipient-result">
      {revealed ? "Celebrar de novo" : "Descobrir meu amigo oculto"}
    </EmojiBurstButton>
    {revealed ? <div id="recipient-result" className="mt-5" aria-live="polite">
      <p className="text-sm text-white/75">Você tirou</p>
      <p className="mt-1 break-words text-3xl font-semibold sm:text-4xl">
        {recipient.name} <span aria-hidden>{emojis[0]}</span>
      </p>
      <div className="mt-6 rounded-xl bg-white/10 p-5">
        <h3 className="font-semibold">Sugestões de presentes</h3>
        {items.length ? <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-white/90">
          {items.map((item, index) => {
            const photoId = recipient.photoIds?.[index];
            return <li key={index} className="break-words [overflow-wrap:anywhere]">
              <div className="flex flex-wrap items-center gap-x-2">
                <span>{item}</span>
                {photoId ? <WishlistPhotoLink token={token} photoId={photoId} suggestion={item}
                  className="h-11 text-white hover:bg-white/10 hover:text-white" /> : null}
              </div>
            </li>;
          })}
        </ul> : <p className="mt-3 leading-relaxed text-white/90">Seu amigo oculto ainda não escreveu sugestões. Volte mais tarde para conferir.</p>}
      </div>
      <Button variant="ghost" className="mt-4 text-white hover:bg-white/10 hover:text-white" onClick={() => setRevealed(false)}>
        Ocultar resultado
      </Button>
    </div> : null}
  </>;
}
