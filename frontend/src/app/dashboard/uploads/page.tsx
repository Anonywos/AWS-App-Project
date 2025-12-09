"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Search, Upload, X, ImageIcon, Music, Video, File, Trash2 } from "lucide-react"
import { apiPostFile, apiGetAllFiles, apiDeleteFile } from "@/lib/api"
import { MediaViewerModal } from "./viewMedia"

export type UploadFile = {
  id: string
  name: string
  file_url: string
  file_type: string
  thumbnail_url: string | null
  description: string | null
  tags: string[]
  created_at: string
  size?: number
  mediaType?: string
}

export default function UploadsPage() {
  const [uploads, setUploads] = useState<UploadFile[]>([])
  const [filteredUploads, setFilteredUploads] = useState<UploadFile[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<UploadFile | null>(null)

  useEffect(() => {
    fetchUploads()
  }, [])

  async function fetchUploads() {
    try {
      const data = await apiGetAllFiles();
      console.log(data)
      setUploads(data.uploads)
      setFilteredUploads(data.uploads)
    } catch (error) {
      console.error("Error fetching uploads:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(query: string) {
    setSearchQuery(query)
    if (!query.trim()) {
      setFilteredUploads(uploads)
      return
    }

    const q = query.toLowerCase()
    const filtered = uploads.filter(
      (upload) =>
        upload.name.toLowerCase().includes(q) ||
        upload.description?.toLowerCase().includes(q) ||
        upload.tags.some((tag) => tag.toLowerCase().includes(q)),
    )
    setFilteredUploads(filtered)
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este arquivo?")) return

    try {
      const response = await apiDeleteFile(id);
      if (response.ok) {
        await fetchUploads()
      }
    } catch (error) {
      console.error("Error deleting upload:", error)
    }
  }

  function handleUploadSuccess() {
    setShowUploadModal(false)
    fetchUploads()
  }

  function getFileIcon(type: string) {
    if (type.startsWith("image/")) return <ImageIcon className="h-5 w-5" />
    if (type.startsWith("audio/")) return <Music className="h-5 w-5" />
    if (type.startsWith("video/")) return <Video className="h-5 w-5" />
    return <File className="h-5 w-5" />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground text-balance">Meus Uploads</h1>
            <p className="mt-2 text-sm text-muted-foreground">Gerencie suas imagens, áudios e vídeos em um só lugar</p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" />
            Novo Upload
          </button>
        </div>

        {/* Search bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, tag ou descrição..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
        </div>

        {/* Files grid */}
        {filteredUploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-12 text-center">
            <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              {searchQuery ? "Nenhum arquivo encontrado" : "Nenhum upload ainda"}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {searchQuery
                ? "Tente buscar com palavras-chave diferentes"
                : "Faça o upload do seu primeiro arquivo para começar"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Fazer Upload
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredUploads.map((upload) => (
              <div
                key={upload.id}
                className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-lg"
                onClick={() => setSelectedFile(upload)}
              >
                {/* Thumbnail */}
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  {upload.thumbnail_url ? (
                    <img
                      src={upload.thumbnail_url || "/placeholder.svg"}
                      alt={upload.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      {getFileIcon(upload.file_type)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-1">{upload.name}</h3>
                    <button
                      onClick={() => handleDelete(upload.id)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {upload.description && (
                    <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{upload.description}</p>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {upload.tags.map((tag, i) => (
                      <button key={i} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{tag}</button>
                    ))}
                  </div>

                  {/* File info */}
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>{upload.file_type.split("/")[0]}</span>
                    <span>{new Date(upload.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && <UploadModal onClose={() => setShowUploadModal(false)} onSuccess={handleUploadSuccess} />}
      {/* Viewer Modal */}
      {selectedFile && <MediaViewerModal file={selectedFile} onClose={() => setSelectedFile(null)} />}
    </div>
  )
}

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)

    // Gera preview para imagens
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!selectedFile) {
      setError("Selecione um arquivo")
      return
    }

    setUploading(true)

    try {
      const formData = new FormData(e.currentTarget)
      formData.append("file", selectedFile)
      console.log(formData)

      await apiPostFile(formData);

      onSuccess()
    } catch (err: any) {
      setError(err?.message || "Erro ao fazer upload")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className=" w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl h-9/10 overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Novo Upload</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="file" className="text-sm font-medium text-foreground">
              Selecione o arquivo *
            </label>
            <input
              id="file"
              type="file"
              onChange={handleFileSelect}
              accept="image/*,audio/*,video/*"
              required
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>

          {previewUrl && (
            <div className="rounded-lg border border-border bg-muted p-4">
              <img
                src={previewUrl || "/placeholder.svg"}
                alt="Preview"
                className="mx-auto max-h-48 rounded-lg object-contain"
              />
            </div>
          )}

          {selectedFile && (
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
              <p className="text-sm text-foreground">
                <span className="font-medium">Arquivo:</span> {selectedFile.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tipo: {selectedFile.type} | Tamanho: {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-foreground">
              Nome do arquivo
            </label>
            <input
              id="name"
              name="name"
              placeholder={selectedFile?.name || "Meu arquivo"}
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
            <p className="text-xs text-muted-foreground">Deixe em branco para usar o nome do arquivo</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="tags" className="text-sm font-medium text-foreground">
              Tags
            </label>
            <input
              id="tags"
              name="tags"
              placeholder="foto, viagem, 2024 (separadas por vírgula)"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
            <p className="text-xs text-muted-foreground">Separe as tags com vírgulas</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-foreground">
              Descrição
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Descreva o arquivo..."
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Enviando..." : "Fazer Upload"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
