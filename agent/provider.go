package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	openai "github.com/sashabaranov/go-openai"
)

// AIProvider interface defines the contract for all AI providers
type AIProvider interface {
	CreateClient(config ProviderConfig) (interface{}, error)
	CreateChatCompletion(ctx context.Context, client interface{}, req ChatRequest, messages []openai.ChatCompletionMessage) (*openai.ChatCompletionResponse, error)
	CreateChatCompletionStream(ctx context.Context, client interface{}, req ChatRequest, messages []openai.ChatCompletionMessage) (*openai.ChatCompletionStream, error)
	GetModels(config ProviderConfig) []string
	ValidateConfig(config ProviderConfig) error
	GetToolDefinitions() []openai.Tool
}

// ChatRequest represents a chat request (moved from llm.go for consistency)
type ChatRequest struct {
	Message   string `json:"message"`
	SessionID string `json:"sessionId,omitempty"`
}

// OpenAIProvider implements AIProvider for OpenAI-compatible APIs
type OpenAIProvider struct{}

func (p *OpenAIProvider) CreateClient(config ProviderConfig) (interface{}, error) {
	if config.ApiKey == "" {
		return nil, fmt.Errorf("API key is required for OpenAI provider")
	}

	clientConfig := openai.DefaultConfig(config.ApiKey)
	if config.ApiUrl != "" {
		apiUrl := config.ApiUrl
		if before, ok := strings.CutSuffix(apiUrl, "/chat/completions"); ok {
			apiUrl = before
		}
		clientConfig.BaseURL = apiUrl
	}
	return openai.NewClientWithConfig(clientConfig), nil
}

func (p *OpenAIProvider) CreateChatCompletion(ctx context.Context, client interface{}, req ChatRequest, messages []openai.ChatCompletionMessage) (*openai.ChatCompletionResponse, error) {
	openaiClient, ok := client.(*openai.Client)
	if !ok {
		return nil, fmt.Errorf("invalid client type for OpenAI provider")
	}

	// Get model from settings or use default
	s := getSettings()
	model := s.Model
	if model == "" {
		model = "gpt-3.5-turbo"
	}

	resp, err := openaiClient.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model:    model,
			Messages: messages,
			Tools:    p.GetToolDefinitions(),
		},
	)
	return &resp, err
}

func (p *OpenAIProvider) CreateChatCompletionStream(ctx context.Context, client interface{}, req ChatRequest, messages []openai.ChatCompletionMessage) (*openai.ChatCompletionStream, error) {
	openaiClient, ok := client.(*openai.Client)
	if !ok {
		return nil, fmt.Errorf("invalid client type for OpenAI provider")
	}

	// Get model from settings or use default
	s := getSettings()
	model := s.Model
	if model == "" {
		model = "gpt-3.5-turbo"
	}

	return openaiClient.CreateChatCompletionStream(
		ctx,
		openai.ChatCompletionRequest{
			Model:    model,
			Messages: messages,
			Tools:    p.GetToolDefinitions(),
			Stream:   true,
		},
	)
}

func (p *OpenAIProvider) GetModels(config ProviderConfig) []string {
	return config.Models
}

func (p *OpenAIProvider) ValidateConfig(config ProviderConfig) error {
	if config.ApiKey == "" {
		return fmt.Errorf("API key is required for OpenAI provider")
	}
	if config.ApiUrl == "" {
		return fmt.Errorf("API URL is required for OpenAI provider")
	}
	return nil
}

func (p *OpenAIProvider) GetToolDefinitions() []openai.Tool {
	return commonTools()
}

// AnthropicProvider implements AIProvider for Anthropic Claude
type AnthropicProvider struct{}

func (p *AnthropicProvider) CreateClient(config ProviderConfig) (interface{}, error) {
	if config.ApiKey == "" {
		return nil, fmt.Errorf("API key is required for Anthropic provider")
	}
	// For now, we'll use OpenAI client as a base and adapt for Anthropic
	// In a full implementation, you'd use the Anthropic SDK directly
	clientConfig := openai.DefaultConfig(config.ApiKey)
	clientConfig.BaseURL = config.ApiUrl + "/v1/messages"
	return openai.NewClientWithConfig(clientConfig), nil
}

func (p *AnthropicProvider) CreateChatCompletion(ctx context.Context, client interface{}, req ChatRequest, messages []openai.ChatCompletionMessage) (*openai.ChatCompletionResponse, error) {
	// Convert OpenAI format to Anthropic format
	// This is a simplified implementation - full implementation would need proper format conversion
	openaiClient, ok := client.(*openai.Client)
	if !ok {
		return nil, fmt.Errorf("invalid client type for Anthropic provider")
	}

	// For now, delegate to OpenAI provider with different model
	s := getSettings()
	model := s.Model
	if model == "" {
		model = "claude-3-5-sonnet-20241022"
	}

	resp, err := openaiClient.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model:    model,
			Messages: messages,
			Tools:    p.GetToolDefinitions(),
		},
	)
	return &resp, err
}

