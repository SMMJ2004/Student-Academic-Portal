// ============================================================================
// Student Academic Portal - Client Controller
// File: app.js
// Description: Manages UI interactions, academic policies, data displays,
//              and communicates with the Student Information System REST APIs.
// ============================================================================

let cachedDegrees = [];
let cachedStudents = [];
let cachedCourses = [];
let cachedFaculty = [];
let cachedDepartments = [];
let activeRecordEditor = null;

const recordDefinitions = {
    students: {
        endpoint: 'students',
        idColumn: 'STUDENT_ID',
        fields: [
            { name: 'student_id', column: 'STUDENT_ID', label: 'Student ID', maxLength: 30 },
            { name: 'student_name', column: 'STUDENT_NAME', label: 'Full Name', maxLength: 100 },
            { name: 'father_name', column: 'FATHER_NAME', label: 'Father Name', maxLength: 100 },
            { name: 'gender', column: 'GENDER', label: 'Gender', options: ['Male', 'Female'] },
            { name: 'batch', column: 'BATCH', label: 'Batch Year', type: 'number', min: 1900, max: 2200 },
            { name: 'email', column: 'EMAIL', label: 'Email', type: 'email', maxLength: 254 },
            { name: 'degree', column: 'DEGREE', label: 'Degree Program', optionsFrom: 'degrees' }
        ]
    },
    courses: {
        endpoint: 'courses',
        idColumn: 'COURSE_CODE',
        fields: [
            { name: 'course_code', column: 'COURSE_CODE', label: 'Course Code', maxLength: 30 },
            { name: 'course_name', column: 'COURSE_NAME', label: 'Course Name', maxLength: 100 },
            { name: 'credit_hours', column: 'CREDIT_HOURS', label: 'Credit Hours', type: 'number', min: 1, max: 100 },
            { name: 'department_id', column: 'DEPARTMENT_ID', label: 'Department', optionsFrom: 'departments' }
        ]
    },
    faculty: {
        endpoint: 'faculty',
        idColumn: 'FACULTY_ID',
        fields: [
            { name: 'faculty_id', column: 'FACULTY_ID', label: 'Faculty ID', maxLength: 30 },
            { name: 'faculty_name', column: 'FACULTY_NAME', label: 'Full Name', maxLength: 100 },
            { name: 'gender', column: 'GENDER', label: 'Gender', options: ['Male', 'Female'] },
            { name: 'role', column: 'ROLE', label: 'Role', maxLength: 50 },
            { name: 'department_id', column: 'DEPARTMENT_ID', label: 'Department', optionsFrom: 'departments' },
            { name: 'email', column: 'EMAIL', label: 'Email', type: 'email', maxLength: 254 }
        ]
    },
    departments: {
        endpoint: 'departments',
        idColumn: 'DEPARTMENT_ID',
        fields: [
            { name: 'department_id', column: 'DEPARTMENT_ID', label: 'Department ID', maxLength: 30 },
            { name: 'department_name', column: 'DEPARTMENT_NAME', label: 'Department Name', maxLength: 100 },
            { name: 'hod_id', column: 'HOD_ID', label: 'Head of Department', optionsFrom: 'faculty' }
        ]
    },
    'degree-programs': {
        endpoint: 'degree-programs',
        idColumn: 'DEGREE_ID',
        fields: [
            { name: 'degree_id', column: 'DEGREE_ID', label: 'Degree ID', maxLength: 30 },
            { name: 'degree_name', column: 'DEGREE_NAME', label: 'Degree Name', maxLength: 100 },
            { name: 'department_id', column: 'DEPARTMENT_ID', label: 'Department', optionsFrom: 'departments' }
        ]
    }
};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function isWholeNumberInRange(value, min, max) {
    if (value.trim() === '') return false;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= min && number <= max;
}

function updateAttendancePreview() {
    const attendedInput = document.getElementById('modal-att-hours');
    const totalHoursInput = document.getElementById('modal-att-total');
    const attendancePercent = document.getElementById('modal-live-att-pct');
    const attendanceStatus = document.getElementById('modal-live-att-status');
    const attended = Number(attendedInput.value);
    const total = Number(totalHoursInput.value);
    if (!isWholeNumberInRange(attendedInput.value, 0, 100) ||
        !isWholeNumberInRange(totalHoursInput.value, 1, 100) ||
        attended > total) {
        attendancePercent.textContent = '—';
        attendanceStatus.textContent = 'Enter valid hours';
        attendanceStatus.className = 'badge badge-warning';
        return;
    }

    const percent = Math.round((attended * 100 / total) * 10) / 10;
    const eligible = percent >= 80;
    attendancePercent.textContent = `${percent.toFixed(1)}%`;
    attendanceStatus.textContent = eligible ? 'Eligible' : 'Ineligible';
    attendanceStatus.className = `badge ${eligible ? 'badge-success' : 'badge-danger'}`;
}

