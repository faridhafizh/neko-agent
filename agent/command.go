package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// CommandTemplate represents a reusable command template
type CommandTemplate struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Category    string            `json:"category"`
	Command     string            `json:"command"`
	Parameters  []CommandParameter `json:"parameters"`
	Icon        string            `json:"icon"`
	Tags        []string          `json:"tags"`
}

// CommandParameter represents a parameter in a command template
type CommandParameter struct {
	Name         string `json:"name"`
	Type         string `json:"type"` // text, number, boolean, select, file, directory
	Description  string `json:"description"`
	Required     bool   `json:"required"`
	DefaultValue string `json:"defaultValue"`
	Options      []string `json:"options"` // For select type
}

// Built-in command templates
var builtInTemplates = []CommandTemplate{
	{
		ID:          "list-files",
		Name:        "List Files",
		Description: "List files in a directory",
		Category:    "File Operations",
		Command:     "Get-ChildItem -Path \"{{path}}\" -{{detail}}",
		Parameters: []CommandParameter{
			{Name: "path", Type: "directory", Description: "Directory path", Required: true, DefaultValue: "."},
			{Name: "detail", Type: "select", Description: "Detail level", Required: false, DefaultValue: "Name", Options: []string{"Name", "Force", "Recurse"}},
		},
		Icon: "📁",
		Tags: []string{"file", "list", "directory"},
	},
	{
		ID:          "copy-file",
		Name:        "Copy File",
		Description: "Copy a file to another location",
		Category:    "File Operations",
		Command:     "Copy-Item -Path \"{{source}}\" -Destination \"{{destination}}\" -{{force}}",
		Parameters: []CommandParameter{
			{Name: "source", Type: "file", Description: "Source file", Required: true},
			{Name: "destination", Type: "text", Description: "Destination path", Required: true},
			{Name: "force", Type: "boolean", Description: "Overwrite existing", Required: false, DefaultValue: "Force"},
		},
		Icon: "📋",
		Tags: []string{"file", "copy", "move"},
	},
	{
		ID:          "delete-file",
		Name:        "Delete File",
		Description: "Delete a file or directory",
		Category:    "File Operations",
		Command:     "Remove-Item -Path \"{{path}}\" -{{force}} -{{recurse}}",
		Parameters: []CommandParameter{
			{Name: "path", Type: "text", Description: "Path to delete", Required: true},
			{Name: "force", Type: "boolean", Description: "Force deletion", Required: false, DefaultValue: "Force"},
			{Name: "recurse", Type: "boolean", Description: "Delete recursively", Required: false, DefaultValue: "Recurse"},
		},
		Icon: "🗑️",
		Tags: []string{"file", "delete", "remove"},
	},
	{
		ID:          "create-directory",
		Name:        "Create Directory",
		Description: "Create a new directory",
		Category:    "File Operations",
		Command:     "New-Item -Path \"{{path}}\" -ItemType Directory -{{force}}",
		Parameters: []CommandParameter{
			{Name: "path", Type: "text", Description: "Directory path", Required: true},
			{Name: "force", Type: "boolean", Description: "Overwrite existing", Required: false, DefaultValue: "Force"},
		},
		Icon: "📁",
		Tags: []string{"file", "create", "directory"},
	},
	{
		ID:          "get-process",
		Name:        "Get Processes",
		Description: "List running processes",
		Category:    "System Management",
		Command:     "Get-Process -Name \"{{name}}\" | Select-Object Name, Id, CPU, WorkingSet | Sort-Object CPU -Descending",
		Parameters: []CommandParameter{
			{Name: "name", Type: "text", Description: "Process name (optional)", Required: false, DefaultValue: ""},
		},
		Icon: "⚙️",
		Tags: []string{"process", "system", "monitor"},
	},
	{
		ID:          "kill-process",
		Name:        "Kill Process",
		Description: "Terminate a running process",
		Category:    "System Management",
		Command:     "Stop-Process -Id {{id}} -{{force}}",
		Parameters: []CommandParameter{
			{Name: "id", Type: "number", Description: "Process ID", Required: true},
			{Name: "force", Type: "boolean", Description: "Force termination", Required: false, DefaultValue: "Force"},
		},
		Icon: "🛑",
		Tags: []string{"process", "kill", "terminate"},
	},
	{
		ID:          "get-service",
		Name:        "Get Services",
		Description: "List system services",
		Category:    "System Management",
		Command:     "Get-Service -Name \"{{name}}\" | Select-Object Name, Status, StartType | Sort-Object Status",
		Parameters: []CommandParameter{
			{Name: "name", Type: "text", Description: "Service name (optional)", Required: false, DefaultValue: ""},
		},
		Icon: "🔧",
		Tags: []string{"service", "system", "manage"},
	},
	{
		ID:          "test-connection",
		Name:        "Test Connection",
		Description: "Test network connectivity",
		Category:    "Network Operations",
		Command:     "Test-Connection -ComputerName \"{{host}}\" -Port {{port}} -Count {{count}}",
		Parameters: []CommandParameter{
			{Name: "host", Type: "text", Description: "Host name or IP", Required: true, DefaultValue: "google.com"},
			{Name: "port", Type: "number", Description: "Port number", Required: false, DefaultValue: "80"},
			{Name: "count", Type: "number", Description: "Number of tests", Required: false, DefaultValue: "4"},
		},
		Icon: "🌐",
		Tags: []string{"network", "ping", "test"},
	},
	{
		ID:          "download-file",
		Name:        "Download File",
		Description: "Download a file from URL",
		Category:    "Network Operations",
		Command:     "Invoke-WebRequest -Uri \"{{url}}\" -OutFile \"{{output}}\"",
		Parameters: []CommandParameter{
			{Name: "url", Type: "text", Description: "Download URL", Required: true},
			{Name: "output", Type: "file", Description: "Output file path", Required: true},
		},
		Icon: "⬇️",
		Tags: []string{"network", "download", "file"},
	},
	{
		ID:          "git-status",
		Name:        "Git Status",
		Description: "Show git repository status",
		Category:    "Development",
		Command:     "git status",
		Parameters:  []CommandParameter{},
		Icon: "📊",
		Tags: []string{"git", "development", "version"},
	},
	{
		ID:          "git-pull",
		Name:        "Git Pull",
		Description: "Pull changes from remote repository",
		Category:    "Development",
		Command:     "git pull origin {{branch}}",
		Parameters: []CommandParameter{
			{Name: "branch", Type: "text", Description: "Branch name", Required: false, DefaultValue: "main"},
		},
		Icon: "⬇️",
		Tags: []string{"git", "development", "sync"},
	},
	{
		ID:          "npm-install",
		Name:        "NPM Install",
		Description: "Install npm packages",
		Category:    "Development",
		Command:     "npm install {{package}}",
		Parameters: []CommandParameter{
			{Name: "package", Type: "text", Description: "Package name (leave empty for all)", Required: false, DefaultValue: ""},
		},
		Icon: "📦",
		Tags: []string{"npm", "development", "package"},
	},
}

