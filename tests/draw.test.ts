import { describe, expect, it } from "vitest";
import { makeDraw, type DrawPair } from "../src/lib/draw";

describe("sorteio com restrições direcionais", () => {
  for (const size of [2, 3, 10, 30]) {
    it(`preserva uma bijeção sem autoatribuição com ${size} pessoas`, () => {
      const ids = Array.from({ length: size }, (_, index) => `person-${index}`);
      for (let run = 0; run < 30; run++) {
        const pairs = makeDraw(ids);
        expect(pairs).toHaveLength(size);
        expect(new Set(pairs.map(pair => pair.giverId))).toEqual(new Set(ids));
        expect(new Set(pairs.map(pair => pair.receiverId))).toEqual(new Set(ids));
        expect(pairs.every(pair => pair.giverId !== pair.receiverId)).toBe(true);
      }
    });
  }
  it("detecta impossibilidade em vez de tentar embaralhar indefinidamente", () => {
    expect(() => makeDraw(["a", "b"], [{ giverId: "a", receiverId: "b" }])).toThrow(/Não é possível/);
    expect(() => makeDraw(["a"])).toThrow(/pelo menos 2/);
  });
  it("encontra solução para todos os grafos direcionais possíveis de três pessoas quando ela existe", () => {
    const ids = ["a", "b", "c"];
    const edges: DrawPair[] = ids.flatMap(giverId => ids.filter(receiverId => receiverId !== giverId).map(receiverId => ({ giverId, receiverId })));
    const permutations = [["a", "b", "c"], ["a", "c", "b"], ["b", "a", "c"], ["b", "c", "a"], ["c", "a", "b"], ["c", "b", "a"]];
    for (let mask = 0; mask < 64; mask++) {
      const excluded = edges.filter((_, index) => mask & 1 << index);
      const exists = permutations.some(receivers => ids.every((giver, index) => giver !== receivers[index] && !excluded.some(rule => rule.giverId === giver && rule.receiverId === receivers[index])));
      if (!exists) expect(() => makeDraw(ids, excluded)).toThrow(/Não é possível/);
      else {
        const result = makeDraw(ids, excluded);
        expect(result.every(pair => !excluded.some(rule => rule.giverId === pair.giverId && rule.receiverId === pair.receiverId))).toBe(true);
      }
    }
  });
});
