// ============================================================================
// Student Academic Record Database - Oracle data layer
// ============================================================================

const oracledb = require('oracledb');

const STATUS_OPTIONS = new Set(['ENROLLED', 'COMPLETED', 'DROPPED']);

function requiredText(data, field, label, maxLength = 30) {
    const value = typeof data[field] === 'string' ? data[field].trim() : '';
    if (!value) throw new Error(`${label} is required.`);
    if (Array.from(value).length > maxLength) {
        throw new Error(`${label} must be ${maxLength} characters or fewer.`);
    }
    return value;
}

function integerInRange(input, label, min, max) {
    let value = NaN;
    if (typeof input === 'number') {
        value = input;
    } else if (typeof input === 'string') {
        const text = input.trim();
        if (/^-?\d+$/.test(text)) value = Number(text);
    }

    if (!Number.isSafeInteger(value) || value < min || value > max) {
        throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
    }
    return value;
}

function requiredInteger(data, field, label, min, max) {
    return integerInRange(data[field], label, min, max);
}

function ensureChanged(result, entity, identifier) {
    if (result.rowsAffected === 0) {
        throw new Error(`${entity} ${identifier} was not found.`);
    }
}

function computeAttendance(attended, total) {
    const totalHours = integerInRange(total, 'Total course hours', 1, 100);
    const hoursAttended = integerInRange(attended, 'Hours attended', 0, totalHours);
    const percent = Math.round((hoursAttended * 100 / totalHours) * 10) / 10;
    return {
        attended: hoursAttended,
        total: totalHours,
        percent,
        status: percent >= 80 ? 'Eligible' : 'Ineligible'
    };
}

function computeGrade(sessionals, finalExam, isEligible) {
    const sessionalMarks = integerInRange(sessionals, 'Sessional marks', 0, 50);
    const requestedFinalMarks = integerInRange(finalExam, 'Final exam marks', 0, 50);
    const finalMarks = isEligible ? requestedFinalMarks : 0;
    const totalScore = sessionalMarks + finalMarks;
    let grade = 'F';
    if (totalScore > 86) grade = 'A';
    else if (totalScore > 74) grade = 'B';
    else if (totalScore > 62) grade = 'C';
    else if (totalScore > 50) grade = 'D';
    return { sessionals: sessionalMarks, finalExam: finalMarks, totalScore, grade };
}

const ELIGIBLE_SCORE = `
    g.SESSIONALS +
    CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
         THEN g.FINAL_EXAM ELSE 0 END
`;

const GRADE_CASE = score => `
    CASE
        WHEN ${score} > 86 THEN 'A'
        WHEN ${score} > 74 THEN 'B'
        WHEN ${score} > 62 THEN 'C'
        WHEN ${score} > 50 THEN 'D'
        ELSE 'F'
    END
`;

class AcademicDatabase {
    constructor() {
        const missing = ['ORACLE_USER', 'ORACLE_PASSWORD', 'ORACLE_CONNECT_STRING']
            .filter(name => !process.env[name]);

        if (missing.length) {
            this.ready = Promise.reject(new Error(
                `Oracle configuration is missing ${missing.join(', ')}. Set these environment variables to connect to the app schema.`
            ));
            this.ready.catch(() => {});
            return;
        }

        this.pool = null;
        this.ready = this.initialize();
        this.ready.catch(() => {});
    }

    async initialize() {
        try {
            this.pool = await oracledb.createPool({
                user: process.env.ORACLE_USER,
                password: process.env.ORACLE_PASSWORD,
                connectString: process.env.ORACLE_CONNECT_STRING,
                poolMin: 1,
                poolMax: 8,
                poolIncrement: 1
            });

            const connection = await this.pool.getConnection();
            try {
                for (const table of [
                    'STUDENT_DETAILS', 'COURSES', 'FACULTY', 'DEPARTMENTS',
                    'DEGREE_PROGRAM', 'ENROLLMENT', 'ATTENDANCE', 'GRADES'
                ]) {
                    await connection.execute(`SELECT COUNT(*) FROM ${table}`);
                }
            } finally {
                await connection.close();
            }
        } catch (error) {
            if (this.pool) {
                await this.pool.close(0);
                this.pool = null;
            }
            throw new Error(`Unable to connect to the Oracle app schema or access its tables: ${error.message}`);
        }
    }

    async withConnection(work, transaction = false) {
        await this.ready;
        const connection = await this.pool.getConnection();
        try {
            const result = await work(connection);
            if (transaction) await connection.commit();
            return result;
        } catch (error) {
            if (transaction) await connection.rollback();
            throw error;
        } finally {
            await connection.close();
        }
    }

    async rows(connection, sql, binds = {}) {
        const result = await connection.execute(sql, binds, {
            outFormat: oracledb.OUT_FORMAT_OBJECT
        });
        return result.rows || [];
    }

    async run(connection, sql, binds = {}) {
        return connection.execute(sql, binds);
    }

