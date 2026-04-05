# Adaptive Cyber Defense & Intelligent Threat Detection System

This is a full-stack AI-powered Adaptive Cyber Defense system designed to monitor system activity, user behavior, and network traffic to detect anomalies and potential security breaches in real-time.

## Features

- **Real-Time Threat Detection**: Continuously monitors CPU, memory, and network traffic to detect anomalies.
- **Risk Scoring**: Calculates an anomaly score and risk score for each event.
- **Simulated Reinforcement Learning (RL) Engine**: Automatically decides on mitigation actions (e.g., "Block IP", "Quarantine Session") based on the risk score.
- **Automated Defense System**: Executes actions automatically for high-risk threats, while allowing admin approval for lower-risk ones.
- **Dashboard**: A React-based dashboard displaying live alerts, risk scores, and system resource utilization using Recharts.
- **Authentication**: JWT-based authentication for secure access.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Recharts, Lucide React
- **Backend**: Node.js, Express, Socket.IO (for real-time WebSockets)
- **Database**: SQLite (using \`better-sqlite3\`)

## Setup Instructions

1. **Install Dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

2. **Run the Development Server**:
   \`\`\`bash
   npm run dev
   \`\`\`
   This will start both the Express backend and the Vite frontend server.

3. **Access the Dashboard**:
   Open your browser and navigate to the provided URL.
   - **Username**: \`admin\`
   - **Password**: \`admin123\`

## Module Explanation

### 1. Backend (\`server.ts\`)
The backend is built with Express and uses SQLite for data storage. It exposes REST APIs for authentication (\`/api/login\`), fetching alerts (\`/api/alerts\`), and fetching system stats (\`/api/stats\`). It also uses Socket.IO to push real-time updates to the connected clients.

A simulation loop runs every 5 seconds to generate synthetic system metrics (CPU, memory, network) and calculate an \`anomalyScore\`. If the score exceeds a threshold, an alert is generated and the simulated RL engine decides on an automated mitigation action.

### 2. Frontend Dashboard (\`src/components/Dashboard.tsx\`)
The dashboard connects to the backend via REST APIs (for initial data load) and WebSockets (for real-time updates). It uses \`Recharts\` to visualize the anomaly score trend and resource utilization. The Threat Intelligence Log displays a table of recent alerts, allowing admins to take manual actions on pending threats.

### 3. Authentication (\`src/components/Login.tsx\`)
A simple login form that authenticates the user against the SQLite database and stores the resulting JWT in \`localStorage\`.

## Future Enhancements
- Integrate actual Python-based Deep Learning models (LSTM, Autoencoders) via a microservice architecture.
- Implement a true RL algorithm (DQN/PPO) for the defense engine.
- Add a mobile companion app using React Native or Flutter.
