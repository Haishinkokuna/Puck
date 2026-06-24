# Puck - The RPG Kanban Board

Puck is a uniquely gamified, full-stack Kanban board that turns your productivity and project management into an RPG adventure. Designed for developers and teams who want to level up their workflow, Puck rewards you with XP for completing tasks, allowing you to unlock nodes in visually stunning "Constellation" Skill Trees and equip powerful titles.

---

## Key Features

### Advanced Project Management
* **Kanban Boards**: Create and manage multiple workspaces.
* **Custom Columns**: Fully customizable columns to match your workflow.
* **Global Categories**: Categorize your tasks (e.g., Frontend, Backend, UI/UX) globally across all your boards with custom icons and colors.
* **Smooth Drag & Drop**: Seamlessly move tasks between columns.

### RPG Gamification
* **XP Engine**: Completing tasks awards Experience Points (XP) based on the task category.
* **Leveling System**: Gain levels as you accumulate XP.
* **Constellation Skill Trees**: Spend your hard-earned XP to unlock nodes in visually beautiful, interactive skill trees.
* **Equippable Titles**: Unlocking certain skill nodes grants you Titles (e.g., "React Sorcerer", "Query Slayer") that you can equip to your profile.

### Visual Tree Editor
* **Point-and-Click Builder**: Easily create new Constellations and Skill Trees.
* **Interactive Canvas**: Click to spawn new nodes, define their XP cost, and instantly connect them.
* **Smooth Dragging**: Arrange your skill trees exactly how you want them with a buttery smooth, 60fps drag-and-drop editor.

---

## Tech Stack

**Frontend:**
* **React** + **Vite**: Lightning-fast modern frontend.
* **Zustand**: Lightweight and powerful global state management.
* **React Router**: Client-side routing.
* **Vanilla CSS**: Custom glassmorphism design system, neon glows, and custom SVG animations. No bulky UI libraries.
* **Lucide Icons**: Clean, consistent SVG icon system.

**Backend:**
* **Node.js** + **Express**: Robust and lightweight API architecture.
* **PostgreSQL**: Relational database for complex RPG logic and user data.
* **node-postgres (pg)**: Raw SQL driver for maximum performance and precise database control.
* **JWT Authentication**: Secure, token-based user sessions.

---

## Getting Started

### Prerequisites
* **Node.js** (v18+)
* **PostgreSQL** (or Docker, a `docker-compose.yml` is provided)

### 1. Database Setup
If you are using Docker, you can spin up the PostgreSQL database easily:
```bash
docker-compose up -d
```

### 2. Environment Variables
Copy the `.env.example` file to `.env` in the root directory:
```bash
cp .env.example .env
```
Update the `.env` file with your database credentials and a strong `JWT_SECRET`.

### 3. Backend Setup
Navigate into the `server` directory, install dependencies, and run migrations:
```bash
cd server
npm install
node migrations/migrate_v4.js  # Runs the base schema and initial seeding
node migrations/migrate_v5.js  # Runs the global task types migration
```

Start the backend development server:
```bash
npm run dev
```
*(The server will run on `http://localhost:3001`)*

### 4. Frontend Setup
In a new terminal window, navigate into the `client` directory and install dependencies:
```bash
cd client
npm install
```

Start the Vite development server:
```bash
npm run dev
```
*(The frontend will run on `http://localhost:5173`)*

---

## Design Philosophy
Puck focuses on an incredibly premium, dark-mode aesthetic utilizing heavily customized **Glassmorphism**. Rather than relying on TailwindCSS or component libraries, all styles are hand-written Vanilla CSS to ensure every glowing effect, modal blur, and smooth transition feels uniquely tailored to the RPG theme.

## License
This project is licensed under the ISC License.