    async getStats() {
        return this.withConnection(async connection => {
            const count = async table => {
                const rows = await this.rows(connection, `SELECT COUNT(*) AS C FROM ${table}`);
                return Number(rows[0].C);
            };

            const students = await count('STUDENT_DETAILS');
            const courses = await count('COURSES');
            const faculty = await count('FACULTY');
            const departments = await count('DEPARTMENTS');
            const enrollments = await count('ENROLLMENT');

            const attendanceRows = await this.rows(connection, `
                SELECT COUNT(*) AS TOTAL,
                       NVL(SUM(CASE WHEN HOURS_ATTENDED * 100 / NULLIF(TOTAL_HOURS, 0) >= 80 THEN 1 ELSE 0 END), 0) AS ELIGIBLE,
                       NVL(SUM(CASE WHEN HOURS_ATTENDED * 100 / NULLIF(TOTAL_HOURS, 0) < 80 THEN 1 ELSE 0 END), 0) AS INELIGIBLE,
                       NVL(ROUND(AVG(HOURS_ATTENDED * 100 / NULLIF(TOTAL_HOURS, 0)), 1), 0) AS AVG_PERCENTAGE
                FROM ATTENDANCE
            `);

            const gradeRows = await this.rows(connection, `
                SELECT GRADE, COUNT(*) AS GRADE_COUNT
                FROM (
                    SELECT ${GRADE_CASE(ELIGIBLE_SCORE)} AS GRADE
                    FROM GRADES g
                    LEFT JOIN ATTENDANCE a
                      ON a.STUDENT_ID = g.STUDENT_ID
                     AND a.COURSE_CODE = g.COURSE_CODE
                     AND a.SEMESTER = g.SEMESTER
                )
                GROUP BY GRADE
                ORDER BY GRADE
            `);

            const atRiskRows = await this.rows(connection, `
                SELECT COUNT(DISTINCT a.STUDENT_ID) AS C
                FROM ATTENDANCE a
                LEFT JOIN GRADES g
                  ON g.STUDENT_ID = a.STUDENT_ID
                 AND g.COURSE_CODE = a.COURSE_CODE
                 AND g.SEMESTER = a.SEMESTER
                WHERE a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) < 80
                   OR NVL(g.SESSIONALS, 0) +
                      CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
                           THEN NVL(g.FINAL_EXAM, 0) ELSE 0 END < 60
            `);

            return {
                students,
                courses,
                faculty,
                departments,
                enrollments,
                attendance: {
                    total: Number(attendanceRows[0].TOTAL),
                    eligible: Number(attendanceRows[0].ELIGIBLE),
                    ineligible: Number(attendanceRows[0].INELIGIBLE),
                    avgPercentage: Number(attendanceRows[0].AVG_PERCENTAGE)
                },
                grades: gradeRows.map(row => ({ GRADE: row.GRADE, count: Number(row.GRADE_COUNT) })),
                atRiskCount: Number(atRiskRows[0].C)
            };
        });
    }

    async getStudents(degreeFilter = null) {
        const sql = `
            SELECT s.*, d.DEGREE_NAME, dep.DEPARTMENT_NAME
            FROM STUDENT_DETAILS s
            JOIN DEGREE_PROGRAM d ON d.DEGREE_ID = s.DEGREE
            JOIN DEPARTMENTS dep ON dep.DEPARTMENT_ID = d.DEPARTMENT_ID
            ${degreeFilter ? 'WHERE s.DEGREE = :degree' : ''}
            ORDER BY s.STUDENT_ID
        `;
        return this.withConnection(connection => this.rows(
            connection,
            sql,
            degreeFilter ? { degree: degreeFilter } : {}
        ));
    }

    async createStudent(data) {
        const studentId = requiredText(data, 'student_id', 'Student ID');
        await this.withConnection(async connection => {
            await this.run(connection, `
                INSERT INTO STUDENT_DETAILS
                    (STUDENT_ID, STUDENT_NAME, FATHER_NAME, GENDER, BATCH, EMAIL, DEGREE)
                VALUES
                    (:student_id, :student_name, :father_name, :gender, :batch, :email, :degree)
            `, {
                student_id: studentId,
                student_name: requiredText(data, 'student_name', 'Student name', 100),
                father_name: requiredText(data, 'father_name', 'Father name', 100),
                gender: requiredText(data, 'gender', 'Gender'),
                batch: requiredInteger(data, 'batch', 'Batch', 1900, 2200),
                email: requiredText(data, 'email', 'Email', 254),
                degree: requiredText(data, 'degree', 'Degree program')
            });
        }, true);
        return { success: true, message: `Student ${studentId} added successfully.` };
    }

