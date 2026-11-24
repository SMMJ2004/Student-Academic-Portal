-- Run once against an existing Oracle schema after taking a database backup.
-- The preflight stops before any DDL if rows cannot be mapped safely.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET SERVEROUTPUT ON;

DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM (
        SELECT e.STUDENT_ID, e.COURSE_CODE
        FROM ENROLLMENT e
        WHERE EXISTS (
            SELECT 1
            FROM ATTENDANCE a
            WHERE a.STUDENT_ID = e.STUDENT_ID
              AND a.COURSE_CODE = e.COURSE_CODE
        )
        GROUP BY e.STUDENT_ID, e.COURSE_CODE
        HAVING COUNT(*) > 1
    );
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'Migration stopped: duplicate enrollment pairs make legacy attendance semester ambiguous.');
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM (
        SELECT STUDENT_ID, COURSE_CODE, SEMESTER
        FROM ENROLLMENT
        GROUP BY STUDENT_ID, COURSE_CODE, SEMESTER
        HAVING COUNT(*) > 1
    );
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20006, 'Migration stopped: duplicate enrollment rows exist for a student, course, and semester.');
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM (
        SELECT STUDENT_ID, COURSE_CODE
        FROM ATTENDANCE
        GROUP BY STUDENT_ID, COURSE_CODE
        HAVING COUNT(*) > 1
    );
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20002, 'Migration stopped: duplicate attendance rows exist for a student and course.');
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM ATTENDANCE a
    WHERE NOT EXISTS (
        SELECT 1
        FROM ENROLLMENT e
        WHERE e.STUDENT_ID = a.STUDENT_ID
          AND e.COURSE_CODE = a.COURSE_CODE
    );
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20003, 'Migration stopped: attendance rows without a matching enrollment exist.');
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM GRADES g
    WHERE NOT EXISTS (
        SELECT 1
        FROM ENROLLMENT e
        WHERE e.STUDENT_ID = g.STUDENT_ID
          AND e.COURSE_CODE = g.COURSE_CODE
          AND e.SEMESTER = g.SEMESTER
    );
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20004, 'Migration stopped: grade rows without a matching enrollment semester exist.');
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM (
        SELECT STUDENT_ID, COURSE_CODE, SEMESTER
        FROM GRADES
        GROUP BY STUDENT_ID, COURSE_CODE, SEMESTER
        HAVING COUNT(*) > 1
    );
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20005, 'Migration stopped: duplicate grade rows exist for a student, course, and semester.');
    END IF;
END;
/

ALTER TABLE STUDENT_DETAILS MODIFY (
    STUDENT_NAME VARCHAR2(100 CHAR),
    FATHER_NAME VARCHAR2(100 CHAR),
    EMAIL VARCHAR2(254 CHAR)
);
ALTER TABLE COURSES MODIFY (COURSE_NAME VARCHAR2(100 CHAR));
ALTER TABLE DEPARTMENTS MODIFY (DEPARTMENT_NAME VARCHAR2(100 CHAR));
ALTER TABLE DEGREE_PROGRAM MODIFY (DEGREE_NAME VARCHAR2(100 CHAR));
ALTER TABLE FACULTY MODIFY (
    FACULTY_NAME VARCHAR2(100 CHAR),
    ROLE VARCHAR2(50 CHAR),
    EMAIL VARCHAR2(254 CHAR)
);
ALTER TABLE ATTENDANCE ADD (SEMESTER VARCHAR2(30));

UPDATE ATTENDANCE a
SET SEMESTER = (
    SELECT e.SEMESTER
    FROM ENROLLMENT e
    WHERE e.STUDENT_ID = a.STUDENT_ID
      AND e.COURSE_CODE = a.COURSE_CODE
);

ALTER TABLE ATTENDANCE MODIFY (SEMESTER NOT NULL);

DECLARE
    v_constraint_name USER_CONSTRAINTS.CONSTRAINT_NAME%TYPE;
BEGIN
    FOR t IN (
        SELECT 'ENROLLMENT' AS TABLE_NAME FROM DUAL
        UNION ALL SELECT 'ATTENDANCE' FROM DUAL
        UNION ALL SELECT 'GRADES' FROM DUAL
    ) LOOP
        BEGIN
            SELECT CONSTRAINT_NAME INTO v_constraint_name
            FROM USER_CONSTRAINTS
            WHERE TABLE_NAME = t.TABLE_NAME
              AND CONSTRAINT_TYPE = 'P';
            EXECUTE IMMEDIATE
                'ALTER TABLE ' || t.TABLE_NAME || ' DROP CONSTRAINT ' || v_constraint_name || ' CASCADE';
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                NULL;
        END;
    END LOOP;

    FOR c IN (
        SELECT uc.TABLE_NAME, uc.CONSTRAINT_NAME
        FROM USER_CONSTRAINTS uc
        WHERE uc.TABLE_NAME IN ('ENROLLMENT', 'ATTENDANCE', 'GRADES')
          AND uc.CONSTRAINT_TYPE = 'U'
          AND 2 = (
              SELECT COUNT(*)
              FROM USER_CONS_COLUMNS ucc
              WHERE ucc.CONSTRAINT_NAME = uc.CONSTRAINT_NAME
                AND ucc.TABLE_NAME = uc.TABLE_NAME
          )
          AND EXISTS (
              SELECT 1 FROM USER_CONS_COLUMNS ucc
              WHERE ucc.CONSTRAINT_NAME = uc.CONSTRAINT_NAME
                AND ucc.TABLE_NAME = uc.TABLE_NAME
                AND ucc.COLUMN_NAME = 'STUDENT_ID'
          )
          AND EXISTS (
              SELECT 1 FROM USER_CONS_COLUMNS ucc
              WHERE ucc.CONSTRAINT_NAME = uc.CONSTRAINT_NAME
                AND ucc.TABLE_NAME = uc.TABLE_NAME
                AND ucc.COLUMN_NAME = 'COURSE_CODE'
          )
    ) LOOP
        EXECUTE IMMEDIATE
            'ALTER TABLE ' || c.TABLE_NAME || ' DROP CONSTRAINT ' || c.CONSTRAINT_NAME || ' CASCADE';
    END LOOP;
END;
/

ALTER TABLE ENROLLMENT ADD CONSTRAINT ENROLLMENT_PK
    PRIMARY KEY (STUDENT_ID, COURSE_CODE, SEMESTER);
ALTER TABLE ATTENDANCE ADD CONSTRAINT ATTENDANCE_PK
    PRIMARY KEY (STUDENT_ID, COURSE_CODE, SEMESTER);
ALTER TABLE GRADES ADD CONSTRAINT GRADES_PK
    PRIMARY KEY (STUDENT_ID, COURSE_CODE, SEMESTER);

ALTER TABLE ATTENDANCE ADD CONSTRAINT ATTENDANCE_ENROLLMENT_FK
    FOREIGN KEY (STUDENT_ID, COURSE_CODE, SEMESTER)
    REFERENCES ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER);
ALTER TABLE GRADES ADD CONSTRAINT GRADES_ENROLLMENT_FK
    FOREIGN KEY (STUDENT_ID, COURSE_CODE, SEMESTER)
    REFERENCES ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER);

COMMIT;
PROMPT Semester-aware keys migration completed. Existing rows were preserved.