func (p *AnthropicProvider) CreateChatCompletionStream(ctx context.Context, client interface{}, req ChatRequest, messages []openai.ChatCompletionMessage) (*openai.ChatCompletionStream, error) {
	openaiClient, ok := client.(*openai.Client)
	if !ok {
		return nil, fmt.Errorf("invalid client type for Anthropic provider")
	}

	s := getSettings()
	model := s.Model
	if model == "" {
		model = "claude-3-5-sonnet-20241022"
	}

	return openaiClient.CreateChatCompletionStream(
		ctx,
		openai.ChatCompletionRequest{
			Model:    model,
			Messages: messages,
			Tools:    p.GetToolDefinitions(),
			Stream:   true,
		},
	)
}

func (p *AnthropicProvider) GetModels(config ProviderConfig) []string {
	return config.Models
}

func (p *AnthropicProvider) ValidateConfig(config ProviderConfig) error {
	if config.ApiKey == "" {
		return fmt.Errorf("API key is required for Anthropic provider")
	}
	if config.ApiUrl == "" {
		return fmt.Errorf("API URL is required for Anthropic provider")
	}
	return nil
}

func (p *AnthropicProvider) GetToolDefinitions() []openai.Tool {
	return commonTools()
}

// ZhipuProvider implements AIProvider for Zhipu AI (GLM models)
type ZhipuProvider struct{}

func (p *ZhipuProvider) CreateClient(config ProviderConfig) (interface{}, error) {
	if config.ApiKey == "" {
		return nil, fmt.Errorf("API key is required for Zhipu provider")
	}

	clientConfig := openai.DefaultConfig(config.ApiKey)
	if config.ApiUrl != "" {
		apiUrl := config.ApiUrl
		if before, ok := strings.CutSuffix(apiUrl, "/chat/completions"); ok {
			apiUrl = before
		}
		clientConfig.BaseURL = apiUrl
	}
	return openai.NewClientWithConfig(clientConfig), nil
}

func (p *ZhipuProvider) CreateChatCompletion(ctx context.Context, client interface{}, req ChatRequest, messages []openai.ChatCompletionMessage) (*openai.ChatCompletionResponse, error) {
	openaiClient, ok := client.(*openai.Client)
	if !ok {
		return nil, fmt.Errorf("invalid client type for Zhipu provider")
	}

	s := getSettings()
	model := s.Model
	if model == "" {
		model = "glm-4.7-flash"
	}

	resp, err := openaiClient.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model:    model,
			Messages: messages,
			Tools:    p.GetToolDefinitions(),
		},
	)
	return &resp, err
}

func (p *ZhipuProvider) CreateChatCompletionStream(ctx context.Context, client interface{}, req ChatRequest, messages []openai.ChatCompletionMessage) (*openai.ChatCompletionStream, error) {
	openaiClient, ok := client.(*openai.Client)
	if !ok {
		return nil, fmt.Errorf("invalid client type for Zhipu provider")
	}

	s := getSettings()
	model := s.Model
	if model == "" {
		model = "glm-4.7-flash"
	}

	return openaiClient.CreateChatCompletionStream(
		ctx,
		openai.ChatCompletionRequest{
			Model:    model,
			Messages: messages,
			Tools:    p.GetToolDefinitions(),
			Stream:   true,
		},
	)
}

func (p *ZhipuProvider) GetModels(config ProviderConfig) []string {
	return config.Models
}

func (p *ZhipuProvider) ValidateConfig(config ProviderConfig) error {
	if config.ApiKey == "" {
		return fmt.Errorf("API key is required for Zhipu provider")
	}
	if config.ApiUrl == "" {
		return fmt.Errorf("API URL is required for Zhipu provider")
	}
	return nil
}

func (p *ZhipuProvider) GetToolDefinitions() []openai.Tool {
	return commonTools()
}

// LocalProvider implements AIProvider for local models (Ollama, etc.)
type LocalProvider struct{}

func (p *LocalProvider) CreateClient(config ProviderConfig) (interface{}, error) {
	// Local models don't typically need API keys
	clientConfig := openai.DefaultConfig("not-required")
	if config.ApiUrl != "" {
		apiUrl := config.ApiUrl
		if before, ok := strings.CutSuffix(apiUrl, "/chat/completions"); ok {
			apiUrl = before
		}
		clientConfig.BaseURL = apiUrl
	}
	return openai.NewClientWithConfig(clientConfig), nil
}