    async updateStudent(id, data) {
        const binds = {
            student_name: requiredText(data, 'student_name', 'Student name', 100),
            father_name: requiredText(data, 'father_name', 'Father name', 100),
            gender: requiredText(data, 'gender', 'Gender'),
            batch: requiredInteger(data, 'batch', 'Batch', 1900, 2200),
            email: requiredText(data, 'email', 'Email', 254),
            degree: requiredText(data, 'degree', 'Degree program'),
            student_id: id
        };
        const result = await this.withConnection(connection => this.run(connection, `
            UPDATE STUDENT_DETAILS
            SET STUDENT_NAME = :student_name,
                FATHER_NAME = :father_name,
                GENDER = :gender,
                BATCH = :batch,
                EMAIL = :email,
                DEGREE = :degree
            WHERE STUDENT_ID = :student_id
        `, binds), true);
        ensureChanged(result, 'Student', id);
        return { success: true, message: `Student ${id} updated successfully.` };
    }

    async deleteStudent(id) {
        await this.withConnection(async connection => {
            await this.run(connection, 'DELETE FROM GRADES WHERE STUDENT_ID = :student_id', { student_id: id });
            await this.run(connection, 'DELETE FROM ATTENDANCE WHERE STUDENT_ID = :student_id', { student_id: id });
            await this.run(connection, 'DELETE FROM ENROLLMENT WHERE STUDENT_ID = :student_id', { student_id: id });
            const result = await this.run(connection, 'DELETE FROM STUDENT_DETAILS WHERE STUDENT_ID = :student_id', { student_id: id });
            ensureChanged(result, 'Student', id);
        }, true);
        return { success: true, message: `Student ${id} removed successfully.` };
    }

    async getCourses() {
        return this.withConnection(connection => this.rows(connection, `
            SELECT c.*, d.DEPARTMENT_NAME
            FROM COURSES c
            JOIN DEPARTMENTS d ON d.DEPARTMENT_ID = c.DEPARTMENT_ID
            ORDER BY c.COURSE_CODE
        `));
    }

    async createCourse(data) {
        const courseCode = requiredText(data, 'course_code', 'Course code');
        await this.withConnection(connection => this.run(connection, `
            INSERT INTO COURSES (COURSE_CODE, COURSE_NAME, CREDIT_HOURS, DEPARTMENT_ID)
            VALUES (:course_code, :course_name, :credit_hours, :department_id)
        `, {
            course_code: courseCode,
            course_name: requiredText(data, 'course_name', 'Course name', 100),
            credit_hours: requiredInteger(data, 'credit_hours', 'Credit hours', 1, 100),
            department_id: requiredText(data, 'department_id', 'Department')
        }), true);
        return { success: true, message: `Course ${courseCode} added successfully.` };
    }

    async updateCourse(courseCode, data) {
        const result = await this.withConnection(connection => this.run(connection, `
            UPDATE COURSES
            SET COURSE_NAME = :course_name,
                CREDIT_HOURS = :credit_hours,
                DEPARTMENT_ID = :department_id
            WHERE COURSE_CODE = :course_code
        `, {
            course_name: requiredText(data, 'course_name', 'Course name', 100),
            credit_hours: requiredInteger(data, 'credit_hours', 'Credit hours', 1, 100),
            department_id: requiredText(data, 'department_id', 'Department'),
            course_code: courseCode
        }), true);
        ensureChanged(result, 'Course', courseCode);
        return { success: true, message: `Course ${courseCode} updated successfully.` };
    }

    async deleteCourse(courseCode) {
        const result = await this.withConnection(connection => this.run(
            connection,
            'DELETE FROM COURSES WHERE COURSE_CODE = :course_code',
            { course_code: courseCode }
        ), true);
        ensureChanged(result, 'Course', courseCode);
        return { success: true, message: `Course ${courseCode} removed successfully.` };
    }

    async getFaculty() {
        return this.withConnection(connection => this.rows(connection, `
            SELECT f.*, d.DEPARTMENT_NAME
            FROM FACULTY f
            JOIN DEPARTMENTS d ON d.DEPARTMENT_ID = f.DEPARTMENT_ID
            ORDER BY f.FACULTY_ID
        `));
    }

    async createFaculty(data) {
        const facultyId = requiredText(data, 'faculty_id', 'Faculty ID');
        await this.withConnection(connection => this.run(connection, `
            INSERT INTO FACULTY (FACULTY_ID, FACULTY_NAME, GENDER, ROLE, DEPARTMENT_ID, EMAIL)
            VALUES (:faculty_id, :faculty_name, :gender, :role, :department_id, :email)
        `, {
            faculty_id: facultyId,
            faculty_name: requiredText(data, 'faculty_name', 'Faculty name', 100),
            gender: requiredText(data, 'gender', 'Gender'),
            role: requiredText(data, 'role', 'Role', 50),
            department_id: requiredText(data, 'department_id', 'Department'),
            email: requiredText(data, 'email', 'Email', 254)
        }), true);
        return { success: true, message: `Faculty member ${facultyId} added successfully.` };
    }

