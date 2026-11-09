"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { ParticipantPage } from "@/lib/types";
import { saveWishlistAction } from "@/server/actions";
import { GiftMark } from "@/components/family-shell";
import { Button } from "@/components/ui/button";
import { RecipientReveal } from "@/components/recipient-reveal";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { WishlistPhotoLink } from "@/components/wishlist-photo-link";
import {
  wishlistItems, WISHLIST_ITEM_MAX_LENGTH, WISHLIST_MAX_LENGTH, WISHLIST_MAX_PHOTOS,
  WISHLIST_PHOTO_MAX_BYTES, WISHLIST_PHOTO_TOO_LARGE,
} from "@/lib/wishlist";
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
  const { wishlistText: wishlist, wishlistRevision, photoIds } = participant.self;
  const [suggestion, setSuggestion] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTarget = useRef<number | undefined>(undefined);
  const restoreFocus = useRef(false);
  const { pending, feedback, run, clearFeedback } = useOperation();
  const items = wishlistItems(wishlist);
  const nextWishlist = [...items, suggestion.trim()].join("\n");
  const listFull = nextWishlist.length > WISHLIST_MAX_LENGTH;
  const photosFull = Object.keys(photoIds).length >= WISHLIST_MAX_PHOTOS;

  useEffect(() => {
    if (!pending && restoreFocus.current) {
      inputRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [pending]);

  function saveItems(text: string, options: { added?: boolean; removedIndex?: number; photoIndex?: number; file?: File } = {}) {
    if (pending) return;
    let upload: FormData | undefined;
    if (options.file) {
      upload = new FormData();
      upload.set("photo", options.file);
    }
    setPhotoError("");
    run(() => saveWishlistAction({
      token, wishlistText: text, expectedWishlistText: wishlist, expectedRevision: wishlistRevision,
      removedIndex: options.removedIndex, photoIndex: options.photoIndex,
    }, upload), () => {
      if (options.added) {
        setSuggestion("");
        setPhoto(null);
      }
      restoreFocus.current = true;
    });
  }

  function choosePhoto(index?: number) {
    photoTarget.current = index;
    photoInputRef.current?.click();
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
          <RecipientReveal key={participant.recipient.name + participant.recipient.emoji} token={token} recipient={participant.recipient} />
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
              if (suggestion.trim() && !listFull) saveItems(nextWishlist, { added: true, file: photo ?? undefined });
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
                <Button type="button" variant="outline" className="h-11 px-3" disabled={pending || photosFull}
                  aria-label="Incluir foto na nova sugestão" aria-describedby="wishlist-photo-help"
                  title="Incluir foto" onClick={() => choosePhoto()}>
                  <ImagePlus aria-hidden="true" />
                  <span className="hidden sm:inline">Foto</span>
                </Button>
                <Button type="submit" className="h-11 shrink-0" disabled={pending || !suggestion.trim() || listFull || (photosFull && !!photo)}>
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
            <input type="file" ref={photoInputRef} hidden disabled={pending}
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                const index = photoTarget.current;
                clearFeedback();
                if (file.size > WISHLIST_PHOTO_MAX_BYTES) {
                  setPhotoError(WISHLIST_PHOTO_TOO_LARGE);
                  return;
                }
                setPhotoError("");
                if (index === undefined) setPhoto(file);
                else saveItems(wishlist, { photoIndex: index, file });
              }}
            />
            <p id="wishlist-photo-help" className="text-xs text-muted-foreground">
              {photosFull
                ? `Sua lista atingiu o limite de ${WISHLIST_MAX_PHOTOS} fotos.`
                : "Foto opcional em JPG, PNG ou WebP, até 3 MB."}
            </p>
            {photo ? (
              <div className="flex items-center gap-2 rounded-lg border border-border px-3">
                <p className="min-w-0 flex-1 truncate text-sm" title={photo.name}>{photo.name}</p>
                <Button type="button" variant="ghost" className="h-11" disabled={pending}
                  onClick={() => { setPhoto(null); setPhotoError(""); clearFeedback(); }}>
                  Remover foto
                </Button>
              </div>
            ) : null}
            {photoError ? <p role="alert" className="text-sm text-destructive">{photoError}</p> : null}
            {listFull ? <p role="alert" className="text-sm text-destructive">Sua lista atingiu o limite de 5.000 caracteres. Remova uma sugestão para adicionar outra.</p> : null}
            {items.length ? (
              <ul aria-label="Suas sugestões salvas" className="divide-y divide-border">
                {items.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 py-3">
                    <p className="min-w-0 flex-1 break-words pt-2 text-sm leading-relaxed [overflow-wrap:anywhere]">{item}</p>
                    {photoIds[index] ? (
                      <WishlistPhotoLink token={token} photoId={photoIds[index]} suggestion={item} className="h-11" />
                    ) : (
                      <Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground"
                        disabled={pending || photosFull} aria-label={`Incluir foto em ${item}`} title="Incluir foto"
                        onClick={() => choosePhoto(index)}>
                        <ImagePlus aria-hidden="true" />
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" disabled={pending} aria-label={`Remover sugestão: ${item}`} onClick={() => saveItems(items.filter((_, itemIndex) => itemIndex !== index).join("\n"), { removedIndex: index })}>
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
