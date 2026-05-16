package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	openai "github.com/sashabaranov/go-openai"
)

type ChatResponse struct {
	Reply          string          `json:"reply"`
	SessionID      string          `json:"sessionId"`
	HasPendingCmd  bool            `json:"hasPendingCmd"`
	PendingCommand *PendingCommand `json:"pendingCommand,omitempty"`
	ActiveSoul     string          `json:"activeSoul"`
	SoulEmoji      string          `json:"soulEmoji"`
	MemoryCount    int             `json:"memoryCount"`
}

// getAIClient returns the appropriate AI client based on active provider
func getAIClient() (interface{}, AIProvider, error) {
	provider, config, err := GetActiveProvider()
	if err != nil {
		return nil, nil, err
	}
	
	client, err := provider.CreateClient(config)
	if err != nil {
		return nil, nil, err
	}
	
	return client, provider, nil
}

func handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get or create session
	var session *ChatSession
	if req.SessionID != "" {
		session = chatHistoryStore.GetSession(req.SessionID)
	}
	if session == nil {
		session = chatHistoryStore.CreateSession("New Chat")
	}

	// Search for relevant memories based on user message
	relevantMemories := memoryStore.SearchMemories(req.Message, 5)

	// Build memory context string
	memoryContext := ""
	if len(relevantMemories) > 0 {
		memoryContext = "\n\nRelevant memories from past interactions:\n"
		for _, mem := range relevantMemories {
			memoryContext += fmt.Sprintf("- [%s] %s\n", mem.Category, mem.Content)
			// Update last used timestamp
			memoryStore.UpdateLastUsed(mem.ID)
		}
	}

	// Get system info context
	sysInfo := getSystemInfo()
	sysContext := fmt.Sprintf("\n\n[System Context]\nOS: %s\nUser: %s\nCWD: %s\nCPU: %d%%\nRAM: %d/%d MB (%d%%)", 
		sysInfo.OS, sysInfo.Username, sysInfo.CurrentDir, sysInfo.CPUUsage, sysInfo.RAMUsed, sysInfo.RAMTotal, sysInfo.RAMUsage)

	// Build system prompt with soul, memory, and system context
	activeSoul := soulStore.GetActiveSoul()
	systemPrompt := activeSoul.SystemPrompt + memoryContext + sysContext

	// Build conversation from session messages
	var messages []openai.ChatCompletionMessage
	messages = append(messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleSystem,
		Content: systemPrompt,
	})
	for _, msg := range session.Messages {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
		})
	}

	// Add current user message
	userMessage := openai.ChatCompletionMessage{
		Role: openai.ChatMessageRoleUser,
	}

	// Simple check: if message contains a path to a screenshot, try to include it as an image
	screenshotPath := extractScreenshotPath(req.Message)
	if screenshotPath != "" {
		base64Data, err := getBase64Image(screenshotPath)
		if err == nil {
			userMessage.MultiContent = []openai.ChatMessagePart{
				{
					Type: openai.ChatMessagePartTypeText,
					Text: req.Message,
				},
				{
					Type: openai.ChatMessagePartTypeImageURL,
					ImageURL: &openai.ChatMessageImageURL{
						URL: base64Data,
					},
				},
			}
		} else {
			userMessage.Content = req.Message
		}
	} else {
		userMessage.Content = req.Message
	}
	messages = append(messages, userMessage)

	s := getSettings()

	if s.ApiKey == "" {
		http.Error(w, "API Key is missing. Silakan isi konfigurasi API Key terlebih dahulu di menu ⚙️ Settings.", http.StatusBadRequest)
		return
	}

	// Get AI client and provider
	client, provider, err := getAIClient()
	if err != nil {
		log.Printf("Failed to get AI client: %v", err)
		http.Error(w, fmt.Sprintf("AI provider error: %v", err), http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	resp, err := provider.CreateChatCompletion(ctx, client, req, messages)

	if err != nil {
		log.Printf("Chat completion error: %v", err)

		// Check if it's a rate limit error
		if strings.Contains(err.Error(), "429") || strings.Contains(err.Error(), "Rate limit") {
			http.Error(w, "Rate limit reached. Please wait a moment before sending another message.", http.StatusTooManyRequests)
			return
		}

		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	choice := resp.Choices[0]

	// Save messages to session
	chatHistoryStore.AddMessage(session.ID, ChatMessage{Role: "user", Content: req.Message})
	chatHistoryStore.AddMessage(session.ID, ChatMessage{Role: "assistant", Content: choice.Message.Content})

	// Get memory stats
	memStats := memoryStore.GetMemoryStats()
	memoryCount := memStats["total"].(int)

	res := ChatResponse{
		Reply:       choice.Message.Content,
		SessionID:   session.ID,
		ActiveSoul:  activeSoul.Name,
		SoulEmoji:   activeSoul.Emoji,
		MemoryCount: memoryCount,
	}

	if len(choice.Message.ToolCalls) > 0 {
		// Process tool calls
		for _, toolCall := range choice.Message.ToolCalls {
			result, isDirect := executeDirectTool(toolCall, session.ID)
			if isDirect {
				// For direct tools, we would ideally continue the conversation here
				// But for simplicity in this turn-based UI, we'll return the result as a reply
				// or let the AI know it succeeded.
				// In a real implementation, we'd loop back to the LLM.
				chatHistoryStore.AddMessage(session.ID, ChatMessage{
					Role:    "system",
					Content: fmt.Sprintf("Tool %s executed. Result: %s", toolCall.Function.Name, result),
				})
				res.Reply = result
			} else if toolCall.Function.Name == "run_powershell_command" {
				var args map[string]string
				json.Unmarshal([]byte(toolCall.Function.Arguments), &args)

				cmdID := toolCall.ID
				pendingCmd := &PendingCommand{
					ID:          cmdID,
					SessionID:   session.ID,
					Command:     args["command"],
					Description: args["description"],
				}

				pendingCmdsMutex.Lock()
				pendingCommands[cmdID] = pendingCmd
				pendingCmdsMutex.Unlock()

				res.HasPendingCmd = true
				res.PendingCommand = pendingCmd
				if res.Reply == "" {
					res.Reply = fmt.Sprintf("I need to run a command: %s", args["description"])
				}
				break
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func handleApproveCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	pendingCmdsMutex.RLock()
	cmd, exists := pendingCommands[req.ID]
	pendingCmdsMutex.RUnlock()

	if !exists {
		http.Error(w, "Command not found or already executed", http.StatusNotFound)
		return
	}

	// Remove from pending
	pendingCmdsMutex.Lock()
	delete(pendingCommands, req.ID)
	pendingCmdsMutex.Unlock()

	// Execute it
	execCmd := exec.Command("pwsh", "-Command", cmd.Command)
	output, err := execCmd.CombinedOutput()
	resultStr := string(output)

	// Clean ANSI escape codes (PowerShell colors)
	ansiRegex := regexp.MustCompile(`\x1b\[[0-9;]*m`)
	resultStr = ansiRegex.ReplaceAllString(resultStr, "")

	if err != nil {
		resultStr += fmt.Sprintf("\nError: %v", err)
	}

	// Save command execution result to session
	if cmd.SessionID != "" {
		chatHistoryStore.AddMessage(cmd.SessionID, ChatMessage{
			Role:    "system",
			Content: fmt.Sprintf("Command executed: %s\nOutput:\n%s", cmd.Command, resultStr),
		})
	}

	// Build messages from session for follow-up
	var messages []openai.ChatCompletionMessage
	if cmd.SessionID != "" {
		session := chatHistoryStore.GetSession(cmd.SessionID)
		if session != nil {
			activeSoul := soulStore.GetActiveSoul()
			messages = append(messages, openai.ChatCompletionMessage{
				Role:    openai.ChatMessageRoleSystem,
				Content: activeSoul.SystemPrompt,
			})
			for _, msg := range session.Messages {
				messages = append(messages, openai.ChatCompletionMessage{
					Role:    msg.Role,
					Content: msg.Content,
				})
			}
		}
	}

	if len(messages) == 0 {
		json.NewEncoder(w).Encode(map[string]string{
			"status": "success",
			"output": resultStr,
			"reply":  "Execution finished.",
		})
		return
	}

	// Prompt the AI again with the result
	client, provider, err := getAIClient()
	if err != nil {
		log.Printf("Failed to get AI client for command approval: %v", err)
		reply := fmt.Sprintf("Execution finished, but AI provider error: %v", err)
		json.NewEncoder(w).Encode(map[string]string{
			"status":    "success",
			"output":    resultStr,
			"reply":     reply,
			"sessionId": cmd.SessionID,
		})
		return
	}

	// Create a dummy request for the provider
	dummyReq := ChatRequest{SessionID: cmd.SessionID}
	resp, chatErr := provider.CreateChatCompletion(context.Background(), client, dummyReq, messages)

	reply := "Execution finished. AI didn't respond."
	if chatErr != nil {
		reply = fmt.Sprintf("Execution finished, but AI encountered an error: %v", chatErr)
	} else if len(resp.Choices) > 0 {
		reply = resp.Choices[0].Message.Content
		if cmd.SessionID != "" {
			chatHistoryStore.AddMessage(cmd.SessionID, ChatMessage{
				Role:    "assistant",
				Content: reply,
			})
		}
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status":    "success",
		"output":    resultStr,
		"reply":     reply,
		"sessionId": cmd.SessionID,
	})
}

func handleRejectCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	pendingCmdsMutex.Lock()
	cmd, exists := pendingCommands[req.ID]
	delete(pendingCommands, req.ID)
	pendingCmdsMutex.Unlock()

	if exists && cmd.SessionID != "" {
		chatHistoryStore.AddMessage(cmd.SessionID, ChatMessage{
			Role:    "system",
			Content: "User rejected the execution of this command.",
		})
	}

	sessionID := ""
	if cmd != nil {
		sessionID = cmd.SessionID
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status":    "rejected",
		"sessionId": sessionID,
	})
}

// ── Streaming Chat Handler (SSE) ────────────────────────────────────────────

func handleChatStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get or create session
	var session *ChatSession
	if req.SessionID != "" {
		session = chatHistoryStore.GetSession(req.SessionID)
	}
	if session == nil {
		session = chatHistoryStore.CreateSession("New Chat")
	}

	// Search for relevant memories
	relevantMemories := memoryStore.SearchMemories(req.Message, 5)
	memoryContext := ""
	if len(relevantMemories) > 0 {
		memoryContext = "\n\nRelevant memories from past interactions:\n"
		for _, mem := range relevantMemories {
			memoryContext += fmt.Sprintf("- [%s] %s\n", mem.Category, mem.Content)
			memoryStore.UpdateLastUsed(mem.ID)
		}
	}

	// Get system info context
	sysInfo := getSystemInfo()
	sysContext := fmt.Sprintf("\n\n[System Context]\nOS: %s\nUser: %s\nCWD: %s\nCPU: %d%%\nRAM: %d/%d MB (%d%%)", 
		sysInfo.OS, sysInfo.Username, sysInfo.CurrentDir, sysInfo.CPUUsage, sysInfo.RAMUsed, sysInfo.RAMTotal, sysInfo.RAMUsage)

	activeSoul := soulStore.GetActiveSoul()
	systemPrompt := activeSoul.SystemPrompt + memoryContext + sysContext

	var messages []openai.ChatCompletionMessage
	messages = append(messages, openai.ChatCompletionMessage{
		Role:    openai.ChatMessageRoleSystem,
		Content: systemPrompt,
	})
	for _, msg := range session.Messages {
		messages = append(messages, openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
		})
	}
	// Add current user message
	userMessage := openai.ChatCompletionMessage{
		Role: openai.ChatMessageRoleUser,
	}

	screenshotPath := extractScreenshotPath(req.Message)
	if screenshotPath != "" {
		base64Data, err := getBase64Image(screenshotPath)
		if err == nil {
			userMessage.MultiContent = []openai.ChatMessagePart{
				{
					Type: openai.ChatMessagePartTypeText,
					Text: req.Message,
				},
				{
					Type: openai.ChatMessagePartTypeImageURL,
					ImageURL: &openai.ChatMessageImageURL{
						URL: base64Data,
					},
				},
			}
		} else {
			userMessage.Content = req.Message
		}
	} else {
		userMessage.Content = req.Message
	}
	messages = append(messages, userMessage)

	s := getSettings()
	if s.ApiKey == "" {
		http.Error(w, "API Key is missing.", http.StatusBadRequest)
		return
	}

	// Get AI client and provider
	client, provider, err := getAIClient()
	if err != nil {
		log.Printf("Failed to get AI client: %v", err)
		http.Error(w, fmt.Sprintf("AI provider error: %v", err), http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()

	stream, err := provider.CreateChatCompletionStream(ctx, client, req, messages)
	if err != nil {
		log.Printf("Stream error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer stream.Close()

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	// Save user message
	chatHistoryStore.AddMessage(session.ID, ChatMessage{Role: "user", Content: req.Message})

	var fullContent strings.Builder
	var toolCallID, toolCallName, toolCallArgs string
	hasToolCall := false

	for {
		response, err := stream.Recv()
		if err != nil {
			if err == io.EOF {
				break
			}
			// Send error event
			errData, _ := json.Marshal(map[string]string{"type": "error", "content": err.Error()})
			fmt.Fprintf(w, "data: %s\n\n", errData)
			flusher.Flush()
			break
		}

		delta := response.Choices[0].Delta

		// Check for tool calls
		if len(delta.ToolCalls) > 0 {
			hasToolCall = true
			for _, tc := range delta.ToolCalls {
				if tc.ID != "" {
					toolCallID = tc.ID
				}
				if tc.Function.Name != "" {
					toolCallName = tc.Function.Name
				}
				toolCallArgs += tc.Function.Arguments
			}
			continue
		}

		// Regular content token
		if delta.Content != "" {
			fullContent.WriteString(delta.Content)
			tokenData, _ := json.Marshal(map[string]string{
				"type":    "token",
				"content": delta.Content,
			})
			fmt.Fprintf(w, "data: %s\n\n", tokenData)
			flusher.Flush()
		}
	}

	// Save assistant message
	chatHistoryStore.AddMessage(session.ID, ChatMessage{Role: "assistant", Content: fullContent.String()})

	// Handle tool call if present
	if hasToolCall {
		if toolCallID == "" {
			toolCallID = generateID()
		}

		// Try to execute as direct tool first
		result, isDirect := executeDirectTool(openai.ToolCall{
			ID:   toolCallID,
			Type: openai.ToolTypeFunction,
			Function: openai.FunctionCall{
				Name:      toolCallName,
				Arguments: toolCallArgs,
			},
		}, session.ID)

		if isDirect {
			chatHistoryStore.AddMessage(session.ID, ChatMessage{
				Role:    "system",
				Content: fmt.Sprintf("Tool %s executed. Result: %s", toolCallName, result),
			})
			
			// Send tool execution result event
			resultData, _ := json.Marshal(map[string]string{
				"type":    "token",
				"content": "\n\n[Tool Result] " + result,
			})
			fmt.Fprintf(w, "data: %s\n\n", resultData)
			flusher.Flush()
		} else if toolCallName == "run_powershell_command" {
			var args map[string]string
			json.Unmarshal([]byte(toolCallArgs), &args)

			pendingCmd := &PendingCommand{
				ID:          toolCallID,
				SessionID:   session.ID,
				Command:     args["command"],
				Description: args["description"],
			}

			pendingCmdsMutex.Lock()
			pendingCommands[toolCallID] = pendingCmd
			pendingCmdsMutex.Unlock()

			toolData, _ := json.Marshal(map[string]interface{}{
				"type":        "tool_call",
				"id":          toolCallID,
				"command":     args["command"],
				"description": args["description"],
			})
			fmt.Fprintf(w, "data: %s\n\n", toolData)
			flusher.Flush()
		}
	}

	// Send done event
	memStats := memoryStore.GetMemoryStats()
	memoryCount := memStats["total"].(int)

	doneData, _ := json.Marshal(map[string]interface{}{
		"type":        "done",
		"sessionId":   session.ID,
		"activeSoul":  activeSoul.Name,
		"soulEmoji":   activeSoul.Emoji,
		"memoryCount": memoryCount,
	})
	fmt.Fprintf(w, "data: %s\n\n", doneData)
	flusher.Flush()
}

func executeDirectTool(toolCall openai.ToolCall, _ string) (string, bool) {
	switch toolCall.Function.Name {
	case "read_file":
		var args map[string]string
		json.Unmarshal([]byte(toolCall.Function.Arguments), &args)
		content, err := readFileContent(args["path"])
		if err != nil {
			return fmt.Sprintf("Error reading file: %v", err), true
		}
		return fmt.Sprintf("File content of %s:\n%s", args["path"], content), true

	case "write_file":
		var args map[string]string
		json.Unmarshal([]byte(toolCall.Function.Arguments), &args)
		err := writeFileContent(args["path"], args["content"])
		if err != nil {
			return fmt.Sprintf("Error writing file: %v", err), true
		}
		return fmt.Sprintf("Successfully wrote to file: %s", args["path"]), true

	case "list_directory":
		var args map[string]string
		json.Unmarshal([]byte(toolCall.Function.Arguments), &args)
		files, err := listDirContent(args["path"])
		if err != nil {
			return fmt.Sprintf("Error listing directory: %v", err), true
		}
		return fmt.Sprintf("Contents of %s:\n%s", args["path"], strings.Join(files, "\n")), true

	case "capture_screenshot":
		path, err := CaptureScreenshot()
		if err != nil {
			return fmt.Sprintf("Error capturing screenshot: %v", err), true
		}
		return fmt.Sprintf("Screenshot captured and saved to: %s. I can see your screen now.", path), true

	case "search_in_files":
		var args map[string]string
		json.Unmarshal([]byte(toolCall.Function.Arguments), &args)
		results, err := searchInFiles(args["path"], args["query"])
		if err != nil {
			return fmt.Sprintf("Error searching in files: %v", err), true
		}
		if len(results) == 0 {
			return "No matches found.", true
		}
		return fmt.Sprintf("Found matches for '%s' in:\n%s", args["query"], strings.Join(results, "\n")), true

	default:
		return "", false
	}
}

// Helper functions for direct tools
func readFileContent(path string) (string, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

func writeFileContent(path string, content string) error {
	return os.WriteFile(path, []byte(content), 0644)
}

func listDirContent(path string) ([]string, error) {
	if path == "" {
		path = "."
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, entry := range entries {
		suffix := ""
		if entry.IsDir() {
			suffix = "/"
		}
		files = append(files, entry.Name()+suffix)
	}
	return files, nil
}

func extractScreenshotPath(message string) string {
	// Look for pattern data\screenshots\screenshot_*.png
	re := regexp.MustCompile(`data[\\/]screenshots[\\/]screenshot_\d+_\d+\.png`)
	return re.FindString(message)
}

func getBase64Image(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	
	mimeType := "image/png"
	if filepath.Ext(path) == ".jpg" || filepath.Ext(path) == ".jpeg" {
		mimeType = "image/jpeg"
	}
	
	base64Data := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data), nil
}
