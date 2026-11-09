import { getDb } from "@/lib/db";
import { resolveParticipant } from "@/lib/tokens";
import { idSchema } from "@/lib/validations";

export const runtime = "nodejs";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; photoId: string }> },
) {
  const { token, photoId } = await params;
  const notFound = () => new Response(null, { status: 404, headers });
  if (!idSchema.safeParse(photoId).success) return notFound();
  const viewer = await resolveParticipant(token);
  if (!viewer) return notFound();

  const result = await (await getDb()).query<{ content: Uint8Array }>(`
    SELECT photo.content
    FROM wishlist_photos photo
    JOIN participants viewer ON viewer.id=$2 AND viewer.access_token_hash=$3
    WHERE photo.id=$1 AND (
      photo.participant_id=viewer.id OR EXISTS (
        SELECT 1 FROM draws d JOIN events e ON e.id=d.event_id
        WHERE d.event_id=viewer.event_id AND d.giver_id=viewer.id AND d.receiver_id=photo.participant_id
          AND e.status='drawn' AND e.draw_version=d.draw_version
      )
    )`, [photoId, viewer.id, viewer.access_token_hash]);
  const photo = result.rows[0];
  if (!photo) return notFound();
  return new Response(new Uint8Array(photo.content), {
    headers: { ...headers, "Content-Type": "image/webp" },
  });
}