// Template storage (in-memory for now, could be moved to database)
var customTemplates []CommandTemplate

func handleCommandTemplates(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		// Return all templates (built-in + custom)
		allTemplates := append(builtInTemplates, customTemplates...)
		
		// Filter by category if specified
		category := r.URL.Query().Get("category")
		if category != "" {
			var filtered []CommandTemplate
			for _, template := range allTemplates {
				if template.Category == category {
					filtered = append(filtered, template)
				}
			}
			allTemplates = filtered
		}

		// Group by category
		categories := make(map[string][]CommandTemplate)
		for _, template := range allTemplates {
			categories[template.Category] = append(categories[template.Category], template)
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"templates":  allTemplates,
			"categories": categories,
			"total":      len(allTemplates),
		})
		return
	}

	if r.Method == "POST" {
		// Create new custom template
		var template CommandTemplate
		if err := json.NewDecoder(r.Body).Decode(&template); err != nil {
			http.Error(w, "Invalid template data", http.StatusBadRequest)
			return
		}

		// Generate ID if not provided
		if template.ID == "" {
			template.ID = fmt.Sprintf("custom_%d", len(customTemplates)+1)
		}

		// Validate template
		if template.Name == "" || template.Command == "" {
			http.Error(w, "Name and command are required", http.StatusBadRequest)
			return
		}

		customTemplates = append(customTemplates, template)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(template)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func handleCommandValidate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Command    string            `json:"command"`
		Parameters map[string]string `json:"parameters"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Simple validation - check if command has basic PowerShell syntax
	if req.Command == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"valid": false,
			"errors": []string{"Command cannot be empty"},
		})
		return
	}

	// Check for unmatched placeholders
	placeholderErrors := validatePlaceholders(req.Command, req.Parameters)

	// Check for dangerous commands
	dangerousErrors := validateDangerousCommands(req.Command)

	allErrors := append(placeholderErrors, dangerousErrors...)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"valid":  len(allErrors) == 0,
		"errors": allErrors,
	})
}

func validatePlaceholders(command string, parameters map[string]string) []string {
	var errors []string
	
	// Find all {{placeholder}} patterns
	matches := strings.Contains(command, "{{")
	
	if matches {
		// Simple check - extract placeholders
		start := 0
		for {
			startIdx := strings.Index(command[start:], "{{")
			if startIdx == -1 {
				break
			}
			startIdx += start
			
			endIdx := strings.Index(command[startIdx:], "}}")
			if endIdx == -1 {
				errors = append(errors, "Unclosed placeholder found")
				break
			}
			endIdx += startIdx + 2
			
			placeholder := command[startIdx+2 : endIdx-2]
			if _, exists := parameters[placeholder]; !exists {
				errors = append(errors, fmt.Sprintf("Missing value for placeholder: %s", placeholder))
			}
			
			start = endIdx
		}
	}
	
	return errors
}

func validateDangerousCommands(command string) []string {
	var errors []string
	
	// List of potentially dangerous commands
	dangerousPatterns := []string{
		"Remove-Item -Recurse -Force",
		"Stop-Computer",
		"Restart-Computer",
		"Set-ExecutionPolicy",
		"Invoke-Expression",
		"Format-Volume",
		"Clear-Content",
	}
	
	lowerCommand := strings.ToLower(command)
	for _, pattern := range dangerousPatterns {
		if strings.Contains(lowerCommand, strings.ToLower(pattern)) {
			errors = append(errors, fmt.Sprintf("Potentially dangerous command detected: %s", pattern))
		}
	}
	
	return errors
}

func handleCommandExecute(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Command    string            `json:"command"`
		Parameters map[string]string `json:"parameters"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Replace placeholders with actual values
	finalCommand := req.Command
	for key, value := range req.Parameters {
		placeholder := fmt.Sprintf("{{%s}}", key)
		finalCommand = strings.ReplaceAll(finalCommand, placeholder, value)
	}

	// Create a pending command for approval
	cmdID := generateID()
	pendingCmd := &PendingCommand{
		ID:          cmdID,
		SessionID:   "", // Can be set if needed
		Command:     finalCommand,
		Description: "Execute command from visual builder",
	}

	pendingCmdsMutex.Lock()
	pendingCommands[cmdID] = pendingCmd
	pendingCmdsMutex.Unlock()

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":          "pending_approval",
		"pendingCommand":  pendingCmd,
		"finalCommand":    finalCommand,
	})
}
