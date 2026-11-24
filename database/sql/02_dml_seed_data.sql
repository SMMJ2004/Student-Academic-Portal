-- ============================================================================
-- Student Academic Record Database - Oracle SQL
-- File: 02_dml_seed_data.sql
-- Description: DML script containing the exact sample records extracted from
--              the project report (Pages 11-14).
-- ============================================================================

-- Disable circular FK temporarily to allow clean initial load of DEPARTMENTS & FACULTY
ALTER TABLE DEPARTMENTS DISABLE CONSTRAINT DEPARTMENTS_FACULTY_FK;

-- ----------------------------------------------------------------------------
-- 1. DEPARTMENTS (Page 12)
-- ----------------------------------------------------------------------------
INSERT INTO DEPARTMENTS (DEPARTMENT_ID, DEPARTMENT_NAME, HOD_ID)
VALUES ('CS', 'Computer Science', 'F001');

INSERT INTO DEPARTMENTS (DEPARTMENT_ID, DEPARTMENT_NAME, HOD_ID)
VALUES ('PH', 'Physics', 'F003');

INSERT INTO DEPARTMENTS (DEPARTMENT_ID, DEPARTMENT_NAME, HOD_ID)
VALUES ('CH', 'Chemistry', 'F004');

INSERT INTO DEPARTMENTS (DEPARTMENT_ID, DEPARTMENT_NAME, HOD_ID)
VALUES ('BI', 'Biology', 'F005');

INSERT INTO DEPARTMENTS (DEPARTMENT_ID, DEPARTMENT_NAME, HOD_ID)
VALUES ('MA', 'Mathematics', 'F006');

-- ----------------------------------------------------------------------------
-- 2. FACULTY (Page 12)
-- ----------------------------------------------------------------------------
INSERT INTO FACULTY (FACULTY_ID, FACULTY_NAME, GENDER, ROLE, DEPARTMENT_ID, EMAIL)
VALUES ('F001', 'Dr. Alice Williams', 'Female', 'Professor', 'CS', 'alice.williams@email.com');

INSERT INTO FACULTY (FACULTY_ID, FACULTY_NAME, GENDER, ROLE, DEPARTMENT_ID, EMAIL)
VALUES ('F002', 'Dr. Bob Johnson', 'Male', 'Assistant Professor', 'CS', 'bob.johnson@email.com');

INSERT INTO FACULTY (FACULTY_ID, FACULTY_NAME, GENDER, ROLE, DEPARTMENT_ID, EMAIL)
VALUES ('F003', 'Dr. Carol Davis', 'Female', 'Professor', 'PH', 'carol.davis@email.com');

INSERT INTO FACULTY (FACULTY_ID, FACULTY_NAME, GENDER, ROLE, DEPARTMENT_ID, EMAIL)
VALUES ('F004', 'Dr. Daniel Lee', 'Male', 'Associate Professor', 'CH', 'daniel.lee@email.com');

INSERT INTO FACULTY (FACULTY_ID, FACULTY_NAME, GENDER, ROLE, DEPARTMENT_ID, EMAIL)
VALUES ('F005', 'Dr. Eva Moore', 'Female', 'Professor', 'BI', 'eva.moore@email.com');

INSERT INTO FACULTY (FACULTY_ID, FACULTY_NAME, GENDER, ROLE, DEPARTMENT_ID, EMAIL)
VALUES ('F006', 'Dr. Frank White', 'Male', 'Lecturer', 'MA', 'frank.white@email.com');

-- Re-enable circular FK constraint
ALTER TABLE DEPARTMENTS ENABLE CONSTRAINT DEPARTMENTS_FACULTY_FK;

-- ----------------------------------------------------------------------------
-- 3. DEGREE_PROGRAM (Page 11)
-- ----------------------------------------------------------------------------
INSERT INTO DEGREE_PROGRAM (DEGREE_ID, DEGREE_NAME, DEPARTMENT_ID)
VALUES ('BSc_CS', 'Computer Science', 'CS');

INSERT INTO DEGREE_PROGRAM (DEGREE_ID, DEGREE_NAME, DEPARTMENT_ID)
VALUES ('BSc_Physics', 'Physics', 'PH');

INSERT INTO DEGREE_PROGRAM (DEGREE_ID, DEGREE_NAME, DEPARTMENT_ID)
VALUES ('BSc_Chemistry', 'Chemistry', 'CH');

INSERT INTO DEGREE_PROGRAM (DEGREE_ID, DEGREE_NAME, DEPARTMENT_ID)
VALUES ('BSc_Biology', 'Biology', 'BI');

