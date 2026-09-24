import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

// ── Firebase Admin (server-side) ───────────────────────────
// Uses the API key approach via REST for simplicity
// (no service account needed with Firestore REST API)
const projectId = process.env.FIREBASE_PROJECT_ID;
const apiKey    = process.env.FIREBASE_API_KEY;

// Fetch todos via Firestore REST API (no service account needed)
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/todos?key=${apiKey}&orderBy=createdAt`;

const response = await fetch(url);
if (!response.ok) {
  console.error('Failed to fetch todos:', await response.text());
  process.exit(1);
}

const data = await response.json();
const documents = data.documents || [];

// Parse Firestore field format into plain objects
function parseField(field) {
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.integerValue !== undefined) return parseInt(field.integerValue);
  if (field.timestampValue !== undefined) return field.timestampValue;
  return '';
}

const todos = documents
  .map(doc => {
    const f = doc.fields || {};
    return {
      text:      parseField(f.text      || {}),
      completed: parseField(f.completed || { booleanValue: false }),
      dueDate:   parseField(f.dueDate   || {}),
      category:  parseField(f.category  || {}),
      priority:  parseField(f.priority  || {}),
      createdAt: parseField(f.createdAt || {}),
    };
  })
  .filter(t => !t.completed); // only active todos

// ── Build email ────────────────────────────────────────────
const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  timeZone: 'America/Chicago'
});

function getDueLabel(dueDate) {
  if (!dueDate) return '';
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  if (due < todayDate) return ' ⚠️ OVERDUE';
  if (due.getTime() === todayDate.getTime()) return ' ⏰ DUE TODAY';
  return ` 📅 Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function getPriorityLabel(priority) {
  if (priority === 'high') return ' 🔴 High';
  if (priority === 'low')  return ' 🔵 Low';
  return '';
}

// Plain text version
const textLines = todos.length === 0
  ? ['🎉 All clear! No active tasks today.']
  : todos.map((t, i) => {
      const parts = [`${i + 1}. ${t.text}`];
      if (t.category) parts.push(`   Category: ${t.category}`);
      if (t.priority && t.priority !== 'normal') parts.push(`   Priority: ${t.priority}`);
      if (t.dueDate) parts.push(`   Due: ${t.dueDate}${getDueLabel(t.dueDate)}`);
      return parts.join('\n');
    });

const textBody = `🌿 Your Daily Todo List — ${today}\n\n${textLines.join('\n\n')}\n\n— Your Todo App`;

// HTML version
const htmlRows = todos.length === 0
  ? `<tr><td colspan="3" style="text-align:center;padding:24px;color:#7a6552;font-style:italic;">🎉 All clear! No active tasks today.</td></tr>`
  : todos.map((t, i) => {
      const priorityColor = t.priority === 'high' ? '#c0392b' : t.priority === 'low' ? '#8b5e3c' : '#3d6b1f';
      const dueLabel = getDueLabel(t.dueDate);
      const isOverdue = dueLabel.includes('OVERDUE');
      return `
        <tr style="border-bottom:1px solid #f0dfc8;">
          <td style="padding:12px 8px;font-size:13px;color:#7a6552;">${i + 1}</td>
          <td style="padding:12px 8px;">
            <div style="font-size:15px;font-weight:500;color:#2c1a0e;">${t.text}</div>
            <div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:6px;">
              ${t.category ? `<span style="background:#d6ebbc;color:#2d5016;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">${t.category}</span>` : ''}
              ${t.priority && t.priority !== 'normal' ? `<span style="background:${t.priority === 'high' ? '#fdecea' : '#f0dfc8'};color:${priorityColor};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">${t.priority} priority</span>` : ''}
              ${t.dueDate ? `<span style="background:${isOverdue ? '#fdecea' : '#eef6e3'};color:${isOverdue ? '#c0392b' : '#2d5016'};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">${t.dueDate}${dueLabel}</span>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5ede0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(59,33,7,0.12);border:1px solid #d9c4aa;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#2d5016,#4e8a28);padding:28px 32px;">
      <div style="font-size:28px;margin-bottom:4px;">🌿</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Your Daily Todo List</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${today}</p>
    </div>

    <!-- Stats bar -->
    <div style="background:#eef6e3;padding:10px 32px;border-bottom:1px solid #d6ebbc;">
      <p style="margin:0;font-size:13px;color:#3d6b1f;font-weight:600;">
        📋 ${todos.length} active task${todos.length !== 1 ? 's' : ''} remaining
      </p>
    </div>

    <!-- Todo table -->
    <table style="width:100%;border-collapse:collapse;padding:0 16px;">
      ${htmlRows}
    </table>

    <!-- Footer -->
    <div style="background:#fdf6ee;padding:16px 32px;border-top:1px solid #f0dfc8;text-align:center;">
      <p style="margin:0;font-size:12px;color:#7a6552;">
        Sent by your <a href="https://sarok.github.io/todo-app/" style="color:#3d6b1f;text-decoration:none;font-weight:600;">Todo App</a> · Have a productive day! 🌱
      </p>
    </div>
  </div>
</body>
</html>`;

// ── Send email ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

await transporter.sendMail({
  from: `"🌿 Todo App" <${process.env.GMAIL_USER}>`,
  to: process.env.RECIPIENT_EMAIL,
  subject: `📋 Your Todo List for ${today}`,
  text: textBody,
  html: htmlBody,
});

console.log(`✅ Daily todo email sent to ${process.env.RECIPIENT_EMAIL} — ${todos.length} active tasks`);
