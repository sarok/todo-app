// ── State ─────────────────────────────────────────────────────
const STORAGE_KEY = 'kiro-todos';

let todos = loadTodos();
let activeFilter = 'all';       // all | active | completed
let activeCategoryFilter = '';  // '' means all categories

// ── Persistence ───────────────────────────────────────────────
function loadTodos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

// ── DOM refs ──────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Returns one of: 'overdue' | 'due-today' | 'upcoming' | null
 */
function getDueStatus(dueDate) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00'); // avoid timezone shift
  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'due-today';
  return 'upcoming';
}

function formatDueDate(dueDate) {
  if (!dueDate) return '';
  const due = new Date(dueDate + 'T00:00:00');
  return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Create a todo object ───────────────────────────────────────
function createTodo(text, dueDate, category, priority) {
  return {
    id: generateId(),
    text: text.trim(),
    completed: false,
    dueDate: dueDate || '',
    category: category || '',
    priority: priority || 'normal',
    createdAt: Date.now(),
  };
}

// ── Filter logic ──────────────────────────────────────────────
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

// ── Render ────────────────────────────────────────────────────
function render() {
  const filtered = getFilteredTodos();
  todoList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
    filtered.forEach(todo => {
      todoList.appendChild(buildTodoItem(todo));
    });
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
  checkbox.addEventListener('change', () => toggleTodo(todo.id));

  // Content wrapper
  const content = document.createElement('div');
  content.className = 'todo-content';

  const textEl = document.createElement('span');
  textEl.className = 'todo-text';
  textEl.textContent = todo.text;

  const meta = document.createElement('div');
  meta.className = 'todo-meta';

  // Category badge
  if (todo.category) {
    const catBadge = document.createElement('span');
    catBadge.className = 'badge badge-category';
    catBadge.textContent = todo.category;
    meta.appendChild(catBadge);
  }

  // Priority badge (skip 'normal' to reduce noise — show only high/low)
  if (todo.priority && todo.priority !== 'normal') {
    const prioBadge = document.createElement('span');
    prioBadge.className = `badge badge-priority-${todo.priority}`;
    prioBadge.textContent = todo.priority + ' priority';
    meta.appendChild(prioBadge);
  }

  // Due date badge
  if (todo.dueDate) {
    const status = getDueStatus(todo.dueDate);
    const dueBadge = document.createElement('span');
    dueBadge.className = 'badge badge-due' + (status === 'overdue' ? ' overdue' : status === 'due-today' ? ' due-today' : '');
    const label = status === 'overdue' ? '⚠ Overdue · ' : status === 'due-today' ? '⏰ Today · ' : '📅 ';
    dueBadge.textContent = label + formatDueDate(todo.dueDate);
    meta.appendChild(dueBadge);
  }

  content.appendChild(textEl);
  if (meta.children.length > 0) content.appendChild(meta);

  // Delete button
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

  if (total === 0) {
    statsText.textContent = 'No tasks yet';
  } else {
    statsText.textContent = `${active} active · ${completed} completed · ${total} total`;
  }
}

// ── Actions ───────────────────────────────────────────────────
function addTodo(text, dueDate, category, priority) {
  const todo = createTodo(text, dueDate, category, priority);
  todos.unshift(todo); // newest first
  saveTodos();
  render();
}

function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  saveTodos();
  render();
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  saveTodos();
  render();
}

function clearCompletedTodos() {
  const count = todos.filter(t => t.completed).length;
  if (count === 0) return;
  if (!confirm(`Remove ${count} completed task${count > 1 ? 's' : ''}?`)) return;
  todos = todos.filter(t => !t.completed);
  saveTodos();
  render();
}

// ── Event listeners ───────────────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (!text) return;

  addTodo(
    text,
    dueInput.value,
    categorySelect.value,
    prioritySelect.value
  );

  // Reset form fields
  todoInput.value = '';
  dueInput.value = '';
  categorySelect.value = '';
  prioritySelect.value = 'normal';
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

// ── Init ──────────────────────────────────────────────────────
render();
