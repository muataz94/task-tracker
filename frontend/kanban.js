const KANBAN_COLUMNS = ['open', 'in_progress', 'done', 'overdue'];
const KANBAN_LABELS  = { open: 'Open', in_progress: 'In Progress', done: 'Done', overdue: 'Overdue' };
const KANBAN_COLORS  = { open: '#818cf8', in_progress: '#fbbf24', done: '#34d399', overdue: '#f87171' };

let currentTaskView = 'table';

function setTaskView(view) {
  currentTaskView = view;
  const tableView  = document.getElementById('tasks-table-view');
  const kanbanView = document.getElementById('tasks-kanban-view');
  const btnTable   = document.getElementById('btn-table-view');
  const btnKanban  = document.getElementById('btn-kanban-view');
  if (tableView)  tableView.classList.toggle('hidden', view !== 'table');
  if (kanbanView) kanbanView.classList.toggle('hidden', view !== 'kanban');
  if (btnTable)   btnTable.classList.toggle('active', view === 'table');
  if (btnKanban)  btnKanban.classList.toggle('active', view === 'kanban');
  if (view === 'kanban') renderKanban(tableData['Tasks'] || []);
}

function renderKanban(tasks) {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  board.innerHTML = KANBAN_COLUMNS.map(col => `
    <div class="kanban-col" data-status="${col}"
      ondragover="event.preventDefault()"
      ondrop="onKanbanDrop(event,'${col}')">
      <div class="kanban-col-header">
        <span class="kanban-col-dot" style="background:${KANBAN_COLORS[col]}"></span>
        <span class="kanban-col-title">${KANBAN_LABELS[col]}</span>
        <span class="kanban-col-count">${tasks.filter(t => t.status === col).length}</span>
      </div>
      <div class="kanban-cards" id="kanban-${col}">
        ${tasks.filter(t => t.status === col).map(t => kanbanCard(t)).join('')}
      </div>
    </div>`).join('');
}

function kanbanCard(task) {
  const due    = task.due_date ? new Date(task.due_date) : null;
  const isLate = due && due < new Date() && task.status !== 'done';
  return `
    <div class="kanban-card glass" draggable="true"
      data-id="${task.id}"
      ondragstart="onKanbanDragStart(event,'${task.id}')"
      onclick="openEditModal('Tasks','${task.id}')">
      <div class="kanban-card-title">${task.title || '—'}</div>
      ${task.description ? `<div class="kanban-card-desc">${task.description}</div>` : ''}
      <div class="kanban-card-footer">
        ${task.priority ? `<span class="badge badge-${task.priority}">${task.priority}</span>` : ''}
        ${task.assignee ? `<span class="kanban-assignee">${task.assignee}</span>` : ''}
        ${due ? `<span class="kanban-due" style="color:${isLate ? 'var(--accent-red)' : 'var(--text-3)'}">${due.toLocaleDateString()}</span>` : ''}
      </div>
    </div>`;
}

let draggedTaskId = null;

function onKanbanDragStart(event, id) {
  draggedTaskId = id;
  event.dataTransfer.effectAllowed = 'move';
}

async function onKanbanDrop(event, newStatus) {
  event.preventDefault();
  if (!draggedTaskId) return;
  const tasks = tableData['Tasks'] || [];
  const task  = tasks.find(t => t.id === draggedTaskId);
  if (!task || task.status === newStatus) { draggedTaskId = null; return; }
  try {
    await updateRow('Tasks', draggedTaskId, { status: newStatus });
    task.status = newStatus;
    cacheClear('Tasks');
    cacheClear('dashboard');
    renderKanban(tableData['Tasks']);
  } catch(e) { showToast('Update failed: ' + e.message, 'error'); }
  draggedTaskId = null;
}
