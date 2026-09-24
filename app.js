// ── Firebase Setup ─────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyALXwtSW4ij7h8ExsHDOYG0R6HjX12IiLc",
  authDomain: "saro-todo.firebaseapp.com",
  projectId: "saro-todo",
  storageBucket: "saro-todo.firebasestorage.app",
  messagingSenderId: "734271210915",
  appId: "1:734271210915:web:ae05ab1eb019ea1e35c616"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const todosCol = collection(db, "todos");

// ── State ──────────────────────────────────────────────────
let todos = [];                 // local mirror of Firestore data
let activeFilter = 'all';       // all | active | completed
let activeCategoryFilter = '';  // '' = all categories

// ── DOM refs ───────────────────────────────────────────────
const form           = document.getElementById('todo-form');
const todoInput      = document.getElementById('todo-input');
const dueInput       = document.getElementById('todo-due');
const categorySelect = document.getElementById('todo-category');
const prioritySelect = document.getElementById('todo-priority');
const todoList       = document.getElementById('todo-list');
const emptyState     = document.getElementById('empty-state');
const statsText      = document.getElementById('stats-text');
const filterBtns     = document.querySelectorAll('.filter-btn');
const categoryFilter = document.getElementById('category-filter');
const clearCompleted = document.getElementById('clear-completed');

// ── Helpers ────────────────────────────────────────────────
function getDueStatus(dueDate) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'due-today';
  return 'upcoming';
}

function formatDueDate(dueDate) {
  if (!dueDate) return '';
  return new Date(dueDate + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

// ── Filter ─────────────────────────────────────────────────
function getFilteredTodos() {
  return todos.filter(todo => {
    const matchesStatus =
      activeFilter === 'all' ||
      (activeFilter === 'active' && !todo.completed) ||
      (activeFilter === 'completed' && todo.completed);
    const matchesCategory =
      !activeCategoryFilter || todo.category === activeCategoryFilter;
    return matchesStatus && matchesCategory;
  });
}

// ── Render ─────────────────────────────────────────────────
function render() {
  const filtered = getFilteredTodos();
  todoList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
    filtered.forEach(todo => todoList.appendChild(buildTodoItem(todo)));
  }

  updateStats();
}

function buildTodoItem(todo) {
  const li = document.createElement('li');
  li.className = 'todo-item' + (todo.completed ? ' completed' : '');
  li.dataset.id = todo.id;

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-checkbox';
  checkbox.checked = todo.completed;
  checkbox.setAttribute('aria-label', `Mark "${todo.text}" as ${todo.completed ? 'incomplete' : 'complete'}`);
  checkbox.addEventListener('change', () => toggleTodo(todo.id, todo.completed));

  // Content
  const content = document.createElement('div');
  content.className = 'todo-content';

  const textEl = document.createElement('span');
  textEl.className = 'todo-text';
  textEl.textContent = todo.text;

  const meta = document.createElement('div');
  meta.className = 'todo-meta';

  if (todo.category) {
    const b = document.createElement('span');
    b.className = 'badge badge-category';
    b.textContent = todo.category;
    meta.appendChild(b);
  }

  if (todo.priority && todo.priority !== 'normal') {
    const b = document.createElement('span');
    b.className = `badge badge-priority-${todo.priority}`;
    b.textContent = todo.priority + ' priority';
    meta.appendChild(b);
  }

  if (todo.dueDate) {
    const status = getDueStatus(todo.dueDate);
    const b = document.createElement('span');
    b.className = 'badge badge-due' +
      (status === 'overdue' ? ' overdue' : status === 'due-today' ? ' due-today' : '');
    const label = status === 'overdue' ? '⚠ Overdue · '
      : status === 'due-today' ? '⏰ Today · ' : '📅 ';
    b.textContent = label + formatDueDate(todo.dueDate);
    meta.appendChild(b);
  }

  content.appendChild(textEl);
  if (meta.children.length > 0) content.appendChild(meta);

  // Delete
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'todo-delete';
  deleteBtn.textContent = '✕';
  deleteBtn.setAttribute('aria-label', `Delete "${todo.text}"`);
  deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

  li.appendChild(checkbox);
  li.appendChild(content);
  li.appendChild(deleteBtn);
  return li;
}

function updateStats() {
  const total     = todos.length;
  const completed = todos.filter(t => t.completed).length;
  const active    = total - completed;
  statsText.textContent = total === 0
    ? 'No tasks yet'
    : `${active} active · ${completed} completed · ${total} total`;
}

// ── Firestore Actions ──────────────────────────────────────

/** Add a new todo to Firestore */
async function addTodo(text, dueDate, category, priority) {
  await addDoc(todosCol, {
    text:      text.trim(),
    completed: false,
    dueDate:   dueDate || '',
    category:  category || '',
    priority:  priority || 'normal',
    createdAt: Date.now(),
  });
}

/** Toggle completed state in Firestore */
async function toggleTodo(id, currentState) {
  await updateDoc(doc(db, "todos", id), { completed: !currentState });
}

/** Delete a todo from Firestore */
async function deleteTodo(id) {
  await deleteDoc(doc(db, "todos", id));
}

/** Delete all completed todos */
async function clearCompletedTodos() {
  const completed = todos.filter(t => t.completed);
  if (completed.length === 0) return;
  if (!confirm(`Remove ${completed.length} completed task${completed.length > 1 ? 's' : ''}?`)) return;
  await Promise.all(completed.map(t => deleteDoc(doc(db, "todos", t.id))));
}

// ── Real-time Firestore listener ───────────────────────────
// onSnapshot fires immediately with current data, then again
// on every change — so the UI stays in sync across all devices.
const q = query(todosCol, orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  todos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
});

// ── Event Listeners ────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;

  // Disable button while saving
  const btn = document.getElementById('add-btn');
  btn.disabled = true;
  btn.textContent = 'Adding…';

  await addTodo(text, dueInput.value, categorySelect.value, prioritySelect.value);

  // Reset form
  todoInput.value = '';
  dueInput.value = '';
  categorySelect.value = '';
  prioritySelect.value = 'normal';
  btn.disabled = false;
  btn.textContent = 'Add Task';
  todoInput.focus();
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});

categoryFilter.addEventListener('change', () => {
  activeCategoryFilter = categoryFilter.value;
  render();
});

clearCompleted.addEventListener('click', clearCompletedTodos);
