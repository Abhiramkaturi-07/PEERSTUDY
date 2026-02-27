import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Upload,
  FileText,
  Check,
  X,
  Eye,
  Calendar,
  Tag,
  ChevronLeft,
  ChevronRight,
  Trash2,
  MessageSquareText,
  PencilLine,
  Pencil,
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  BarChart3,
  Info,
  NotebookText,
} from 'lucide-react';
import { useAuth } from '../App';
import { NoteAnnotation, NoteItem } from '../types';

const NOTE_TYPES = ['Lecture', 'Assignment', 'Personal', 'Reference'];
const TAG_COLORS = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500', 'bg-violet-500'];

interface NotesResponse {
  notes: NoteItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const cleanFileName = (name: string) => name.replace(/^\d{10,}-/, '').trim();
const getExtension = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot) : '';
};
const fallbackNameFromUrl = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    const raw = decodeURIComponent(parsed.pathname.split('/').pop() || '');
    return cleanFileName(raw);
  } catch {
    return '';
  }
};
const displayName = (note: NoteItem) =>
  cleanFileName(note.file_name || '') || fallbackNameFromUrl(note.file_url || '') || 'Untitled note';

function Toast({
  message,
  kind,
  onClose,
}: {
  message: string;
  kind: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed right-6 top-24 z-50 px-4 py-3 rounded-xl shadow-lg text-white ${kind === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
      {message}
    </div>
  );
}

export default function NotesPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [view, setView] = useState<'all' | 'review'>('all');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<NoteItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadType, setUploadType] = useState('Lecture');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadTags, setUploadTags] = useState<string[]>([]);

  const [annotationText, setAnnotationText] = useState('');
  const [drawingMode, setDrawingMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const fallbackApiBase = window.location.port === '3000' ? '' : 'http://localhost:3000';

  const fetchWithFallback = async (path: string, init?: RequestInit) => {
    let res = await fetch(path, init);
    if (res.status === 404 && fallbackApiBase) {
      const fallbackUrl = `${fallbackApiBase}${path.startsWith('/') ? path : `/${path}`}`;
      res = await fetch(fallbackUrl, init);
    }
    return res;
  };

  const subjectOptions = useMemo(() => {
    const fromProfile = (user?.subjects || []).map((s) => s.subject_name);
    const fallback = ['Math', 'Coding', 'Circuits', 'Physics', 'Miscellaneous'];
    return Array.from(new Set([...(fromProfile.length ? fromProfile : fallback)]));
  }, [user?.subjects]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (subjectFilter) params.set('subject', subjectFilter);
      if (typeFilter) params.set('type', typeFilter);
      params.set('sort', sort);
      params.set('page', String(page));
      params.set('limit', '20');
      if (view === 'review') params.set('reviewed', 'false');

      const res = await fetchWithFallback(`/api/notes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data: NotesResponse = await res.json();
      setNotes(data.notes);
      setTotalPages(data.totalPages);
    } catch (e) {
      setToast({ message: 'Could not load notes', kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [view, search, subjectFilter, typeFilter, sort, page]);

  const showSuccess = (message: string) => setToast({ message, kind: 'success' });
  const showError = (message: string) => setToast({ message, kind: 'error' });

  const toggleTag = (tag: string) => {
    setUploadTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const onDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    const next = e.dataTransfer.files?.[0];
    if (next) {
      setFile(next);
      setUploadFileName(cleanFileName(next.name));
    }
  };

  const handleUpload = async () => {
    if (!file) {
      showError('Select a file first');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError('File too large. Max size is 10MB.');
      return;
    }
    setUploading(true);
    try {
      const baseCustomName = uploadFileName.trim() || cleanFileName(file.name);
      const originalExt = getExtension(file.name);
      const finalUploadName = getExtension(baseCustomName)
        ? baseCustomName
        : `${baseCustomName}${originalExt}`;

      const form = new FormData();
      form.append('fileName', finalUploadName);
      form.append('file_name', finalUploadName);
      form.append('file', file);
      form.append('subjectTags', JSON.stringify(uploadTags));
      form.append('type', uploadType);
      form.append('description', uploadDesc);
      if (user?.group_id) form.append('groupId', String(user.group_id));

      const res = await fetchWithFallback('/api/notes/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const jsonData = await res.json().catch(() => null);
      const textData = jsonData ? '' : await res.text().catch(() => '');

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Notes API not found. Start the backend with `npm run dev`.');
        }
        throw new Error(jsonData?.error || textData || `Upload failed (${res.status})`);
      }

      // Ensure the typed upload name is persisted even if backend upload route ignored fileName.
      const uploadedId = jsonData?.note?.id;
      if (uploadedId) {
        const renameRes = await fetchWithFallback(`/api/notes/${uploadedId}/rename`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ fileName: finalUploadName, file_name: finalUploadName }),
        });
        if (!renameRes.ok) {
          // best-effort fallback to old updater
          await fetchWithFallback(`/api/notes/${uploadedId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ fileName: finalUploadName, file_name: finalUploadName }),
          });
        }
      }

      setShowUpload(false);
      setFile(null);
      setUploadFileName('');
      setUploadDesc('');
      setUploadType('Lecture');
      setUploadTags([]);
      showSuccess('Note uploaded');
      loadNotes();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Upload failed';
      showError(message);
    } finally {
      setUploading(false);
    }
  };

  const toggleReviewed = async (note: NoteItem) => {
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reviewed: !note.reviewed }),
      });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, reviewed: !n.reviewed } : n)));
    } catch {
      showError('Failed to update');
    }
  };

  const deleteNote = async (id: number) => {
    if (!confirm('Delete this note?')) return;
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setSelectedNote((prev) => (prev?.id === id ? null : prev));
      showSuccess('Note deleted');
    } catch {
      showError('Delete failed');
    }
  };

  const openRename = (note: NoteItem) => {
    setRenameTarget(note);
    setRenameValue(displayName(note));
  };

  const renameNote = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      showError('File name cannot be empty');
      return;
    }

    try {
      setRenaming(true);
      const res = await fetchWithFallback(`/api/notes/${renameTarget.id}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileName: trimmed, file_name: trimmed }),
      });
      let data = await res.json().catch(() => null);
      if (!res.ok) {
        // fallback for older backend processes
        const fallbackRes = await fetchWithFallback(`/api/notes/${renameTarget.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ fileName: trimmed, file_name: trimmed }),
        });
        data = await fallbackRes.json().catch(() => null);
        if (!fallbackRes.ok) throw new Error(data?.error || 'Rename failed');
      }

      const nextNote = data?.note
        ? {
            ...data.note,
            file_name: (data.note.file_name || '').trim() || trimmed,
          }
        : { ...renameTarget, file_name: trimmed };

      setNotes((prev) => prev.map((n) => (n.id === renameTarget.id ? nextNote : n)));
      setSelectedNote((prev) => (prev?.id === renameTarget.id ? nextNote : prev));
      setRenameTarget(null);
      setRenameValue('');
      loadNotes();
      showSuccess('File name updated');
    } catch (e: any) {
      showError(e.message || 'Rename failed');
    } finally {
      setRenaming(false);
    }
  };

  const saveAnnotations = async (nextAnnotations: NoteAnnotation[]) => {
    if (!selectedNote) return;
    try {
      const res = await fetch(`/api/notes/${selectedNote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ annotations: nextAnnotations }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelectedNote(data.note);
      setNotes((prev) => prev.map((n) => (n.id === data.note.id ? data.note : n)));
      showSuccess('Annotations saved');
    } catch {
      showError('Could not save annotations');
    }
  };

  const addCommentAnnotation = () => {
    if (!selectedNote || !annotationText.trim()) return;
    const next: NoteAnnotation[] = [
      ...(selectedNote.annotations || []),
      {
        id: `${Date.now()}`,
        type: 'comment',
        text: annotationText.trim(),
        createdAt: new Date().toISOString(),
      },
    ];
    setAnnotationText('');
    saveAnnotations(next);
  };

  const beginDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const saveDrawingAnnotation = () => {
    if (!selectedNote || !canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const next: NoteAnnotation[] = [
      ...(selectedNote.annotations || []),
      {
        id: `${Date.now()}`,
        type: 'drawing',
        dataUrl,
        createdAt: new Date().toISOString(),
      },
    ];
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    saveAnnotations(next);
  };

  return (
    <div className="max-w-7xl mx-auto py-4">
      {toast && <Toast message={toast.message} kind={toast.kind} onClose={() => setToast(null)} />}

      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit mb-6 overflow-x-auto">
        {[
          { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
          { label: 'Group Chat', icon: MessageSquare, path: '/chat' },
          { label: 'Weekly Tasks', icon: CheckSquare, path: '/tasks' },
          { label: 'Progress', icon: BarChart3, path: '/progress' },
          { label: 'Group Info', icon: Info, path: '/group-info' },
          { label: 'Notes', icon: NotebookText, path: '/notes', active: true },
        ].map((tab) => (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              tab.active
                ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 font-bold'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={18} />
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Notes</h1>
          <p className="text-slate-500">Manage your study documents and revisions.</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Upload size={16} />
          + Upload
        </button>
      </div>

      <div className="glass rounded-3xl p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1">
            <button
              onClick={() => {
                setPage(1);
                setView('all');
              }}
              className={`px-3 py-2 rounded-xl text-sm font-semibold ${view === 'all' ? 'bg-white dark:bg-slate-700' : ''}`}
            >
              All Notes
            </button>
            <button
              onClick={() => {
                setPage(1);
                setView('review');
              }}
              className={`px-3 py-2 rounded-xl text-sm font-semibold ${view === 'review' ? 'bg-white dark:bg-slate-700' : ''}`}
            >
              Notes to Review
            </button>
          </div>

          <div className="flex-1 min-w-[220px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search by file name..."
              className="input-field pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <select
              value={subjectFilter}
              onChange={(e) => {
                setPage(1);
                setSubjectFilter(e.target.value);
              }}
              className="input-field py-2"
            >
              <option value="">All Subjects</option>
              {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value);
              }}
              className="input-field py-2"
            >
              <option value="">All Types</option>
              {NOTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}
              className="input-field py-2"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="text-left text-sm border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="px-4 py-3">Reviewed</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Subject Tags</th>
                <th className="px-4 py-3">Uploaded Date</th>
                <th className="px-4 py-3">Materials</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="px-4 py-4"><div className="h-6 w-6 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-64 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-6 w-20 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-6 w-40 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-6 w-20 rounded bg-slate-200 dark:bg-slate-700 animate-pulse ml-auto" /></td>
                </tr>
              ))}
              {!loading && notes.map((note) => (
                <tr key={note.id} className="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-4">
                    <button
                      onClick={() => toggleReviewed(note)}
                      className={`w-6 h-6 rounded-md border flex items-center justify-center ${
                        note.reviewed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {note.reviewed && <Check size={14} />}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => setSelectedNote(note)}
                      className="flex items-center gap-2 font-semibold hover:text-indigo-600 transition-colors"
                    >
                      <FileText size={16} />
                      {displayName(note)}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <span className="px-2 py-1 rounded-lg text-xs font-bold bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                      {note.type}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(note.subject_tags || []).map((tag, idx) => (
                        <button
                          key={`${note.id}-${tag}`}
                          onClick={() => {
                            setPage(1);
                            setSubjectFilter(tag);
                          }}
                          className={`px-2 py-1 rounded-full text-white text-[11px] font-semibold ${TAG_COLORS[idx % TAG_COLORS.length]}`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      {new Date(note.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <button onClick={() => setSelectedNote(note)} className="inline-flex items-center gap-2 hover:text-indigo-600">
                      <Eye size={14} />
                      Preview
                    </button>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="inline-flex items-center gap-3">
                      <button
                        onClick={() => openRename(note)}
                        className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-600"
                      >
                        <Pencil size={14} />
                        Rename
                      </button>
                      <button onClick={() => deleteNote(note.id)} className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-600">
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && notes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">No notes found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-50"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-50"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showUpload && (
          <motion.div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-2xl rounded-3xl p-6 bg-white text-slate-900 border border-slate-200 shadow-xl dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Upload Note</h3>
                <button onClick={() => setShowUpload(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropFile}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center mb-4"
              >
                <Upload className="mx-auto mb-2 text-slate-400" />
                <p className="font-semibold">Drag and drop your file here</p>
                <p className="text-sm text-slate-500 mb-3">PDF, Images, DOCX, PPT, TXT (max 10MB)</p>
                <label className="btn-primary cursor-pointer inline-flex items-center gap-2">
                  Upload from Device
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const next = e.target.files?.[0] || null;
                      setFile(next);
                      setUploadFileName(next ? cleanFileName(next.name) : '');
                    }}
                  />
                </label>
                {file && <p className="mt-3 text-sm text-indigo-600">{uploadFileName || file.name}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">File Name</label>
                  <input
                    value={uploadFileName}
                    onChange={(e) => setUploadFileName(e.target.value)}
                    className="input-field mt-1"
                    placeholder="Enter file name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className="input-field mt-1">
                    {NOTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Subject Tags</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {subjectOptions.map((tag, idx) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          uploadTags.includes(tag)
                            ? `${TAG_COLORS[idx % TAG_COLORS.length]} text-white`
                            : 'bg-slate-100 dark:bg-slate-800'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium">Description (optional)</label>
                <textarea value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} className="input-field min-h-[90px] mt-1" />
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowUpload(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800">Cancel</button>
                <button onClick={handleUpload} disabled={uploading} className="btn-primary disabled:opacity-60">
                  {uploading ? 'Uploading...' : 'Submit'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {renameTarget && (
          <motion.div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="w-full max-w-md rounded-3xl p-6 bg-white text-slate-900 border border-slate-200 shadow-xl dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Rename Note</h3>
                <button
                  onClick={() => {
                    setRenameTarget(null);
                    setRenameValue('');
                  }}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>
              <label className="text-sm font-medium">Name</label>
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="input-field mt-1"
                placeholder="Enter file name"
              />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setRenameTarget(null);
                    setRenameValue('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={renameNote}
                  disabled={renaming}
                  className="btn-primary disabled:opacity-60"
                >
                  {renaming ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedNote && (
          <motion.div
            className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm p-4 md:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="h-full w-full bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-[1fr_320px]">
              <div className="relative">
                <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <p className="font-semibold truncate">{displayName(selectedNote)}</p>
                  <button onClick={() => setSelectedNote(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                </div>
                <div className="h-[calc(100%-56px)] relative bg-slate-50 dark:bg-slate-950">
                  {selectedNote.file_type.includes('pdf') ? (
                    <iframe title={selectedNote.file_name} src={selectedNote.file_url} className="w-full h-full" />
                  ) : selectedNote.file_type.startsWith('image/') ? (
                    <div className="w-full h-full relative">
                      <img src={selectedNote.file_url} className="w-full h-full object-contain" />
                      <canvas
                        ref={canvasRef}
                        width={1200}
                        height={800}
                        className="absolute inset-0 w-full h-full"
                        onMouseDown={beginDraw}
                        onMouseMove={draw}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                      />
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <a href={selectedNote.file_url} target="_blank" rel="noreferrer" className="btn-primary">Open File</a>
                    </div>
                  )}
                </div>
              </div>
              <div className="border-l border-slate-200 dark:border-slate-800 p-4 overflow-y-auto">
                <h4 className="font-bold mb-3">Annotations</h4>
                <div className="space-y-2 mb-4">
                  <textarea
                    value={annotationText}
                    onChange={(e) => setAnnotationText(e.target.value)}
                    placeholder="Add comment..."
                    className="input-field min-h-[90px]"
                  />
                  <button onClick={addCommentAnnotation} className="btn-primary w-full inline-flex items-center justify-center gap-2">
                    <MessageSquareText size={14} />
                    Save Comment
                  </button>
                </div>
                {selectedNote.file_type.startsWith('image/') && (
                  <div className="space-y-2 mb-4">
                    <button
                      onClick={() => setDrawingMode((prev) => !prev)}
                      className={`w-full px-4 py-2 rounded-xl text-sm font-semibold ${
                        drawingMode ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      <PencilLine size={14} className="inline mr-2" />
                      {drawingMode ? 'Drawing On' : 'Enable Draw'}
                    </button>
                    <button onClick={saveDrawingAnnotation} className="w-full px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold">
                      Save Drawing
                    </button>
                  </div>
                )}
                <div className="space-y-3">
                  {(selectedNote.annotations || []).map((a) => (
                    <div key={a.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                      <p className="text-xs text-slate-500 mb-1">{new Date(a.createdAt).toLocaleString()}</p>
                      {a.type === 'comment' && <p className="text-sm">{a.text}</p>}
                      {a.type === 'drawing' && a.dataUrl && <img src={a.dataUrl} className="rounded-lg border border-slate-200 dark:border-slate-700" />}
                    </div>
                  ))}
                  {(selectedNote.annotations || []).length === 0 && (
                    <p className="text-sm text-slate-500">No annotations yet.</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
