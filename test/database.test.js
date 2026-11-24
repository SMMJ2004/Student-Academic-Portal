const assert = require('node:assert/strict');
const test = require('node:test');
const database = require('../src/database');

function mockDatabase(t, { rows, run }) {
    const original = {
        withConnection: database.withConnection,
        rows: database.rows,
        run: database.run
    };

    database.withConnection = async work => work({});
    database.rows = rows;
    database.run = run;

    t.after(() => {
        Object.assign(database, original);
    });
}

test('attendance changes preserve stored final marks while recalculating the effective grade', async t => {
    const writes = [];
    mockDatabase(t, {
        rows: async (_connection, sql) => sql.includes('SELECT SESSIONALS, FINAL_EXAM')
            ? [{ SESSIONALS: 42, FINAL_EXAM: 36 }]
            : [],
        run: async (_connection, sql, binds) => {
            writes.push({ sql, binds });
            return { rowsAffected: 1 };
        }
    });

    const result = await database.updateAttendance('S001', 'CS101', 'Fall 2023', 75, 100);
    const gradeWrite = writes.find(write => write.sql.includes('UPDATE GRADES'));

    assert.equal(result.examStatus, 'Ineligible');
    assert.match(result.message, /counts as 0 while ineligible/);
    assert.match(gradeWrite.sql, /SET GRADE = :grade/);
    assert.doesNotMatch(gradeWrite.sql, /FINAL_EXAM\s*=/i);
});

test('editing grades while ineligible keeps the stored exam mark but reports an effective zero', async t => {
    let updateBinds;
    mockDatabase(t, {
        rows: async (_connection, sql) => {
            if (sql.includes('SELECT HOURS_ATTENDED, TOTAL_HOURS')) {
                return [{ HOURS_ATTENDED: 75, TOTAL_HOURS: 100 }];
            }
            if (sql.includes('SELECT FINAL_EXAM FROM GRADES')) {
                return [{ FINAL_EXAM: 36 }];
            }
            return [];
        },
        run: async (_connection, _sql, binds) => {
            updateBinds = binds;
            return { rowsAffected: 1 };
        }
    });

    const result = await database.updateGrade('S001', 'CS101', 'Fall 2023', 42, 0);

    assert.equal(updateBinds.final_exam, 36);
    assert.equal(result.finalExam, 0);
    assert.equal(result.totalScore, 42);
});

test('grades view shows zero for ineligible exams based on attendance hours', async t => {
    let gradeQuery;
    mockDatabase(t, {
        rows: async (_connection, sql) => {
            gradeQuery = sql;
            return [];
        },
        run: async () => ({ rowsAffected: 1 })
    });

    await database.getGrades();

    assert.match(
        gradeQuery,
        /CASE WHEN a\.HOURS_ATTENDED \* 100 \/ NULLIF\(a\.TOTAL_HOURS, 0\) >= 80\s+THEN g\.FINAL_EXAM ELSE 0 END AS FINAL_EXAM/
    );
});

test('grade recalculation updates grades without synchronizing attendance or overwriting exam marks', async t => {
    const writes = [];
    mockDatabase(t, {
        rows: async () => [],
        run: async (_connection, sql) => {
            writes.push(sql);
            return { rowsAffected: 1 };
        }
    });

    await database.recalculateGrades();

    assert.equal(writes.length, 1);
    assert.match(writes[0], /UPDATE GRADES g/);
    assert.doesNotMatch(writes[0], /UPDATE ATTENDANCE|SET FINAL_EXAM\s*=/i);
});

test('eligibility synchronization updates statuses and grades without overwriting exam marks', async t => {
    const writes = [];
    mockDatabase(t, {
        rows: async () => [],
        run: async (_connection, sql) => {
            writes.push(sql);
            return { rowsAffected: 1 };
        }
    });

    await database.syncExamEligibility();

    assert.equal(writes.length, 2);
    assert.match(writes[0], /UPDATE ATTENDANCE/);
    assert.match(writes[1], /UPDATE GRADES g/);
    assert.doesNotMatch(writes[1], /SET FINAL_EXAM\s*=/i);
});
