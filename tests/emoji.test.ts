import { expect, it } from "vitest";
import { isSingleEmoji } from "../src/lib/emoji";
it("aceita um único emoji incluindo sequências e rejeita texto ou múltiplos",()=>{
  for(const value of ["💀","❤️","👨‍👩‍👧‍👦","👍🏽","🇧🇷","1️⃣"]) expect(isSingleEmoji(value),value).toBe(true);
  for(const value of ["","texto","a💀","💀🔥"," ","1"]) expect(isSingleEmoji(value),value).toBe(false);
});
