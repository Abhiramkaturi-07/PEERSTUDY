export interface User {
  id: number;
  name: string;
  email: string;
  branch: string;
  goals?: string;
  group_preference?: number;
  group_id?: number | null;
  subjects?: UserSubject[];
}

export interface UserSubject {
  subject_name: string;
  score: number;
}

export interface Group {
  id: number;
  name: string;
  icon_url?: string | null;
  members: User[];
  messages: Message[];
  tasks: Task[];
}

export interface Message {
  id: number;
  group_id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'pdf' | 'voice';
  timestamp: string;
}

export interface Task {
  id: number;
  group_id: number;
  creator_id: number;
  creator_name: string;
  subject: string;
  content: string;
  completion_count: number;
  created_at: string;
}

export interface Recommendation extends User {
  compatibility: number;
  strongestSubjects: string[];
  allSubjects: UserSubject[];
}

export interface NoteAnnotation {
  id: string;
  type: 'comment' | 'drawing';
  text?: string;
  dataUrl?: string;
  createdAt: string;
}

export interface NoteItem {
  id: number;
  user_id: number;
  group_id?: number | null;
  file_name: string;
  file_url: string;
  file_type: string;
  subject_tags: string[];
  type: string;
  description?: string;
  reviewed: boolean;
  annotations: NoteAnnotation[];
  created_at: string;
}
