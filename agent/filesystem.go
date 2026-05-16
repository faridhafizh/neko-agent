package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type FileEntry struct {
	Name         string    `json:"name"`
	Path         string    `json:"path"`
	IsDir        bool      `json:"isDir"`
	Size         int64     `json:"size"`
	LastModified time.Time `json:"lastModified"`
}

// Security: Get Base Directory (defaults to user home, or can be configured)
func getBaseDir() string {
	baseDir := dbGetConfig("fs_base_dir")
	if baseDir == "" {
		baseDir, _ = os.UserHomeDir()
		if baseDir == "" {
			baseDir, _ = os.Getwd()
		}
	}
	// Always return absolute path
	abs, err := filepath.Abs(baseDir)
	if err != nil {
		return "."
	}
	return abs
}

// Security: Resolve and validate path to prevent path traversal
func resolveSafePath(reqPath string) (string, error) {
	baseDir := getBaseDir()
	
	// Default to base dir if empty
	if reqPath == "" || reqPath == "/" {
		return baseDir, nil
	}

	// Clean the requested path
	cleanReq := filepath.Clean(reqPath)
	
	// Join with base if it's not absolute or if it attempts traversal
	var fullPath string
	if filepath.IsAbs(cleanReq) {
		fullPath = cleanReq
	} else {
		fullPath = filepath.Join(baseDir, cleanReq)
	}

	// Double check absolute resolution
	finalAbs, err := filepath.Abs(fullPath)
	if err != nil {
		return "", err
	}

	// Ensure it is still within baseDir (or is exactly baseDir)
	if !strings.HasPrefix(finalAbs, baseDir) {
		return "", fmt.Errorf("access denied: path outside base directory")
	}

	return finalAbs, nil
}

// Handler: Limit to 1MB reads to prevent memory bloat in UI
const maxFileSize = 1 * 1024 * 1024

