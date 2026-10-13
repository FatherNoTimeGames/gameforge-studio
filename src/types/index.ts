export type TargetEngineId =
  | 'godot4'
  | 'unity'
  | 'godot3'
  | 'unreal'
  | 'phaser'
  | 'pygame'
  | 'bevy';

export interface TargetEngine {
  id: TargetEngineId;
  name: string;
  lang: string;
  extension: string;
  category: '2D/3D Engine' | '3D AAA' | 'Web' | 'Framework';
  icon: string;
  description: string;
  syntaxHighlights: string;
}

export interface PageHistoryItem {
  content: string;
  title: string;
  at: number;
}

export interface WikiPage {
  id: string;
  title: string;
  parentId?: string | null;
  content: string;
  lastModified: number;
  summary?: string;
  keywords?: string[];
  needsReview?: false | 'warning' | 'error';
  sourceRefs?: string[];
  history?: PageHistoryItem[];
  tags?: string[];
  category?: 'Core' | 'Mechanics' | 'Systems' | 'World' | 'Tech';
}

export interface SourceItem {
  id: string;
  title: string;
  kind: 'paste' | 'file' | 'url';
  text: string;
  url?: string;
  progress?: number;
  addedAt: number;
}

export interface VerificationVerdict {
  title: string;
  status: 'ok' | 'warning' | 'error';
  issues: string[];
  unsupported: string[];
  missing: string[];
}

export type RightTab = 'concept' | 'teacher' | 'context';
export type LeftTab = 'wiki' | 'edit' | 'builder';
export type WikiViewMode = 'edit' | 'preview' | 'split';

export type ActionType =
  | 'discuss'
  | 'recompile'
  | 'balance'
  | 'teach'
  | 'wiki_edit'
  | 'test_logic'
  | 'apply_agreed';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actionType: ActionType;
  timestamp: number;
  engineTarget?: string;
  modelUsed?: string;
  imageName?: string;
  applied?: boolean;
}

export interface Snapshot {
  id: string;
  name: string;
  timestamp: number;
  pageCount: number;
  state: {
    projectName: string;
    targetEngineId: TargetEngineId;
    pages: WikiPage[];
    conceptNotepad?: string;
    teacherNotepad?: string;
    notepad?: string;
    sources: SourceItem[];
  };
}

export interface ProjectData {
  id: string;
  name: string;
  manualName: boolean;
  updatedAt: number;
  targetEngineId: TargetEngineId;
  pages: WikiPage[];
  sources: SourceItem[];
  conceptNotepad: string;
  teacherNotepad: string;
  notepad?: string;
  chatConcept: ChatMessage[];
  chatTeacher: ChatMessage[];
  snapshots: Snapshot[];
}

export interface ToastNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface AutoVerifyProgress {
  isRunning: boolean;
  currentPass: number;
  maxPasses: number;
  statusMessage: string;
  cleanPagesCount: number;
  totalPagesCount: number;
  issuesResolvedTotal: number;
}
