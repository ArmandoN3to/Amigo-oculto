export const DEFAULT_PARTICIPANT_EMOJI = "🎁";
export const EMOJI_CHOICES = ["💀", "😂", "❤️", "🎉", "🐱", "🔥", "🌻", "⚽", "👑", "🦋", "🚀", "🎁"];

const segmenter = new Intl.Segmenter("pt-BR", { granularity: "grapheme" });
export function isSingleEmoji(value: string): boolean {
  return value.length <= 32 && [...segmenter.segment(value)].length === 1 &&
    /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u.test(value);
}