    async updateFaculty(facultyId, data) {
        const result = await this.withConnection(connection => this.run(connection, `
            UPDATE FACULTY
            SET FACULTY_NAME = :faculty_name,
                GENDER = :gender,
                ROLE = :role,
                DEPARTMENT_ID = :department_id,
                EMAIL = :email
            WHERE FACULTY_ID = :faculty_id
        `, {
            faculty_name: requiredText(data, 'faculty_name', 'Faculty name', 100),
            gender: requiredText(data, 'gender', 'Gender'),
            role: requiredText(data, 'role', 'Role', 50),
            department_id: requiredText(data, 'department_id', 'Department'),
            email: requiredText(data, 'email', 'Email', 254),
            faculty_id: facultyId
        }), true);
        ensureChanged(result, 'Faculty member', facultyId);
        return { success: true, message: `Faculty member ${facultyId} updated successfully.` };
    }

    async deleteFaculty(facultyId) {
        const result = await this.withConnection(async connection => {
            const heads = await this.rows(connection, `
                SELECT DEPARTMENT_ID FROM DEPARTMENTS WHERE HOD_ID = :faculty_id
            `, { faculty_id: facultyId });
            if (heads.length) {
                throw new Error(`Faculty member ${facultyId} is assigned as head of department ${heads[0].DEPARTMENT_ID}.`);
            }
            return this.run(connection, 'DELETE FROM FACULTY WHERE FACULTY_ID = :faculty_id', {
                faculty_id: facultyId
            });
        }, true);
        ensureChanged(result, 'Faculty member', facultyId);
        return { success: true, message: `Faculty member ${facultyId} removed successfully.` };
    }

    async getDepartments() {
        return this.withConnection(connection => this.rows(connection, `
            SELECT d.*, f.FACULTY_NAME AS HOD_NAME
            FROM DEPARTMENTS d
            LEFT JOIN FACULTY f ON f.FACULTY_ID = d.HOD_ID
            ORDER BY d.DEPARTMENT_ID
        `));
    }

    async validateDepartmentHead(connection, facultyId, departmentId = null) {
        if (!facultyId) throw new Error('Head of Department is required.');
        const rows = await this.rows(connection, `
            SELECT 1 AS FOUND FROM FACULTY WHERE FACULTY_ID = :faculty_id
        `, { faculty_id: facultyId });
        if (!rows.length) throw new Error(`Faculty member ${facultyId} was not found.`);

        const assignmentSql = departmentId
            ? 'SELECT DEPARTMENT_ID FROM DEPARTMENTS WHERE HOD_ID = :faculty_id AND DEPARTMENT_ID <> :department_id'
            : 'SELECT DEPARTMENT_ID FROM DEPARTMENTS WHERE HOD_ID = :faculty_id';
        const assignments = await this.rows(connection, assignmentSql, {
            faculty_id: facultyId,
            ...(departmentId ? { department_id: departmentId } : {})
        });
        if (assignments.length) {
            throw new Error(`Faculty member ${facultyId} is already head of department ${assignments[0].DEPARTMENT_ID}.`);
        }
    }

    async createDepartment(data) {
        const departmentId = requiredText(data, 'department_id', 'Department ID');
        await this.withConnection(async connection => {
            const hodId = requiredText(data, 'hod_id', 'Head of Department');
            await this.validateDepartmentHead(connection, hodId);
            await this.run(connection, `
                INSERT INTO DEPARTMENTS (DEPARTMENT_ID, DEPARTMENT_NAME, HOD_ID)
                VALUES (:department_id, :department_name, :hod_id)
            `, {
                department_id: departmentId,
                department_name: requiredText(data, 'department_name', 'Department name', 100),
                hod_id: hodId
            });
        }, true);
        return { success: true, message: `Department ${departmentId} added successfully.` };
    }

    async updateDepartment(departmentId, data) {
        const result = await this.withConnection(async connection => {
            const hodId = requiredText(data, 'hod_id', 'Head of Department');
            await this.validateDepartmentHead(connection, hodId, departmentId);
            return this.run(connection, `
                UPDATE DEPARTMENTS
                SET DEPARTMENT_NAME = :department_name, HOD_ID = :hod_id
                WHERE DEPARTMENT_ID = :department_id
            `, {
                department_name: requiredText(data, 'department_name', 'Department name', 100),
                hod_id: hodId,
                department_id: departmentId
            });
        }, true);
        ensureChanged(result, 'Department', departmentId);
        return { success: true, message: `Department ${departmentId} updated successfully.` };
    }

    async deleteDepartment(departmentId) {
        const result = await this.withConnection(connection => this.run(
            connection,
            'DELETE FROM DEPARTMENTS WHERE DEPARTMENT_ID = :department_id',
            { department_id: departmentId }
        ), true);
        ensureChanged(result, 'Department', departmentId);
        return { success: true, message: `Department ${departmentId} removed successfully.` };
    }