INSERT INTO DEGREE_PROGRAM (DEGREE_ID, DEGREE_NAME, DEPARTMENT_ID)
VALUES ('BSc_Math', 'Mathematics', 'MA');

-- ----------------------------------------------------------------------------
-- 4. STUDENT_DETAILS (Page 11)
-- ----------------------------------------------------------------------------
INSERT INTO STUDENT_DETAILS (STUDENT_ID, STUDENT_NAME, FATHER_NAME, GENDER, BATCH, EMAIL, DEGREE)
VALUES ('S001', 'John Doe', 'Michael Doe', 'Male', 2023, 'john.doe@email.com', 'BSc_CS');

INSERT INTO STUDENT_DETAILS (STUDENT_ID, STUDENT_NAME, FATHER_NAME, GENDER, BATCH, EMAIL, DEGREE)
VALUES ('S002', 'Jane Smith', 'James Smith', 'Female', 2023, 'jane.smith@email.com', 'BSc_CS');

INSERT INTO STUDENT_DETAILS (STUDENT_ID, STUDENT_NAME, FATHER_NAME, GENDER, BATCH, EMAIL, DEGREE)
VALUES ('S003', 'Sam Brown', 'William Brown', 'Male', 2023, 'sam.brown@email.com', 'BSc_Physics');

INSERT INTO STUDENT_DETAILS (STUDENT_ID, STUDENT_NAME, FATHER_NAME, GENDER, BATCH, EMAIL, DEGREE)
VALUES ('S004', 'Emily White', 'Robert White', 'Female', 2023, 'emily.white@email.com', 'BSc_Chemistry');

INSERT INTO STUDENT_DETAILS (STUDENT_ID, STUDENT_NAME, FATHER_NAME, GENDER, BATCH, EMAIL, DEGREE)
VALUES ('S005', 'Michael Green', 'Joseph Green', 'Male', 2023, 'michael.green@email.com', 'BSc_Biology');

INSERT INTO STUDENT_DETAILS (STUDENT_ID, STUDENT_NAME, FATHER_NAME, GENDER, BATCH, EMAIL, DEGREE)
VALUES ('S006', 'Olivia Black', 'Thomas Black', 'Female', 2023, 'olivia.black@email.com', 'BSc_Math');

INSERT INTO STUDENT_DETAILS (STUDENT_ID, STUDENT_NAME, FATHER_NAME, GENDER, BATCH, EMAIL, DEGREE)
VALUES ('S007', 'Daniel Harris', 'Edward Harris', 'Male', 2023, 'daniel.harris@email.com', 'BSc_CS');

INSERT INTO STUDENT_DETAILS (STUDENT_ID, STUDENT_NAME, FATHER_NAME, GENDER, BATCH, EMAIL, DEGREE)
VALUES ('S008', 'Sophia Clark', 'David Clark', 'Female', 2023, 'sophia.clark@email.com', 'BSc_CS');

INSERT INTO STUDENT_DETAILS (STUDENT_ID, STUDENT_NAME, FATHER_NAME, GENDER, BATCH, EMAIL, DEGREE)
VALUES ('S009', 'David Lewis', 'Paul Lewis', 'Male', 2023, 'david.lewis@email.com', 'BSc_Physics');

INSERT INTO STUDENT_DETAILS (STUDENT_ID, STUDENT_NAME, FATHER_NAME, GENDER, BATCH, EMAIL, DEGREE)
VALUES ('S010', 'Emma Turner', 'Brian Turner', 'Female', 2023, 'emma.turner@email.com', 'BSc_Chemistry');

-- ----------------------------------------------------------------------------
-- 5. COURSES (Page 12)
-- ----------------------------------------------------------------------------
INSERT INTO COURSES (COURSE_CODE, COURSE_NAME, CREDIT_HOURS, DEPARTMENT_ID)
VALUES ('CS101', 'Introduction to Computer Science', 3, 'CS');

INSERT INTO COURSES (COURSE_CODE, COURSE_NAME, CREDIT_HOURS, DEPARTMENT_ID)
VALUES ('CS102', 'Data Structures', 4, 'CS');

INSERT INTO COURSES (COURSE_CODE, COURSE_NAME, CREDIT_HOURS, DEPARTMENT_ID)
VALUES ('PH101', 'Introduction to Physics', 3, 'PH');

INSERT INTO COURSES (COURSE_CODE, COURSE_NAME, CREDIT_HOURS, DEPARTMENT_ID)
VALUES ('CH101', 'Chemistry 101', 3, 'CH');

