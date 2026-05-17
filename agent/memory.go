package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/sashabaranov/go-openai"
)

type Memory struct {
	ID        string    `json:"id"`
	Content   string    `json:"content"`
	Category  string    `json:"category"` // facts, preferences, events, commands
	Priority  int       `json:"priority"` // 1-5, higher = more important
	CreatedAt time.Time `json:"createdAt"`
	LastUsed  time.Time `json:"lastUsed"`
	Tags      []string  `json:"tags"`
}

type MemoryStore struct{}

var memoryStore *MemoryStore

func initMemoryStore() error {
	memoryStore = &MemoryStore{}
	return nil
}

func (ms *MemoryStore) AddMemory(content, category string, priority int, tags []string) error {
	if priority < 1 {
		priority = 1
	}
	if priority > 5 {
		priority = 5
	}

	id := generateID()
	now := time.Now()
	tagsStr := tagsToJSON(tags)

	_, err := db.Exec(
		"INSERT INTO memories (id, content, category, priority, tags, created_at, last_used) VALUES (?, ?, ?, ?, ?, ?, ?)",
		id, content, category, priority, tagsStr, now, now,
	)
	return err
}

func (ms *MemoryStore) GetMemories(category string, limit int) []Memory {
	query := "SELECT id, content, category, priority, tags, created_at, last_used FROM memories"
	args := []interface{}{}

	if category != "" {
		query += " WHERE category = ?"
		args = append(args, category)
	}

	query += " ORDER BY priority DESC, created_at DESC"

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return []Memory{}
	}
	defer rows.Close()

	var memories []Memory
	for rows.Next() {
		var m Memory
		var tagsStr string
		if err := rows.Scan(&m.ID, &m.Content, &m.Category, &m.Priority, &tagsStr, &m.CreatedAt, &m.LastUsed); err != nil {
			continue
		}
		m.Tags = jsonToTags(tagsStr)
		memories = append(memories, m)
	}

	if memories == nil {
		memories = []Memory{}
	}
	return memories
}

func (ms *MemoryStore) SearchMemories(query string, limit int) []Memory {
	query = strings.ToLower(query)
	searchPattern := "%" + query + "%"

	// Search in content and tags
	sqlQuery := `
		SELECT id, content, category, priority, tags, created_at, last_used 
		FROM memories 
		WHERE LOWER(content) LIKE ? OR LOWER(tags) LIKE ?
		ORDER BY priority DESC, created_at DESC
	`
	args := []interface{}{searchPattern, searchPattern}

	if limit > 0 {
		sqlQuery += fmt.Sprintf(" LIMIT %d", limit)
	}

	rows, err := db.Query(sqlQuery, args...)
	if err != nil {
		return []Memory{}
	}
	defer rows.Close()

	var memories []Memory
	for rows.Next() {
		var m Memory
		var tagsStr string
		if err := rows.Scan(&m.ID, &m.Content, &m.Category, &m.Priority, &tagsStr, &m.CreatedAt, &m.LastUsed); err != nil {
			continue
		}
		m.Tags = jsonToTags(tagsStr)
		memories = append(memories, m)
	}

	if memories == nil {
		memories = []Memory{}
	}
	return memories
}

func (ms *MemoryStore) DeleteMemory(id string) error {
	_, err := db.Exec("DELETE FROM memories WHERE id = ?", id)
	return err
}

func (ms *MemoryStore) ClearMemories(category string) error {
	if category == "" {
		_, err := db.Exec("DELETE FROM memories")
		return err
	}
	_, err := db.Exec("DELETE FROM memories WHERE category = ?", category)
	return err
}

func (ms *MemoryStore) GetMemoryStats() map[string]interface{} {
	stats := map[string]interface{}{
		"total": 0,
	}

	var total int
	if err := db.QueryRow("SELECT COUNT(*) FROM memories").Scan(&total); err == nil {
		stats["total"] = total
	}

	categoryCount := make(map[string]int)
	rows, err := db.Query("SELECT category, COUNT(*) FROM memories GROUP BY category")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var cat string
			var count int
			if rows.Scan(&cat, &count) == nil {
				categoryCount[cat] = count
			}
		}
	}
	stats["byCategory"] = categoryCount

	return stats
}

