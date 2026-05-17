<p align="center">
  <img src="assets/logo.png" alt="Neko-Claw Logo" width="200" height="200" style="border-radius: 24px;" />
</p>

<h1 align="center">🐱 Neko-Agent</h1>

<p align="center">
  <strong>A "pawsome" computer control superapp that allows you to interact with your Windows machine using AI.</strong>
</p>

<p align="center">
  Featuring a sleek cat-themed UI, Neko-Claw provides a safe yet efficient way to automate tasks through PowerShell commands.
</p>

## 🐾 Features

- **Cat-Themed Interface**: A warm, user-friendly UI designed with a premium "Neko" aesthetic.
- **Human-in-the-Loop Safety**: AI proposes PowerShell commands, but nothing runs without your explicit "Purr-fect" (Approve) or "Hiss" (Reject).
- **One-Command Start**: Intelligent backend that automatically builds the Next.js frontend if needed.
- **Smart Output Cleaning**: Automatically strips ANSI escape codes from terminal outputs for clean readability.
- **Flexible Configuration**: Easily change API Keys, Models, and URLs directly from the Settings menu.

## 🛠️ Tech Stack

- **Backend**: Go (Golang)
- **Frontend**: Next.js (TypeScript, Tailwind CSS)
- **AI Integration**: OpenAI-compatible API

## 🚀 Getting Started

### Prerequisites

- [Go](https://go.dev/dl/) 1.20+
- [Node.js & npm](https://nodejs.org/) (for building the UI)
- [PowerShell/pwsh](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell) (standard on Windows)

### Installation & Running

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/neko-claw.git
   cd neko-claw
   ```

2. **Run the application**:
   Navigate to the `agent` folder and run the Go server. It will automatically install UI dependencies and build the frontend on the first run.
   ```bash
   cd agent
   go run .
   ```

3. **Access the App**:
   Open your browser and go to `http://localhost:8080`.

## ⚙️ Configuration

Once the app is running:
1. Click on **⚙️ Settings** in the top navigation bar.
2. Enter your **API Key**.
3. Ensure the Endpoint is set.
4. Save the configuration and start chatting with Neko!

## ⚠️ Safety Warning

This application allows an AI to suggest commands that can modify your system. **Always review the commands in the approval box before clicking "Purr-fect"**.

---

*Made with 🐾 and AI.*