func (p *LocalProvider) CreateChatCompletion(ctx context.Context, client interface{}, req ChatRequest, messages []openai.ChatCompletionMessage) (*openai.ChatCompletionResponse, error) {
	openaiClient, ok := client.(*openai.Client)
	if !ok {
		return nil, fmt.Errorf("invalid client type for Local provider")
	}

	s := getSettings()
	model := s.Model
	if model == "" {
		model = "llama3.1"
	}

	resp, err := openaiClient.CreateChatCompletion(
		ctx,
		openai.ChatCompletionRequest{
			Model:    model,
			Messages: messages,
			Tools:    p.GetToolDefinitions(),
		},
	)
	return &resp, err
}

func (p *LocalProvider) CreateChatCompletionStream(ctx context.Context, client interface{}, req ChatRequest, messages []openai.ChatCompletionMessage) (*openai.ChatCompletionStream, error) {
	openaiClient, ok := client.(*openai.Client)
	if !ok {
		return nil, fmt.Errorf("invalid client type for Local provider")
	}

	s := getSettings()
	model := s.Model
	if model == "" {
		model = "llama3.1"
	}

	return openaiClient.CreateChatCompletionStream(
		ctx,
		openai.ChatCompletionRequest{
			Model:    model,
			Messages: messages,
			Tools:    p.GetToolDefinitions(),
			Stream:   true,
		},
	)
}

func (p *LocalProvider) GetModels(config ProviderConfig) []string {
	return config.Models
}

func (p *LocalProvider) ValidateConfig(config ProviderConfig) error {
	if config.ApiUrl == "" {
		return fmt.Errorf("API URL is required for Local provider")
	}
	return nil
}

func (p *LocalProvider) GetToolDefinitions() []openai.Tool {
	return commonTools()
}

func commonTools() []openai.Tool {
	return []openai.Tool{
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "run_powershell_command",
				Description: "Propose a powershell command to execute on the user's computer. The user must approve it first.",
				Parameters: json.RawMessage(`{
					"type": "object",
					"properties": {
						"command": {
							"type": "string",
							"description": "The exact powershell command to run."
						},
						"description": {
							"type": "string",
							"description": "A short summary explaining what this command does safely."
						}
					},
					"required": ["command", "description"]
				}`),
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "read_file",
				Description: "Read the content of a file from the user's computer.",
				Parameters: json.RawMessage(`{
					"type": "object",
					"properties": {
						"path": {
							"type": "string",
							"description": "The path to the file to read."
						}
					},
					"required": ["path"]
				}`),
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "write_file",
				Description: "Write content to a file on the user's computer.",
				Parameters: json.RawMessage(`{
					"type": "object",
					"properties": {
						"path": {
							"type": "string",
							"description": "The path to the file to write."
						},
						"content": {
							"type": "string",
							"description": "The content to write to the file."
						}
					},
					"required": ["path", "content"]
				}`),
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "list_directory",
				Description: "List files and directories in a specific path.",
				Parameters: json.RawMessage(`{
					"type": "object",
					"properties": {
						"path": {
							"type": "string",
							"description": "The directory path to list."
						}
					},
					"required": ["path"]
				}`),
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "capture_screenshot",
				Description: "Take a screenshot of the user's desktop to see what's happening.",
				Parameters: json.RawMessage(`{
					"type": "object",
					"properties": {}
				}`),
			},
		},
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        "search_in_files",
				Description: "Search for a specific query string within all files in a directory (local knowledge/RAG).",
				Parameters: json.RawMessage(`{
					"type": "object",
					"properties": {
						"path": {
							"type": "string",
							"description": "The directory path to search in."
						},
						"query": {
							"type": "string",
							"description": "The search term to look for."
						}
					},
					"required": ["path", "query"]
				}`),
			},
		},
	}
}

// ProviderFactory creates provider instances
func GetProvider(providerType string) (AIProvider, error) {
	switch providerType {
	case "openai":
		return &OpenAIProvider{}, nil
	case "anthropic":
		return &AnthropicProvider{}, nil
	case "zhipu":
		return &ZhipuProvider{}, nil
	case "local":
		return &LocalProvider{}, nil
	default:
		return nil, fmt.Errorf("unsupported provider type: %s", providerType)
	}
}

// GetActiveProvider returns the currently active AI provider
func GetActiveProvider() (AIProvider, ProviderConfig, error) {
	s := getSettings()
	
	providerType := s.ActiveProvider
	if providerType == "" {
		providerType = "zhipu" // Default to Zhipu for backward compatibility
	}
	
	provider, err := GetProvider(providerType)
	if err != nil {
		return nil, ProviderConfig{}, err
	}
	
	config, exists := s.Providers[providerType]
	if !exists {
		return nil, ProviderConfig{}, fmt.Errorf("provider configuration not found for: %s", providerType)
	}
	
	return provider, config, nil
}