    async getDegreePrograms() {
        return this.withConnection(connection => this.rows(connection, `
            SELECT dp.*, d.DEPARTMENT_NAME
            FROM DEGREE_PROGRAM dp
            JOIN DEPARTMENTS d ON d.DEPARTMENT_ID = dp.DEPARTMENT_ID
            ORDER BY dp.DEGREE_ID
        `));
    }

    async createDegreeProgram(data) {
        const degreeId = requiredText(data, 'degree_id', 'Degree ID');
        await this.withConnection(connection => this.run(connection, `
            INSERT INTO DEGREE_PROGRAM (DEGREE_ID, DEGREE_NAME, DEPARTMENT_ID)
            VALUES (:degree_id, :degree_name, :department_id)
        `, {
            degree_id: degreeId,
            degree_name: requiredText(data, 'degree_name', 'Degree name', 100),
            department_id: requiredText(data, 'department_id', 'Department')
        }), true);
        return { success: true, message: `Degree program ${degreeId} added successfully.` };
    }

    async updateDegreeProgram(degreeId, data) {
        const result = await this.withConnection(connection => this.run(connection, `
            UPDATE DEGREE_PROGRAM
            SET DEGREE_NAME = :degree_name, DEPARTMENT_ID = :department_id
            WHERE DEGREE_ID = :degree_id
        `, {
            degree_name: requiredText(data, 'degree_name', 'Degree name', 100),
            department_id: requiredText(data, 'department_id', 'Department'),
            degree_id: degreeId
        }), true);
        ensureChanged(result, 'Degree program', degreeId);
        return { success: true, message: `Degree program ${degreeId} updated successfully.` };
    }

    async deleteDegreeProgram(degreeId) {
        const result = await this.withConnection(connection => this.run(
            connection,
            'DELETE FROM DEGREE_PROGRAM WHERE DEGREE_ID = :degree_id',
            { degree_id: degreeId }
        ), true);
        ensureChanged(result, 'Degree program', degreeId);
        return { success: true, message: `Degree program ${degreeId} removed successfully.` };
    }

    async getEnrollments() {
        return this.withConnection(connection => this.rows(connection, `
            SELECT e.STUDENT_ID, e.COURSE_CODE, e.SEMESTER, e.FACULTY_ID,
                   INITCAP(e.STATUS) AS STATUS,
                   s.STUDENT_NAME, c.COURSE_NAME, f.FACULTY_NAME
            FROM ENROLLMENT e
            JOIN STUDENT_DETAILS s ON s.STUDENT_ID = e.STUDENT_ID
            JOIN COURSES c ON c.COURSE_CODE = e.COURSE_CODE
            JOIN FACULTY f ON f.FACULTY_ID = e.FACULTY_ID
            ORDER BY e.STUDENT_ID, e.COURSE_CODE, e.SEMESTER
        `));
    }

    async createEnrollment(data) {
        const studentId = requiredText(data, 'student_id', 'Student ID');
        const courseCode = requiredText(data, 'course_code', 'Course code');
        const semester = requiredText(data, 'semester', 'Semester');
        const facultyId = requiredText(data, 'faculty_id', 'Faculty ID');
        const status = (data.status || 'Enrolled').toUpperCase();
        if (!STATUS_OPTIONS.has(status)) throw new Error('Enrollment status must be Enrolled, Completed, or Dropped.');

        await this.withConnection(async connection => {
            await this.run(connection, `
                INSERT INTO ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER, FACULTY_ID, STATUS)
                VALUES (:student_id, :course_code, :semester, :faculty_id, :status)
            `, {
                student_id: studentId,
                course_code: courseCode,
                semester,
                faculty_id: facultyId,
                status
            });
        }, true);
        return { success: true, message: 'Student enrolled in course successfully. Add attendance and grades separately when available.' };
    }

    async updateEnrollmentStatus(studentId, courseCode, semester, status) {
        const normalizedStatus = String(status || '').toUpperCase();
        if (!STATUS_OPTIONS.has(normalizedStatus)) {
            throw new Error('Enrollment status must be Enrolled, Completed, or Dropped.');
        }
        const result = await this.withConnection(connection => this.run(connection, `
            UPDATE ENROLLMENT
            SET STATUS = :status
            WHERE STUDENT_ID = :student_id AND COURSE_CODE = :course_code
              AND SEMESTER = :semester
        `, {
            status: normalizedStatus,
            student_id: studentId,
            course_code: courseCode,
            semester
        }), true);
        ensureChanged(result, 'Enrollment', `${studentId}/${courseCode}/${semester}`);
        return { success: true, message: `Enrollment status marked as ${normalizedStatus.toLowerCase()}.` };
    }

