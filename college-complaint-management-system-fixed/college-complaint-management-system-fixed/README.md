# CampusCare — College Complaint Management System

A full-stack Node.js + Express project. Students can create accounts, submit complaints and track updates. Administrators can view all complaints, change status and respond.

## Features
- Student registration and login; passwords are hashed with bcryptjs.
- Each student sees only their own complaints.
- Admin dashboard to view all submissions and student contact details.
- Complaint categories, priority, location, description and unique reference ID.
- Admin status updates and responses.
- Search and filters.
- JSON-file storage; no database setup required.

## Run on Windows
1. Extract this ZIP file.
2. Open Command Prompt and enter the extracted project folder, for example:
   `cd /d "C:\\Users\\USER\\Desktop\\college-complaint-management-system"`
3. Install packages: `npm install`
4. Start the project: `npm start`
5. Open `http://localhost:3000` in your browser.

Use Node.js 22 LTS (the project includes a `.node-version` hint).

## Administrator login
- Email: `admin@college.edu`
- Password: `Admin@123`

The administrator account is created automatically on the first run. To use a different password, set `ADMIN_PASSWORD` before starting the server. For a public deployment, also set a strong `SESSION_SECRET` and `ADMIN_PASSWORD`.

## Student login
Select **Create account**, register with your name, email, department and a password of at least 8 characters. Then sign in normally.

## Data
New accounts and complaints are stored in `data/users.json` and `data/complaints.json`. The supplied data files are reset to empty so the project starts clean; the default administrator is created automatically.

## Note
This is an academic/demo project. For production use, move from JSON files to a database and configure persistent sessions, HTTPS, rate limiting and CSRF protection.
