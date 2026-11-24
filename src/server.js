// ============================================================================
// Student Academic Record Database - Web App Server
// File: server.js
// Description: Node.js HTTP server hosting user-facing REST APIs
//              and delivering the Student Information System web interface.
// ============================================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./database');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const PUBLIC_REAL_DIR = fs.realpathSync(PUBLIC_DIR);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let bodySize = 0;
        let tooLarge = false;
        req.on('data', chunk => {
            if (tooLarge) return;
            bodySize += chunk.length;
            if (bodySize > 1e6) {
                tooLarge = true;
                chunks.length = 0;
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (tooLarge) {
                const error = new Error('Payload too large. Maximum request size is 1 MB.');
                error.statusCode = 413;
                reject(error);
                return;
            }

            try {
                const body = Buffer.concat(chunks).toString('utf8');
                const parsed = body ? JSON.parse(body) : {};
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error('Request body must be a JSON object.');
                }
                resolve(parsed);
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

function parseAcademicRecordKey(pathname, prefix) {
    const parts = pathname.slice(prefix.length).split('/').map(decodeURIComponent);
    if (parts.length !== 3 || parts.some(part => !part)) {
        throw new Error('Student ID, course code, and semester are required.');
    }
    return parts;
}

function isPathWithin(directory, candidate) {
    const relativePath = path.relative(directory, candidate);
    return relativePath === '' ||
        (!path.isAbsolute(relativePath) &&
            relativePath !== '..' &&
            !relativePath.startsWith(`..${path.sep}`));
}

function serveStaticFile(req, res, pathname) {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(pathname);
    } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Invalid path encoding');
    }

    if (decodedPath.includes('\0')) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Invalid path');
    }

    const relativeRequestPath = decodedPath.replace(/\\/g, '/').replace(/^\/+/, '') || 'index.html';
    const filePath = path.resolve(PUBLIC_DIR, relativeRequestPath);
    const sendIndex = () => fs.realpath(path.join(PUBLIC_REAL_DIR, 'index.html'), (realPathError, indexPath) => {
        if (realPathError) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
            return;
        }
        if (!isPathWithin(PUBLIC_REAL_DIR, indexPath)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Access denied');
            return;
        }

        fs.readFile(indexPath, (readError, indexContent) => {
            if (readError) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not Found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(indexContent);
            }
        });
    });

    if (!isPathWithin(PUBLIC_DIR, filePath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Access denied');
    }

    fs.realpath(filePath, (realPathError, realPath) => {
        if (realPathError) {
            if (realPathError.code === 'ENOENT') return sendIndex();
            res.writeHead(realPathError.code === 'EACCES' || realPathError.code === 'EPERM' ? 403 : 500, {
                'Content-Type': 'text/plain; charset=utf-8'
            });
            return res.end(realPathError.code === 'EACCES' || realPathError.code === 'EPERM'
                ? 'Access denied'
                : `Server Error: ${realPathError.code}`);
        }

        if (!isPathWithin(PUBLIC_REAL_DIR, realPath)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Access denied');
        }

        fs.readFile(realPath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') return sendIndex();
                res.writeHead(err.code === 'EACCES' || err.code === 'EPERM' ? 403 : 500, {
                    'Content-Type': 'text/plain; charset=utf-8'
                });
                res.end(err.code === 'EACCES' || err.code === 'EPERM'
                    ? 'Access denied'
                    : `Server Error: ${err.code}`);
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        });
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    if (!req.url || !req.url.startsWith('/')) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Invalid request URL');
    }

    const requestTarget = req.url.split('#', 1)[0];
    const queryStart = requestTarget.indexOf('?');
    const pathname = queryStart === -1 ? requestTarget : requestTarget.slice(0, queryStart);
    const query = new URLSearchParams(queryStart === -1 ? '' : requestTarget.slice(queryStart + 1));

    // --- REST API ENDPOINTS ---
    if (pathname.startsWith('/api/')) {
        try {
            // Dashboard Stats
            if (req.method === 'GET' && pathname === '/api/stats') {
                return sendJson(res, 200, await db.getStats());
            }

            // Students
            if (req.method === 'GET' && pathname === '/api/students') {
                const students = await db.getStudents(query.get('degree'));
                return sendJson(res, 200, students);
            }

            if (req.method === 'POST' && pathname === '/api/students') {
                const body = await parseJsonBody(req);
                const result = await db.createStudent(body);
                return sendJson(res, 201, result);
            }

            if (req.method === 'PUT' && pathname.startsWith('/api/students/')) {
                const id = decodeURIComponent(pathname.replace('/api/students/', ''));
                const body = await parseJsonBody(req);
                const result = await db.updateStudent(id, body);
                return sendJson(res, 200, result);
            }

            if (req.method === 'DELETE' && pathname.startsWith('/api/students/')) {
                const id = decodeURIComponent(pathname.replace('/api/students/', ''));
                const result = await db.deleteStudent(id);
                return sendJson(res, 200, result);
            }

            // Courses
            if (req.method === 'GET' && pathname === '/api/courses') {
                return sendJson(res, 200, await db.getCourses());
            }

            if (req.method === 'POST' && pathname === '/api/courses') {
                return sendJson(res, 201, await db.createCourse(await parseJsonBody(req)));
            }

            if (req.method === 'PUT' && pathname.startsWith('/api/courses/')) {
                const id = decodeURIComponent(pathname.replace('/api/courses/', ''));
                return sendJson(res, 200, await db.updateCourse(id, await parseJsonBody(req)));
            }

            if (req.method === 'DELETE' && pathname.startsWith('/api/courses/')) {
                const id = decodeURIComponent(pathname.replace('/api/courses/', ''));
                return sendJson(res, 200, await db.deleteCourse(id));
            }

            // Faculty
            if (req.method === 'GET' && pathname === '/api/faculty') {
                return sendJson(res, 200, await db.getFaculty());
            }

            if (req.method === 'POST' && pathname === '/api/faculty') {
                return sendJson(res, 201, await db.createFaculty(await parseJsonBody(req)));
            }

            if (req.method === 'PUT' && pathname.startsWith('/api/faculty/')) {
                const id = decodeURIComponent(pathname.replace('/api/faculty/', ''));
                return sendJson(res, 200, await db.updateFaculty(id, await parseJsonBody(req)));
            }

            if (req.method === 'DELETE' && pathname.startsWith('/api/faculty/')) {
                const id = decodeURIComponent(pathname.replace('/api/faculty/', ''));
                return sendJson(res, 200, await db.deleteFaculty(id));
            }

            // Departments & Degrees
            if (req.method === 'GET' && pathname === '/api/departments') {
                return sendJson(res, 200, await db.getDepartments());
            }

            if (req.method === 'POST' && pathname === '/api/departments') {
                return sendJson(res, 201, await db.createDepartment(await parseJsonBody(req)));
            }

            if (req.method === 'PUT' && pathname.startsWith('/api/departments/')) {
                const id = decodeURIComponent(pathname.replace('/api/departments/', ''));
                return sendJson(res, 200, await db.updateDepartment(id, await parseJsonBody(req)));
            }

            if (req.method === 'DELETE' && pathname.startsWith('/api/departments/')) {
                const id = decodeURIComponent(pathname.replace('/api/departments/', ''));
                return sendJson(res, 200, await db.deleteDepartment(id));
            }

            if (req.method === 'GET' && pathname === '/api/degree-programs') {
                return sendJson(res, 200, await db.getDegreePrograms());
            }

            if (req.method === 'POST' && pathname === '/api/degree-programs') {
                return sendJson(res, 201, await db.createDegreeProgram(await parseJsonBody(req)));
            }

            if (req.method === 'PUT' && pathname.startsWith('/api/degree-programs/')) {
                const id = decodeURIComponent(pathname.replace('/api/degree-programs/', ''));
                return sendJson(res, 200, await db.updateDegreeProgram(id, await parseJsonBody(req)));
            }

            if (req.method === 'DELETE' && pathname.startsWith('/api/degree-programs/')) {
                const id = decodeURIComponent(pathname.replace('/api/degree-programs/', ''));
                return sendJson(res, 200, await db.deleteDegreeProgram(id));
            }

            // Enrollments
            if (req.method === 'GET' && pathname === '/api/enrollments') {
                return sendJson(res, 200, await db.getEnrollments());
            }

            if (req.method === 'POST' && pathname === '/api/enrollments') {
                const body = await parseJsonBody(req);
                const result = await db.createEnrollment(body);
                return sendJson(res, 201, result);
            }

            if (req.method === 'PUT' && pathname.startsWith('/api/enrollments/')) {
                const [studentId, courseCode, semester] = parseAcademicRecordKey(pathname, '/api/enrollments/');
                const body = await parseJsonBody(req);
                const result = await db.updateEnrollmentStatus(studentId, courseCode, semester, body.status);
                return sendJson(res, 200, result);
            }

            // Attendance
            if (req.method === 'GET' && pathname === '/api/attendance') {
                return sendJson(res, 200, await db.getAttendance());
            }

            if (req.method === 'POST' && pathname === '/api/attendance') {
                const body = await parseJsonBody(req);
                const result = await db.createAttendance(
                    body.student_id,
                    body.course_code,
                    body.semester,
                    body.hours_attended,
                    body.total_hours
                );
                return sendJson(res, 201, result);
            }

            if (req.method === 'PUT' && pathname.startsWith('/api/attendance/')) {
                const [studentId, courseCode, semester] = parseAcademicRecordKey(pathname, '/api/attendance/');
                const body = await parseJsonBody(req);
                const result = await db.updateAttendance(
                    studentId,
                    courseCode,
                    semester,
                    body.hours_attended,
                    body.total_hours
                );
                return sendJson(res, 200, result);
            }

            // Grades
            if (req.method === 'GET' && pathname === '/api/grades') {
                return sendJson(res, 200, await db.getGrades());
            }

            if (req.method === 'POST' && pathname === '/api/grades') {
                const body = await parseJsonBody(req);
                const result = await db.createGrade(
                    body.student_id,
                    body.course_code,
                    body.semester,
                    body.sessionals,
                    body.final_exam
                );
                return sendJson(res, 201, result);
            }

            if (req.method === 'PUT' && pathname.startsWith('/api/grades/')) {
                const [studentId, courseCode, semester] = parseAcademicRecordKey(pathname, '/api/grades/');
                const body = await parseJsonBody(req);
                const result = await db.updateGrade(
                    studentId,
                    courseCode,
                    semester,
                    body.sessionals,
                    body.final_exam
                );
                return sendJson(res, 200, result);
            }

            // Early Warning / At-Risk Analytics
            if (req.method === 'GET' && pathname === '/api/analytics/at-risk') {
                return sendJson(res, 200, await db.getAtRiskStudents());
            }

            if (req.method === 'GET' && pathname === '/api/analytics/course-performance') {
                return sendJson(res, 200, await db.getCoursePerformance());
            }

            // Academic Operations (Sync 80% Rule & Recalculate Grades)
            if (req.method === 'POST' && (pathname === '/api/academic/sync-eligibility' || pathname === '/api/plsql/recalculate-attendance')) {
                return sendJson(res, 200, await db.syncExamEligibility());
            }

            if (req.method === 'POST' && (pathname === '/api/academic/recalculate-grades' || pathname === '/api/plsql/recalculate-grades')) {
                return sendJson(res, 200, await db.recalculateGrades());
            }

            // System Reset
            if (req.method === 'POST' && (pathname === '/api/academic/reset-records' || pathname === '/api/db/reset')) {
                return sendJson(res, 200, await db.resetDatabase());
            }

            return sendJson(res, 404, { error: 'Endpoint not found' });
        } catch (err) {
            console.error('API Error:', err);
            return sendJson(res, err.statusCode === 413 ? 413 : 400, {
                error: err.message || 'Server error'
            });
        }
    }

    // Static Assets
    serveStaticFile(req, res, pathname);
});

async function startServer() {
    try {
        await db.ready;
        server.listen(PORT, HOST, () => {
            console.log(`=======================================================`);
            console.log(` Student Academic Record Portal is Running!            `);
            console.log(` Listening on ${HOST}:${PORT}                          `);
            console.log(`=======================================================`);
        });
    } catch (err) {
        console.error(`Unable to start the portal: ${err.message}`);
        process.exitCode = 1;
    }
}

if (require.main === module) {
    startServer();
    process.once('SIGINT', () => {
        server.close(async () => {
            await db.close();
            process.exit(0);
        });
    });
    process.once('SIGTERM', () => {
        server.close(async () => {
            await db.close();
            process.exit(0);
        });
    });
}

module.exports = server;
