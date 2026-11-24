-- ============================================================================
-- Student Academic Record Database - Oracle SQL
-- File: 05_analytical_queries.sql
-- Description: Analytical queries covering SELECT, JOINs, Aggregations, 
--              Subqueries, and At-Risk Student Analytics.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BASIC SELECT & FILTERING: Active Computer Science Students
-- ----------------------------------------------------------------------------
SELECT 
    STUDENT_ID,
    STUDENT_NAME,
    GENDER,
    BATCH,
    EMAIL,
    DEGREE
FROM STUDENT_DETAILS
WHERE DEGREE = 'BSc_CS'
ORDER BY STUDENT_NAME ASC;

-- ----------------------------------------------------------------------------
-- 2. MULTI-TABLE JOIN: Comprehensive Student Academic Overview
-- Combines Student, Degree, Course, Instructor, and Final Grade.
-- ----------------------------------------------------------------------------
SELECT 
    s.STUDENT_ID,
    s.STUDENT_NAME,
    dp.DEGREE_NAME,
    c.COURSE_NAME,
    f.FACULTY_NAME AS INSTRUCTOR,
    g.SESSIONALS,
    CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
         THEN g.FINAL_EXAM ELSE 0 END AS FINAL_EXAM,
    g.SESSIONALS +
        CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
             THEN g.FINAL_EXAM ELSE 0 END AS TOTAL_SCORE,
    g.GRADE,
    e.SEMESTER
FROM STUDENT_DETAILS s
JOIN DEGREE_PROGRAM dp ON s.DEGREE = dp.DEGREE_ID
JOIN ENROLLMENT e ON s.STUDENT_ID = e.STUDENT_ID
JOIN COURSES c ON e.COURSE_CODE = c.COURSE_CODE
JOIN FACULTY f ON e.FACULTY_ID = f.FACULTY_ID
JOIN GRADES g
  ON g.STUDENT_ID = e.STUDENT_ID
 AND g.COURSE_CODE = e.COURSE_CODE
 AND g.SEMESTER = e.SEMESTER
LEFT JOIN ATTENDANCE a
  ON a.STUDENT_ID = e.STUDENT_ID
 AND a.COURSE_CODE = e.COURSE_CODE
 AND a.SEMESTER = e.SEMESTER
ORDER BY s.STUDENT_ID, c.COURSE_CODE, e.SEMESTER;

-- ----------------------------------------------------------------------------
-- 3. GROUP BY & AGGREGATIONS: Course Performance Metrics
-- Calculates enrollment count, average score, max score, and min score per course.
-- ----------------------------------------------------------------------------
SELECT 
    c.COURSE_CODE,
    c.COURSE_NAME,
    COUNT(g.STUDENT_ID) AS TOTAL_STUDENTS,
    ROUND(AVG(g.SESSIONALS +
        CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
             THEN g.FINAL_EXAM ELSE 0 END), 2) AS AVG_TOTAL_SCORE,
    MAX(g.SESSIONALS +
        CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
             THEN g.FINAL_EXAM ELSE 0 END) AS HIGHEST_SCORE,
    MIN(g.SESSIONALS +
        CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
             THEN g.FINAL_EXAM ELSE 0 END) AS LOWEST_SCORE
FROM COURSES c
JOIN GRADES g ON c.COURSE_CODE = g.COURSE_CODE
LEFT JOIN ATTENDANCE a
  ON a.STUDENT_ID = g.STUDENT_ID
 AND a.COURSE_CODE = g.COURSE_CODE
 AND a.SEMESTER = g.SEMESTER
GROUP BY c.COURSE_CODE, c.COURSE_NAME
ORDER BY AVG_TOTAL_SCORE DESC;

-- ----------------------------------------------------------------------------
-- 4. AGGREGATIONS: Department Faculty & Program Distribution
-- ----------------------------------------------------------------------------
SELECT 
    d.DEPARTMENT_ID,
    d.DEPARTMENT_NAME,
    COUNT(DISTINCT f.FACULTY_ID) AS FACULTY_COUNT,
    COUNT(DISTINCT c.COURSE_CODE) AS OFFERED_COURSES
