package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// TerminalSession represents a terminal session
type TerminalSession struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	CreatedAt   time.Time `json:"createdAt"`
	LastActive  time.Time `json:"lastActive"`
	WorkingDir  string    `json:"workingDir"`
	Command     string    `json:"command"`
	History     []string  `json:"history"`
	IsActive    bool      `json:"isActive"`
}

// TerminalMessage represents a WebSocket message for terminal
type TerminalMessage struct {
	Type      string      `json:"type"`      // input, output, resize, close, status
	SessionID string      `json:"sessionId"`
	Data      interface{} `json:"data"`
}

// TerminalInputData represents input data for terminal
type TerminalInputData struct {
	Input   string `json:"input"`
	Columns int    `json:"columns"`
	Rows    int    `json:"rows"`
}

// TerminalOutputData represents output data from terminal
type TerminalOutputData struct {
	Output   string `json:"output"`
	ExitCode int    `json:"exitCode"`
	IsError  bool   `json:"isError"`
}

// Terminal sessions storage
var terminalSessions = make(map[string]*TerminalSession)
var terminalSessionsMutex sync.RWMutex

// Terminal process storage
var terminalProcesses = make(map[string]*exec.Cmd)
var terminalProcessesMutex sync.RWMutex

func handleTerminalSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		terminalSessionsMutex.RLock()
		sessions := make([]*TerminalSession, 0, len(terminalSessions))
		for _, session := range terminalSessions {
			sessions = append(sessions, session)
		}
		terminalSessionsMutex.RUnlock()

		json.NewEncoder(w).Encode(map[string]interface{}{
			"sessions": sessions,
			"total":    len(sessions),
		})
		return
	}

	if r.Method == "POST" {
		// Create new terminal session
		var req struct {
			Title string `json:"title"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		session := &TerminalSession{
			ID:         generateID(),
			Title:      req.Title,
			CreatedAt:  time.Now(),
			LastActive: time.Now(),
			WorkingDir: getBaseDir(),
			History:    []string{},
			IsActive:   true,
		}

		terminalSessionsMutex.Lock()
		terminalSessions[session.ID] = session
		terminalSessionsMutex.Unlock()

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(session)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func handleTerminalSession(w http.ResponseWriter, r *http.Request) {
	// Extract session ID from URL path
	path := strings.TrimPrefix(r.URL.Path, "/api/terminal/sessions/")
	sessionID := strings.TrimSuffix(path, "/")

	if sessionID == "" {
		http.Error(w, "Session ID required", http.StatusBadRequest)
		return
	}

	if r.Method == "GET" {
		terminalSessionsMutex.RLock()
		session, exists := terminalSessions[sessionID]
		terminalSessionsMutex.RUnlock()

		if !exists {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(session)
		return
	}

	if r.Method == "DELETE" {
		terminalSessionsMutex.Lock()
		defer terminalSessionsMutex.Unlock()

		_, exists := terminalSessions[sessionID]
		if !exists {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}

		// Kill associated process if running
		terminalProcessesMutex.Lock()
		if process, exists := terminalProcesses[sessionID]; exists {
			if process.Process != nil {
				process.Process.Kill()
			}
			delete(terminalProcesses, sessionID)
		}
		terminalProcessesMutex.Unlock()

		// Remove session
		delete(terminalSessions, sessionID)

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
		return
	}

	if r.Method == "POST" {
		// Execute command in terminal session
		var req struct {
			Command string `json:"command"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		terminalSessionsMutex.Lock()
		session, exists := terminalSessions[sessionID]
		if !exists {
			terminalSessionsMutex.Unlock()
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}
		session.LastActive = time.Now()
		terminalSessionsMutex.Unlock()

		// Execute command
		output, exitCode, err := executeTerminalCommand(session.WorkingDir, req.Command)

		// Update session history
		terminalSessionsMutex.Lock()
		session.History = append(session.History, req.Command)
		// Keep only last 100 commands
		if len(session.History) > 100 {
			session.History = session.History[len(session.History)-100:]
		}
		terminalSessionsMutex.Unlock()

		response := map[string]interface{}{
			"output":    output,
			"exitCode":  exitCode,
			"isError":   err != nil,
			"timestamp": time.Now(),
		}

		json.NewEncoder(w).Encode(response)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func handleTerminalWS(w http.ResponseWriter, r *http.Request) {
	// This would be implemented with a proper WebSocket library
	// For now, we'll just return a placeholder response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "WebSocket endpoint not yet implemented",
		"status":  "placeholder",
		"sessions": []string{
			"Use session management endpoints for now",
		},
	})
}

