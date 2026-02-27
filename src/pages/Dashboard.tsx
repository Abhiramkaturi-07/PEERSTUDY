import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, 
  CheckSquare, 
  BarChart3, 
  Info, 
  Send, 
  Paperclip, 
  Plus, 
  Check, 
  Users, 
  Settings,
  Image as ImageIcon,
  FileText,
  Clock,
  ChevronRight,
  LayoutDashboard,
  Mic,
  Square,
  Loader2,
  X,
  Trash2,
  BookmarkPlus,
  Undo2,
  Copy,
  Forward,
  SmilePlus,
  NotebookText,
  ImagePlus,
  Search as SearchIcon
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../App';
import { Group, Message, Task } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line
} from 'recharts';

interface DashboardProps {
  activeTab?: 'dashboard' | 'chat' | 'progress' | 'tasks' | 'info';
}

function VoiceAudioPlayer({
  src,
  playbackRate = 1,
}: {
  src: string;
  playbackRate?: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  return (
    <div className="w-full">
      <audio ref={audioRef} controls src={src} className="w-full rounded-lg" />
    </div>
  );
}

export default function Dashboard({ activeTab: initialTab = 'dashboard' }: DashboardProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState('');
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [openMessageMenu, setOpenMessageMenu] = useState<{ id: number; x: number; y: number } | null>(null);
  const [deletedForMeIds, setDeletedForMeIds] = useState<number[]>([]);
  const [messagePlaybackRates, setMessagePlaybackRates] = useState<Record<number, number>>({});
  const [messageReactions, setMessageReactions] = useState<Record<number, string[]>>({});
  const [previewPlaybackRate, setPreviewPlaybackRate] = useState(1);
  const [saveNoteMessage, setSaveNoteMessage] = useState<Message | null>(null);
  const [saveNoteTags, setSaveNoteTags] = useState<string[]>([]);
  const [saveNoteType, setSaveNoteType] = useState('Lecture');
  const [saveNoteDescription, setSaveNoteDescription] = useState('');
  const [saveNoteFileName, setSaveNoteFileName] = useState('');
  const [savingToNotes, setSavingToNotes] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [showComposerEmojiPicker, setShowComposerEmojiPicker] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [groupIconPreview, setGroupIconPreview] = useState('');
  const [groupIconFile, setGroupIconFile] = useState<File | null>(null);
  const [removeGroupIcon, setRemoveGroupIcon] = useState(false);
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [searchedMessages, setSearchedMessages] = useState<Message[]>([]);
  const [clearingChat, setClearingChat] = useState(false);
  const { user, token } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const longPressTimerRef = useRef<number | null>(null);
  const groupIconObjectUrlRef = useRef<string | null>(null);
  const fallbackApiBase = window.location.port === '3000' ? '' : 'http://localhost:3000';

  const fetchWithFallback = async (path: string, init?: RequestInit) => {
    let res = await fetch(path, init);
    if (res.status === 404 && fallbackApiBase) {
      const fallbackUrl = `${fallbackApiBase}${path.startsWith('/') ? path : `/${path}`}`;
      res = await fetch(fallbackUrl, init);
    }
    return res;
  };

  useEffect(() => {
    if (user?.group_id) {
      fetch(`/api/groups/${user.group_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        setGroup(data);
        setLoading(false);
      });

      const newSocket = io();
      setSocket(newSocket);
      newSocket.emit('join-group', user.group_id);

      newSocket.on('new-message', (msg: Message) => {
        setGroup(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : null);
      });

      newSocket.on('message-updated', (updatedMsg: Message) => {
        setGroup(prev => prev ? {
          ...prev,
          messages: prev.messages.map((m) => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m),
        } : null);
      });

      newSocket.on('message-deleted', ({ id }: { id: number }) => {
        setGroup(prev => prev ? {
          ...prev,
          messages: prev.messages.filter((m) => m.id !== id),
        } : null);
      });

      newSocket.on('group-updated', (updatedGroup: Group) => {
        setGroup(prev => prev ? { ...prev, ...updatedGroup } : prev);
      });

      newSocket.on('chat-cleared', () => {
        setGroup(prev => prev ? { ...prev, messages: [] } : prev);
      });

      return () => {
        newSocket.off('group-updated');
        newSocket.off('chat-cleared');
        newSocket.disconnect();
      };
    }
  }, [user?.group_id, token]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [group?.messages, activeTab]);

  useEffect(() => {
    if (!isRecording) return;
    const intervalId = window.setInterval(() => {
      setRecordingSeconds((prev) => Math.min(prev + 1, 59));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
      if (groupIconObjectUrlRef.current) {
        URL.revokeObjectURL(groupIconObjectUrlRef.current);
        groupIconObjectUrlRef.current = null;
      }
    };
  }, [recordedAudioUrl]);

  const formatRecordingTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const clearRecordedAudio = () => {
    setRecordedAudioBlob(null);
    setRecordedAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  };

  const startVoiceRecording = async () => {
    if (isRecording) return;
    setRecordingError('');
    clearRecordedAudio();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      setRecordingSeconds(0);

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (blob.size > 0) {
          setRecordedAudioBlob(blob);
          setRecordedAudioUrl(URL.createObjectURL(blob));
        }
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((track) => track.stop());
          recordingStreamRef.current = null;
        }
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setRecordingError('Microphone permission denied or unavailable.');
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const sendVoiceMessage = async () => {
    if (!recordedAudioBlob || !socket || !group || !user) return;
    setIsUploadingVoice(true);
    setRecordingError('');

    try {
      const inferredExtension = recordedAudioBlob.type.includes('wav')
        ? 'wav'
        : recordedAudioBlob.type.includes('mp4') || recordedAudioBlob.type.includes('m4a')
          ? 'm4a'
          : recordedAudioBlob.type.includes('mpeg') || recordedAudioBlob.type.includes('mp3')
            ? 'mp3'
            : 'webm';

      const formData = new FormData();
      formData.append('voice', recordedAudioBlob, `voice-${Date.now()}.${inferredExtension}`);

      let fileUrl = '';
      const res = await fetch('/api/chat/upload-voice', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        fileUrl = data.fileUrl ?? data.url ?? '';
      } else {
        const fallbackFormData = new FormData();
        fallbackFormData.append('file', recordedAudioBlob, `voice-${Date.now()}.${inferredExtension}`);
        const fallbackRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fallbackFormData,
        });
        if (!fallbackRes.ok) {
          throw new Error('Voice upload failed');
        }
        const fallbackData = await fallbackRes.json();
        fileUrl = fallbackData.url ?? '';
      }

      if (!fileUrl) throw new Error('Voice upload failed');
      if (fileUrl.startsWith('/')) {
        fileUrl = `${window.location.origin}${fileUrl}`;
      }

      socket.emit('send-message', {
        groupId: group.id,
        senderId: user.id,
        senderName: user.name,
        sender: user.name,
        content: fileUrl,
        type: 'voice',
      });
      clearRecordedAudio();
      setRecordingSeconds(0);
    } catch (err) {
      setRecordingError('Could not send voice message. Please try again.');
    } finally {
      setIsUploadingVoice(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !socket || !group || !user) return;

    socket.emit('send-message', {
      groupId: group.id,
      senderId: user.id,
      senderName: user.name,
      sender: user.name,
      content: message,
      type: 'text'
    });
    setMessage('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket || !group || !user) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      let type: any = 'text';
      if (data.type.startsWith('image/')) type = 'image';
      else if (data.type.startsWith('video/')) type = 'video';
      else if (data.type === 'application/pdf') type = 'pdf';

      socket.emit('send-message', {
        groupId: group.id,
        senderId: user.id,
        senderName: user.name,
        sender: user.name,
        content: data.url,
        type
      });
    } catch (err) {
      console.error(err);
    }
  };

  const completeTask = async (taskId: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setGroup(prev => {
          if (!prev) return null;
          return {
            ...prev,
            tasks: prev.tasks.map(t => t.id === taskId ? { ...t, completion_count: t.completion_count + 1 } : t)
          };
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const unsendMessage = async (messageId: number) => {
    if (!confirm('Unsend this message for everyone?')) return;

    const previousMessages = group?.messages || [];
    setGroup((prev) => prev ? {
      ...prev,
      messages: prev.messages.filter((m) => m.id !== messageId),
    } : null);

    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete message');
      setOpenMessageMenu(null);
    } catch (err) {
      // Roll back optimistic update if server call fails.
      setGroup((prev) => prev ? { ...prev, messages: previousMessages } : prev);
      console.error(err);
    }
  };

  const deleteForMe = (messageId: number) => {
    setDeletedForMeIds((prev) => prev.includes(messageId) ? prev : [...prev, messageId]);
    setOpenMessageMenu(null);
  };

  const copyMessageText = async (msg: Message) => {
    const textToCopy = msg.type === 'text'
      ? msg.content
      : (msg.content.startsWith('http') ? msg.content : `${window.location.origin}${msg.content}`);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setOpenMessageMenu(null);
    } catch (err) {
      console.error(err);
    }
  };

  const addReaction = (messageId: number, emoji: string) => {
    setMessageReactions((prev) => {
      const current = prev[messageId] || [];
      return { ...prev, [messageId]: current.includes(emoji) ? current : [...current, emoji] };
    });
    setOpenMessageMenu(null);
  };

  const openMessageActionMenu = (msg: Message, x: number, y: number) => {
    setOpenMessageMenu({ id: msg.id, x, y });
  };

  const startLongPress = (msg: Message, e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      openMessageActionMenu(msg, touch.clientX, touch.clientY);
    }, 450);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const composerEmojis = ['😀', '😂', '😍', '👍', '🔥', '🎯', '📚', '💯'];

  const appendComposerEmoji = (emoji: string) => {
    setMessage((prev) => `${prev}${emoji}`);
    setShowComposerEmojiPicker(false);
  };

  useEffect(() => {
    if (!showChatSettings || !group) return;
    setGroupNameDraft(group.name || '');
    setGroupIconPreview(group.icon_url || '');
    setGroupIconFile(null);
    setRemoveGroupIcon(false);
    if (groupIconObjectUrlRef.current) {
      URL.revokeObjectURL(groupIconObjectUrlRef.current);
      groupIconObjectUrlRef.current = null;
    }
    setSearchTerm('');
    setSearchedMessages([]);
  }, [showChatSettings, group]);

  const saveGroupSettings = async () => {
    if (!group || !groupNameDraft.trim()) return;
    setSavingGroupSettings(true);
    try {
      let iconUrl = group.icon_url || '';
      if (removeGroupIcon) {
        iconUrl = '';
      }
      if (groupIconFile) {
        const iconForm = new FormData();
        iconForm.append('icon', groupIconFile);
        const iconRes = await fetchWithFallback(`/api/groups/${group.id}/icon`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: iconForm,
        });
        if (!iconRes.ok) {
          const errData = await iconRes.json().catch(() => null);
          throw new Error(errData?.error || `Failed to upload icon (${iconRes.status})`);
        }
        const iconData = await iconRes.json();
        iconUrl = iconData.iconUrl || iconData.group?.icon_url || iconUrl;
      }

      let res = await fetchWithFallback(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: groupNameDraft.trim(),
          icon_url: iconUrl || null,
        }),
      });
      if (!res.ok) {
        res = await fetchWithFallback(`/api/groups/${group.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: groupNameDraft.trim(),
            icon_url: iconUrl || null,
          }),
        });
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Failed to update group (${res.status})`);
      }
      const data = await res.json();
      setGroup((prev) => prev ? { ...prev, ...data.group } : prev);
      setShowChatSettings(false);
    } catch (err: any) {
      alert(err?.message || 'Could not save group settings');
    } finally {
      setSavingGroupSettings(false);
    }
  };

  const performMessageSearch = async () => {
    if (!group) return;
    const q = searchTerm.trim();
    if (!q) {
      setSearchedMessages([]);
      return;
    }
    setSearchingMessages(true);
    try {
      const res = await fetchWithFallback(`/api/groups/${group.id}/messages?search=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchedMessages(data.messages || []);
    } catch {
      const local = group.messages.filter((m) => (m.content || '').toLowerCase().includes(q.toLowerCase()));
      setSearchedMessages(local.slice().reverse());
    } finally {
      setSearchingMessages(false);
    }
  };

  const clearEntireChat = async () => {
    if (!group) return;
    if (!confirm('Delete the entire group chat for everyone?')) return;
    setClearingChat(true);
    try {
      let res = await fetchWithFallback(`/api/groups/${group.id}/messages`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        res = await fetchWithFallback(`/api/groups/${group.id}/clear-chat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Failed to delete chat (${res.status})`);
      }
      setGroup((prev) => prev ? { ...prev, messages: [] } : prev);
      setShowChatSettings(false);
    } catch (err: any) {
      alert(err?.message || 'Could not delete chat');
    } finally {
      setClearingChat(false);
    }
  };

  const forwardMessage = async () => {
    if (!forwardingMessage || !socket || !group || !user) return;
    setForwarding(true);
    try {
      socket.emit('send-message', {
        groupId: group.id,
        senderId: user.id,
        senderName: user.name,
        sender: user.name,
        content: forwardingMessage.content,
        type: forwardingMessage.type,
      });
      setForwardingMessage(null);
      setOpenMessageMenu(null);
    } finally {
      setForwarding(false);
    }
  };

  const subjectOptions = (user?.subjects || []).map((s) => s.subject_name);

  const toggleSaveTag = (tag: string) => {
    setSaveNoteTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const inferFileTypeForNote = (msg: Message) => {
    if (msg.type === 'pdf') return 'application/pdf';
    if (msg.type === 'image') return 'image/jpeg';
    if (msg.type === 'video') return 'video/webm';
    if (msg.type === 'voice') return 'audio/webm';
    return 'application/octet-stream';
  };

  const getFileNameFromUrl = (url: string) => {
    try {
      const parsed = new URL(url, window.location.origin);
      const raw = parsed.pathname.split('/').pop() || 'chat-file';
      const decoded = decodeURIComponent(raw);
      // Remove upload prefixes like `1712345678901-` for cleaner note titles.
      return decoded.replace(/^\d{10,}-/, '');
    } catch {
      return 'chat-file';
    }
  };

  const saveMessageToNotes = async () => {
    if (!saveNoteMessage) return;
    setSavingToNotes(true);
    try {
      const normalizedUrl = saveNoteMessage.content.startsWith('http')
        ? (() => {
            try {
              const parsed = new URL(saveNoteMessage.content);
              return parsed.pathname;
            } catch {
              return saveNoteMessage.content;
            }
          })()
        : saveNoteMessage.content;

      const groupIdForSave = group?.id ?? user?.group_id ?? null;

      const res = await fetch('/api/notes/save-from-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          groupId: groupIdForSave,
          fileName: saveNoteFileName.trim() || getFileNameFromUrl(normalizedUrl),
          fileUrl: normalizedUrl,
          fileType: inferFileTypeForNote(saveNoteMessage),
          subjectTags: saveNoteTags,
          type: saveNoteType,
          description: saveNoteDescription,
          chatMessageId: saveNoteMessage.id,
        }),
      });
      const jsonData = await res.json().catch(() => null);
      const textData = jsonData ? '' : await res.text().catch(() => '');

      if (!res.ok) {
        const serverError = jsonData?.error || textData || `Request failed (${res.status})`;
        // If already saved, treat as success UX-wise.
        if (res.status === 409) {
          setSaveNoteMessage(null);
          setSaveNoteTags([]);
          setSaveNoteType('Lecture');
          setSaveNoteDescription('');
          setSaveNoteFileName('');
          alert('Already saved in notes');
          return;
        }
        throw new Error(serverError);
      }
      setSaveNoteMessage(null);
      setSaveNoteTags([]);
      setSaveNoteType('Lecture');
      setSaveNoteDescription('');
      setSaveNoteFileName('');
      alert('Saved to notes');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save to notes';
      alert(message);
    } finally {
      setSavingToNotes(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;
  if (!group) return <div>No group found.</div>;

  const progressData = [
    { name: 'Week 1', improvement: 20, tasks: 5, assignments: 3 },
    { name: 'Week 2', improvement: 35, tasks: 8, assignments: 5 },
    { name: 'Week 3', improvement: 55, tasks: 12, assignments: 9 },
    { name: 'Week 4', improvement: 75, tasks: 15, assignments: 12 },
  ];

  const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e'];
  const activeMenuMessage = openMessageMenu
    ? group.messages.find((m) => m.id === openMessageMenu.id) || null
    : null;
  const activeMenuSenderId = activeMenuMessage
    ? ((activeMenuMessage as any).sender_id ?? (activeMenuMessage as any).senderId)
    : null;
  const isMenuMessageMine = activeMenuSenderId !== null && Number(activeMenuSenderId) === Number(user?.id);
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
  const menuWidth = 260;
  const menuMaxHeight = 380;
  const menuLeft = openMessageMenu ? Math.min(Math.max(openMessageMenu.x + 8, 8), viewportWidth - menuWidth - 8) : 8;
  const menuTop = openMessageMenu ? Math.min(Math.max(openMessageMenu.y + 8, 8), viewportHeight - menuMaxHeight - 8) : 8;
  const tabToPath: Record<'dashboard' | 'chat' | 'tasks' | 'progress' | 'info', string> = {
    dashboard: '/dashboard',
    chat: '/chat',
    tasks: '/tasks',
    progress: '/progress',
    info: '/group-info',
  };

  const goToTab = (tab: 'dashboard' | 'chat' | 'tasks' | 'progress' | 'info') => {
    setActiveTab(tab);
    navigate(tabToPath[tab]);
  };

  return (
    <>
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'chat', label: 'Group Chat', icon: MessageSquare },
          { id: 'tasks', label: 'Weekly Tasks', icon: CheckSquare },
          { id: 'progress', label: 'Progress', icon: BarChart3 },
          { id: 'info', label: 'Group Info', icon: Info },
          { id: 'notes', label: 'Notes', icon: NotebookText, path: '/notes' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if ('path' in tab && tab.path) {
                navigate(tab.path);
                return;
              }
              goToTab(tab.id as 'dashboard' | 'chat' | 'tasks' | 'progress' | 'info');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 font-bold' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={18} />
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-y-auto pr-2"
            >
              <div className="lg:col-span-2 space-y-6">
                <div className="glass p-8 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none">
                  <h1 className="text-3xl font-display font-bold mb-2">Welcome back to {group.name}!</h1>
                  <p className="text-indigo-100 mb-6">You have 3 pending tasks for this week. Keep up the great work!</p>
                  <div className="flex gap-4">
                    <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider opacity-70">Group Members</p>
                      <p className="text-2xl font-bold">{group.members.length}</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider opacity-70">Tasks Done</p>
                      <p className="text-2xl font-bold">12/15</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass p-6 rounded-3xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold">Recent Tasks</h3>
                      <button onClick={() => goToTab('tasks')} className="text-indigo-600 text-sm font-bold">View All</button>
                    </div>
                    <div className="space-y-4">
                      {group.tasks.slice(0, 3).map(task => (
                        <div key={task.id} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl flex items-center justify-center">
                            <CheckSquare size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate">{task.content}</p>
                            <p className="text-xs text-slate-500">{task.subject}</p>
                          </div>
                          <ChevronRight size={16} className="text-slate-300" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass p-6 rounded-3xl">
                    <h3 className="font-bold mb-6">Skill Improvement</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={progressData}>
                          <Bar dataKey="improvement" radius={[4, 4, 0, 0]}>
                            {progressData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="glass p-6 rounded-3xl h-[400px] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">Quick Chat</h3>
                    <button onClick={() => goToTab('chat')} className="text-indigo-600 text-sm font-bold">Open Full</button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                    {group.messages.slice(-5).map(msg => (
                      <div key={msg.id} className="text-sm">
                        <span className="font-bold text-indigo-600">{msg.sender_name}: </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {msg.type === 'voice' ? 'Voice message' : msg.content}
                        </span>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input 
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm outline-none"
                    />
                    <button className="p-2 bg-indigo-600 text-white rounded-xl">
                      <Send size={16} />
                    </button>
                  </form>
                </div>

                <div className="glass p-6 rounded-3xl">
                  <h3 className="font-bold mb-4">Group Members</h3>
                  <div className="space-y-4">
                    {group.members.map(member => (
                      <div key={member.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                          <Users size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.branch}</p>
                        </div>
                        <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass rounded-[2.5rem] h-full flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center overflow-hidden">
                    {group.icon_url ? (
                      <img
                        src={group.icon_url}
                        alt={group.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <MessageSquare size={24} />
                    )}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">{group.name} Chat</h2>
                    <p className="text-xs text-slate-500">{group.members.length} members online</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChatSettings(true)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Settings size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6" onClick={() => setOpenMessageMenu(null)}>
                {group.messages.map((msg, i) => {
                  if (deletedForMeIds.includes(msg.id)) return null;
                  const messageSenderId = (msg as any).sender_id ?? (msg as any).senderId;
                  const messageSenderName = (msg as any).sender_name ?? (msg as any).senderName;
                  const isMe = Number(messageSenderId) === Number(user?.id);
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {!isMe && <span className="text-xs font-bold text-slate-400">{messageSenderName}</span>}
                        <span className="text-[10px] text-slate-300">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        onClick={(e) => openMessageActionMenu(msg, e.clientX, e.clientY)}
                        onTouchStart={(e) => startLongPress(msg, e)}
                        onTouchEnd={clearLongPress}
                        onTouchMove={clearLongPress}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          openMessageActionMenu(msg, e.clientX, e.clientY);
                        }}
                        className={`max-w-[80%] p-4 rounded-2xl relative ${
                        isMe 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                      }`}>
                        {msg.type === 'text' && <p className="text-sm leading-relaxed">{msg.content}</p>}
                        {msg.type === 'image' && <img src={msg.content} alt="Upload" className="rounded-lg max-h-64 object-cover" />}
                        {msg.type === 'video' && <video src={msg.content} controls className="rounded-lg max-h-64" />}
                        {msg.type === 'pdf' && (
                          <a href={msg.content} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-bold underline">
                            <FileText size={18} /> View PDF Document
                          </a>
                        )}
                        {msg.type === 'voice' && (
                          <div className="w-full min-w-[220px]">
                            <VoiceAudioPlayer src={msg.content} playbackRate={messagePlaybackRates[msg.id] ?? 1} />
                          </div>
                        )}
                        {!!messageReactions[msg.id]?.length && (
                          <div
                            className={`absolute -bottom-3 ${isMe ? 'right-3' : 'left-3'} px-2 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-md flex items-center gap-1`}
                          >
                            {messageReactions[msg.id].slice(0, 3).map((emoji) => (
                              <span key={`${msg.id}-${emoji}`} className="text-sm leading-none">
                                {emoji}
                              </span>
                            ))}
                            {messageReactions[msg.id].length > 3 && (
                              <span className="text-[10px] font-semibold text-slate-500">+{messageReactions[msg.id].length - 3}</span>
                            )}
                          </div>
                        )}
                        {msg.type !== 'text' && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSaveNoteMessage(msg);
                                setSaveNoteFileName(getFileNameFromUrl(msg.content));
                              }}
                              className={`text-[11px] px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                                isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-200 dark:bg-slate-700'
                              }`}
                            >
                              <BookmarkPlus size={12} />
                              Save to Notes
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                {(isRecording || recordedAudioUrl || recordingError) && (
                  <div className="mb-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 p-4">
                    {isRecording && (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recording... {formatRecordingTime(recordingSeconds)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={stopVoiceRecording}
                          className="px-3 py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-colors flex items-center gap-2"
                        >
                          <Square size={14} />
                          Stop
                        </button>
                      </div>
                    )}

                    {!isRecording && recordedAudioUrl && (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Voice Preview</p>
                        <VoiceAudioPlayer src={recordedAudioUrl} playbackRate={previewPlaybackRate} />
                        <div className="flex items-center justify-end gap-1">
                          {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                            <button
                              key={speed}
                              type="button"
                              onClick={() => setPreviewPlaybackRate(speed)}
                              className={`px-2 py-1 text-xs rounded-md ${
                                previewPlaybackRate === speed ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700'
                              }`}
                            >
                              {speed}x
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={sendVoiceMessage}
                            disabled={isUploadingVoice}
                            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center gap-2"
                          >
                            {isUploadingVoice ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            {isUploadingVoice ? 'Uploading...' : 'Send Voice'}
                          </button>
                          <button
                            type="button"
                            onClick={clearRecordedAudio}
                            disabled={isUploadingVoice}
                            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                          >
                            <X size={14} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {recordingError && <p className="mt-3 text-sm text-rose-500">{recordingError}</p>}
                  </div>
                )}

                <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                  <div className="flex gap-2">
                    <label className="p-3 bg-white dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors shadow-sm">
                      <Paperclip size={20} className="text-slate-400" />
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      disabled={isRecording || isUploadingVoice}
                      className="p-3 bg-white dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-500 disabled:opacity-50"
                      title="Record Voice Message"
                    >
                      <Mic size={20} className={isRecording ? "text-rose-500 animate-pulse" : "text-slate-400"} />
                    </button>
                  </div>
                  <div className="relative flex-1 overflow-visible">
                    {showComposerEmojiPicker && (
                      <div className="absolute bottom-full right-0 mb-2 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-lg">
                        <div className="flex items-center gap-1">
                          {composerEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => appendComposerEmoji(emoji)}
                              className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-base"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <input 
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message here..."
                      className="w-full bg-white dark:bg-slate-800 rounded-2xl px-6 py-3 outline-none shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowComposerEmojiPicker((prev) => !prev)}
                      className="absolute -right-10 top-1/2 -translate-y-1/2 p-2 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                      title="Add emoji"
                    >
                      <SmilePlus size={16} className="text-slate-500" />
                    </button>
                  </div>
                  <button type="submit" className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all">
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          <AnimatePresence>
            {showChatSettings && activeTab === 'chat' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="w-full max-w-2xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto bg-white text-slate-900 border border-slate-200 shadow-xl dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xl font-bold">Chat Settings</h3>
                    <button onClick={() => setShowChatSettings(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="font-semibold">Group details</h4>
                      <div>
                        <label className="text-sm text-slate-500">Group name</label>
                        <input
                          value={groupNameDraft}
                          onChange={(e) => setGroupNameDraft(e.target.value)}
                          className="input-field mt-1"
                          placeholder="Enter group name"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-500">Group icon</label>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                            {groupIconPreview ? (
                              <img src={groupIconPreview} alt="Group icon preview" className="h-full w-full object-cover" />
                            ) : (
                              <MessageSquare size={20} className="text-slate-400" />
                            )}
                          </div>
                          <label className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer inline-flex items-center gap-2 text-sm">
                            <ImagePlus size={14} />
                            Change Icon
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const nextFile = e.target.files?.[0] || null;
                                setGroupIconFile(nextFile);
                                setRemoveGroupIcon(false);
                                if (nextFile) {
                                  if (groupIconObjectUrlRef.current) {
                                    URL.revokeObjectURL(groupIconObjectUrlRef.current);
                                  }
                                  const objectUrl = URL.createObjectURL(nextFile);
                                  groupIconObjectUrlRef.current = objectUrl;
                                  setGroupIconPreview(objectUrl);
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setGroupIconFile(null);
                              setGroupIconPreview('');
                              setRemoveGroupIcon(true);
                              if (groupIconObjectUrlRef.current) {
                                URL.revokeObjectURL(groupIconObjectUrlRef.current);
                                groupIconObjectUrlRef.current = null;
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-300 text-sm"
                          >
                            Remove Icon
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={saveGroupSettings}
                          disabled={savingGroupSettings}
                          className="btn-primary disabled:opacity-60"
                        >
                          {savingGroupSettings ? 'Saving...' : 'Save changes'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold">Search in chat</h4>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                performMessageSearch();
                              }
                            }}
                            className="input-field pl-9"
                            placeholder="Search messages..."
                          />
                        </div>
                        <button onClick={performMessageSearch} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                          Search
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                        {searchingMessages && <p className="p-3 text-sm text-slate-500">Searching...</p>}
                        {!searchingMessages && searchedMessages.length === 0 && (
                          <p className="p-3 text-sm text-slate-500">No search results yet.</p>
                        )}
                        {!searchingMessages && searchedMessages.map((m) => (
                          <div key={`search-${m.id}`} className="p-3 border-b border-slate-100 dark:border-slate-900 last:border-b-0">
                            <p className="text-xs text-slate-500 mb-1">{m.sender_name} • {new Date(m.timestamp).toLocaleString()}</p>
                            <p className="text-sm break-all">{m.type === 'text' ? m.content : `${m.type.toUpperCase()} message`}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-rose-200 dark:border-rose-800 p-4 bg-rose-50/50 dark:bg-rose-900/10">
                      <h4 className="font-semibold text-rose-600 mb-2">Danger zone</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Delete the entire conversation for all group members.</p>
                      <button
                        type="button"
                        onClick={clearEntireChat}
                        disabled={clearingChat}
                        className="px-4 py-2 rounded-xl bg-rose-500 text-white font-semibold hover:bg-rose-600 disabled:opacity-60"
                      >
                        {clearingChat ? 'Deleting...' : 'Delete Entire Chat'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {saveNoteMessage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="w-full max-w-lg rounded-3xl p-6 bg-white text-slate-900 border border-slate-200 shadow-xl dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Save to Notes</h3>
                    <button onClick={() => setSaveNoteMessage(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                      <X size={16} />
                    </button>
                  </div>
                    <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">File name</label>
                      <input
                        value={saveNoteFileName}
                        onChange={(e) => setSaveNoteFileName(e.target.value)}
                        className="input-field mt-1"
                        placeholder="Enter note name"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">File</p>
                      <p className="text-sm font-semibold break-all">{getFileNameFromUrl(saveNoteMessage.content)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Type</label>
                      <select
                        value={saveNoteType}
                        onChange={(e) => setSaveNoteType(e.target.value)}
                        className="input-field mt-1"
                      >
                        {['Lecture', 'Assignment', 'Personal', 'Reference'].map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Subject tags</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(subjectOptions.length ? subjectOptions : ['Miscellaneous']).map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleSaveTag(tag)}
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              saveNoteTags.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <textarea
                        value={saveNoteDescription}
                        onChange={(e) => setSaveNoteDescription(e.target.value)}
                        className="input-field min-h-[90px] mt-1"
                        placeholder="Optional note..."
                      />
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setSaveNoteMessage(null);
                        setSaveNoteFileName('');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button onClick={saveMessageToNotes} disabled={savingToNotes} className="btn-primary disabled:opacity-60">
                      {savingToNotes ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {forwardingMessage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="w-full max-w-md rounded-3xl p-6 bg-white text-slate-900 border border-slate-200 shadow-xl dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Forward message</h3>
                    <button
                      onClick={() => setForwardingMessage(null)}
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">Forward to this group chat</p>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm mb-5 break-all">
                    {forwardingMessage.type === 'text' ? forwardingMessage.content : `${forwardingMessage.type.toUpperCase()} message`}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setForwardingMessage(null)}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={forwardMessage}
                      disabled={forwarding}
                      className="btn-primary disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      <Forward size={14} />
                      {forwarding ? 'Forwarding...' : 'Forward'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === 'tasks' && (
            <motion.div 
              key="tasks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full overflow-y-auto pr-2"
            >
              <div className="space-y-6">
                <div className="glass p-8 rounded-[2rem]">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                    <CheckSquare className="text-indigo-600" />
                    Weekly Tasks
                  </h2>
                  <div className="space-y-4">
                    {group.tasks.map(task => (
                      <div key={task.id} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-4">
                          <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 text-xs font-bold rounded-full">
                            {task.subject}
                          </span>
                          <div className="flex items-center gap-1 text-slate-400 text-xs">
                            <Clock size={12} />
                            {new Date(task.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <p className="text-lg font-bold mb-4">{task.content}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold">
                              {task.creator_name[0]}
                            </div>
                            <span className="text-xs text-slate-500">Assigned by {task.creator_name}</span>
                          </div>
                          <button 
                            onClick={() => completeTask(task.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 transition-colors"
                          >
                            <Check size={16} />
                            Complete ({task.completion_count})
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="glass p-8 rounded-[2rem]">
                  <h3 className="text-xl font-bold mb-6">Assign New Task</h3>
                  <form className="space-y-4" onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    fetch(`/api/groups/${group.id}/tasks`, {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        subject: formData.get('subject'),
                        content: formData.get('content')
                      })
                    }).then(() => window.location.reload());
                  }}>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Subject</label>
                      <select name="subject" className="input-field">
                        {user?.subjects?.map(s => <option key={s.subject_name} value={s.subject_name}>{s.subject_name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Task Description</label>
                      <textarea name="content" className="input-field min-h-[120px]" placeholder="What should the group do?" required />
                    </div>
                    <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                      <Plus size={20} />
                      Post Task
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'progress' && (
            <motion.div 
              key="progress"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass p-8 rounded-[2.5rem] h-full overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-12">
                <div>
                  <h2 className="text-3xl font-display font-bold mb-2">Progress Tracking</h2>
                  <p className="text-slate-500">Visualize your group's growth over time.</p>
                </div>
                <div className="flex gap-4">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-center">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Total Tasks</p>
                    <p className="text-2xl font-bold">48</p>
                  </div>
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-center">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Completion Rate</p>
                    <p className="text-2xl font-bold">92%</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h3 className="font-bold text-xl mb-6">Skill Improvement Trend</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={progressData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="improvement" 
                          stroke="#6366f1" 
                          strokeWidth={4} 
                          dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} 
                          activeDot={{ r: 8 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="font-bold text-xl mb-6">Task Completion Distribution</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={progressData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="tasks" fill="#a855f7" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="assignments" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'info' && (
            <motion.div 
              key="info"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass p-8 rounded-[2.5rem] h-full overflow-y-auto"
            >
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-12">
                  <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-indigo-500/30">
                    <Users size={48} />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">{group.name}</h2>
                  <p className="text-slate-500">Established on {new Date().toLocaleDateString()}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                      <Users size={18} className="text-indigo-600" />
                      Group Members
                    </h3>
                    <div className="space-y-4">
                      {group.members.map(member => (
                        <div key={member.id} className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center font-bold text-indigo-600">
                            {member.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{member.name}</p>
                            <p className="text-xs text-slate-500">{member.branch}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                      <ImageIcon size={18} className="text-purple-600" />
                      Shared Media
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {group.messages.filter(m => m.type === 'image').slice(0, 6).map(m => (
                        <img key={m.id} src={m.content} alt="Shared" className="w-full aspect-square object-cover rounded-xl" />
                      ))}
                      {group.messages.filter(m => m.type === 'image').length === 0 && (
                        <p className="col-span-3 text-center py-8 text-slate-400 text-sm">No media shared yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button className="px-8 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">
                    Invite Link
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm("Are you sure you want to leave this group?")) {
                        fetch(`/api/groups/${group.id}/leave`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}` }
                        }).then(() => window.location.href = '/');
                      }
                    }}
                    className="px-8 py-3 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                  >
                    Leave Group
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {openMessageMenu && activeMenuMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[75]"
            onClick={() => setOpenMessageMenu(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute w-[260px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
              style={{ left: menuLeft, top: menuTop }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="py-2">
                {isMenuMessageMine && (
                  <button
                    type="button"
                    onClick={() => unsendMessage(activeMenuMessage.id)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                  >
                    <Undo2 size={15} />
                    Unsend message
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteForMe(activeMenuMessage.id)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                >
                  <Trash2 size={15} />
                  Delete for me
                </button>
                {activeMenuMessage.type === 'text' && (
                  <button
                    type="button"
                    onClick={() => copyMessageText(activeMenuMessage)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                  >
                    <Copy size={15} />
                    Copy message
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setForwardingMessage(activeMenuMessage);
                    setOpenMessageMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                >
                  <Forward size={15} />
                  Forward
                </button>
                <div className="px-4 py-2">
                  <div className="text-xs text-slate-500 mb-2 inline-flex items-center gap-2">
                    <SmilePlus size={14} />
                    React
                  </div>
                  <div className="flex gap-2">
                    {['👍', '❤️', '😂', '🔥'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => addReaction(activeMenuMessage.id, emoji)}
                        className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                {activeMenuMessage.type === 'voice' && (
                  <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2">
                    <p className="text-xs text-slate-500 mb-2">Playback speed</p>
                    <div className="flex flex-wrap gap-2">
                      {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => {
                            setMessagePlaybackRates((prev) => ({ ...prev, [activeMenuMessage.id]: speed }));
                            setOpenMessageMenu(null);
                          }}
                          className={`px-2 py-1 text-xs rounded-md ${
                            (messagePlaybackRates[activeMenuMessage.id] ?? 1) === speed
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  );
}
