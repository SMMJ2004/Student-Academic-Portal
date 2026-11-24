# Student Academic Record Database - Oracle SQL & Web App

## Project Overview

This project contains Oracle database scripts and a Node.js web application for managing student records, courses, enrollments, attendance, grades, faculty, departments, and degree programs.

The included seed records are fictional demo data. The web application reads and writes directly to the Oracle schema configured by the person running it.

## Run the Web Application Locally

### Quick start with Docker Compose

This is the recommended way to reproduce the demo. It starts an isolated Oracle Database Free container and the web app, creates the app schema, and loads the fictional seed records. It does not connect to your existing Oracle installation.

Requirements:

- Docker Desktop with Docker Compose v2
- At least 4 GB of memory available to Docker and enough disk space for the Oracle image and database

On Windows, start Docker Desktop, double-click [`scripts/run-app.bat`](scripts/run-app.bat), and press Enter to launch the Docker demo. The launcher builds and starts the services, waits for the app to become ready, then opens it in your browser. The first run downloads the Oracle image and may take several minutes. Choose option 2 only if you want to connect to an Oracle database you already have.

From the repository folder, run:

```bash
docker compose up --build
```

The first start downloads the images and initializes Oracle, so it can take several minutes. When the services are ready, open <http://127.0.0.1:3000>. Stop services started by the launcher with `docker compose down` from the repository folder, or stop foreground services with `Ctrl+C`. The database is kept in a Docker volume across restarts.

The demo credentials are intentionally fixed for this disposable local database only:

| Purpose | Value |
| --- | --- |
| Oracle app user | `STUDENT_APP` |
| Oracle app password | `StudentDemo2026` |
| Oracle service | `FREEPDB1` |
| DBeaver host and port | `localhost:1522` |

In DBeaver, connect using the app user, password, host/port, and service above to inspect the sample tables. The database and web app ports are bound to loopback (`127.0.0.1`), not exposed to other computers. Never reuse these demo credentials for another database.

To completely erase the demo database and restore the original seed records, run:

```bash
docker compose down --volumes
docker compose up --build
```

**Warning:** `docker compose down --volumes` permanently deletes the Compose database volume and all changes made to this demo database.

### Run with your own Oracle database

The alternative setup runs Node.js directly on your computer and connects to an Oracle instance you provide. It requires Node.js 22.5.0 or later, npm, an Oracle schema dedicated to this app, and DBeaver or another Oracle SQL client to initialize a new schema. Do not run the app as `SYSTEM`.

The app uses the `oracledb` driver in Thin mode. It does not create tables or seed data automatically. The legacy `academic_records.db` SQLite file is not used.

#### 1. Prepare the Oracle schema

Create or select a dedicated, empty app schema. Using DBeaver connected as that schema owner, run these scripts in order:

1. [`database/sql/01_ddl_schema.sql`](database/sql/01_ddl_schema.sql) creates the tables and constraints.
2. [`database/sql/02_dml_seed_data.sql`](database/sql/02_dml_seed_data.sql) inserts and commits the fictional sample records.

Run these scripts only once for a new, empty schema. Do not rerun them on a schema that already contains data. The database user used by the app should be the schema owner (or have the required table access).

#### Upgrade an existing schema without resetting its data

The web app identifies enrollment, attendance, and grade records by student, course, and semester. Before upgrading an existing schema, take a database backup, then run [`database/sql/06_migrate_semester_keys.sql`](database/sql/06_migrate_semester_keys.sql) once as the schema owner. Run the entire script in SQL*Plus/SQLcl, or use DBeaver's script execution with error handling configured to stop on the first error. The migration preserves existing rows, assigns each legacy attendance row the semester of its matching enrollment, and adds composite keys and foreign keys.

The migration also widens student and faculty names to 100 characters, emails to 254, course/department/degree names to 100, and faculty roles to 50. Its preflight stops the script before DDL if a legacy attendance row cannot be assigned to exactly one semester, if it finds orphan rows, or if duplicate grade records exist. Resolve the reported data issue, take a fresh backup, and rerun the migration. Do not rerun the fresh-schema DDL or seed scripts against an existing database, and do not drop or reset the schema.

If you already applied an earlier version of `database/sql/06_migrate_semester_keys.sql`, run [`database/sql/07_migrate_text_widths.sql`](database/sql/07_migrate_text_widths.sql) once to widen those columns without rerunning the semester migration. Run it with the same stop-on-error script settings.

For Oracle running in Docker with port `1521` published to the host, a typical connect string is `localhost:1521/FREEPDB1`. The service name and host-side port depend on your Oracle installation. When Node.js runs on your computer and Oracle runs in Docker, use the published host port and `localhost`; a Docker service name is only resolvable from containers on the same Docker network.

#### 2. Install dependencies

Run these commands from the repository root.

Windows PowerShell:

```powershell
npm.cmd ci
```

macOS or Linux:

```bash
npm ci
```

Run the unit tests after installing dependencies:

Windows PowerShell:

```powershell
npm.cmd test
```

macOS or Linux:

```bash
npm test
```

The tests use a mocked database connection and do not require a running Oracle service.

#### 3. Configure credentials and start the app

Set these variables in the same terminal that starts the app:

- `ORACLE_USER`: the dedicated app-schema username
- `ORACLE_PASSWORD`: that schema's password
- `ORACLE_CONNECT_STRING`: Oracle host, port, and service name

