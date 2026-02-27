import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("peerstudy.db");
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

const parseTags = (input: any): string[] => {
  if (Array.isArray(input)) return input.map((v) => String(v)).filter(Boolean);
  if (typeof input === "string") {
    if (!input.trim()) return [];
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
      return [];
    } catch {
      // Supports comma-separated fallback from clients.
      return input.split(",").map((v) => v.trim()).filter(Boolean);
    }
  }
  return [];
};

const normalizeFileUrl = (rawUrl: string): string => {
  if (!rawUrl) return rawUrl;
  try {
    const u = new URL(rawUrl);
    return u.pathname.startsWith("/uploads/") ? u.pathname : rawUrl;
  } catch {
    return rawUrl;
  }
};

const inferFileTypeFromName = (fileName: string): string => {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if ([".jpg", ".jpeg", ".png"].includes(ext)) return "image/jpeg";
  if (ext === ".docx" || ext === ".doc") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".ppt" || ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".txt") return "text/plain";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mp3" || ext === ".wav" || ext === ".m4a") return "audio/webm";
  return "application/octet-stream";
};

const extensionFromName = (name: string): string => {
  const ext = path.extname(name || "");
  return ext || "";
};

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    goals TEXT,
    group_preference INTEGER DEFAULT 3,
    group_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS user_subjects (
    user_id INTEGER,
    subject_name TEXT,
    score INTEGER,
    PRIMARY KEY (user_id, subject_name),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    sender_id INTEGER,
    sender_name TEXT,
    content TEXT,
    type TEXT DEFAULT 'text',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    creator_id INTEGER,
    subject TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (creator_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS task_completions (
    task_id INTEGER,
    user_id INTEGER,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, user_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    group_id INTEGER,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    subject_tags TEXT DEFAULT '[]',
    type TEXT DEFAULT 'Lecture',
    description TEXT,
    reviewed INTEGER DEFAULT 0,
    annotations TEXT DEFAULT '[]',
    chat_message_id INTEGER,
    file_size INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES groups(id)
  );
`);

const ensureGroupsIconColumn = () => {
  const columns: any[] = db.prepare("PRAGMA table_info(groups)").all();
  const hasIconColumn = columns.some((c: any) => c.name === "icon_url");
  if (!hasIconColumn) {
    db.exec("ALTER TABLE groups ADD COLUMN icon_url TEXT");
  }
};

ensureGroupsIconColumn();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

app.use(express.json());

// File Upload Setup
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const voiceUploadDir = path.join(uploadDir, "voice");
if (!fs.existsSync(voiceUploadDir)) {
  fs.mkdirSync(voiceUploadDir, { recursive: true });
}
const notesUploadDir = path.join(uploadDir, "notes");
if (!fs.existsSync(notesUploadDir)) {
  fs.mkdirSync(notesUploadDir, { recursive: true });
}
const groupUploadDir = path.join(uploadDir, "groups");
if (!fs.existsSync(groupUploadDir)) {
  fs.mkdirSync(groupUploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, voiceUploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
});

const allowedVoiceMimeTypes = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/mp4",
  "audio/x-m4a",
  "video/webm",
]);

const voiceUpload = multer({
  storage: voiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = new Set([".mp3", ".wav", ".m4a", ".webm"]);
    if (allowedVoiceMimeTypes.has(file.mimetype) || allowedExt.has(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only audio files (.mp3, .wav, .m4a, .webm) are allowed"));
  },
});

const notesStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, notesUploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
});

const allowedNoteExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".docx", ".doc", ".ppt", ".pptx", ".txt"]);
const allowedNoteMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

const notesUpload = multer({
  storage: notesStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedNoteExtensions.has(ext) || allowedNoteMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Unsupported note file type"));
  },
});

const groupIconStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, groupUploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
});

const groupIconUpload = multer({
  storage: groupIconStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
    const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    if (allowedExt.has(ext) || allowedMime.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image files are allowed for group icon"));
  },
});

app.use("/uploads", express.static("uploads"));

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- API ROUTES ---

// Auth
app.post("/api/auth/register", async (req, res) => {
  const { name, branch, email, password, goals } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (name, branch, email, password, goals) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run(name, branch, email, hashedPassword, goals);
    const token = jwt.sign({ id: result.lastInsertRowid, email }, JWT_SECRET);
    res.json({ token, user: { id: result.lastInsertRowid, name, email, branch, goals } });
  } catch (err: any) {
    res.status(400).json({ error: "Email already exists" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, branch: user.branch, goals: user.goals, group_id: user.group_id } });
});

// User Profile & Subjects
app.get("/api/user/profile", authenticateToken, (req: any, res) => {
  const user: any = db.prepare("SELECT id, name, branch, email, goals, group_preference, group_id FROM users WHERE id = ?").get(req.user.id);
  const subjects = db.prepare("SELECT subject_name, score FROM user_subjects WHERE user_id = ?").all(req.user.id);
  res.json({ ...user, subjects });
});

app.post("/api/user/subjects", authenticateToken, (req: any, res) => {
  const { subjects, groupPreference } = req.body;
  
  const deleteStmt = db.prepare("DELETE FROM user_subjects WHERE user_id = ?");
  const insertStmt = db.prepare("INSERT INTO user_subjects (user_id, subject_name, score) VALUES (?, ?, ?)");
  const updatePrefStmt = db.prepare("UPDATE users SET group_preference = ? WHERE id = ?");

  const transaction = db.transaction(() => {
    deleteStmt.run(req.user.id);
    for (const [name, score] of Object.entries(subjects)) {
      insertStmt.run(req.user.id, name, score);
    }
    updatePrefStmt.run(groupPreference, req.user.id);
  });

  transaction();
  res.json({ success: true });
});

// Matching Algorithm
app.get("/api/match", authenticateToken, (req: any, res) => {
  const currentUser: any = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  const currentSubjects = db.prepare("SELECT * FROM user_subjects WHERE user_id = ?").all(req.user.id);
  
  // Find other users who are not in a group
  const others = db.prepare("SELECT id, name, branch, goals, group_preference FROM users WHERE id != ? AND group_id IS NULL").all(req.user.id);
  
  const recommendations = others.map((other: any) => {
    const otherSubjects = db.prepare("SELECT * FROM user_subjects WHERE user_id = ?").all(other.id);
    
    let score = 0;
    // Complementary strengths: Higher if one is strong where other is weak
    currentSubjects.forEach(cs => {
      const os = otherSubjects.find(s => s.subject_name === cs.subject_name);
      if (os) {
        // If current user is weak (<4) and other is strong (>7)
        if (cs.score < 4 && os.score > 7) score += 10;
        // If current user is strong (>7) and other is weak (<4)
        if (cs.score > 7 && os.score < 4) score += 10;
      }
    });

    // Similar group size preference
    if (currentUser.group_preference === other.group_preference) score += 5;

    return {
      ...other,
      compatibility: score,
      strongestSubjects: otherSubjects.filter(s => s.score > 7).map(s => s.subject_name),
      allSubjects: otherSubjects
    };
  }).sort((a, b) => b.compatibility - a.compatibility).slice(0, 10);

  res.json(recommendations);
});

// Group Management
app.post("/api/groups/join", authenticateToken, (req: any, res) => {
  const { memberIds, groupName } = req.body;
  const groupResult = db.prepare("INSERT INTO groups (name) VALUES (?)").run(groupName || "New Study Group");
  const groupId = groupResult.lastInsertRowid;

  const updateStmt = db.prepare("UPDATE users SET group_id = ? WHERE id = ?");
  const transaction = db.transaction(() => {
    updateStmt.run(groupId, req.user.id);
    memberIds.forEach((id: number) => updateStmt.run(groupId, id));
  });
  transaction();

  res.json({ groupId });
});

app.get("/api/groups/:id", authenticateToken, (req: any, res) => {
  const group = db.prepare("SELECT * FROM groups WHERE id = ?").get(req.params.id);
  const members = db.prepare("SELECT id, name, branch, email, goals FROM users WHERE group_id = ?").all(req.params.id);
  const messages = db.prepare("SELECT * FROM messages WHERE group_id = ? ORDER BY timestamp ASC").all(req.params.id);
  const tasks = db.prepare(`
    SELECT t.*, u.name as creator_name,
    (SELECT COUNT(*) FROM task_completions tc WHERE tc.task_id = t.id) as completion_count
    FROM tasks t
    JOIN users u ON t.creator_id = u.id
    WHERE t.group_id = ?
  `).all(req.params.id);

  res.json({ ...group, members, messages, tasks });
});

app.get("/api/groups/:id/messages", authenticateToken, (req: any, res) => {
  const groupId = Number(req.params.id);
  const search = String(req.query.search || "").trim().toLowerCase();
  const membership: any = db
    .prepare("SELECT id FROM users WHERE id = ? AND group_id = ?")
    .get(req.user.id, groupId);
  if (!membership) return res.status(403).json({ error: "Not allowed" });

  if (!search) {
    const messages = db
      .prepare("SELECT * FROM messages WHERE group_id = ? ORDER BY timestamp DESC LIMIT 100")
      .all(groupId);
    return res.json({ messages });
  }

  const messages = db
    .prepare(
      "SELECT * FROM messages WHERE group_id = ? AND LOWER(content) LIKE ? ORDER BY timestamp DESC LIMIT 100"
    )
    .all(groupId, `%${search}%`);
  return res.json({ messages });
});

app.patch("/api/groups/:id", authenticateToken, (req: any, res) => {
  const groupId = Number(req.params.id);
  const membership: any = db
    .prepare("SELECT id FROM users WHERE id = ? AND group_id = ?")
    .get(req.user.id, groupId);
  if (!membership) return res.status(403).json({ error: "Not allowed" });

  const existing: any = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  if (!existing) return res.status(404).json({ error: "Group not found" });

  const nextName = typeof req.body.name === "string" ? req.body.name.trim() : existing.name;
  const hasIconField = Object.prototype.hasOwnProperty.call(req.body, "icon_url");
  const nextIcon = hasIconField
    ? (req.body.icon_url === null
        ? null
        : (typeof req.body.icon_url === "string" ? (req.body.icon_url.trim() || null) : existing.icon_url))
    : existing.icon_url;
  if (!nextName) return res.status(400).json({ error: "Group name is required" });

  db.prepare("UPDATE groups SET name = ?, icon_url = ? WHERE id = ?").run(nextName, nextIcon || null, groupId);
  const updated: any = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  io.to(`group-${groupId}`).emit("group-updated", updated);
  return res.json({ success: true, group: updated });
});

app.put("/api/groups/:id", authenticateToken, (req: any, res) => {
  const groupId = Number(req.params.id);
  const membership: any = db
    .prepare("SELECT id FROM users WHERE id = ? AND group_id = ?")
    .get(req.user.id, groupId);
  if (!membership) return res.status(403).json({ error: "Not allowed" });

  const existing: any = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  if (!existing) return res.status(404).json({ error: "Group not found" });

  const nextName = typeof req.body.name === "string" ? req.body.name.trim() : existing.name;
  const hasIconField = Object.prototype.hasOwnProperty.call(req.body, "icon_url");
  const nextIcon = hasIconField
    ? (req.body.icon_url === null
        ? null
        : (typeof req.body.icon_url === "string" ? (req.body.icon_url.trim() || null) : existing.icon_url))
    : existing.icon_url;
  if (!nextName) return res.status(400).json({ error: "Group name is required" });

  db.prepare("UPDATE groups SET name = ?, icon_url = ? WHERE id = ?").run(nextName, nextIcon || null, groupId);
  const updated: any = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  io.to(`group-${groupId}`).emit("group-updated", updated);
  return res.json({ success: true, group: updated });
});

app.post("/api/groups/:id/icon", authenticateToken, groupIconUpload.single("icon"), (req: any, res) => {
  const groupId = Number(req.params.id);
  const membership: any = db
    .prepare("SELECT id FROM users WHERE id = ? AND group_id = ?")
    .get(req.user.id, groupId);
  if (!membership) return res.status(403).json({ error: "Not allowed" });
  if (!req.file) return res.status(400).json({ error: "No icon file uploaded" });

  const iconUrl = `/uploads/groups/${req.file.filename}`;
  db.prepare("UPDATE groups SET icon_url = ? WHERE id = ?").run(iconUrl, groupId);
  const updated: any = db.prepare("SELECT * FROM groups WHERE id = ?").get(groupId);
  io.to(`group-${groupId}`).emit("group-updated", updated);
  return res.json({ success: true, iconUrl, group: updated });
});

app.delete("/api/groups/:id/messages", authenticateToken, (req: any, res) => {
  const groupId = Number(req.params.id);
  const membership: any = db
    .prepare("SELECT id FROM users WHERE id = ? AND group_id = ?")
    .get(req.user.id, groupId);
  if (!membership) return res.status(403).json({ error: "Not allowed" });

  db.prepare("DELETE FROM messages WHERE group_id = ?").run(groupId);
  io.to(`group-${groupId}`).emit("chat-cleared", { group_id: groupId });
  return res.json({ success: true });
});

app.post("/api/groups/:id/clear-chat", authenticateToken, (req: any, res) => {
  const groupId = Number(req.params.id);
  const membership: any = db
    .prepare("SELECT id FROM users WHERE id = ? AND group_id = ?")
    .get(req.user.id, groupId);
  if (!membership) return res.status(403).json({ error: "Not allowed" });

  db.prepare("DELETE FROM messages WHERE group_id = ?").run(groupId);
  io.to(`group-${groupId}`).emit("chat-cleared", { group_id: groupId });
  return res.json({ success: true });
});

app.post("/api/groups/:id/tasks", authenticateToken, (req: any, res) => {
  const { subject, content } = req.body;
  db.prepare("INSERT INTO tasks (group_id, creator_id, subject, content) VALUES (?, ?, ?, ?)")
    .run(req.params.id, req.user.id, subject, content);
  res.json({ success: true });
});

app.post("/api/tasks/:id/complete", authenticateToken, (req: any, res) => {
  try {
    db.prepare("INSERT INTO task_completions (task_id, user_id) VALUES (?, ?)")
      .run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: "Already completed" });
  }
});

app.post("/api/groups/:id/leave", authenticateToken, (req: any, res) => {
  db.prepare("UPDATE users SET group_id = NULL WHERE id = ?").run(req.user.id);
  res.json({ success: true });
});

app.put("/api/messages/:id", authenticateToken, (req: any, res) => {
  const { content } = req.body;
  const messageId = Number(req.params.id);
  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ error: "Message content is required" });
  }

  const existing: any = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
  if (!existing) return res.status(404).json({ error: "Message not found" });
  if (existing.sender_id !== req.user.id) return res.status(403).json({ error: "Not allowed" });

  db.prepare("UPDATE messages SET content = ? WHERE id = ?").run(content.trim(), messageId);
  const updated: any = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
  io.to(`group-${updated.group_id}`).emit("message-updated", updated);
  res.json({ success: true, message: updated });
});

app.delete("/api/messages/:id", authenticateToken, (req: any, res) => {
  const messageId = Number(req.params.id);
  const existing: any = db.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
  if (!existing) return res.status(404).json({ error: "Message not found" });
  if (existing.sender_id !== req.user.id) return res.status(403).json({ error: "Not allowed" });

  db.prepare("DELETE FROM messages WHERE id = ?").run(messageId);
  io.to(`group-${existing.group_id}`).emit("message-deleted", {
    id: messageId,
    group_id: existing.group_id,
  });
  res.json({ success: true });
});

app.post("/api/upload", authenticateToken, upload.single("file"), (req: any, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");
  res.json({ url: `/uploads/${req.file.filename}`, type: req.file.mimetype });
});

app.post("/api/chat/upload-voice", authenticateToken, voiceUpload.single("voice"), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No voice file uploaded" });
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const fileUrl = `${baseUrl}/uploads/voice/${req.file.filename}`;
  res.json({
    success: true,
    fileUrl,
  });
});

app.post("/api/notes/upload", authenticateToken, notesUpload.single("file"), (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const subjectTags = parseTags(req.body.subjectTags);
    const noteType = req.body.type || "Lecture";
    const description = req.body.description || "";
    const groupId = req.body.groupId ? Number(req.body.groupId) : null;
    const requestedFileName = typeof (req.body.fileName ?? req.body.file_name) === "string"
      ? String(req.body.fileName ?? req.body.file_name).trim()
      : "";
    const sanitizedRequestedName = (requestedFileName || req.file.originalname).replace(/[\\/:*?"<>|]/g, "_").trim();
    let safeFileName = sanitizedRequestedName || req.file.originalname;
    // Preserve extension when custom upload name has none.
    if (!extensionFromName(safeFileName)) {
      const originalExt = extensionFromName(req.file.originalname);
      safeFileName = `${safeFileName}${originalExt}`;
    }

    const duplicate: any = db
      .prepare(
        "SELECT id FROM notes WHERE user_id = ? AND file_name = ? AND file_size = ? LIMIT 1"
      )
      .get(req.user.id, safeFileName, req.file.size);
    if (duplicate) {
      return res.status(409).json({ error: "Duplicate upload detected" });
    }

    const fileUrl = `/uploads/notes/${req.file.filename}`;
    const result = db
      .prepare(
        `INSERT INTO notes
          (user_id, group_id, file_name, file_url, file_type, subject_tags, type, description, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user.id,
        groupId,
        safeFileName,
        fileUrl,
        req.file.mimetype,
        JSON.stringify(subjectTags),
        noteType,
        description,
        req.file.size
      );

    const note: any = db.prepare("SELECT * FROM notes WHERE id = ?").get(result.lastInsertRowid);
    res.json({
      success: true,
      note: {
        ...note,
        reviewed: Boolean(note.reviewed),
        subject_tags: JSON.parse(note.subject_tags || "[]"),
        annotations: JSON.parse(note.annotations || "[]"),
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "Failed to upload note" });
  }
});