FROM DEPARTMENTS d
LEFT JOIN FACULTY f ON d.DEPARTMENT_ID = f.DEPARTMENT_ID
LEFT JOIN COURSES c ON d.DEPARTMENT_ID = c.DEPARTMENT_ID
GROUP BY d.DEPARTMENT_ID, d.DEPARTMENT_NAME;

-- ----------------------------------------------------------------------------
-- 5. SUBQUERY: Students Scoring Above Course Average
-- ----------------------------------------------------------------------------
SELECT 
    s.STUDENT_ID,
    s.STUDENT_NAME,
    g.COURSE_CODE,
    g.SESSIONALS +
        CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
             THEN g.FINAL_EXAM ELSE 0 END AS STUDENT_TOTAL
FROM STUDENT_DETAILS s
JOIN GRADES g ON s.STUDENT_ID = g.STUDENT_ID
LEFT JOIN ATTENDANCE a
  ON a.STUDENT_ID = g.STUDENT_ID
 AND a.COURSE_CODE = g.COURSE_CODE
 AND a.SEMESTER = g.SEMESTER
WHERE g.SESSIONALS +
    CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
         THEN g.FINAL_EXAM ELSE 0 END > (
    SELECT AVG(g2.SESSIONALS +
        CASE WHEN a2.HOURS_ATTENDED * 100 / NULLIF(a2.TOTAL_HOURS, 0) >= 80
             THEN g2.FINAL_EXAM ELSE 0 END)
    FROM GRADES g2
    LEFT JOIN ATTENDANCE a2
      ON a2.STUDENT_ID = g2.STUDENT_ID
     AND a2.COURSE_CODE = g2.COURSE_CODE
     AND a2.SEMESTER = g2.SEMESTER
    WHERE g2.COURSE_CODE = g.COURSE_CODE
);

-- ----------------------------------------------------------------------------
-- 6. PERFORMANCE ANALYTICS: Identify "At-Risk" Students
-- Criteria: Attendance < 80% (INELIGIBLE) OR Total Score < 60
-- ----------------------------------------------------------------------------
SELECT 
    s.STUDENT_ID,
    s.STUDENT_NAME,
    s.EMAIL,
    a.COURSE_CODE,
    a.SEMESTER,
    ROUND((a.HOURS_ATTENDED / a.TOTAL_HOURS) * 100, 2) AS ATTENDANCE_PERCENT,
    CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
         THEN 'ELIGIBLE' ELSE 'INELIGIBLE' END AS EXAM_STATUS,
    NVL(g.SESSIONALS, 0) +
        CASE WHEN a.HOURS_ATTENDED * 100 / NULLIF(a.TOTAL_HOURS, 0) >= 80
             THEN NVL(g.FINAL_EXAM, 0) ELSE 0 END AS TOTAL_SCORE,
    CASE 
        WHEN a.HOURS_ATTENDED / a.TOTAL_HOURS < 0.80
             AND NVL(g.SESSIONALS, 0) +
                 CASE WHEN a.HOURS_ATTENDED / a.TOTAL_HOURS >= 0.80
                      THEN NVL(g.FINAL_EXAM, 0) ELSE 0 END < 60
            THEN 'Critical (Attendance & Academics)'
        WHEN a.HOURS_ATTENDED / a.TOTAL_HOURS < 0.80 
            THEN 'Attendance Warning'
        ELSE 'Academic Warning'
    END AS RISK_LEVEL
FROM STUDENT_DETAILS s
JOIN ATTENDANCE a ON s.STUDENT_ID = a.STUDENT_ID
LEFT JOIN GRADES g
  ON g.STUDENT_ID = a.STUDENT_ID
 AND g.COURSE_CODE = a.COURSE_CODE
 AND g.SEMESTER = a.SEMESTER
WHERE (a.HOURS_ATTENDED / a.TOTAL_HOURS) < 0.80
   OR (NVL(g.SESSIONALS, 0) +
       CASE WHEN a.HOURS_ATTENDED / a.TOTAL_HOURS >= 0.80
            THEN NVL(g.FINAL_EXAM, 0) ELSE 0 END) < 60
ORDER BY ATTENDANCE_PERCENT ASC;
