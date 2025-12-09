import { useEffect, useState } from "react";
import { X, Music } from "lucide-react"
import { UploadFile } from "./page";
import { apiGetFileById } from "@/lib/api";
import { API_BASE } from "@/lib/api";

type Quality = "original" | "360p" | "720p" | "1080p";

export function MediaViewerModal({ file, onClose }: { file: UploadFile; onClose: () => void }) {
  const [quality, setQuality] = useState<Quality>("720p")
  const fileId = file.id ?? null;
  const [availableQualities, setAvailableQualities] = useState<Quality[]>(["original"]);
  const [originalFile, setOriginalFile] = useState<string | null>(null)

  function getVideoUrl(quality: Quality): string {
    return `${API_BASE}/media/video/${fileId}?quality=${quality}`
  }

  useEffect(() => {
    if (!fileId) return;

    let cancelled = false;

    async function fetchMedia() {
        try {
        const response = await apiGetFileById(fileId);

        if (cancelled) return;

        if (response.mediaType === "image") {
            setOriginalFile(response.original?.data_url ?? null);
            return;
        }

        if (response.mediaType === "video") {
            const qs: Quality[] = ["original"];

            if (response.variants?.["360p"]) qs.push("360p");
            if (response.variants?.["720p"]) qs.push("720p");
            if (response.variants?.["1080p"]) qs.push("1080p");

            setAvailableQualities(qs);

            // se a qualidade atual não existir, volta pra primeira disponível
            if (!qs.includes(quality)) {
            setQuality(qs[0]);
            }

            return;
        }

        // outros tipos (audio/other) você pode tratar depois
        } catch (error) {
        console.error("Error fetching media:", error);
        }
    }

    fetchMedia();

    return () => {
        cancelled = true;
    };
    }, [fileId]);

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB"
    return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-auto rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-6 py-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground truncate">{file.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="capitalize">{file.mediaType}</span>
              {/* <span>•</span>
              <span>{formatFileSize(file.size ?? 0)}</span> */}
              <span>•</span>
              <span>
                {new Date(file.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Media Player */}
        <div className="p-6">
          <div className="mb-6 rounded-lg bg-muted/30 overflow-hidden">
            {file.mediaType === "image" && (
              <div className="flex items-center justify-center bg-black/5 min-h-[400px]">
                <img
                  src={originalFile || "/placeholder.svg"}
                  alt={file.name}
                  className="max-h-[70vh] w-auto object-contain"
                />
              </div>
            )}

            {file.mediaType === "video" && (
              <div className="space-y-4">
                {/* Quality selector */}
                <div className="flex items-center justify-end gap-2 px-4 pt-4">
                  <span className="text-sm font-medium text-foreground">Qualidade:</span>
                  <div className="flex rounded-lg border border-border bg-background">
                    {(availableQualities as Quality[]).map((q) => (
                      <button
                        key={q}
                        onClick={() => setQuality(q)}
                        className={`px-4 py-1.5 text-sm font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                          quality === q
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video player */}
                <video key={quality} controls className="w-full rounded-lg" src={getVideoUrl(quality)}>
                  Seu navegador não suporta reprodução de vídeo.
                </video>
              </div>
            )}

            {file.mediaType === "audio" && (
              <div className="flex flex-col items-center justify-center space-y-6 py-12 px-6">
                {/* Audio visualization placeholder */}
                <div className="flex items-center justify-center w-32 h-32 rounded-full bg-primary/10">
                  <Music className="h-16 w-16 text-primary" />
                </div>

                {/* Audio player */}
                <audio controls className="w-full max-w-md">
                  <source src={file.file_url} type={file.file_type} />
                  Seu navegador não suporta reprodução de áudio.
                </audio>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-4">
            {file.description && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Descrição</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{file.description}</p>
              </div>
            )}

            {file.tags.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {file.tags.map((tag, i) => (
                    <span key={i} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* {file.bucket && (
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <div>
                  <span className="font-medium text-foreground">Bucket:</span>
                  <p className="mt-1 text-muted-foreground truncate">{file.bucket}</p>
                </div>
                <div>
                  <span className="font-medium text-foreground">Tipo:</span>
                  <p className="mt-1 text-muted-foreground">{file.file_type}</p>
                </div>
              </div>
            )} */}
          </div>
        </div>
      </div>
    </div>
  )
}