    async getAttendance() {
        return this.withConnection(connection => this.rows(connection, `
            SELECT a.STUDENT_ID, a.COURSE_CODE, a.SEMESTER, a.TOTAL_HOURS, a.HOURS_ATTENDED,
                   ROUND(a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0), 1) AS ATTENDANCE_PERCENT,
                   CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
                        THEN 'Eligible' ELSE 'Ineligible' END AS EXAM_STATUS,
                   s.STUDENT_NAME, c.COURSE_NAME
            FROM ATTENDANCE a
            JOIN STUDENT_DETAILS s ON s.STUDENT_ID = a.STUDENT_ID
            JOIN COURSES c ON c.COURSE_CODE = a.COURSE_CODE
            ORDER BY a.STUDENT_ID, a.COURSE_CODE, a.SEMESTER
        `));
    }

    async createAttendance(studentId, courseCode, semester, hoursAttended, totalHours) {
        const attendance = computeAttendance(hoursAttended, totalHours);
        await this.withConnection(async connection => {
            await this.run(connection, `
                INSERT INTO ATTENDANCE
                    (STUDENT_ID, COURSE_CODE, SEMESTER, TOTAL_HOURS, HOURS_ATTENDED, EXAM_STATUS)
                VALUES
                    (:student_id, :course_code, :semester, :total_hours, :hours_attended, :exam_status)
            `, {
                student_id: studentId,
                course_code: courseCode,
                semester,
                total_hours: attendance.total,
                hours_attended: attendance.attended,
                exam_status: attendance.status.toUpperCase()
            });
            await this.recalculateSingleGrade(
                connection,
                studentId,
                courseCode,
                semester,
                attendance.status === 'Eligible'
            );
        }, true);

        return {
            success: true,
            attendancePercent: attendance.percent,
            examStatus: attendance.status,
            message: `Attendance added: ${attendance.percent}% (${attendance.status}).`
        };
    }

    async recalculateSingleGrade(connection, studentId, courseCode, semester, isEligible) {
        const rows = await this.rows(connection, `
            SELECT SESSIONALS, FINAL_EXAM FROM GRADES
            WHERE STUDENT_ID = :student_id
              AND COURSE_CODE = :course_code
              AND SEMESTER = :semester
        `, { student_id: studentId, course_code: courseCode, semester });
        if (!rows.length) return;

        const grade = computeGrade(rows[0].SESSIONALS, rows[0].FINAL_EXAM, isEligible);
        await this.run(connection, `
            UPDATE GRADES
            SET GRADE = :grade
            WHERE STUDENT_ID = :student_id
              AND COURSE_CODE = :course_code
              AND SEMESTER = :semester
        `, {
            grade: grade.grade,
            student_id: studentId,
            course_code: courseCode,
            semester
        });
    }

    async updateAttendance(studentId, courseCode, semester, hoursAttended, totalHours) {
        const attendance = computeAttendance(hoursAttended, totalHours);
        await this.withConnection(async connection => {
            const result = await this.run(connection, `
                UPDATE ATTENDANCE
                SET HOURS_ATTENDED = :hours_attended,
                    TOTAL_HOURS = :total_hours,
                    EXAM_STATUS = :exam_status
                WHERE STUDENT_ID = :student_id
                  AND COURSE_CODE = :course_code
                  AND SEMESTER = :semester
            `, {
                hours_attended: attendance.attended,
                total_hours: attendance.total,
                exam_status: attendance.status.toUpperCase(),
                student_id: studentId,
                course_code: courseCode,
                semester
            });
            ensureChanged(result, 'Attendance record', `${studentId}/${courseCode}/${semester}`);

            await this.recalculateSingleGrade(
                connection,
                studentId,
                courseCode,
                semester,
                attendance.status === 'Eligible'
            );
        }, true);

        return {
            success: true,
            attendancePercent: attendance.percent,
            examStatus: attendance.status,
            message: `Attendance updated: ${attendance.percent}% (${attendance.status}). ${attendance.status === 'Ineligible' ? 'Final exam mark counts as 0 while ineligible.' : ''}`
        };
    }

    async getGrades() {
        const score = ELIGIBLE_SCORE;
        const grade = GRADE_CASE(score);
        return this.withConnection(connection => this.rows(connection, `
            SELECT g.STUDENT_ID, g.COURSE_CODE, g.SEMESTER, g.SESSIONALS,
                   CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
                        THEN g.FINAL_EXAM ELSE 0 END AS FINAL_EXAM,
                   ${score} AS TOTAL_SCORE,
                   ${grade} AS GRADE,
                   s.STUDENT_NAME, c.COURSE_NAME,
                   CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
                        THEN 'Eligible' ELSE 'Ineligible' END AS EXAM_STATUS,
                   ROUND(NVL(a.HOURS_ATTENDED, 0) * 100 / NULLIF(a.TOTAL_HOURS, 0), 1) AS ATTENDANCE_PERCENT
            FROM GRADES g
            JOIN STUDENT_DETAILS s ON s.STUDENT_ID = g.STUDENT_ID
            JOIN COURSES c ON c.COURSE_CODE = g.COURSE_CODE
            LEFT JOIN ATTENDANCE a
              ON a.STUDENT_ID = g.STUDENT_ID
             AND a.COURSE_CODE = g.COURSE_CODE
             AND a.SEMESTER = g.SEMESTER
            ORDER BY g.STUDENT_ID, g.COURSE_CODE, g.SEMESTER
        `));
    }

