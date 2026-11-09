import type { WishlistPhotoIds } from "./wishlist";

export type EventStatus = "draft" | "drawn";
export type EmailStatus = "pending" | "sent" | "failed";

export interface PublicEvent {
  id: string;
  name: string;
  eventDate: string;
  giftLimit: number | null;
  status: EventStatus;
  participantCount: number;
}
export interface AdminParticipant {
  id: string;
  name: string;
  email: string;
  emoji: string;
  emailStatus: EmailStatus | null;
  emailError: string | null;
  emailAttempts: number;
}
export interface AdminEvent extends PublicEvent {
  participants: AdminParticipant[];
  exclusions: { giverId: string; receiverId: string }[];
  drawVersion: number;
}
export interface RuntimeStatus {
  adminConfigured: boolean;
  emailConfigured: boolean;
  emailConfigurationIssues: string[];
  emailWarnings: string[];
  storageMode: "local" | "postgres";
}
export interface AdminDashboard extends RuntimeStatus {
  events: PublicEvent[];
  selectedEvent: AdminEvent | null;
}
export interface ParticipantPage {
  event: PublicEvent;
  self: { name: string; wishlistText: string; wishlistRevision: number; photoIds: WishlistPhotoIds };
  recipient: { name: string; emoji: string; wishlistText: string; photoIds?: WishlistPhotoIds } | null;
}
export interface ActionResult {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
  eventId?: string;
}