func executeTerminalCommand(workingDir, command string) (string, int, error) {
	// For security, we'll use PowerShell for Windows systems
	// In a real implementation, you'd want to handle this more carefully
	
	// Parse command and arguments
	parts := strings.Fields(command)
	if len(parts) == 0 {
		return "", 0, fmt.Errorf("empty command")
	}

	var cmd *exec.Cmd
	
	// Handle common commands
	switch strings.ToLower(parts[0]) {
	case "cd":
		if len(parts) < 2 {
			return workingDir, 0, nil
		}
		newDir := parts[1]
		if !filepath.IsAbs(newDir) {
			newDir = filepath.Join(workingDir, newDir)
		}
		if info, err := os.Stat(newDir); err == nil && info.IsDir() {
			return newDir, 0, nil
		}
		return workingDir, 1, fmt.Errorf("directory not found: %s", newDir)
		
	case "ls", "dir":
		cmd = exec.Command("powershell", "-Command", "Get-ChildItem -Path . -Force")
		
	case "pwd":
		return workingDir, 0, nil
		
	case "clear", "cls":
		return "Screen cleared", 0, nil
		
	case "echo":
		output := strings.Join(parts[1:], " ")
		return output, 0, nil
		
	default:
		// Execute as PowerShell command
		cmd = exec.Command("powershell", "-Command", command)
	}

	if cmd != nil {
		cmd.Dir = workingDir
		
		// Set up environment variables
		cmd.Env = os.Environ()
		
		// Capture output
		output, err := cmd.CombinedOutput()
		
		exitCode := 0
		if err != nil {
			if exitError, ok := err.(*exec.ExitError); ok {
				exitCode = exitError.ExitCode()
			} else {
				exitCode = 1
			}
		}
		
		return string(output), exitCode, err
	}

	return "", 0, fmt.Errorf("unsupported command")
}

// Terminal session management functions
func getTerminalSession(sessionID string) (*TerminalSession, bool) {
	terminalSessionsMutex.RLock()
	defer terminalSessionsMutex.RUnlock()
	
	session, exists := terminalSessions[sessionID]
	return session, exists
}

func updateTerminalSession(sessionID string, updates func(*TerminalSession)) error {
	terminalSessionsMutex.Lock()
	defer terminalSessionsMutex.Unlock()
	
	session, exists := terminalSessions[sessionID]
	if !exists {
		return fmt.Errorf("session not found")
	}
	
	updates(session)
	session.LastActive = time.Now()
	
	return nil
}

func deleteTerminalSession(sessionID string) error {
	terminalSessionsMutex.Lock()
	defer terminalSessionsMutex.Unlock()
	
	_, exists := terminalSessions[sessionID]
	if !exists {
		return fmt.Errorf("session not found")
	}
	
	// Kill associated process
	terminalProcessesMutex.Lock()
	if process, exists := terminalProcesses[sessionID]; exists {
		if process.Process != nil {
			process.Process.Kill()
		}
		delete(terminalProcesses, sessionID)
	}
	terminalProcessesMutex.Unlock()
	
	// Remove session
	delete(terminalSessions, sessionID)
	
	return nil
}

// Cleanup inactive sessions
func cleanupInactiveSessions() {
	terminalSessionsMutex.Lock()
	defer terminalSessionsMutex.Unlock()
	
	cutoff := time.Now().Add(-24 * time.Hour) // Remove sessions inactive for 24 hours
	
	for sessionID, session := range terminalSessions {
		if session.LastActive.Before(cutoff) {
			// Kill associated process
			terminalProcessesMutex.Lock()
			if process, exists := terminalProcesses[sessionID]; exists {
				if process.Process != nil {
					process.Process.Kill()
				}
				delete(terminalProcesses, sessionID)
			}
			terminalProcessesMutex.Unlock()
			
			// Remove session
			delete(terminalSessions, sessionID)
		}
	}
}

// Initialize terminal cleanup routine
func initTerminalCleanup() {
	// Run cleanup every hour
	go func() {
		for {
			time.Sleep(1 * time.Hour)
			cleanupInactiveSessions()
		}
	}()
}