    async updateGrade(studentId, courseCode, semester, sessionals, finalExam) {
        const validatedSessionals = integerInRange(sessionals, 'Sessional marks', 0, 50);
        const validatedFinalExam = integerInRange(finalExam, 'Final exam marks', 0, 50);
        const result = await this.withConnection(async connection => {
            const attendance = await this.rows(connection, `
                SELECT HOURS_ATTENDED, TOTAL_HOURS FROM ATTENDANCE
                WHERE STUDENT_ID = :student_id
                  AND COURSE_CODE = :course_code
                  AND SEMESTER = :semester
            `, { student_id: studentId, course_code: courseCode, semester });
            const isEligible = attendance.length > 0 &&
                attendance[0].HOURS_ATTENDED * 100 / attendance[0].TOTAL_HOURS >= 80;
            const existingGrades = await this.rows(connection, `
                SELECT FINAL_EXAM FROM GRADES
                WHERE STUDENT_ID = :student_id
                  AND COURSE_CODE = :course_code
                  AND SEMESTER = :semester
                FOR UPDATE
            `, { student_id: studentId, course_code: courseCode, semester });
            if (!existingGrades.length) {
                throw new Error(`Grade record ${studentId}/${courseCode}/${semester} was not found.`);
            }
            const calculated = computeGrade(validatedSessionals, validatedFinalExam, isEligible);
            const storedFinalExam = isEligible
                ? calculated.finalExam
                : Number(existingGrades[0].FINAL_EXAM);
            const update = await this.run(connection, `
                UPDATE GRADES
                SET SESSIONALS = :sessionals, FINAL_EXAM = :final_exam, GRADE = :grade
                WHERE STUDENT_ID = :student_id
                  AND COURSE_CODE = :course_code
                  AND SEMESTER = :semester
            `, {
                sessionals: calculated.sessionals,
                final_exam: storedFinalExam,
                grade: calculated.grade,
                student_id: studentId,
                course_code: courseCode,
                semester
            });
            ensureChanged(update, 'Grade record', `${studentId}/${courseCode}/${semester}`);
            return { ...calculated, isEligible };
        }, true);

        const message = !result.isEligible
            ? `Student attendance is < 80% (Ineligible). Final exam counts as 0 / 50. Total Score: ${result.totalScore} / 100 (${result.grade}).`
            : `Marks saved. Sessionals: ${result.sessionals}/50, Final Exam: ${result.finalExam}/50. Total Score: ${result.totalScore}/100 (${result.grade}).`;
        return {
            success: true,
            sessionals: result.sessionals,
            finalExam: result.finalExam,
            totalScore: result.totalScore,
            grade: result.grade,
            message
        };
    }

    async createGrade(studentId, courseCode, semester, sessionals, finalExam) {
        const validatedSessionals = integerInRange(sessionals, 'Sessional marks', 0, 50);
        const validatedFinalExam = integerInRange(finalExam, 'Final exam marks', 0, 50);
        const result = await this.withConnection(async connection => {
            const attendance = await this.rows(connection, `
                SELECT HOURS_ATTENDED, TOTAL_HOURS FROM ATTENDANCE
                WHERE STUDENT_ID = :student_id
                  AND COURSE_CODE = :course_code
                  AND SEMESTER = :semester
            `, { student_id: studentId, course_code: courseCode, semester });
            if (!attendance.length) {
                throw new Error('Add an attendance record before entering grades.');
            }

            const isEligible =
                attendance[0].HOURS_ATTENDED * 100 / attendance[0].TOTAL_HOURS >= 80;
            const calculated = computeGrade(validatedSessionals, validatedFinalExam, isEligible);
            await this.run(connection, `
                INSERT INTO GRADES
                    (STUDENT_ID, COURSE_CODE, SEMESTER, SESSIONALS, FINAL_EXAM, GRADE)
                VALUES
                    (:student_id, :course_code, :semester, :sessionals, :final_exam, :grade)
            `, {
                student_id: studentId,
                course_code: courseCode,
                semester,
                sessionals: calculated.sessionals,
                final_exam: calculated.finalExam,
                grade: calculated.grade
            });
            return { ...calculated, isEligible };
        }, true);

        const message = !result.isEligible
            ? `Student attendance is < 80% (Ineligible). Final exam counts as 0 / 50. Total Score: ${result.totalScore} / 100 (${result.grade}).`
            : `Marks saved. Sessionals: ${result.sessionals}/50, Final Exam: ${result.finalExam}/50. Total Score: ${result.totalScore}/100 (${result.grade}).`;
        return {
            success: true,
            sessionals: result.sessionals,
            finalExam: result.finalExam,
            totalScore: result.totalScore,
            grade: result.grade,
            message
        };
    }