Do not commit real Oracle credentials, `.env` files, or Oracle wallet files to GitHub. The fixed Docker demo credentials above are intentionally disposable and must never be reused.

Windows: run `npm.cmd ci` once, then double-click [`scripts/run-app.bat`](scripts/run-app.bat) and choose option 2. It prompts for the app-schema username, connect string (press Enter to use `localhost:1521/FREEPDB1`), and password. The password prompt is hidden. Keep the server window open while using the app.

macOS or Linux:

```bash
export ORACLE_USER="your_app_schema_user"
export ORACLE_CONNECT_STRING="localhost:1521/FREEPDB1"
read -s -r -p "Oracle app-schema password: " ORACLE_PASSWORD
printf '\n'
export ORACLE_PASSWORD
npm start
unset ORACLE_PASSWORD
```

Keep the terminal open while using the app. The server checks its Oracle connection and required tables at startup; connection or schema errors are reported in that terminal. Then open <http://127.0.0.1:3000>.

The server binds to the local computer only by default. The API does not include user authentication, so do not expose it to the internet or other network devices. Docker Compose also binds both published ports to the local computer only.

---

## 🌟 Web Application Features

1. **📊 Executive Dashboard**:
   * Real-time metrics for total students, courses, faculty, and departments.
   * Visual attendance health meter and exam eligibility breakdown.
   * Interactive grade distribution bar graph (A through F).
   * Course performance summary table with average, highest, and lowest scores.

2. **👨‍🎓 Student Management (CRUD)**:
   * View full student roster with degree program mapping.
   * Live search by name, ID, or email, with degree program filtering.
   * Add, edit, and remove student profiles. Student deletion transactionally removes related grades, attendance, and enrollments; database constraints protect the remaining records.

3. **📚 Courses and Faculty**:
   * The Courses tab contains the course catalog and degree programs.
   * The Faculty tab contains the faculty directory and departments with Head of Department (HOD) allocations.
   * Add, edit, and remove courses, faculty, departments, and degree programs. Changes are committed to Oracle and visible in DBeaver after refreshing the table view.

4. **📝 Course Enrollments**:
   * Semester-by-semester course registration linking students, courses, and instructors.
   * Supports retaking a course in a different semester while keeping each term's attendance and grades separate.
   * Dynamic status switcher (`Enrolled`, `Completed`, `Dropped`).
   * Add new student enrollments; attendance and grade records are entered separately when the information is available.

5. **⏱ Attendance Tracking**:
   * Accurate tracking of attended hours vs. total course hours.
   * Automatic percentage calculation.
   * Exam eligibility enforcement: requires attendance of **at least 80%** (`ELIGIBLE` vs. `INELIGIBLE`).
   * Add attendance records for enrollments and edit recorded hours.

6. **🎯 Academic Grading**:
   * Sessional marks and final exam marks evaluation.
   * Automatic grade determination based on total scores:
     * **A**: > 86
     * **B**: > 74
     * **C**: > 62
     * **D**: > 50
     * **F**: ≤ 50
   * Add grades after attendance has been recorded, then edit marks as needed.

7. **📈 SQL Analytics**:
   * Example analytical queries are available in [`database/sql/05_analytical_queries.sql`](database/sql/05_analytical_queries.sql) and can be run in an Oracle SQL client.

8. **⚡ Oracle Business Operations**:
   * **Recalculate Grades**: Recalculates letter grades using current attendance eligibility; ineligible final exams count as zero.
   * **Recalculate Eligibility**: Applies the attendance threshold to all attendance records and recalculates grades. Stored final exam marks are preserved and count as zero while the student is ineligible.
   * These operations run against Oracle.

---

## 🗂 Project Structure
* **[`src/`](src/)**: Node.js application source:
  * [`src/server.js`](src/server.js) — REST API and static asset server.
  * [`src/database.js`](src/database.js) — Oracle connection pool, CRUD operations, transactions, and analytics.
  * **[`src/public/`](src/public/)** — Single-Page Application frontend (`index.html`, `styles.css`, and `app.js`).
* **[`test/`](test/)**: Focused database-operation tests runnable with `npm test`.
* **[`database/sql/standalone.sql`](database/sql/standalone.sql)**: Complete standalone Oracle SQL script.
* **[`docs/Student Academic Record Database Report.pdf`](docs/Student%20Academic%20Record%20Database%20Report.pdf)**: Complete 22-page design, ERD, and normalization documentation.
* **[`database/sql/`](database/sql/)**: Oracle schema, seed, CRUD, transaction, analytics, and migration scripts.
* **[`docker/`](docker/)**: App Dockerfile and Oracle initialization script.
* **[`scripts/`](scripts/)**: Windows launchers for Docker demo and existing Oracle modes.

---

## 🗄️ Database Tables
1. `STUDENT_DETAILS`: Personal student profiles and degree programs.
2. `COURSES`: Course catalog and credit hours.
3. `ENROLLMENT`: Student-course registrations mapped to semesters and faculty; keyed by student, course, and semester.
4. `ATTENDANCE`: Total vs. attended hours and exam eligibility status; keyed to the matching semester-specific enrollment.
5. `GRADES`: Sessional marks, final exam marks, and final letter grades; keyed to the matching semester-specific enrollment.
6. `DEPARTMENTS`: Department details and Head of Department (`HOD_ID`).
7. `FACULTY`: Faculty profiles, designations, and departmental roles.
8. `DEGREE_PROGRAM`: Degree programs offered per department.
