const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const COMPLAINTS_FILE = path.join(DATA_DIR, "complaints.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
for (const file of [USERS_FILE, COMPLAINTS_FILE]) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, "[]", "utf8");
}

function readJson(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Could not read ${path.basename(file)}; using an empty list:`, error.message);
    return [];
  }
}
function writeJson(file, value) {
  const tempFile = file + ".tmp";
  fs.writeFileSync(tempFile, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tempFile, file);
}
function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department || "" };
}
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Please sign in to continue." });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Please sign in to continue." });
  if (req.session.user.role !== "admin") return res.status(403).json({ error: "Administrator access required." });
  next();
}
function clean(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "college_complaint_sid",
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 4 }
}));
app.use(express.static(path.join(__dirname, "public")));

// Create a default administrator once, so the project works immediately after npm install.
async function ensureAdmin() {
  const users = readJson(USERS_FILE);
  const email = (process.env.ADMIN_EMAIL || "admin@college.edu").toLowerCase();
  if (!users.some(u => u.email === email)) {
    users.push({
      id: "usr_admin",
      name: "College Administrator",
      email,
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin@123", 10),
      role: "admin",
      department: "Administration",
      createdAt: new Date().toISOString()
    });
    writeJson(USERS_FILE, users);
    console.log(`Default admin created: ${email}`);
    if (!process.env.ADMIN_PASSWORD) console.log("Default admin password: Admin@123 (change it for real deployments)");
  }
}

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post("/api/register", async (req, res) => {
  const name = clean(req.body.name, 80);
  const email = clean(req.body.email, 150).toLowerCase();
  const department = clean(req.body.department, 80);
  const password = String(req.body.password || "");
  if (!name || !email || !password) return res.status(400).json({ error: "Name, email and password are required." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8) return res.status(400).json({ error: "Password must contain at least 8 characters." });

  const users = readJson(USERS_FILE);
  if (users.some(u => u.email === email)) {
    return res.status(409).json({ error: "An account with this email already exists. Please sign in instead." });
  }
  const user = {
    id: "usr_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name, email, department,
    passwordHash: await bcrypt.hash(password, 10),
    role: "student",
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeJson(USERS_FILE, users);
  req.session.user = safeUser(user);
  res.status(201).json({ user: req.session.user });
});

app.post("/api/login", async (req, res) => {
  const email = clean(req.body.email, 150).toLowerCase();
  const password = String(req.body.password || "");
  const user = readJson(USERS_FILE).find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  req.session.user = safeUser(user);
  res.json({ user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("college_complaint_sid");
    res.json({ success: true });
  });
});

app.get("/api/complaints", requireAuth, (req, res) => {
  let complaints = readJson(COMPLAINTS_FILE);
  if (req.session.user.role !== "admin") {
    complaints = complaints.filter(c => c.studentId === req.session.user.id);
  }
  complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ complaints });
});

app.post("/api/complaints", requireAuth, (req, res) => {
  if (req.session.user.role === "admin") return res.status(403).json({ error: "Administrators cannot submit student complaints." });
  const title = clean(req.body.title, 120);
  const category = clean(req.body.category, 60);
  const priority = clean(req.body.priority || "Medium", 20);
  const description = clean(req.body.description, 4000);
  const location = clean(req.body.location, 150);
  if (!title || !category || !description) return res.status(400).json({ error: "Title, category and description are required." });
  if (!["Low", "Medium", "High"].includes(priority)) return res.status(400).json({ error: "Choose a valid priority." });

  const complaint = {
    id: "CMP-" + Date.now().toString().slice(-7) + Math.random().toString(10).slice(2, 4),
    studentId: req.session.user.id,
    studentName: req.session.user.name,
    studentEmail: req.session.user.email,
    department: req.session.user.department || "",
    title, category, priority, description, location,
    status: "Submitted",
    adminResponse: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const complaints = readJson(COMPLAINTS_FILE);
  complaints.push(complaint);
  writeJson(COMPLAINTS_FILE, complaints);
  res.status(201).json({ complaint });
});

app.patch("/api/complaints/:id", requireAdmin, (req, res) => {
  const status = clean(req.body.status, 30);
  const adminResponse = clean(req.body.adminResponse, 2000);
  const allowed = ["Submitted", "Under Review", "In Progress", "Resolved", "Rejected"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid complaint status." });
  const complaints = readJson(COMPLAINTS_FILE);
  const complaint = complaints.find(c => c.id === req.params.id);
  if (!complaint) return res.status(404).json({ error: "Complaint not found." });
  complaint.status = status;
  complaint.adminResponse = adminResponse;
  complaint.updatedAt = new Date().toISOString();
  writeJson(COMPLAINTS_FILE, complaints);
  res.json({ complaint });
});

app.get("/api/admin/summary", requireAdmin, (req, res) => {
  const complaints = readJson(COMPLAINTS_FILE);
  const users = readJson(USERS_FILE).filter(u => u.role === "student");
  res.json({
    total: complaints.length,
    submitted: complaints.filter(c => c.status === "Submitted").length,
    active: complaints.filter(c => ["Under Review", "In Progress"].includes(c.status)).length,
    resolved: complaints.filter(c => c.status === "Resolved").length,
    students: users.length
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

ensureAdmin().then(() => {
  app.listen(PORT, () => console.log(`College Complaint Management System running at http://localhost:${PORT}`));
}).catch(err => {
  console.error("Could not initialize administrator:", err);
  process.exit(1);
});