INSERT INTO COURSES (COURSE_CODE, COURSE_NAME, CREDIT_HOURS, DEPARTMENT_ID)
VALUES ('BIO101', 'Biology 101', 3, 'BI');

INSERT INTO COURSES (COURSE_CODE, COURSE_NAME, CREDIT_HOURS, DEPARTMENT_ID)
VALUES ('MA101', 'Mathematics I', 4, 'MA');

INSERT INTO COURSES (COURSE_CODE, COURSE_NAME, CREDIT_HOURS, DEPARTMENT_ID)
VALUES ('CS201', 'Algorithms', 4, 'CS');

INSERT INTO COURSES (COURSE_CODE, COURSE_NAME, CREDIT_HOURS, DEPARTMENT_ID)
VALUES ('PH102', 'Advanced Physics', 4, 'PH');

INSERT INTO COURSES (COURSE_CODE, COURSE_NAME, CREDIT_HOURS, DEPARTMENT_ID)
VALUES ('CH102', 'Organic Chemistry', 4, 'CH');

INSERT INTO COURSES (COURSE_CODE, COURSE_NAME, CREDIT_HOURS, DEPARTMENT_ID)
VALUES ('BIO102', 'Ecology', 3, 'BI');

-- ----------------------------------------------------------------------------
-- 6. ENROLLMENT (Pages 13-14)
-- ----------------------------------------------------------------------------
INSERT INTO ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER, FACULTY_ID, STATUS)
VALUES ('S001', 'CS101', 'Fall 2023', 'F001', 'Enrolled');

INSERT INTO ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER, FACULTY_ID, STATUS)
VALUES ('S002', 'CS102', 'Fall 2023', 'F002', 'Enrolled');

INSERT INTO ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER, FACULTY_ID, STATUS)
VALUES ('S003', 'PH101', 'Fall 2023', 'F003', 'Enrolled');

INSERT INTO ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER, FACULTY_ID, STATUS)
VALUES ('S004', 'CH101', 'Fall 2023', 'F004', 'Enrolled');

INSERT INTO ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER, FACULTY_ID, STATUS)
VALUES ('S005', 'BIO101', 'Fall 2023', 'F005', 'Enrolled');

INSERT INTO ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER, FACULTY_ID, STATUS)
VALUES ('S006', 'MA101', 'Fall 2023', 'F006', 'Enrolled');

INSERT INTO ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER, FACULTY_ID, STATUS)
VALUES ('S007', 'CS101', 'Fall 2023', 'F001', 'Enrolled');

INSERT INTO ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER, FACULTY_ID, STATUS)
VALUES ('S008', 'CS102', 'Fall 2023', 'F002', 'Enrolled');

INSERT INTO ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER, FACULTY_ID, STATUS)
VALUES ('S009', 'PH102', 'Fall 2023', 'F003', 'Enrolled');

INSERT INTO ENROLLMENT (STUDENT_ID, COURSE_CODE, SEMESTER, FACULTY_ID, STATUS)
VALUES ('S010', 'CH102', 'Fall 2023', 'F004', 'Enrolled');

-- ----------------------------------------------------------------------------
-- 7. ATTENDANCE (Page 13)
-- ----------------------------------------------------------------------------
INSERT INTO ATTENDANCE (STUDENT_ID, COURSE_CODE, SEMESTER, TOTAL_HOURS, HOURS_ATTENDED, EXAM_STATUS)
VALUES ('S001', 'CS101', 'Fall 2023', 40, 35, 'ELIGIBLE');

INSERT INTO ATTENDANCE (STUDENT_ID, COURSE_CODE, SEMESTER, TOTAL_HOURS, HOURS_ATTENDED, EXAM_STATUS)
VALUES ('S002', 'CS102', 'Fall 2023', 40, 38, 'ELIGIBLE');

INSERT INTO ATTENDANCE (STUDENT_ID, COURSE_CODE, SEMESTER, TOTAL_HOURS, HOURS_ATTENDED, EXAM_STATUS)
VALUES ('S003', 'PH101', 'Fall 2023', 40, 30, 'INELIGIBLE');

INSERT INTO ATTENDANCE (STUDENT_ID, COURSE_CODE, SEMESTER, TOTAL_HOURS, HOURS_ATTENDED, EXAM_STATUS)
VALUES ('S004', 'CH101', 'Fall 2023', 40, 40, 'ELIGIBLE');

INSERT INTO ATTENDANCE (STUDENT_ID, COURSE_CODE, SEMESTER, TOTAL_HOURS, HOURS_ATTENDED, EXAM_STATUS)
VALUES ('S005', 'BIO101', 'Fall 2023', 40, 37, 'ELIGIBLE');