function updateGradePreview() {
    const sessionalsInput = document.getElementById('modal-grade-sessionals');
    const finalExamInput = document.getElementById('modal-grade-final');
    const totalScore = document.getElementById('modal-live-total-score');
    const calculatedGrade = document.getElementById('modal-live-grade');
    const sessionals = Number(sessionalsInput.value);
    const finalExam = Number(finalExamInput.value);
    const validSessionals = isWholeNumberInRange(sessionalsInput.value, 0, 50);
    const validFinalExam = finalExamInput.disabled ||
        isWholeNumberInRange(finalExamInput.value, 0, 50);

    if (!validSessionals || !validFinalExam) {
        totalScore.textContent = '— / 100';
        calculatedGrade.textContent = '—';
        calculatedGrade.className = 'badge badge-gray';
        return;
    }

    const score = sessionals + (finalExamInput.disabled ? 0 : finalExam);
    const grade = score > 86 ? 'A'
        : score > 74 ? 'B'
            : score > 62 ? 'C'
                : score > 50 ? 'D'
                    : 'F';
    totalScore.textContent = `${score} / 100`;
    calculatedGrade.textContent = grade;
    calculatedGrade.className = `badge badge-grade-${grade}`;
}

function recordActions(entity, id) {
    const safeEntity = escapeHtml(entity);
    const safeId = escapeHtml(id);
    return `<button class="btn btn-sm btn-outline" data-edit-record="${safeEntity}" data-id="${safeId}">Edit</button>
        <button class="btn btn-sm btn-outline-danger" data-delete-record="${safeEntity}" data-id="${safeId}">Remove</button>`;
}

// --- Toast Notifications ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

// --- API Helpers ---
async function apiGet(endpoint) {
    const res = await fetch(endpoint);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Server error');
    }
    return res.json();
}

async function apiSend(endpoint, method = 'POST', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(endpoint, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || 'Action failed');
    }
    return data;
}

// --- Navigation Tabs ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabViews = document.querySelectorAll('.tab-view');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    const titles = {
        'dashboard': { title: 'Dashboard Overview', sub: 'Key Performance Indicators & Academic Overview' },
        'students': { title: 'Student Management', sub: 'Student Roster, Batches, and Degree Programs' },
        'courses': { title: 'Courses & Degree Programs', sub: 'Course Catalog and Degree Offerings' },
        'faculty': { title: 'Faculty & Departments', sub: 'Faculty Directory and Department Leadership' },
        'enrollments': { title: 'Course Enrollments', sub: 'Academic Term Allocations & Registration Status' },
        'attendance': { title: 'Attendance Tracking', sub: 'Hour Logs & Minimum 80% Final Exam Eligibility' },
        'grades': { title: 'Academic Grading', sub: 'Sessional & Final Exam Marks with Scale Evaluation' }
    };

    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            navItems.forEach(n => n.classList.remove('active'));
            tabViews.forEach(v => v.classList.remove('active'));

            btn.classList.add('active');
            const targetView = document.getElementById(`view-${tab}`);
            if (targetView) targetView.classList.add('active');

            if (titles[tab]) {
                pageTitle.textContent = titles[tab].title;
                pageSubtitle.textContent = titles[tab].sub;
            }

            loadTabData(tab);
        });
    });
}

function loadTabData(tab) {
    if (tab === 'dashboard') loadDashboard();
    else if (tab === 'students') loadStudents();
    else if (tab === 'courses' || tab === 'faculty') loadCoursesFaculty();
    else if (tab === 'enrollments') loadEnrollments();
    else if (tab === 'attendance') loadAttendance();
    else if (tab === 'grades') loadGrades();
}

