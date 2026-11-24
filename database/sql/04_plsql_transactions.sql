-- ============================================================================
-- Student Academic Record Database - Oracle SQL
-- File: 04_plsql_transactions.sql
-- Description: PL/SQL blocks and Transaction Management extracted from the report.
-- ============================================================================

-- Enable DBMS_OUTPUT for console logging in SQL*Plus / SQL Developer / SQLcl
SET SERVEROUTPUT ON;

-- ----------------------------------------------------------------------------
-- Block 1: Dynamic Grade Calculation using CASE Statement
-- Ineligible final exam marks count as 0; stored marks are left unchanged.
-- ----------------------------------------------------------------------------
BEGIN
    UPDATE GRADES g
    SET GRADE = CASE
        WHEN g.SESSIONALS + CASE WHEN EXISTS (
            SELECT 1 FROM ATTENDANCE a
            WHERE a.STUDENT_ID = g.STUDENT_ID
              AND a.COURSE_CODE = g.COURSE_CODE
              AND a.SEMESTER = g.SEMESTER
              AND a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
        ) THEN g.FINAL_EXAM ELSE 0 END > 86 THEN 'A'
        WHEN g.SESSIONALS + CASE WHEN EXISTS (
            SELECT 1 FROM ATTENDANCE a
            WHERE a.STUDENT_ID = g.STUDENT_ID
              AND a.COURSE_CODE = g.COURSE_CODE
              AND a.SEMESTER = g.SEMESTER
              AND a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
        ) THEN g.FINAL_EXAM ELSE 0 END > 74 THEN 'B'
        WHEN g.SESSIONALS + CASE WHEN EXISTS (
            SELECT 1 FROM ATTENDANCE a
            WHERE a.STUDENT_ID = g.STUDENT_ID
              AND a.COURSE_CODE = g.COURSE_CODE
              AND a.SEMESTER = g.SEMESTER
              AND a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
        ) THEN g.FINAL_EXAM ELSE 0 END > 62 THEN 'C'
        WHEN g.SESSIONALS + CASE WHEN EXISTS (
            SELECT 1 FROM ATTENDANCE a
            WHERE a.STUDENT_ID = g.STUDENT_ID
              AND a.COURSE_CODE = g.COURSE_CODE
              AND a.SEMESTER = g.SEMESTER
              AND a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
        ) THEN g.FINAL_EXAM ELSE 0 END > 50 THEN 'D'
        ELSE 'F'
    END;

    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Grade recalculation completed successfully.');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        DBMS_OUTPUT.PUT_LINE('Error during grade update: ' || SQLERRM);
END;
/

-- ----------------------------------------------------------------------------
-- Block 2: Exam Eligibility Automation based on Attendance Ratio
-- Ineligible final exam marks count as 0; stored marks are left unchanged.
-- ----------------------------------------------------------------------------
BEGIN
    UPDATE ATTENDANCE
    SET EXAM_STATUS = CASE
        WHEN (HOURS_ATTENDED / TOTAL_HOURS >= 0.80) THEN 'ELIGIBLE'
        ELSE 'INELIGIBLE'
    END;

    UPDATE GRADES g
    SET GRADE = CASE
        WHEN g.SESSIONALS + CASE WHEN EXISTS (
            SELECT 1
            FROM ATTENDANCE a
            WHERE a.STUDENT_ID = g.STUDENT_ID
              AND a.COURSE_CODE = g.COURSE_CODE
              AND a.SEMESTER = g.SEMESTER
              AND a.EXAM_STATUS = 'ELIGIBLE'
        ) THEN g.FINAL_EXAM ELSE 0 END > 86 THEN 'A'
        WHEN g.SESSIONALS + CASE WHEN EXISTS (
            SELECT 1
            FROM ATTENDANCE a
            WHERE a.STUDENT_ID = g.STUDENT_ID
              AND a.COURSE_CODE = g.COURSE_CODE
              AND a.SEMESTER = g.SEMESTER
              AND a.EXAM_STATUS = 'ELIGIBLE'
        ) THEN g.FINAL_EXAM ELSE 0 END > 74 THEN 'B'
        WHEN g.SESSIONALS + CASE WHEN EXISTS (
            SELECT 1
            FROM ATTENDANCE a
            WHERE a.STUDENT_ID = g.STUDENT_ID
              AND a.COURSE_CODE = g.COURSE_CODE
              AND a.SEMESTER = g.SEMESTER
              AND a.EXAM_STATUS = 'ELIGIBLE'
        ) THEN g.FINAL_EXAM ELSE 0 END > 62 THEN 'C'
        WHEN g.SESSIONALS + CASE WHEN EXISTS (
            SELECT 1
            FROM ATTENDANCE a
            WHERE a.STUDENT_ID = g.STUDENT_ID
              AND a.COURSE_CODE = g.COURSE_CODE
              AND a.SEMESTER = g.SEMESTER
              AND a.EXAM_STATUS = 'ELIGIBLE'
        ) THEN g.FINAL_EXAM ELSE 0 END > 50 THEN 'D'
        ELSE 'F'
    END;

    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Attendance status recalculated; ineligible exam marks count as 0 and are preserved.');
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        DBMS_OUTPUT.PUT_LINE('Error updating attendance eligibility: ' || SQLERRM);
END;
/
