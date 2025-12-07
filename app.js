document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const todoInput = document.getElementById('todo-input');
    const dateInput = document.getElementById('date-input');
    const addBtn = document.getElementById('add-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    // List View Elements
    const todayList = document.getElementById('today-list');
    const weeklyList = document.getElementById('weekly-list');
    const todayEmpty = document.getElementById('today-empty');
    const weeklyEmpty = document.getElementById('weekly-empty');
    const listView = document.getElementById('list-view');

    // Calendar View Elements
    const calendarView = document.getElementById('calendar-view');
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarLabel = document.getElementById('calendar-month-year');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    // View Switcher Elements
    const listBtn = document.getElementById('view-list');
    const calendarBtn = document.getElementById('view-calendar');

    // --- State ---
    let currentView = 'list'; // 'list' or 'calendar'
    let currentDate = new Date(); // For calendar navigation

    // Set default date picker to today
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.value = todayStr;
    dateInput.min = todayStr;

    // Load tasks
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    // Migration: ensure tasks have dates
    tasks = tasks.map(t => (!t.dueDate ? { ...t, dueDate: todayStr } : t));

    // --- Initialization ---
    renderTasks();

    // --- Event Listeners ---
    addBtn.addEventListener('click', addTask);
    todoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

    // Backup/Restore
    exportBtn.addEventListener('click', exportTasks);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importTasks);

    // View Switching
    listBtn.addEventListener('click', () => switchView('list'));
    calendarBtn.addEventListener('click', () => switchView('calendar'));

    // Calendar Nav
    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));

    // --- Core Logic ---

    function switchView(view) {
        currentView = view;
        if (view === 'list') {
            listView.classList.remove('hidden');
            calendarView.classList.add('hidden');
            listBtn.classList.add('active');
            calendarBtn.classList.remove('active');
            renderTasks();
        } else {
            listView.classList.add('hidden');
            calendarView.classList.remove('hidden');
            listBtn.classList.remove('active');
            calendarBtn.classList.add('active');
            renderCalendar();
        }
    }

    function addTask() {
        const text = todoInput.value.trim();
        const date = dateInput.value;
        if (text === '' || !date) return;

        const newTask = {
            id: Date.now(),
            text: text,
            dueDate: date,
            completed: false
        };

        tasks.push(newTask);
        saveTasks();

        if (currentView === 'list') renderTasks();
        else renderCalendar();

        todoInput.value = '';
        todoInput.focus();
    }

    function toggleTask(id) {
        tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveTasks();
        if (currentView === 'list') renderTasks();
        else renderCalendar();
    }

    function deleteTask(id) {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        if (currentView === 'list') renderTasks();
        else renderCalendar();
    }

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        console.log('Saved to localStorage');
    }

    function exportTasks() {
        const dataStr = JSON.stringify(tasks, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', `todo_backup_${new Date().toISOString().slice(0, 10)}.json`);
        linkElement.click();
    }

    function importTasks(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const importedTasks = JSON.parse(e.target.result);

                if (!Array.isArray(importedTasks)) {
                    alert('Invalid file format: Backup file must contain a list of tasks.');
                    return;
                }

                // MERGE STRATEGY: Add tasks that don't exist (by ID). Update existing?
                // For simplicity: We'll filter out duplicates by ID, then add all others.

                let addedCount = 0;
                importedTasks.forEach(item => {
                    // Basic validation
                    if (!item.id || !item.text) return;

                    // Check if exists
                    if (!tasks.some(t => t.id === item.id)) {
                        tasks.push(item);
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    saveTasks();
                    alert(`Successfully restored ${addedCount} tasks.`);
                    // Refresh View
                    if (currentView === 'list') renderTasks();
                    else renderCalendar();
                } else {
                    alert('No new tasks found in file.');
                }

            } catch (error) {
                console.error(error);
                alert('Error reading file. Please make sure it is a valid JSON backup.');
            }

            // Reset input so same file can be selected again if needed
            importFile.value = '';
        };
        reader.readAsText(file);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- List Render Logic ---
    function renderTasks() {
        todayList.innerHTML = '';
        weeklyList.innerHTML = '';

        const todayKey = new Date().toISOString().split('T')[0];

        const sorted = [...tasks].sort((a, b) => {
            if (a.completed === b.completed) return a.dueDate.localeCompare(b.dueDate);
            return a.completed ? 1 : -1;
        });

        const tToday = sorted.filter(t => t.dueDate === todayKey);
        const tWeek = sorted.filter(t => t.dueDate !== todayKey);

        if (tToday.length === 0) todayEmpty.classList.remove('hidden');
        else {
            todayEmpty.classList.add('hidden');
            tToday.forEach(t => renderListItem(t, todayList));
        }

        if (tWeek.length === 0) weeklyEmpty.classList.remove('hidden');
        else {
            weeklyEmpty.classList.add('hidden');
            tWeek.forEach(t => renderListItem(t, weeklyList));
        }
    }

    function renderListItem(task, container) {
        const li = document.createElement('li');
        li.className = `todo-item ${task.completed ? 'completed' : ''}`;

        // Format Date for display
        const dateObj = new Date(task.dueDate + 'T00:00:00');
        const dateDisplay = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

        li.innerHTML = `
            <div class="checkbox">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="todo-content">
                <span class="todo-text">${escapeHtml(task.text)}</span>
                <span class="todo-date">${dateDisplay}</span>
            </div>
            <button class="delete-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg></button>
        `;

        li.querySelector('.checkbox').addEventListener('click', () => toggleTask(task.id));
        li.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task.id); });

        container.appendChild(li);
    }

    // --- Calendar Render Logic ---
    function changeMonth(delta) {
        currentDate.setMonth(currentDate.getMonth() + delta);
        renderCalendar();
    }

    function renderCalendar() {
        calendarGrid.innerHTML = '';

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        calendarLabel.textContent = `${monthNames[month]} ${year}`;

        const firstDayIndex = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const todayKey = new Date().toISOString().split('T')[0];

        for (let i = 0; i < firstDayIndex; i++) {
            const blank = document.createElement('div');
            blank.className = 'day-cell';
            blank.style.backgroundColor = '#fcfcfc';
            calendarGrid.appendChild(blank);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'day-cell';

            const monthStr = (month + 1).toString().padStart(2, '0');
            const dayStr = i.toString().padStart(2, '0');
            const dateKey = `${year}-${monthStr}-${dayStr}`;

            if (dateKey === todayKey) dayCell.classList.add('today');

            dayCell.innerHTML = `<span class="day-number">${i}</span>`;

            const dayTasks = tasks.filter(t => t.dueDate === dateKey);

            dayTasks.forEach(task => {
                const taskEl = document.createElement('div');
                taskEl.className = `cal-task ${task.completed ? 'completed' : ''}`;
                taskEl.textContent = task.text;
                taskEl.title = task.text;
                taskEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleTask(task.id);
                });
                dayCell.appendChild(taskEl);
            });

            calendarGrid.appendChild(dayCell);
        }
    }
});