    async updateCalculatedGrades(connection) {
        const score = `
            g.SESSIONALS +
            CASE WHEN EXISTS (
                SELECT 1 FROM ATTENDANCE a
                WHERE a.STUDENT_ID = g.STUDENT_ID
                  AND a.COURSE_CODE = g.COURSE_CODE
                  AND a.SEMESTER = g.SEMESTER
                  AND a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
            ) THEN g.FINAL_EXAM ELSE 0 END
        `;
        await this.run(connection, `
            UPDATE GRADES g
            SET GRADE = ${GRADE_CASE(score)}
        `);
    }

    async recalculateGrades() {
        await this.withConnection(
            connection => this.updateCalculatedGrades(connection),
            true
        );
        return {
            success: true,
            message: 'Final grades recalculated using current attendance eligibility. Ineligible final exams count as 0.'
        };
    }

    async syncExamEligibility() {
        await this.withConnection(async connection => {
            await this.run(connection, `
                UPDATE ATTENDANCE
                SET EXAM_STATUS = CASE
                    WHEN HOURS_ATTENDED * 100 / NULLIF(TOTAL_HOURS, 0) >= 80
                    THEN 'ELIGIBLE' ELSE 'INELIGIBLE' END
            `);
            await this.updateCalculatedGrades(connection);
        }, true);
        return {
            success: true,
            message: 'Exam eligibility synchronized. Ineligible final exams count as 0; stored marks are preserved.'
        };
    }

    async getAtRiskStudents() {
        const score = `
            NVL(g.SESSIONALS, 0) +
            CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) < 80
                 THEN 0 ELSE NVL(g.FINAL_EXAM, 0) END
        `;
        const grade = GRADE_CASE(score);
        return this.withConnection(connection => this.rows(connection, `
            SELECT s.STUDENT_ID, s.STUDENT_NAME, s.EMAIL,
                   a.COURSE_CODE, a.SEMESTER, c.COURSE_NAME,
                   ROUND(a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0), 1) AS ATTENDANCE_PERCENT,
                   CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
                        THEN 'Eligible' ELSE 'Ineligible' END AS EXAM_STATUS,
                   ${score} AS TOTAL_SCORE,
                   ${grade} AS GRADE,
                   CASE
                       WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) < 80
                            AND ${score} < 60
                           THEN 'Critical (Ineligible & < 60 Marks)'
                       WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) < 80
                           THEN 'Ineligible (< 80% Attendance)'
                       ELSE 'Academic Warning (< 60 Marks)'
                   END AS RISK_LEVEL
            FROM STUDENT_DETAILS s
            JOIN ATTENDANCE a ON a.STUDENT_ID = s.STUDENT_ID
            JOIN COURSES c ON c.COURSE_CODE = a.COURSE_CODE
            LEFT JOIN GRADES g
              ON g.STUDENT_ID = s.STUDENT_ID
             AND g.COURSE_CODE = a.COURSE_CODE
             AND g.SEMESTER = a.SEMESTER
            WHERE a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) < 80
               OR ${score} < 60
            ORDER BY ATTENDANCE_PERCENT
        `));
    }

    async getCoursePerformance() {
        const score = ELIGIBLE_SCORE;
        return this.withConnection(connection => this.rows(connection, `
            SELECT c.COURSE_CODE, c.COURSE_NAME, d.DEPARTMENT_NAME,
                   COUNT(e.STUDENT_ID) AS TOTAL_STUDENTS,
                   ROUND(AVG(${score}), 1) AS AVG_TOTAL_SCORE,
                   MAX(${score}) AS HIGHEST_SCORE,
                   MIN(${score}) AS LOWEST_SCORE
            FROM COURSES c
            JOIN DEPARTMENTS d ON d.DEPARTMENT_ID = c.DEPARTMENT_ID
            JOIN ENROLLMENT e ON e.COURSE_CODE = c.COURSE_CODE
            LEFT JOIN GRADES g
              ON g.STUDENT_ID = e.STUDENT_ID
             AND g.COURSE_CODE = e.COURSE_CODE
             AND g.SEMESTER = e.SEMESTER
            LEFT JOIN ATTENDANCE a
              ON a.STUDENT_ID = e.STUDENT_ID
             AND a.COURSE_CODE = e.COURSE_CODE
             AND a.SEMESTER = e.SEMESTER
            GROUP BY c.COURSE_CODE, c.COURSE_NAME, d.DEPARTMENT_NAME
            ORDER BY AVG_TOTAL_SCORE DESC NULLS LAST, c.COURSE_CODE
        `));
    }

    async resetDatabase() {
        throw new Error('Resetting seed data is disabled for the connected Oracle database to prevent deleting live records.');
    }

    async close() {
        if (!this.pool) {
            await this.ready.catch(() => {});
            if (!this.pool) return;
        }
        await this.pool.close(5);
        this.pool = null;
    }
}

module.exports = new AcademicDatabase();
