package main

import (
	"bytes"
	"fmt"
	"image/png"
	"os"
	"path/filepath"
	"time"

	"github.com/kbinani/screenshot"
)

// CaptureScreenshot takes a screenshot of the main display and saves it to a temporary file
func CaptureScreenshot() (string, error) {
	n := screenshot.NumActiveDisplays()
	if n <= 0 {
		return "", fmt.Errorf("no active displays found")
	}

	// Capture the first display (usually the main one)
	bounds := screenshot.GetDisplayBounds(0)
	img, err := screenshot.CaptureRect(bounds)
	if err != nil {
		return "", fmt.Errorf("failed to capture screenshot: %v", err)
	}

	// Create screenshots directory if it doesn't exist
	screenshotsDir := filepath.Join("data", "screenshots")
	if err := os.MkdirAll(screenshotsDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create screenshots directory: %v", err)
	}

	// Generate filename based on timestamp
	filename := fmt.Sprintf("screenshot_%s.png", time.Now().Format("20060102_150405"))
	filepath := filepath.Join(screenshotsDir, filename)

	// Save to file
	file, err := os.Create(filepath)
	if err != nil {
		return "", fmt.Errorf("failed to create screenshot file: %v", err)
	}
	defer file.Close()

	if err := png.Encode(file, img); err != nil {
		return "", fmt.Errorf("failed to encode screenshot: %v", err)
	}

	return filepath, nil
}

// GetScreenshotBase64 captures a screenshot and returns it as a base64 encoded string
func GetScreenshotBase64() (string, error) {
	n := screenshot.NumActiveDisplays()
	if n <= 0 {
		return "", fmt.Errorf("no active displays found")
	}

	bounds := screenshot.GetDisplayBounds(0)
	img, err := screenshot.CaptureRect(bounds)
	if err != nil {
		return "", fmt.Errorf("failed to capture screenshot: %v", err)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return "", fmt.Errorf("failed to encode screenshot: %v", err)
	}

	return fmt.Sprintf("data:image/png;base64,%s", buf.Bytes()), nil
}