app.get("/api/notes", authenticateToken, (req: any, res) => {
  const search = (req.query.search as string) || "";
  const reviewed = req.query.reviewed as string | undefined;
  const subject = (req.query.subject as string) || "";
  const type = (req.query.type as string) || "";
  const sort = (req.query.sort as string) || "newest";
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;

  const where: string[] = ["user_id = ?"];
  const params: any[] = [req.user.id];

  if (search) {
    where.push("LOWER(file_name) LIKE ?");
    params.push(`%${search.toLowerCase()}%`);
  }
  if (reviewed === "true" || reviewed === "false") {
    where.push("reviewed = ?");
    params.push(reviewed === "true" ? 1 : 0);
  }
  if (type) {
    where.push("type = ?");
    params.push(type);
  }
  if (subject) {
    where.push("subject_tags LIKE ?");
    params.push(`%${subject}%`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const orderBy = sort === "oldest" ? "created_at ASC" : "created_at DESC";
  const totalRow: any = db.prepare(`SELECT COUNT(*) as count FROM notes ${whereSql}`).get(...params);
  const notes: any[] = db
    .prepare(`SELECT * FROM notes ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)
    .map((n) => ({
      ...n,
      reviewed: Boolean(n.reviewed),
      subject_tags: JSON.parse(n.subject_tags || "[]"),
      annotations: JSON.parse(n.annotations || "[]"),
    }));

  res.json({
    notes,
    page,
    limit,
    total: totalRow.count,
    totalPages: Math.max(1, Math.ceil(totalRow.count / limit)),
  });
});

app.put("/api/notes/:id", authenticateToken, (req: any, res) => {
  const id = Number(req.params.id);
  const existing: any = db.prepare("SELECT * FROM notes WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Note not found" });

  const reviewed = req.body.reviewed !== undefined ? (req.body.reviewed ? 1 : 0) : existing.reviewed;
  const description = req.body.description !== undefined ? req.body.description : existing.description;
  const type = req.body.type !== undefined ? req.body.type : existing.type;
  const subjectTags = req.body.subjectTags !== undefined ? JSON.stringify(req.body.subjectTags || []) : existing.subject_tags;
  const annotations = req.body.annotations !== undefined ? JSON.stringify(req.body.annotations || []) : existing.annotations;
  const requestedFileName = typeof (req.body.fileName ?? req.body.file_name) === "string"
    ? String(req.body.fileName ?? req.body.file_name).trim()
    : "";
  const sanitizedFileName = requestedFileName
    ? requestedFileName.replace(/[\\/:*?"<>|]/g, "_").trim()
    : existing.file_name;
  const fileName = sanitizedFileName || existing.file_name;

  db.prepare(
    "UPDATE notes SET reviewed = ?, description = ?, type = ?, subject_tags = ?, annotations = ?, file_name = ? WHERE id = ?"
  ).run(reviewed, description, type, subjectTags, annotations, fileName, id);

  const note: any = db.prepare("SELECT * FROM notes WHERE id = ?").get(id);
  res.json({
    success: true,
    note: {
      ...note,
      reviewed: Boolean(note.reviewed),
      subject_tags: JSON.parse(note.subject_tags || "[]"),
      annotations: JSON.parse(note.annotations || "[]"),
    },
  });
});

app.patch("/api/notes/:id/rename", authenticateToken, (req: any, res) => {
  const id = Number(req.params.id);
  const existing: any = db.prepare("SELECT * FROM notes WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Note not found" });

  const requestedFileName = typeof (req.body.fileName ?? req.body.file_name) === "string"
    ? String(req.body.fileName ?? req.body.file_name).trim()
    : "";
  if (!requestedFileName) return res.status(400).json({ error: "File name is required" });

  const sanitized = requestedFileName.replace(/[\\/:*?"<>|]/g, "_").trim();
  if (!sanitized) return res.status(400).json({ error: "Invalid file name" });

  db.prepare("UPDATE notes SET file_name = ? WHERE id = ?").run(sanitized, id);
  const note: any = db.prepare("SELECT * FROM notes WHERE id = ?").get(id);
  res.json({
    success: true,
    note: {
      ...note,
      reviewed: Boolean(note.reviewed),
      subject_tags: JSON.parse(note.subject_tags || "[]"),
      annotations: JSON.parse(note.annotations || "[]"),
    },
  });
});

app.delete("/api/notes/:id", authenticateToken, (req: any, res) => {
  const id = Number(req.params.id);
  const existing: any = db.prepare("SELECT * FROM notes WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Note not found" });

  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
  res.json({ success: true });
});

app.post("/api/notes/save-from-chat", authenticateToken, (req: any, res) => {
  const { groupId, type = "Lecture", description = "", chatMessageId } = req.body;
  const rawUrl = req.body.fileUrl as string;
  const normalizedUrl = normalizeFileUrl(rawUrl);
  const rawFileName = req.body.fileName || path.basename(normalizedUrl || "") || "chat-file";
  const fileName = String(rawFileName).replace(/[\\/:*?"<>|]/g, "_").trim() || "chat-file";
  const fileType = req.body.fileType || inferFileTypeFromName(fileName);
  const subjectTags = parseTags(req.body.subjectTags);

  if (!normalizedUrl || !fileName || !fileType) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (groupId) {
    const membership: any = db
      .prepare("SELECT id FROM users WHERE id = ? AND group_id = ?")
      .get(req.user.id, Number(groupId));
    if (!membership) return res.status(403).json({ error: "Not a group member" });
  }

  const duplicate: any = db
    .prepare("SELECT id FROM notes WHERE user_id = ? AND file_url = ? LIMIT 1")
    .get(req.user.id, normalizedUrl);
  if (duplicate) return res.status(409).json({ error: "Already saved in notes" });

  const result = db
    .prepare(
      `INSERT INTO notes
      (user_id, group_id, file_name, file_url, file_type, subject_tags, type, description, chat_message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      groupId ? Number(groupId) : null,
      fileName,
      normalizedUrl,
      fileType,
      JSON.stringify(subjectTags),
      type,
      description,
      chatMessageId || null
    );

  const note: any = db.prepare("SELECT * FROM notes WHERE id = ?").get(result.lastInsertRowid);
  res.json({
    success: true,
    note: {
      ...note,
      reviewed: Boolean(note.reviewed),
      subject_tags: JSON.parse(note.subject_tags || "[]"),
      annotations: JSON.parse(note.annotations || "[]"),
    },
  });
});

app.use((err: any, req: any, res: any, next: any) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Max size is 10MB." });
    }
    return res.status(400).json({ error: err.message || "Upload failed" });
  }

  if (typeof err.message === "string" && err.message) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: "Internal server error" });
});

// Socket.io logic
io.on("connection", (socket) => {
  socket.on("join-group", (groupId) => {
    socket.join(`group-${groupId}`);
  });

  const handleIncomingMessage = (data: any) => {
    const groupId = data.groupId ?? data.group_id;
    const senderId = data.senderId ?? data.sender_id;
    const senderName = data.senderName ?? data.sender_name ?? data.sender;
    const content = data.content;
    const type = data.type;
    if (!groupId || !senderId || !senderName || !content || !type) return;

    const stmt = db.prepare("INSERT INTO messages (group_id, sender_id, sender_name, content, type) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run(groupId, senderId, senderName, content, type);
    
    const message = {
      id: result.lastInsertRowid,
      group_id: groupId,
      sender_id: senderId,
      sender_name: senderName,
      content,
      type,
      timestamp: new Date().toISOString(),
      groupId,
      senderId,
      senderName,
    };

    io.to(`group-${groupId}`).emit("new-message", message);
  };

  socket.on("send-message", handleIncomingMessage);
  socket.on("sendMessage", handleIncomingMessage);
});

// Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