// --- 1. Dashboard ---
async function loadDashboard() {
    try {
        const stats = await apiGet('/api/stats');
        document.getElementById('stat-students').textContent = stats.students;
        document.getElementById('stat-courses').textContent = stats.courses;
        document.getElementById('stat-faculty').textContent = stats.faculty;
        document.getElementById('stat-departments').textContent = stats.departments;

        // Attendance Rate
        document.getElementById('dash-attendance-rate').textContent = `${stats.attendance.avgPercentage}%`;
        document.getElementById('dash-eligible-count').textContent = stats.attendance.eligible;
        document.getElementById('dash-ineligible-count').textContent = stats.attendance.ineligible;

        // Grade Distribution
        const distContainer = document.getElementById('grade-distribution-bars');
        distContainer.innerHTML = '';
        const maxGradeCount = Math.max(...stats.grades.map(g => g.count), 1);
        
        ['A', 'B', 'C', 'D', 'F'].forEach(grade => {
            const found = stats.grades.find(g => g.GRADE === grade);
            const count = found ? found.count : 0;
            const pct = Math.round((count / maxGradeCount) * 100);

            const row = document.createElement('div');
            row.className = 'dist-row';
            row.innerHTML = `
                <span class="dist-label">${escapeHtml(grade)}</span>
                <div class="dist-bar-track">
                    <div class="dist-bar-fill" style="width: ${escapeHtml(pct)}%;"></div>
                </div>
                <span class="dist-count">${escapeHtml(count)}</span>
            `;
            distContainer.appendChild(row);
        });

        // Course Performance
        const courses = await apiGet('/api/analytics/course-performance');
        const tbody = document.querySelector('#dash-course-table tbody');
        tbody.innerHTML = '';
        courses.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(c.COURSE_CODE)}</strong></td>
                <td>${escapeHtml(c.COURSE_NAME)}</td>
                <td>${escapeHtml(c.DEPARTMENT_NAME)}</td>
                <td>${escapeHtml(c.TOTAL_STUDENTS || 0)}</td>
                <td><strong class="text-blue">${escapeHtml(c.AVG_TOTAL_SCORE ?? 'N/A')}</strong></td>
                <td>${escapeHtml(c.HIGHEST_SCORE ?? 'N/A')}</td>
                <td>${escapeHtml(c.LOWEST_SCORE ?? 'N/A')}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- 2. Students View ---
async function loadStudents() {
    try {
        const degreeFilter = document.getElementById('student-degree-filter').value;
        const url = degreeFilter ? `/api/students?degree=${encodeURIComponent(degreeFilter)}` : '/api/students';
        cachedStudents = await apiGet(url);
        renderStudentsTable(cachedStudents);

        if (cachedDegrees.length === 0) {
            cachedDegrees = await apiGet('/api/degree-programs');
            updateDegreeSelects();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderStudentsTable(students) {
    const tbody = document.querySelector('#students-table tbody');
    tbody.innerHTML = '';
    const searchTerm = document.getElementById('student-search').value.toLowerCase();

    const filtered = students.filter(s => 
        String(s.STUDENT_NAME).toLowerCase().includes(searchTerm) ||
        String(s.STUDENT_ID).toLowerCase().includes(searchTerm) ||
        String(s.EMAIL).toLowerCase().includes(searchTerm)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No students found.</td></tr>';
        return;
    }

    filtered.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(s.STUDENT_ID)}</strong></td>
            <td>${escapeHtml(s.STUDENT_NAME)}</td>
            <td>${escapeHtml(s.FATHER_NAME)}</td>
            <td><span class="badge ${s.GENDER === 'Male' ? 'badge-info' : 'badge-purple'}">${escapeHtml(s.GENDER)}</span></td>
            <td>${escapeHtml(s.BATCH)}</td>
            <td>${escapeHtml(s.EMAIL)}</td>
            <td><span class="badge badge-gray">${escapeHtml(s.DEGREE_NAME)}</span></td>
            <td>
                <button class="btn btn-sm btn-outline btn-edit-student">Edit</button>
                <button class="btn btn-sm btn-outline-danger btn-delete-student" data-id="${escapeHtml(s.STUDENT_ID)}">Remove</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-delete-student').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm(`Remove student ${id}? This will remove all their enrollments, attendance records, and grades.`)) {
                try {
                    await apiSend(`/api/students/${encodeURIComponent(id)}`, 'DELETE');
                    showToast(`Student ${id} removed.`);
                    await Promise.all([loadStudents(), loadDashboard()]);
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
        });
    });

    tbody.querySelectorAll('.btn-edit-student').forEach((btn, index) => {
        btn.addEventListener('click', () => openRecordEditor('students', filtered[index]));
    });
}

function updateDegreeSelects() {
    const selectFilter = document.getElementById('student-degree-filter');
    const modalDegree = document.getElementById('modal-degree');
    const selectedDegree = selectFilter.value;

    selectFilter.replaceChildren(new Option('All Degree Programs', ''));
    modalDegree.replaceChildren();
    cachedDegrees.forEach(degree => {
        const label = `${degree.DEGREE_NAME} (${degree.DEGREE_ID})`;
        selectFilter.add(new Option(label, degree.DEGREE_ID));
        modalDegree.add(new Option(label, degree.DEGREE_ID));
    });
    selectFilter.value = cachedDegrees.some(degree => degree.DEGREE_ID === selectedDegree) ? selectedDegree : '';
}