func handleFilesystem(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		// List directory
		reqPath := r.URL.Query().Get("path")
		safePath, err := resolveSafePath(reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}

		info, err := os.Stat(safePath)
		if err != nil {
			if os.IsNotExist(err) {
				http.Error(w, "Directory not found", http.StatusNotFound)
			} else {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
			return
		}

		if !info.IsDir() {
			http.Error(w, "Path is not a directory", http.StatusBadRequest)
			return
		}

		entries, err := os.ReadDir(safePath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		result := make([]FileEntry, 0)
		for _, e := range entries {
			i, err := e.Info()
			if err != nil {
				continue
			}
			result = append(result, FileEntry{
				Name:         e.Name(),
				Path:         filepath.Join(reqPath, e.Name()), // Relative to requested path
				IsDir:        e.IsDir(),
				Size:         i.Size(),
				LastModified: i.ModTime(),
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"baseDir": getBaseDir(),
			"current": reqPath,
			"files":   result,
		})

	case "DELETE":
		reqPath := r.URL.Query().Get("path")
		if reqPath == "" {
			http.Error(w, "Path required", http.StatusBadRequest)
			return
		}
		
		safePath, err := resolveSafePath(reqPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}

		if err := os.RemoveAll(safePath); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleFileRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	reqPath := r.URL.Query().Get("path")
	if reqPath == "" {
		http.Error(w, "Path required", http.StatusBadRequest)
		return
	}

	safePath, err := resolveSafePath(reqPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	info, err := os.Stat(safePath)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	if info.IsDir() {
		http.Error(w, "Cannot read directory as file", http.StatusBadRequest)
		return
	}

	if info.Size() > maxFileSize {
		http.Error(w, "File too large to open in browser editor (>1MB)", http.StatusBadRequest)
		return
	}

	content, err := os.ReadFile(safePath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"path":    reqPath,
		"content": string(content),
	})
}

func handleFileWrite(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	safePath, err := resolveSafePath(req.Path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	// Check if trying to edit a directory
	if info, err := os.Stat(safePath); err == nil && info.IsDir() {
		http.Error(w, "Cannot overwrite a directory with a file", http.StatusBadRequest)
		return
	}

	err = os.WriteFile(safePath, []byte(req.Content), 0644)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
}

func handleFileMkdir(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path string `json:"path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	safePath, err := resolveSafePath(req.Path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	err = os.MkdirAll(safePath, 0755)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "created"})
}

func handleFileUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form (max 32MB)
	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Get target directory from form
	targetDir := r.FormValue("targetDir")
	if targetDir == "" {
		targetDir = "/"
	}

	safeTargetDir, err := resolveSafePath(targetDir)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	// Process uploaded files
	var uploadedFiles []map[string]interface{}
	
	for _, files := range r.MultipartForm.File {
		for _, fileHeader := range files {
			file, err := fileHeader.Open()
			if err != nil {
				http.Error(w, "Failed to open uploaded file", http.StatusInternalServerError)
				return
			}
			defer file.Close()

			// Create target file path
			targetPath := filepath.Join(safeTargetDir, fileHeader.Filename)
			
			// Create destination file
			dst, err := os.Create(targetPath)
			if err != nil {
				http.Error(w, "Failed to create destination file", http.StatusInternalServerError)
				return
			}
			
			// Copy file content
			_, err = dst.ReadFrom(file)
			if err != nil {
				dst.Close()
				http.Error(w, "Failed to save file", http.StatusInternalServerError)
				return
			}
			dst.Close()

			// Get file info
			fileInfo, _ := os.Stat(targetPath)
			uploadedFiles = append(uploadedFiles, map[string]interface{}{
				"name":         fileHeader.Filename,
				"path":         targetPath,
				"size":         fileInfo.Size(),
				"lastModified": fileInfo.ModTime(),
			})
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"files":   uploadedFiles,
		"count":   len(uploadedFiles),
	})
}

func handleFileMove(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Source      string `json:"source"`
		Destination string `json:"destination"`
		Copy        bool   `json:"copy"` // false = move, true = copy
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	safeSource, err := resolveSafePath(req.Source)
	if err != nil {
		http.Error(w, "Invalid source path: "+err.Error(), http.StatusForbidden)
		return
	}

	safeDest, err := resolveSafePath(req.Destination)
	if err != nil {
		http.Error(w, "Invalid destination path: "+err.Error(), http.StatusForbidden)
		return
	}

	// Check if source exists
	sourceInfo, err := os.Stat(safeSource)
	if err != nil {
		http.Error(w, "Source does not exist", http.StatusNotFound)
		return
	}

	// Perform move or copy
	var operation string
	if req.Copy {
		err = copyPath(safeSource, safeDest, sourceInfo.IsDir())
		operation = "copied"
	} else {
		err = os.Rename(safeSource, safeDest)
		operation = "moved"
	}

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to %s file: %v", operation, err), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"action": operation,
		"source": req.Source,
		"dest":   req.Destination,
	})
}

func handleFileBatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Operation string   `json:"operation"` // delete, move, copy
		Paths     []string `json:"paths"`
		Target    string   `json:"target,omitempty"` // for move/copy
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	if len(req.Paths) == 0 {
		http.Error(w, "No paths provided", http.StatusBadRequest)
		return
	}

	var results []map[string]interface{}
	var errors []string

	for _, path := range req.Paths {
		safePath, err := resolveSafePath(path)
		if err != nil {
			errors = append(errors, fmt.Sprintf("Invalid path %s: %v", path, err))
			continue
		}

		result := map[string]interface{}{
			"path": path,
		}

		switch req.Operation {
		case "delete":
			err = deletePath(safePath)
			if err != nil {
				result["error"] = err.Error()
				errors = append(errors, fmt.Sprintf("Failed to delete %s: %v", path, err))
			} else {
				result["status"] = "deleted"
			}

		case "move", "copy":
			if req.Target == "" {
				result["error"] = "Target path required for move/copy operation"
				errors = append(errors, fmt.Sprintf("No target provided for %s", path))
				break
			}

			safeTarget, err := resolveSafePath(req.Target)
			if err != nil {
				result["error"] = "Invalid target path: " + err.Error()
				errors = append(errors, fmt.Sprintf("Invalid target for %s: %v", path, err))
				break
			}

			// Determine final destination path
			destPath := filepath.Join(safeTarget, filepath.Base(safePath))
			
			sourceInfo, err := os.Stat(safePath)
			if err != nil {
				result["error"] = "Source not found"
				errors = append(errors, fmt.Sprintf("Source not found: %s", path))
				break
			}

			if req.Operation == "move" {
				err = os.Rename(safePath, destPath)
				if err != nil {
					result["error"] = err.Error()
					errors = append(errors, fmt.Sprintf("Failed to move %s: %v", path, err))
				} else {
					result["status"] = "moved"
					result["destination"] = destPath
				}
			} else { // copy
				err = copyPath(safePath, destPath, sourceInfo.IsDir())
				if err != nil {
					result["error"] = err.Error()
					errors = append(errors, fmt.Sprintf("Failed to copy %s: %v", path, err))
				} else {
					result["status"] = "copied"
					result["destination"] = destPath
				}
			}

		default:
			result["error"] = "Unsupported operation: " + req.Operation
			errors = append(errors, fmt.Sprintf("Unsupported operation for %s", path))
		}

		results = append(results, result)
	}

	response := map[string]interface{}{
		"results": results,
		"total":   len(req.Paths),
		"success": len(req.Paths) - len(errors),
		"errors":  len(errors),
	}

	if len(errors) > 0 {
		response["errorMessages"] = errors
	}

	json.NewEncoder(w).Encode(response)
}

// Helper functions
func copyPath(src, dst string, isDir bool) error {
	if isDir {
		return copyDir(src, dst)
	}
	return copyFile(src, dst)
}

func copyFile(src, dst string) error {
	source, err := os.Open(src)
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destination.Close()

	_, err = destination.ReadFrom(source)
	return err
}

func copyDir(src, dst string) error {
	source, err := os.Stat(src)
	if err != nil {
		return err
	}

	err = os.MkdirAll(dst, source.Mode())
	if err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			err = copyDir(srcPath, dstPath)
		} else {
			err = copyFile(srcPath, dstPath)
		}

		if err != nil {
			return err
		}
	}

	return nil
}

func deletePath(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}

	if info.IsDir() {
		return os.RemoveAll(path)
	}
	return os.Remove(path)
}
func searchInFiles(path string, query string) ([]string, error) {
	var results []string
	query = strings.ToLower(query)

	err := filepath.Walk(path, func(filePath string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			// Skip hidden directories (like .git)
			if strings.HasPrefix(info.Name(), ".") && info.Name() != "." {
				return filepath.SkipDir
			}
			return nil
		}

		// Only search in text files
		ext := strings.ToLower(filepath.Ext(filePath))
		if !isTextFile(ext) {
			return nil
		}

		content, err := os.ReadFile(filePath)
		if err != nil {
			return nil // Skip unreadable files
		}

		if strings.Contains(strings.ToLower(string(content)), query) {
			// Found a match, add to results with a small context
			results = append(results, fmt.Sprintf("Match in %s", filePath))
		}

		// Limit results to 50 for performance
		if len(results) >= 50 {
			return filepath.SkipAll
		}

		return nil
	})

	return results, err
}

func isTextFile(ext string) bool {
	textExts := map[string]bool{
		".txt": true, ".md": true, ".go": true, ".js": true, ".ts": true,
		".tsx": true, ".jsx": true, ".json": true, ".yaml": true, ".yml": true,
		".html": true, ".css": true, ".py": true, ".c": true, ".cpp": true,
		".h": true, ".rs": true, ".sh": true, ".ps1": true,
	}
	return textExts[ext]
}
