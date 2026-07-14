'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface GalleryImage {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  caption: string | null;
  displayOrder: number;
}

const MAX_IMAGES = 20;

function SortableImage({
  image, onDelete, onCaptionSave,
}: {
  image: GalleryImage;
  onDelete: (id: string) => void;
  onCaptionSave: (id: string, caption: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  const [caption, setCaption] = useState(image.caption ?? '');
  const [captionFocused, setCaptionFocused] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  async function handleDelete() {
    setDeleting(true);
    onDelete(image.id);
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 aspect-square">
      <img src={image.thumbnailUrl} alt={image.caption ?? ''} className="w-full h-full object-cover" />

      {/* Drag handle */}
      <button type="button" {...attributes} {...listeners}
        className="absolute top-1.5 left-1.5 bg-black/60 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none">
        <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 16 16">
          <path d="M3 4a1 1 0 0 1 1-1h8a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1zm0 4a1 1 0 0 1 1-1h8a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1zm1 3a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2H4z" />
        </svg>
      </button>

      {/* Delete */}
      <button type="button" onClick={handleDelete} disabled={deleting}
        className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600/80 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-all text-white disabled:opacity-50">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
        </svg>
      </button>

      {/* Caption input on hover/focus */}
      <div className={`absolute bottom-0 inset-x-0 bg-black/70 px-2 py-1.5 transition-opacity ${captionFocused || caption ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <input
          type="text"
          value={caption}
          onChange={e => setCaption(e.target.value)}
          onFocus={() => setCaptionFocused(true)}
          onBlur={() => { setCaptionFocused(false); onCaptionSave(image.id, caption); }}
          placeholder="Add caption…"
          className="w-full bg-transparent text-[11px] text-white placeholder:text-white/50 focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function GalleryManager() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOverRef = useRef(false);
  const [dragOver, setDragOver] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/shops/gallery');
    if (res.ok) {
      const data = await res.json() as { images: GalleryImage[] };
      setImages(data.images);
    }
    setLoading(false);
  }

  function showFlash(msg: string) { setFlash(msg); setTimeout(() => setFlash(''), 2500); }

  async function uploadFiles(files: FileList | File[]) {
    const fileArr = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    const toUpload = fileArr.slice(0, remaining);

    if (toUpload.length === 0) {
      setError(`Maximum ${MAX_IMAGES} images reached.`);
      return;
    }

    setUploading(true);
    setError('');

    for (const file of toUpload) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setUploadProgress(p => ({ ...p, [tempId]: 0 }));

      try {
        let compressed: File | Blob = file;
        if (file.size > 2 * 1024 * 1024) {
          const { default: compress } = await import('browser-image-compression');
          compressed = await compress(file, { maxSizeMB: 2, maxWidthOrHeight: 2400, useWebWorker: true });
        }

        const form = new FormData();
        form.append('image', compressed, file.name);

        setUploadProgress(p => ({ ...p, [tempId]: 30 }));
        const res = await fetch('/api/shops/gallery', { method: 'POST', body: form });
        setUploadProgress(p => ({ ...p, [tempId]: 90 }));

        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setError(data.error ?? 'Upload failed');
        } else {
          const img = await res.json() as GalleryImage;
          setImages(prev => [...prev, img]);
        }
      } catch {
        setError('Upload failed — try again');
      } finally {
        setUploadProgress(p => { const n = { ...p }; delete n[tempId]; return n; });
      }
    }

    setUploading(false);
    showFlash(`${toUpload.length} photo${toUpload.length > 1 ? 's' : ''} uploaded`);
  }

  const handleDelete = useCallback(async (id: string) => {
    setImages(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/shops/gallery/${id}`, { method: 'DELETE' });
    showFlash('Photo deleted');
  }, []);

  const handleCaptionSave = useCallback(async (id: string, caption: string) => {
    await fetch(`/api/shops/gallery/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: caption || null }),
    });
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex(i => i.id === active.id);
    const newIndex = images.findIndex(i => i.id === over.id);
    const reordered = arrayMove(images, oldIndex, newIndex).map((img, idx) => ({ ...img, displayOrder: idx }));
    setImages(reordered);

    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
    reorderTimerRef.current = setTimeout(() => {
      fetch('/api/shops/gallery/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: reordered.map(i => ({ id: i.id, displayOrder: i.displayOrder })) }),
      });
    }, 600);
  }

  const atLimit = images.length >= MAX_IMAGES;

  return (
    <div className="space-y-5">
      {flash && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-2 text-sm text-emerald-300">{flash}</div>
      )}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-2 text-sm text-red-300">{error}</div>
      )}

      {/* Upload zone */}
      {!atLimit && (
        <div
          onDragOver={e => { e.preventDefault(); if (!dragOverRef.current) { dragOverRef.current = true; setDragOver(true); } }}
          onDragLeave={() => { dragOverRef.current = false; setDragOver(false); }}
          onDrop={e => { e.preventDefault(); dragOverRef.current = false; setDragOver(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-500'
          }`}
        >
          <p className="text-zinc-400 text-sm">Drag photos here or <span className="text-amber-400 hover:underline">click to browse</span></p>
          <p className="text-zinc-600 text-xs mt-1">JPG, PNG, WebP · Max 8 MB each · {MAX_IMAGES - images.length} slots remaining</p>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
            onChange={e => { if (e.target.files?.length) { uploadFiles(e.target.files); e.target.value = ''; } }} />
        </div>
      )}

      {atLimit && (
        <div className="border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-500 text-center">
          Maximum {MAX_IMAGES} photos reached. Delete a photo to upload more.
        </div>
      )}

      {/* Upload progress indicators */}
      {Object.entries(uploadProgress).map(([id, pct]) => (
        <div key={id} className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-400">Uploading…</span>
            <span className="text-xs text-zinc-500">{pct}%</span>
          </div>
          <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}

      {/* Grid */}
      {loading ? (
        <p className="text-zinc-600 text-sm text-center py-6">Loading…</p>
      ) : images.length === 0 ? (
        <p className="text-zinc-600 text-sm text-center py-6">No photos yet — add some shots of your store to bring your storefront to life.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map(img => (
                <SortableImage key={img.id} image={img} onDelete={handleDelete} onCaptionSave={handleCaptionSave} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