INSERT INTO ATTENDANCE (STUDENT_ID, COURSE_CODE, SEMESTER, TOTAL_HOURS, HOURS_ATTENDED, EXAM_STATUS)
VALUES ('S006', 'MA101', 'Fall 2023', 40, 32, 'ELIGIBLE');

INSERT INTO ATTENDANCE (STUDENT_ID, COURSE_CODE, SEMESTER, TOTAL_HOURS, HOURS_ATTENDED, EXAM_STATUS)
VALUES ('S007', 'CS101', 'Fall 2023', 40, 40, 'ELIGIBLE');

INSERT INTO ATTENDANCE (STUDENT_ID, COURSE_CODE, SEMESTER, TOTAL_HOURS, HOURS_ATTENDED, EXAM_STATUS)
VALUES ('S008', 'CS102', 'Fall 2023', 40, 35, 'ELIGIBLE');

INSERT INTO ATTENDANCE (STUDENT_ID, COURSE_CODE, SEMESTER, TOTAL_HOURS, HOURS_ATTENDED, EXAM_STATUS)
VALUES ('S009', 'PH102', 'Fall 2023', 40, 38, 'ELIGIBLE');

INSERT INTO ATTENDANCE (STUDENT_ID, COURSE_CODE, SEMESTER, TOTAL_HOURS, HOURS_ATTENDED, EXAM_STATUS)
VALUES ('S010', 'CH102', 'Fall 2023', 40, 40, 'ELIGIBLE');

-- ----------------------------------------------------------------------------
-- 8. GRADES (Pages 13 & 18 Screenshots)
-- Note: Sessionals and final exam marks are on a 50-point scale each (100 total),
-- matching the Oracle SQL Developer query result screenshot on Page 18.
-- Any student with < 80% attendance (such as S003) is ineligible and receives 0 on final exam.
-- ----------------------------------------------------------------------------
INSERT INTO GRADES (STUDENT_ID, COURSE_CODE, SEMESTER, SESSIONALS, FINAL_EXAM, GRADE)
VALUES ('S001', 'CS101', 'Fall 2023', 40, 45, 'B');

INSERT INTO GRADES (STUDENT_ID, COURSE_CODE, SEMESTER, SESSIONALS, FINAL_EXAM, GRADE)
VALUES ('S002', 'CS102', 'Fall 2023', 38, 43, 'B');

INSERT INTO GRADES (STUDENT_ID, COURSE_CODE, SEMESTER, SESSIONALS, FINAL_EXAM, GRADE)
VALUES ('S003', 'PH101', 'Fall 2023', 30, 0, 'F'); -- Ineligible (<80% attendance): Final exam = 0

INSERT INTO GRADES (STUDENT_ID, COURSE_CODE, SEMESTER, SESSIONALS, FINAL_EXAM, GRADE)
VALUES ('S004', 'CH101', 'Fall 2023', 48, 45, 'A');

INSERT INTO GRADES (STUDENT_ID, COURSE_CODE, SEMESTER, SESSIONALS, FINAL_EXAM, GRADE)
VALUES ('S005', 'BIO101', 'Fall 2023', 35, 40, 'B');

INSERT INTO GRADES (STUDENT_ID, COURSE_CODE, SEMESTER, SESSIONALS, FINAL_EXAM, GRADE)
VALUES ('S006', 'MA101', 'Fall 2023', 33, 28, 'D'); -- Eligible (32/40 = 80% attendance)

INSERT INTO GRADES (STUDENT_ID, COURSE_CODE, SEMESTER, SESSIONALS, FINAL_EXAM, GRADE)
VALUES ('S007', 'CS101', 'Fall 2023', 43, 45, 'A');

INSERT INTO GRADES (STUDENT_ID, COURSE_CODE, SEMESTER, SESSIONALS, FINAL_EXAM, GRADE)
VALUES ('S008', 'CS102', 'Fall 2023', 44, 43, 'A');

INSERT INTO GRADES (STUDENT_ID, COURSE_CODE, SEMESTER, SESSIONALS, FINAL_EXAM, GRADE)
VALUES ('S009', 'PH102', 'Fall 2023', 38, 43, 'B');

INSERT INTO GRADES (STUDENT_ID, COURSE_CODE, SEMESTER, SESSIONALS, FINAL_EXAM, GRADE)
VALUES ('S010', 'CH102', 'Fall 2023', 40, 44, 'B');

COMMIT;
