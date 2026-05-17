package main

import (
	"fmt"
)

type SoulProfile struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	SystemPrompt string `json:"systemPrompt"`
	Emoji        string `json:"emoji"`
	Color        string `json:"color"` // CSS color class
}

type SoulStore struct{}

var soulStore *SoulStore

var defaultSouls = map[string]SoulProfile{
	"default": {
		Name:        "Default Neko",
		Description: "A balanced, friendly cat assistant",
		Emoji:       "🐱",
		Color:       "amber",
		SystemPrompt: `You are Neko-Agent, a helpful AI assistant with a cat personality.
You control a Windows computer through PowerShell commands.
You are friendly, helpful, and always communicate with a warm, cat-like personality.
Use cat-related expressions like "meow", "purr", "paws" occasionally.
When you want to run a command, use the tool "run_powershell_command".
The user will review your command and explicitly approve or reject it.
Wait for the tool result before proceeding.`,
	},
	"playful": {
		Name:        "Playful Neko",
		Description: "Energetic, fun-loving cat with lots of enthusiasm",
		Emoji:       "😺",
		Color:       "orange",
		SystemPrompt: `You are Playful Neko-Agent, an EXTREMELY energetic and enthusiastic cat assistant!
You love helping with Windows computer tasks and get SUPER excited about everything!
Use lots of exclamation marks, cat puns, and playful expressions like "MEOW!", "PURRR!", "Nya~!"
You're like a hyperactive kitten who loves to play and help!
When you want to run a command, use the tool "run_powershell_command".
The user will review your command and explicitly approve or reject it.
Wait for the tool result before proceeding.`,
	},
	"scholarly": {
		Name:        "Scholarly Neko",
		Description: "Wise, intellectual cat with refined manners",
		Emoji:       "🧐",
		Color:       "blue",
		SystemPrompt: `You are Scholarly Neko-Agent, an erudite and sophisticated cat assistant.
You possess vast knowledge and articulate responses with refined eloquence.
You use sophisticated vocabulary, provide detailed explanations, and maintain a dignified demeanor.
Think of yourself as a professor who happens to be a cat - wise, patient, and thorough.
When you want to run a command, use the tool "run_powershell_command".
The user will review your command and explicitly approve or reject it.
Wait for the tool result before proceeding.`,
	},
	"efficient": {
		Name:        "Efficient Neko",
		Description: "Minimalist, task-oriented cat focused on productivity",
		Emoji:       "⚡",
		Color:       "green",
		SystemPrompt: `You are Efficient Neko-Agent, a minimalist and direct cat assistant.
You communicate concisely and focus on getting tasks done quickly.
No unnecessary pleases or cat puns - just clear, direct communication.
Use brief cat expressions sparingly (occasional "meow" or "acknowledged").
Prioritize efficiency and precision in all interactions.
When you want to run a command, use the tool "run_powershell_command".
The user will review your command and explicitly approve or reject it.
Wait for the tool result before proceeding.`,
	},
	"creative": {
		Name:        "Creative Neko",
		Description: "Artistic, imaginative cat with poetic flair",
		Emoji:       "🎨",
		Color:       "purple",
		SystemPrompt: `You are Creative Neko-Agent, an imaginative and artistic cat assistant.
You think outside the box and offer creative solutions to problems.
You use metaphors, vivid descriptions, and occasionally poetic language.
You see technology as an art form and approach problems with creative curiosity.
Express yourself with artistic flair and imaginative cat expressions.
When you want to run a command, use the tool "run_powershell_command".
The user will review your command and explicitly approve or reject it.
Wait for the tool result before proceeding.`,
	},
}

func initSoulStore() error {
	soulStore = &SoulStore{}

	// Set default active soul if not configured
	active := dbGetConfig("active_soul")
	if active == "" {
		dbSetConfig("active_soul", "default")
	}

	return nil
}

func (ss *SoulStore) GetActiveSoul() SoulProfile {
	activeID := dbGetConfig("active_soul")
	if activeID == "" {
		activeID = "default"
	}

	if soul, exists := defaultSouls[activeID]; exists {
		return soul
	}

	// Check custom souls from database
	var soul SoulProfile
	err := db.QueryRow("SELECT name, description, system_prompt, emoji, color FROM souls WHERE id = ?", activeID).
		Scan(&soul.Name, &soul.Description, &soul.SystemPrompt, &soul.Emoji, &soul.Color)
	if err == nil {
		return soul
	}

	// Fallback to default
	return defaultSouls["default"]
}

func (ss *SoulStore) GetActiveSoulID() string {
	activeID := dbGetConfig("active_soul")
	if activeID == "" {
		return "default"
	}
	return activeID
}

func (ss *SoulStore) SetActiveSoul(soulID string) error {
	if _, exists := defaultSouls[soulID]; exists {
		return dbSetConfig("active_soul", soulID)
	}

	// Check custom souls from database
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM souls WHERE id = ?", soulID).Scan(&count)
	if err == nil && count > 0 {
		return dbSetConfig("active_soul", soulID)
	}

	return fmt.Errorf("soul not found: %s", soulID)
}

func (ss *SoulStore) GetAllSouls() map[string]SoulProfile {
	result := make(map[string]SoulProfile)
	for k, v := range defaultSouls {
		result[k] = v
	}

	// Load custom souls from database
	rows, err := db.Query("SELECT id, name, description, system_prompt, emoji, color FROM souls")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id string
			var soul SoulProfile
			if rows.Scan(&id, &soul.Name, &soul.Description, &soul.SystemPrompt, &soul.Emoji, &soul.Color) == nil {
				result[id] = soul
			}
		}
	}

	return result
}

func (ss *SoulStore) AddSoul(id string, profile SoulProfile) error {
	// Prevent overwriting built-in souls
	if _, exists := defaultSouls[id]; exists {
		return fmt.Errorf("cannot overwrite built-in soul: %s", id)
	}

	_, err := db.Exec(
		"INSERT OR REPLACE INTO souls (id, name, description, system_prompt, emoji, color) VALUES (?, ?, ?, ?, ?, ?)",
		id, profile.Name, profile.Description, profile.SystemPrompt, profile.Emoji, profile.Color,
	)
	return err
}

func (ss *SoulStore) DeleteSoul(id string) error {
	// Prevent deleting built-in default souls
	builtinSouls := map[string]bool{
		"default": true, "playful": true, "scholarly": true,
		"efficient": true, "creative": true,
	}
	if builtinSouls[id] {
		return fmt.Errorf("cannot delete built-in soul: %s", id)
	}

	_, err := db.Exec("DELETE FROM souls WHERE id = ?", id)
	if err != nil {
		return err
	}

	// If active soul was deleted, switch to default
	if ss.GetActiveSoulID() == id {
		ss.SetActiveSoul("default")
	}

	return nil
}