// --- 3. Courses and Faculty ---
async function loadCoursesFaculty() {
    try {
        const [courses, faculty, depts, degrees] = await Promise.all([
            apiGet('/api/courses'),
            apiGet('/api/faculty'),
            apiGet('/api/departments'),
            apiGet('/api/degree-programs')
        ]);
        cachedCourses = courses;
        cachedFaculty = faculty;
        cachedDepartments = depts;
        cachedDegrees = degrees;
        updateDegreeSelects();

        // Courses
        const tbodyCourses = document.querySelector('#courses-table tbody');
        if (tbodyCourses) {
            tbodyCourses.innerHTML = '';
            courses.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${escapeHtml(c.COURSE_CODE)}</strong></td>
                    <td>${escapeHtml(c.COURSE_NAME)}</td>
                    <td>${escapeHtml(c.CREDIT_HOURS)} Credits</td>
                    <td>${escapeHtml(c.DEPARTMENT_NAME)}</td>
                    <td>${recordActions('courses', c.COURSE_CODE)}</td>
                `;
                tbodyCourses.appendChild(tr);
            });
        }

        // Faculty
        const tbodyFaculty = document.querySelector('#faculty-table tbody');
        if (tbodyFaculty) {
            tbodyFaculty.innerHTML = '';
            faculty.forEach(f => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${escapeHtml(f.FACULTY_ID)}</strong></td>
                    <td>${escapeHtml(f.FACULTY_NAME)}</td>
                    <td><span class="badge ${String(f.ROLE).includes('Professor') ? 'badge-info' : 'badge-gray'}">${escapeHtml(f.ROLE)}</span></td>
                    <td>${escapeHtml(f.DEPARTMENT_NAME)}</td>
                    <td>${escapeHtml(f.EMAIL)}</td>
                    <td>${recordActions('faculty', f.FACULTY_ID)}</td>
                `;
                tbodyFaculty.appendChild(tr);
            });
        }

        // Departments
        const tbodyDepts = document.querySelector('#departments-table tbody');
        if (tbodyDepts) {
            tbodyDepts.innerHTML = '';
            depts.forEach(d => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${escapeHtml(d.DEPARTMENT_ID)}</strong></td>
                    <td>${escapeHtml(d.DEPARTMENT_NAME)}</td>
                    <td>${escapeHtml(d.HOD_NAME || d.HOD_ID)}</td>
                    <td>${recordActions('departments', d.DEPARTMENT_ID)}</td>
                `;
                tbodyDepts.appendChild(tr);
            });
        }

        const tbodyDegrees = document.querySelector('#degree-programs-table tbody');
        if (tbodyDegrees) {
            tbodyDegrees.innerHTML = '';
            degrees.forEach(d => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${escapeHtml(d.DEGREE_ID)}</strong></td>
                    <td>${escapeHtml(d.DEGREE_NAME)}</td>
                    <td>${escapeHtml(d.DEPARTMENT_NAME)}</td>
                    <td>${recordActions('degree-programs', d.DEGREE_ID)}</td>
                `;
                tbodyDegrees.appendChild(tr);
            });
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- 4. Enrollments ---
async function loadEnrollments() {
    try {
        const enrollments = await apiGet('/api/enrollments');
        const tbody = document.querySelector('#enrollments-table tbody');
        tbody.innerHTML = '';

        enrollments.forEach(e => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(e.STUDENT_ID)}</strong></td>
                <td>${escapeHtml(e.STUDENT_NAME)}</td>
                <td>${escapeHtml(e.COURSE_CODE)}</td>
                <td>${escapeHtml(e.COURSE_NAME)}</td>
                <td>${escapeHtml(e.SEMESTER)}</td>
                <td>${escapeHtml(e.FACULTY_NAME)}</td>
                <td>
                    <select class="form-select form-select-sm status-switcher" data-sid="${escapeHtml(e.STUDENT_ID)}" data-cc="${escapeHtml(e.COURSE_CODE)}" data-sem="${escapeHtml(e.SEMESTER)}">
                        <option value="Enrolled" ${e.STATUS === 'Enrolled' ? 'selected' : ''}>Enrolled</option>
                        <option value="Completed" ${e.STATUS === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Dropped" ${e.STATUS === 'Dropped' ? 'selected' : ''}>Dropped</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.status-switcher').forEach(sel => {
            sel.addEventListener('change', async () => {
                const sid = sel.dataset.sid;
                const cc = sel.dataset.cc;
                const semester = sel.dataset.sem;
                const newStatus = sel.value;
                try {
                    await apiSend(`/api/enrollments/${encodeURIComponent(sid)}/${encodeURIComponent(cc)}/${encodeURIComponent(semester)}`, 'PUT', { status: newStatus });
                    showToast(`Enrollment status set to ${newStatus}.`);
                    loadEnrollments();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- 5. Attendance & Exam Eligibility ---
async function loadAttendance() {
    try {
        const attendance = await apiGet('/api/attendance');
        const tbody = document.querySelector('#attendance-table tbody');
        tbody.innerHTML = '';

        attendance.forEach(a => {
            const tr = document.createElement('tr');
            const isEligible = a.EXAM_STATUS.toLowerCase() === 'eligible';
            tr.innerHTML = `
                <td><strong>${escapeHtml(a.STUDENT_ID)}</strong></td>
                <td>${escapeHtml(a.STUDENT_NAME)}</td>
                <td>${escapeHtml(a.COURSE_CODE)}</td>
                <td>${escapeHtml(a.COURSE_NAME)}</td>
                <td>${escapeHtml(a.SEMESTER)}</td>
                <td>${escapeHtml(a.TOTAL_HOURS)} hrs</td>
                <td>${escapeHtml(a.HOURS_ATTENDED)} hrs</td>
                <td>
                    <strong class="${isEligible ? 'text-green' : 'text-danger'}">${escapeHtml(a.ATTENDANCE_PERCENT)}%</strong>
                </td>
                <td>
                    <span class="badge ${isEligible ? 'badge-success' : 'badge-danger'}">
                        ${isEligible ? '✓ ELIGIBLE' : '✕ INELIGIBLE'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline btn-edit-att" 
                        data-sid="${escapeHtml(a.STUDENT_ID)}" 
                        data-sname="${escapeHtml(a.STUDENT_NAME)}"
                        data-cc="${escapeHtml(a.COURSE_CODE)}"
                        data-sem="${escapeHtml(a.SEMESTER)}"
                        data-cname="${escapeHtml(a.COURSE_NAME)}"
                        data-attended="${escapeHtml(a.HOURS_ATTENDED)}"
                        data-total="${escapeHtml(a.TOTAL_HOURS)}">
                        ✏️ Edit Hours
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-edit-att').forEach(btn => {
            btn.addEventListener('click', () => {
                setAttendanceFormMode('edit');
                document.getElementById('modal-att-student-id').value = btn.dataset.sid;
                document.getElementById('modal-att-course-code').value = btn.dataset.cc;
                document.getElementById('modal-att-semester').value = btn.dataset.sem;
                document.getElementById('modal-att-student-label').textContent = `${btn.dataset.sname} (${btn.dataset.sid})`;
                document.getElementById('modal-att-course-label').textContent = `${btn.dataset.cname} (${btn.dataset.cc}, ${btn.dataset.sem})`;
                document.getElementById('modal-att-hours').value = btn.dataset.attended;
                document.getElementById('modal-att-total').value = btn.dataset.total;
                updateAttendancePreview();
                openModal('modal-attendance');
            });
        });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function enrollmentKey(record) {
    return JSON.stringify([record.STUDENT_ID, record.COURSE_CODE, record.SEMESTER]);
}

function setAttendanceFormMode(mode) {
    const isCreating = mode === 'create';
    const enrollmentGroup = document.getElementById('modal-att-enrollment-group');
    const enrollmentSelect = document.getElementById('modal-att-enrollment');
    document.getElementById('form-attendance').dataset.mode = mode;
    enrollmentGroup.style.display = isCreating ? 'block' : 'none';
    enrollmentSelect.required = isCreating;
    document.getElementById('modal-attendance-title').textContent =
        isCreating ? 'Add Attendance Hours' : 'Update Attendance Hours';
    document.getElementById('modal-attendance-submit').textContent =
        isCreating ? 'Save Attendance' : 'Update Attendance';
}

function selectAttendanceEnrollment(option) {
    if (!option) return;
    document.getElementById('modal-att-student-id').value = option.dataset.sid;
    document.getElementById('modal-att-course-code').value = option.dataset.cc;
    document.getElementById('modal-att-semester').value = option.dataset.sem;
    document.getElementById('modal-att-student-label').textContent =
        `${option.dataset.sname} (${option.dataset.sid})`;
    document.getElementById('modal-att-course-label').textContent =
        `${option.dataset.cname} (${option.dataset.cc}, ${option.dataset.sem})`;
    if (document.getElementById('form-attendance').dataset.mode === 'create') {
        document.getElementById('modal-att-hours').value = '';
        document.getElementById('modal-att-total').value = '';
        updateAttendancePreview();
    }
}

async function openAttendanceCreateModal() {
    try {
        const [enrollments, attendance] = await Promise.all([
            apiGet('/api/enrollments'),
            apiGet('/api/attendance')
        ]);
        const existingAttendance = new Set(attendance.map(enrollmentKey));
        const availableEnrollments = enrollments.filter(
            enrollment => !existingAttendance.has(enrollmentKey(enrollment))
        );
        if (!availableEnrollments.length) {
            showToast(
                enrollments.length
                    ? 'All enrollments already have attendance records.'
                    : 'Add an enrollment before recording attendance.',
                'error'
            );
            return;
        }

        const form = document.getElementById('form-attendance');
        form.reset();
        setAttendanceFormMode('create');
        const select = document.getElementById('modal-att-enrollment');
        select.replaceChildren();
        availableEnrollments.forEach((enrollment, index) => {
            const option = new Option(
                `${enrollment.STUDENT_NAME} (${enrollment.STUDENT_ID}) — ${enrollment.COURSE_NAME} (${enrollment.COURSE_CODE}, ${enrollment.SEMESTER})`,
                String(index)
            );
            option.dataset.sid = enrollment.STUDENT_ID;
            option.dataset.cc = enrollment.COURSE_CODE;
            option.dataset.sem = enrollment.SEMESTER;
            option.dataset.sname = enrollment.STUDENT_NAME;
            option.dataset.cname = enrollment.COURSE_NAME;
            select.add(option);
        });
        select.selectedIndex = 0;
        selectAttendanceEnrollment(select.selectedOptions[0]);
        document.getElementById('modal-att-hours').value = '';
        document.getElementById('modal-att-total').value = '';
        updateAttendancePreview();
        openModal('modal-attendance');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function setGradeFormMode(mode) {
    const isCreating = mode === 'create';
    const enrollmentGroup = document.getElementById('modal-grade-enrollment-group');
    const enrollmentSelect = document.getElementById('modal-grade-enrollment');
    document.getElementById('form-grade').dataset.mode = mode;
    enrollmentGroup.style.display = isCreating ? 'block' : 'none';
    enrollmentSelect.required = isCreating;
    document.getElementById('modal-grade-title').textContent =
        isCreating ? 'Add Student Marks' : 'Enter / Update Student Marks';
    document.getElementById('modal-grade-submit').textContent =
        isCreating ? 'Save Marks' : 'Update Marks';
}

function selectGradeEnrollment(option) {
    if (!option) return;
    document.getElementById('modal-grade-student-id').value = option.dataset.sid;
    document.getElementById('modal-grade-course-code').value = option.dataset.cc;
    document.getElementById('modal-grade-semester').value = option.dataset.sem;
    document.getElementById('modal-grade-student-label').textContent =
        `${option.dataset.sname} (${option.dataset.sid})`;
    document.getElementById('modal-grade-course-label').textContent =
        `${option.dataset.cname} (${option.dataset.cc}, ${option.dataset.sem})`;

    const ineligible = option.dataset.examStatus.toLowerCase() === 'ineligible';
    const form = document.getElementById('form-grade');
    if (form.dataset.mode === 'create') {
        document.getElementById('modal-grade-sessionals').value = '';
    }
    const finalInput = document.getElementById('modal-grade-final');
    finalInput.disabled = ineligible;
    finalInput.value = ineligible ? '0' : '';
    document.getElementById('modal-grade-ineligible-warning').style.display =
        ineligible ? 'block' : 'none';
}

async function openGradeCreateModal() {
    try {
        const [enrollments, attendance, grades] = await Promise.all([
            apiGet('/api/enrollments'),
            apiGet('/api/attendance'),
            apiGet('/api/grades')
        ]);
        const attendanceByKey = new Map(
            attendance.map(record => [enrollmentKey(record), record])
        );
        const existingGrades = new Set(grades.map(enrollmentKey));
        const availableEnrollments = enrollments.filter(enrollment => {
            const key = enrollmentKey(enrollment);
            return attendanceByKey.has(key) && !existingGrades.has(key);
        });
        if (!availableEnrollments.length) {
            const needsAttendance = enrollments.some(
                enrollment => !attendanceByKey.has(enrollmentKey(enrollment))
            );
            showToast(
                enrollments.length === 0
                    ? 'Add an enrollment before entering grades.'
                    : needsAttendance
                        ? 'Add attendance before entering grades.'
                        : 'All enrollments with attendance already have grades.',
                'error'
            );
            return;
        }

        const form = document.getElementById('form-grade');
        form.reset();
        setGradeFormMode('create');
        const select = document.getElementById('modal-grade-enrollment');
        select.replaceChildren();
        availableEnrollments.forEach((enrollment, index) => {
            const attendanceRecord = attendanceByKey.get(enrollmentKey(enrollment));
            const option = new Option(
                `${enrollment.STUDENT_NAME} (${enrollment.STUDENT_ID}) — ${enrollment.COURSE_NAME} (${enrollment.COURSE_CODE}, ${enrollment.SEMESTER})`,
                String(index)
            );
            option.dataset.sid = enrollment.STUDENT_ID;
            option.dataset.cc = enrollment.COURSE_CODE;
            option.dataset.sem = enrollment.SEMESTER;
            option.dataset.sname = enrollment.STUDENT_NAME;
            option.dataset.cname = enrollment.COURSE_NAME;
            option.dataset.examStatus = attendanceRecord.EXAM_STATUS;
            select.add(option);
        });
        select.selectedIndex = 0;
        selectGradeEnrollment(select.selectedOptions[0]);
        document.getElementById('modal-grade-sessionals').value = '';
        updateGradePreview();
        openModal('modal-grade');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- 6. Grades View (Showing Barred 0 Final Exam) ---
async function loadGrades() {
    try {
        const grades = await apiGet('/api/grades');
        const tbody = document.querySelector('#grades-table tbody');
        tbody.innerHTML = '';

        grades.forEach(g => {
            const tr = document.createElement('tr');
            const isIneligible = g.EXAM_STATUS.toLowerCase() === 'ineligible';
            const finalExamCell = isIneligible
                ? '0'
                : escapeHtml(g.FINAL_EXAM);

            tr.innerHTML = `
                <td><strong>${escapeHtml(g.STUDENT_ID)}</strong></td>
                <td>${escapeHtml(g.STUDENT_NAME)}</td>
                <td>${escapeHtml(g.COURSE_CODE)} - ${escapeHtml(g.COURSE_NAME)}</td>
                <td>${escapeHtml(g.SEMESTER)}</td>
                <td>${escapeHtml(g.SESSIONALS)}</td>
                <td><strong>${finalExamCell}</strong></td>
                <td><strong>${escapeHtml(g.TOTAL_SCORE)}</strong></td>
                <td><span class="badge badge-grade-${escapeHtml(g.GRADE)}">${escapeHtml(g.GRADE)}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline btn-edit-grade"
                        data-sid="${escapeHtml(g.STUDENT_ID)}"
                        data-sname="${escapeHtml(g.STUDENT_NAME)}"
                        data-cc="${escapeHtml(g.COURSE_CODE)}"
                        data-sem="${escapeHtml(g.SEMESTER)}"
                        data-cname="${escapeHtml(g.COURSE_NAME)}"
                        data-sessionals="${escapeHtml(g.SESSIONALS)}"
                        data-final="${escapeHtml(g.FINAL_EXAM)}"
                        data-ineligible="${isIneligible}">
                        ✏️ Enter Marks
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-edit-grade').forEach(btn => {
            btn.addEventListener('click', () => {
                const isIneligible = btn.dataset.ineligible === 'true';
                setGradeFormMode('edit');
                document.getElementById('modal-grade-student-id').value = btn.dataset.sid;
                document.getElementById('modal-grade-course-code').value = btn.dataset.cc;
                document.getElementById('modal-grade-semester').value = btn.dataset.sem;
                document.getElementById('modal-grade-student-label').textContent = `${btn.dataset.sname} (${btn.dataset.sid})`;
                document.getElementById('modal-grade-course-label').textContent = `${btn.dataset.cname} (${btn.dataset.cc}, ${btn.dataset.sem})`;
                document.getElementById('modal-grade-sessionals').value = btn.dataset.sessionals;

                const finalInput = document.getElementById('modal-grade-final');
                const warningBox = document.getElementById('modal-grade-ineligible-warning');

                if (isIneligible) {
                    finalInput.value = 0;
                    finalInput.disabled = true;
                    warningBox.style.display = 'block';
                } else {
                    finalInput.value = btn.dataset.final;
                    finalInput.disabled = false;
                    warningBox.style.display = 'none';
                }

                updateGradePreview();
                openModal('modal-grade');
            });
        });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- Modals Setup ---
function openModal(id) {
    document.getElementById(id).classList.add('show');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

function setupModals() {
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.dataset.modal);
        });
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal(backdrop.id);
        });
    });

    document.getElementById('modal-att-hours').addEventListener('input', updateAttendancePreview);
    document.getElementById('modal-att-total').addEventListener('input', updateAttendancePreview);
    document.getElementById('modal-grade-sessionals').addEventListener('input', updateGradePreview);
    document.getElementById('modal-grade-final').addEventListener('input', updateGradePreview);
    document.getElementById('modal-att-enrollment').addEventListener('change', event => {
        selectAttendanceEnrollment(event.currentTarget.selectedOptions[0]);
    });
    document.getElementById('modal-grade-enrollment').addEventListener('change', event => {
        selectGradeEnrollment(event.currentTarget.selectedOptions[0]);
        updateGradePreview();
    });
    document.getElementById('btn-add-attendance').addEventListener('click', openAttendanceCreateModal);
    document.getElementById('btn-add-grade').addEventListener('click', openGradeCreateModal);

    // Add Student
    document.getElementById('btn-add-student').addEventListener('click', () => {
        document.getElementById('form-student').reset();
        openModal('modal-student');
    });

    document.getElementById('form-student').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            student_id: document.getElementById('modal-student-id').value.trim(),
            student_name: document.getElementById('modal-student-name').value.trim(),
            father_name: document.getElementById('modal-father-name').value.trim(),
            gender: document.getElementById('modal-gender').value,
            batch: document.getElementById('modal-batch').value,
            email: document.getElementById('modal-email').value.trim(),
            degree: document.getElementById('modal-degree').value
        };

        try {
            await apiSend('/api/students', 'POST', data);
            showToast(`Student ${data.student_id} added successfully!`);
            closeModal('modal-student');
            await Promise.all([loadStudents(), loadDashboard()]);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Attendance Hours Edit Form
    document.getElementById('form-attendance').addEventListener('submit', async (e) => {
        e.preventDefault();
        const sid = document.getElementById('modal-att-student-id').value;
        const cc = document.getElementById('modal-att-course-code').value;
        const semester = document.getElementById('modal-att-semester').value;
        const attended = document.getElementById('modal-att-hours').value;
        const total = document.getElementById('modal-att-total').value;
        const isCreating = e.currentTarget.dataset.mode === 'create';

        try {
            const endpoint = isCreating
                ? '/api/attendance'
                : `/api/attendance/${encodeURIComponent(sid)}/${encodeURIComponent(cc)}/${encodeURIComponent(semester)}`;
            const body = {
                hours_attended: attended,
                total_hours: total
            };
            if (isCreating) Object.assign(body, { student_id: sid, course_code: cc, semester });
            const res = await apiSend(endpoint, isCreating ? 'POST' : 'PUT', body);
            showToast(res.message);
            closeModal('modal-attendance');
            await Promise.all([loadAttendance(), loadGrades(), loadDashboard()]);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Grades Marks Edit Form
    document.getElementById('form-grade').addEventListener('submit', async (e) => {
        e.preventDefault();
        const sid = document.getElementById('modal-grade-student-id').value;
        const cc = document.getElementById('modal-grade-course-code').value;
        const semester = document.getElementById('modal-grade-semester').value;
        const sessionals = document.getElementById('modal-grade-sessionals').value;
        const finalExam = document.getElementById('modal-grade-final').value;
        const isCreating = e.currentTarget.dataset.mode === 'create';

        try {
            const endpoint = isCreating
                ? '/api/grades'
                : `/api/grades/${encodeURIComponent(sid)}/${encodeURIComponent(cc)}/${encodeURIComponent(semester)}`;
            const body = {
                sessionals,
                final_exam: finalExam
            };
            if (isCreating) Object.assign(body, { student_id: sid, course_code: cc, semester });
            const res = await apiSend(endpoint, isCreating ? 'POST' : 'PUT', body);
            showToast(res.message);
            closeModal('modal-grade');
            await Promise.all([loadGrades(), loadDashboard()]);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Enroll Student Form Setup
    const openEnrollmentModal = async () => {
        const studentSelect = document.getElementById('modal-enroll-student');
        const courseSelect = document.getElementById('modal-enroll-course');
        const facultySelect = document.getElementById('modal-enroll-faculty');

        studentSelect.innerHTML = '';
        courseSelect.innerHTML = '';
        facultySelect.innerHTML = '';

        if (cachedStudents.length === 0) cachedStudents = await apiGet('/api/students');
        if (cachedCourses.length === 0) cachedCourses = await apiGet('/api/courses');
        if (cachedFaculty.length === 0) cachedFaculty = await apiGet('/api/faculty');

        cachedStudents.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.STUDENT_ID;
            opt.textContent = `${s.STUDENT_NAME} (${s.STUDENT_ID})`;
            studentSelect.appendChild(opt);
        });

        cachedCourses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.COURSE_CODE;
            opt.textContent = `${c.COURSE_NAME} (${c.COURSE_CODE})`;
            courseSelect.appendChild(opt);
        });

        cachedFaculty.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.FACULTY_ID;
            opt.textContent = `${f.FACULTY_NAME} (${f.ROLE})`;
            facultySelect.appendChild(opt);
        });

        openModal('modal-enrollment');
    };

    document.getElementById('btn-add-enrollment').addEventListener('click', openEnrollmentModal);
    document.getElementById('form-enrollment').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            student_id: document.getElementById('modal-enroll-student').value,
            course_code: document.getElementById('modal-enroll-course').value,
            faculty_id: document.getElementById('modal-enroll-faculty').value,
            semester: document.getElementById('modal-enroll-semester').value.trim(),
            status: 'Enrolled'
        };

        try {
            await apiSend('/api/enrollments', 'POST', data);
            showToast('Student enrolled successfully!');
            closeModal('modal-enrollment');
            loadEnrollments();
            loadDashboard();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

function getRecordOptions(source) {
    if (source === 'departments') {
        return cachedDepartments.map(item => ({ value: item.DEPARTMENT_ID, label: item.DEPARTMENT_NAME }));
    }
    if (source === 'faculty') {
        return cachedFaculty.map(item => ({ value: item.FACULTY_ID, label: `${item.FACULTY_NAME} (${item.FACULTY_ID})` }));
    }
    if (source === 'degrees') {
        return cachedDegrees.map(item => ({ value: item.DEGREE_ID, label: `${item.DEGREE_NAME} (${item.DEGREE_ID})` }));
    }
    return [];
}

function openRecordEditor(entity, record = null) {
    const definition = recordDefinitions[entity];
    if (!definition) return;

    activeRecordEditor = { entity, record };
    document.getElementById('modal-record-title').textContent =
        `${record ? 'Edit' : 'Add'} ${{ students: 'Student', courses: 'Course', faculty: 'Faculty Member', departments: 'Department', 'degree-programs': 'Degree Program' }[entity]}`;

    const fields = document.getElementById('modal-record-fields');
    fields.replaceChildren();

    definition.fields.forEach(field => {
        const group = document.createElement('div');
        group.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = field.label;
        group.appendChild(label);

        let control;
        if (field.options || field.optionsFrom) {
            control = document.createElement('select');
            control.className = 'form-select';
            const options = field.options
                ? field.options.map(value => ({ value, label: value }))
                : getRecordOptions(field.optionsFrom);
            if (field.optional) {
                options.unshift({ value: '', label: 'None' });
            }
            options.forEach(option => {
                const element = document.createElement('option');
                element.value = option.value;
                element.textContent = option.label;
                control.appendChild(element);
            });
        } else {
            control = document.createElement('input');
            control.type = field.type || 'text';
            control.className = 'form-input';
            if (field.maxLength !== undefined) control.maxLength = field.maxLength;
            if (field.min !== undefined) control.min = field.min;
            if (field.max !== undefined) control.max = field.max;
        }

        control.name = field.name;
        control.required = !field.optional;
        if (record) {
            control.value = record[field.column] ?? '';
            if (field.column === definition.idColumn) control.readOnly = true;
        }
        group.appendChild(control);
        fields.appendChild(group);
    });

    openModal('modal-record');
}

function setupRecordManagement() {
    document.querySelectorAll('[data-add-record]').forEach(button => {
        button.addEventListener('click', () => openRecordEditor(button.dataset.addRecord));
    });

    document.addEventListener('click', async event => {
        const editButton = event.target.closest('[data-edit-record]');
        if (editButton) {
            const entity = editButton.dataset.editRecord;
            const definition = recordDefinitions[entity];
            const records = {
                courses: cachedCourses,
                faculty: cachedFaculty,
                departments: cachedDepartments,
                'degree-programs': cachedDegrees
            }[entity];
            const record = records && records.find(item => String(item[definition.idColumn]) === editButton.dataset.id);
            if (record) openRecordEditor(entity, record);
            return;
        }

        const deleteButton = event.target.closest('[data-delete-record]');
        if (deleteButton) {
            const entity = deleteButton.dataset.deleteRecord;
            const definition = recordDefinitions[entity];
            const id = deleteButton.dataset.id;
            if (!confirm(`Remove ${id}? Records that are referenced elsewhere cannot be removed.`)) return;
            try {
                const result = await apiSend(`/api/${definition.endpoint}/${encodeURIComponent(id)}`, 'DELETE');
                showToast(result.message);
                await loadCoursesFaculty();
                await Promise.all([loadStudents(), loadDashboard()]);
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    });

    document.getElementById('form-record').addEventListener('submit', async event => {
        event.preventDefault();
        if (!activeRecordEditor) return;

        const { entity, record } = activeRecordEditor;
        const definition = recordDefinitions[entity];
        const data = Object.fromEntries(new FormData(event.currentTarget).entries());
        const method = record ? 'PUT' : 'POST';
        const endpoint = record
            ? `/api/${definition.endpoint}/${encodeURIComponent(record[definition.idColumn])}`
            : `/api/${definition.endpoint}`;

        try {
            const result = await apiSend(endpoint, method, data);
            showToast(result.message);
            closeModal('modal-record');
            activeRecordEditor = null;
            if (entity !== 'students') await loadCoursesFaculty();
            await Promise.all([loadStudents(), loadDashboard()]);
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// --- Global Academic Operations ---
function setupGlobalActions() {
    document.getElementById('student-search').addEventListener('input', () => {
        renderStudentsTable(cachedStudents);
    });

    document.getElementById('student-degree-filter').addEventListener('change', () => {
        loadStudents();
    });

    // Ineligible final exam marks count as 0 without overwriting the stored mark.
    const runSync = async () => {
        try {
            const res = await apiSend('/api/academic/sync-eligibility', 'POST');
            showToast(res.message);
            loadDashboard();
            loadAttendance();
            loadGrades();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    const runGradeRecalculation = async () => {
        try {
            const res = await apiSend('/api/academic/recalculate-grades', 'POST');
            showToast(res.message);
            loadDashboard();
            loadGrades();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    document.getElementById('btn-recalc-att-tab').addEventListener('click', runSync);
    document.getElementById('btn-recalc-grades-tab').addEventListener('click', runGradeRecalculation);
}

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupModals();
    setupRecordManagement();
    setupGlobalActions();
    loadDashboard();
});