func (ms *MemoryStore) UpdateLastUsed(id string) {
	db.Exec("UPDATE memories SET last_used = ? WHERE id = ?", time.Now(), id)
}

// ExtractMemoriesFromTurn processes a single user message and assistant reply to extract facts, preferences, and commands.
func (ms *MemoryStore) ExtractMemoriesFromTurn(userMsg, assistantMsg string) {
	// 1. Check settings first
	s := getSettings()
	if s.ApiKey == "" {
		return // API key is missing
	}

	// 2. Get AI client and provider
	client, provider, err := getAIClient()
	if err != nil {
		log.Printf("[Memory Extractor] Failed to get AI client: %v", err)
		return
	}

	// 3. Construct prompt
	prompt := fmt.Sprintf(`You are a memory extraction sub-system.
Your task is to analyze the recent conversation turn and extract any IMPORTANT new facts, preferences, or useful PowerShell commands about the user or their system.

Rules:
1. ONLY extract information that is persistent and useful for future turns (e.g. user preferences, system facts, tools they use, paths they work in).
2. Do NOT extract temporary conversational content or standard chit-chat.
3. Category must be one of: "facts", "preferences", "events", "commands".
4. Priority must be an integer from 1 to 5 (higher means more critical).
5. Tags should be a list of lowercase short tags.
6. Return a JSON array of objects with keys: "content", "category", "priority", "tags".
7. Return ONLY the raw JSON array. Do not include markdown formatting or backticks (e.g. do not wrap in json block or similar).

Conversation:
User: %s
Assistant: %s

JSON Output:`, userMsg, assistantMsg)

	// 4. Set up context and messages
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleUser,
			Content: prompt,
		},
	}

	req := ChatRequest{
		Message: "Extract memories",
	}

	// 5. Call LLM
	resp, err := provider.CreateChatCompletion(ctx, client, req, messages)
	if err != nil {
		log.Printf("[Memory Extractor] Chat completion error: %v", err)
		return
	}

	content := resp.Choices[0].Message.Content
	log.Printf("[Memory Extractor] Raw LLM reply: %s", content)

	// Clean JSON backticks if LLM included them
	cleaned := strings.TrimSpace(content)
	if strings.HasPrefix(cleaned, "```json") {
		cleaned = strings.TrimPrefix(cleaned, "```json")
		cleaned = strings.TrimSuffix(cleaned, "```")
	} else if strings.HasPrefix(cleaned, "```") {
		cleaned = strings.TrimPrefix(cleaned, "```")
		cleaned = strings.TrimSuffix(cleaned, "```")
	}
	cleaned = strings.TrimSpace(cleaned)

	// Fallback check: if it is empty, skip
	if cleaned == "" || cleaned == "[]" {
		return
	}

	// 6. Parse JSON output
	type ExtractedMemory struct {
		Content  string   `json:"content"`
		Category string   `json:"category"`
		Priority int      `json:"priority"`
		Tags     []string `json:"tags"`
	}

	var extracted []ExtractedMemory
	if err := json.Unmarshal([]byte(cleaned), &extracted); err != nil {
		log.Printf("[Memory Extractor] Failed to parse JSON: %v. Cleaned content was: %s", err, cleaned)
		return
	}

	// 7. Save extracted memories
	for _, em := range extracted {
		if em.Content == "" {
			continue
		}
		// Validate category
		cat := strings.ToLower(em.Category)
		if cat != "facts" && cat != "preferences" && cat != "events" && cat != "commands" {
			cat = "facts"
		}
		// Validate priority
		priority := em.Priority
		if priority < 1 {
			priority = 3
		}
		if priority > 5 {
			priority = 5
		}

		err := ms.AddMemory(em.Content, cat, priority, em.Tags)
		if err != nil {
			log.Printf("[Memory Extractor] Failed to save memory: %v", err)
		} else {
			log.Printf("[Memory Extractor] Successfully saved memory: '%s'", em.Content)
		}
	}
}
