-- ============================================================================
-- Student Academic Record Database - Oracle SQL
-- File: 03_crud_queries.sql
-- Description: Update and Delete DML queries extracted directly from the report.
-- ============================================================================

-- ============================================================================
-- UPDATE QUERIES
-- ============================================================================

-- 1. Update student's email address
UPDATE STUDENT_DETAILS
SET EMAIL = 'john.doe_updated@email.com'
WHERE STUDENT_ID = 'S001';

-- 2. Update degree program title
UPDATE DEGREE_PROGRAM
SET DEGREE_NAME = 'Computer Science'
WHERE DEGREE_ID = 'BSc_CS';

-- 3. Update faculty role to Head of Department
UPDATE FACULTY
SET ROLE = 'Head of Department'
WHERE FACULTY_ID = 'F001';

-- 4. Update department name
UPDATE DEPARTMENTS
SET DEPARTMENT_NAME = 'Department of Computer Science'
WHERE DEPARTMENT_ID = 'CS';

-- 5. Update course credit hours
UPDATE COURSES
SET CREDIT_HOURS = 4
WHERE COURSE_CODE = 'CS101';

-- 6. Update student grade
UPDATE GRADES
SET SESSIONALS = 40, FINAL_EXAM = 40, GRADE = 'B'
WHERE STUDENT_ID = 'S002' AND COURSE_CODE = 'CS102' AND SEMESTER = 'Fall 2023';

-- 7. Update exam status in attendance
UPDATE ATTENDANCE
SET EXAM_STATUS = 'ELIGIBLE'
WHERE STUDENT_ID = 'S009' AND COURSE_CODE = 'PH102' AND SEMESTER = 'Fall 2023';

-- 8. Update enrollment status
UPDATE ENROLLMENT
SET STATUS = 'Completed'
WHERE STUDENT_ID = 'S010' AND COURSE_CODE = 'CH102' AND SEMESTER = 'Fall 2023';

-- 9. Demote/change faculty role
UPDATE FACULTY 
SET ROLE = 'Lecturer' 
WHERE FACULTY_ID = 'F001';

COMMIT;


-- ============================================================================
-- DELETE QUERIES
-- ============================================================================

-- 1. Delete grade record for a student in a specific course
DELETE FROM GRADES
WHERE STUDENT_ID = 'S003' AND COURSE_CODE = 'PH101' AND SEMESTER = 'Fall 2023';

-- 2. Delete attendance record for a student in a specific course
DELETE FROM ATTENDANCE
WHERE STUDENT_ID = 'S009' AND COURSE_CODE = 'PH102' AND SEMESTER = 'Fall 2023';

-- 3. Delete enrollment record for a student in a specific course
DELETE FROM GRADES
WHERE STUDENT_ID = 'S010' AND COURSE_CODE = 'CH102' AND SEMESTER = 'Fall 2023';

DELETE FROM ATTENDANCE
WHERE STUDENT_ID = 'S010' AND COURSE_CODE = 'CH102' AND SEMESTER = 'Fall 2023';

DELETE FROM ENROLLMENT
WHERE STUDENT_ID = 'S010' AND COURSE_CODE = 'CH102' AND SEMESTER = 'Fall 2023';

COMMIT;
