import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WishlistPhotoLink({ token, photoId, suggestion, className }: {
  token: string;
  photoId: string;
  suggestion: string;
  className?: string;
}) {
  return (
    <Button asChild variant="ghost" className={className}>
      <a href={`/participante/${token}/fotos/${photoId}`} target="_blank" rel="noreferrer"
        aria-label={`Ver foto de ${suggestion} (abre em outra aba)`}>
        <Eye aria-hidden="true" />
        Ver foto
      </a>
    </Button>
  );
}
