"use client";

import { useId, useState } from "react";
import { DEFAULT_PARTICIPANT_EMOJI, EMOJI_CHOICES } from "@/lib/emoji";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EmojiField({ initialValue = "", disabled = false }: { initialValue?: string; disabled?: boolean }) {
  const id = useId();
  const [emoji, setEmoji] = useState(initialValue);
  return <div className="space-y-3">
    <Label htmlFor={id}>Emoji da pessoa</Label>
    <div className="flex items-center gap-3">
      <span aria-hidden className="text-3xl">{emoji || DEFAULT_PARTICIPANT_EMOJI}</span>
      <Input id={id} name="emoji" value={emoji} disabled={disabled} maxLength={32}
        className="w-28 text-center" placeholder="🎁" autoComplete="off"
        onChange={event => setEmoji(event.target.value)} aria-describedby={`${id}-help`} />
      <Button type="button" variant="ghost" disabled={disabled || !emoji} onClick={() => setEmoji("")}>Limpar</Button>
    </div>
    <div className="flex flex-wrap gap-1" role="group" aria-label="Escolher emoji">
      {EMOJI_CHOICES.map(choice => <Button key={choice} type="button" variant={emoji === choice ? "secondary" : "ghost"}
        size="icon" disabled={disabled} aria-label={`Usar ${choice}`} aria-pressed={emoji === choice} onClick={() => setEmoji(choice)}>
        <span className="text-xl">{choice}</span>
      </Button>)}
    </div>
    <p id={`${id}-help`} className="text-sm text-muted-foreground">Escolha ou cole um emoji. Ele aparece na animação de quem tirar esta pessoa. Sem escolha, usamos 🎁.</p>
  </div>;
}
