import { randomInt } from "node:crypto";
import { AppError } from "./errors";

export interface DrawPair { giverId: string; receiverId: string }
export function secureShuffle<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

// Randomized augmenting-path matching is complete: unlike repeated random
// guessing, it terminates even when directed exclusions make a draw impossible.
// Randomness breaks ties; matchings are not claimed to be uniformly distributed.
export function makeDraw(participantIds: readonly string[], exclusions: readonly DrawPair[] = []): DrawPair[] {
  if (participantIds.length < 2) throw new AppError("Adicione pelo menos 2 participantes para sortear.");
  if (new Set(participantIds).size !== participantIds.length) throw new AppError("Há participantes duplicados no sorteio.");
  const blocked = new Set(exclusions.map(pair => `${pair.giverId}:${pair.receiverId}`));
  const candidates = new Map(participantIds.map(giver => [giver, secureShuffle(participantIds.filter(receiver => receiver !== giver && !blocked.has(`${giver}:${receiver}`)))]));
  const receiverToGiver = new Map<string, string>();
  function augment(giver: string, seen: Set<string>): boolean {
    for (const receiver of candidates.get(giver)!) {
      if (seen.has(receiver)) continue;
      seen.add(receiver);
      const previous = receiverToGiver.get(receiver);
      if (!previous || augment(previous, seen)) {
        receiverToGiver.set(receiver, giver);
        return true;
      }
    }
    return false;
  }
  for (const giver of secureShuffle(participantIds)) {
    if (!augment(giver, new Set())) throw new AppError("Não é possível sortear com as restrições atuais. Remova alguma restrição ou adicione participantes.", "IMPOSSIBLE_DRAW");
  }
  return [...receiverToGiver].map(([receiverId, giverId]) => ({ giverId, receiverId }));
}
