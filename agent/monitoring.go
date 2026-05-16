package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for local dev
	},
}


// SystemMetrics represents real-time system metrics
type SystemMetrics struct {
	Timestamp    time.Time        `json:"timestamp"`
	CPU         CPUMetrics       `json:"cpu"`
	Memory      MemoryMetrics    `json:"memory"`
	Disk        []DiskMetrics    `json:"disk"`
	Network     NetworkMetrics   `json:"network"`
	Processes   []ProcessMetrics `json:"processes"`
	Uptime      string           `json:"uptime"`
	LoadAverage []float64        `json:"loadAverage"`
}

// CPUMetrics represents CPU usage metrics
type CPUMetrics struct {
	Overall   float64            `json:"overall"`   // Overall CPU usage percentage
	Cores     []CoreMetrics      `json:"cores"`     // Per-core usage
	Frequency float64            `json:"frequency"` // CPU frequency in MHz
	Temperature float64          `json:"temperature"` // CPU temperature in Celsius
}

// CoreMetrics represents individual CPU core metrics
type CoreMetrics struct {
	ID    int     `json:"id"`
	Usage float64 `json:"usage"`
}

// MemoryMetrics represents memory usage metrics
type MemoryMetrics struct {
	Total     uint64  `json:"total"`     // Total memory in bytes
	Used      uint64  `json:"used"`      // Used memory in bytes
	Available uint64  `json:"available"` // Available memory in bytes
	Usage     float64 `json:"usage"`     // Usage percentage
	Swap      SwapMetrics `json:"swap"`
}

// SwapMetrics represents swap memory metrics
type SwapMetrics struct {
	Total uint64  `json:"total"`
	Used  uint64  `json:"used"`
	Usage float64 `json:"usage"`
}

// DiskMetrics represents disk usage metrics
type DiskMetrics struct {
	Drive      string  `json:"drive"`      // Drive letter or mount point
	Total      uint64  `json:"total"`      // Total space in bytes
	Used       uint64  `json:"used"`       // Used space in bytes
	Available  uint64  `json:"available"`  // Available space in bytes
	Usage      float64 `json:"usage"`      // Usage percentage
	Filesystem string  `json:"filesystem"` // Filesystem type
	MountPoint string  `json:"mountPoint"` // Mount point
	ReadOps    uint64  `json:"readOps"`    // Read operations
	WriteOps   uint64  `json:"writeOps"`   // Write operations
}

// NetworkMetrics represents network metrics
type NetworkMetrics struct {
	Interfaces []NetworkInterface `json:"interfaces"`
	Bandwidth  BandwidthMetrics    `json:"bandwidth"`
	Connections int               `json:"connections"`
}

// NetworkInterface represents a network interface
type NetworkInterface struct {
	Name      string  `json:"name"`
	Status    string  `json:"status"`    // Up/Down
	Sent      uint64  `json:"sent"`      // Bytes sent
	Received  uint64  `json:"received"`  // Bytes received
	PacketsIn uint64  `json:"packetsIn"` // Packets received
	PacketsOut uint64 `json:"packetsOut"` // Packets sent
}

// BandwidthMetrics represents current bandwidth usage
type BandwidthMetrics struct {
	Download float64 `json:"download"` // Mbps
	Upload   float64 `json:"upload"`   // Mbps
}

// ProcessMetrics represents process metrics
type ProcessMetrics struct {
	PID        int     `json:"pid"`
	Name       string  `json:"name"`
	CPU        float64 `json:"cpu"`        // CPU usage percentage
	Memory     uint64  `json:"memory"`     // Memory usage in bytes
	StartTime  string  `json:"startTime"`  // Process start time
	Status     string  `json:"status"`     // Process status
}

// Metrics history storage (in-memory, could be moved to database)
var metricsHistory []SystemMetrics
var maxHistorySize = 1000 // Keep last 1000 data points

func handleSystemMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	metrics, err := collectSystemMetrics()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to collect metrics: %v", err), http.StatusInternalServerError)
		return
	}

	// Add to history
	metricsHistory = append(metricsHistory, *metrics)
	if len(metricsHistory) > maxHistorySize {
		metricsHistory = metricsHistory[1:]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

func handleSystemMetricsHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get query parameters
	limit := r.URL.Query().Get("limit")
	duration := r.URL.Query().Get("duration") // in minutes

	var filteredHistory []SystemMetrics

	// Apply duration filter
	if duration != "" {
		minutes, err := time.ParseDuration(duration + "m")
		if err == nil {
			cutoff := time.Now().Add(-minutes)
			for _, metric := range metricsHistory {
				if metric.Timestamp.After(cutoff) {
					filteredHistory = append(filteredHistory, metric)
				}
			}
		}
	} else {
		filteredHistory = metricsHistory
	}

	// Apply limit filter
	if limit != "" {
		var limitInt int
		_, err := fmt.Sscanf(limit, "%d", &limitInt)
		if err == nil && limitInt > 0 && len(filteredHistory) > limitInt {
			filteredHistory = filteredHistory[len(filteredHistory)-limitInt:]
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"history": filteredHistory,
		"total":   len(filteredHistory),
	})
}

func collectSystemMetrics() (*SystemMetrics, error) {
	metrics := &SystemMetrics{
		Timestamp: time.Now(),
	}

	// Collect CPU metrics
	cpuMetrics, err := collectCPUMetrics()
	if err != nil {
		return nil, fmt.Errorf("failed to collect CPU metrics: %v", err)
	}
	metrics.CPU = *cpuMetrics

	// Collect memory metrics
	memoryMetrics, err := collectMemoryMetrics()
	if err != nil {
		return nil, fmt.Errorf("failed to collect memory metrics: %v", err)
	}
	metrics.Memory = *memoryMetrics

	// Collect disk metrics
	diskMetrics, err := collectDiskMetrics()
	if err != nil {
		return nil, fmt.Errorf("failed to collect disk metrics: %v", err)
	}
	metrics.Disk = diskMetrics

	// Collect network metrics
	networkMetrics, err := collectNetworkMetrics()
	if err != nil {
		return nil, fmt.Errorf("failed to collect network metrics: %v", err)
	}
	metrics.Network = *networkMetrics

	// Collect process metrics
	processMetrics, err := collectProcessMetrics()
	if err != nil {
		return nil, fmt.Errorf("failed to collect process metrics: %v", err)
	}
	metrics.Processes = processMetrics

	// Get system uptime
	metrics.Uptime = getSystemUptime()

	// Get load average (Unix-like systems)
	metrics.LoadAverage = getLoadAverage()

	return metrics, nil
}

func collectCPUMetrics() (*CPUMetrics, error) {
	percentages, err := cpu.Percent(time.Second, true)
	if err != nil {
		return nil, err
	}

	overall, err := cpu.Percent(time.Second, false)
	if err != nil {
		return nil, err
	}

	metrics := &CPUMetrics{
		Overall: overall[0],
		Cores:   make([]CoreMetrics, len(percentages)),
	}

	for i, p := range percentages {
		metrics.Cores[i] = CoreMetrics{
			ID:    i,
			Usage: p,
		}
	}

	// Get frequency
	info, err := cpu.Info()
	if err == nil && len(info) > 0 {
		metrics.Frequency = info[0].Mhz
	}

	return metrics, nil
}


func collectMemoryMetrics() (*MemoryMetrics, error) {
	v, err := mem.VirtualMemory()
	if err != nil {
		return nil, err
	}

	memory := &MemoryMetrics{
		Total:     v.Total,
		Used:      v.Used,
		Available: v.Available,
		Usage:     v.UsedPercent,
	}

	s, err := mem.SwapMemory()
	if err == nil {
		memory.Swap = SwapMetrics{
			Total: s.Total,
			Used:  s.Used,
			Usage: s.UsedPercent,
		}
	}

	return memory, nil
}


func collectDiskMetrics() ([]DiskMetrics, error) {
	partitions, err := disk.Partitions(false)
	if err != nil {
		return nil, err
	}

	var results []DiskMetrics
	for _, p := range partitions {
		usage, err := disk.Usage(p.Mountpoint)
		if err != nil {
			continue
		}

		io, err := disk.IOCounters(p.Device)
		var readOps, writeOps uint64
		if err == nil {
			if stats, exists := io[p.Device]; exists {
				readOps = stats.ReadCount
				writeOps = stats.WriteCount
			}
		}

		results = append(results, DiskMetrics{
			Drive:      p.Device,
			Total:      usage.Total,
			Used:       usage.Used,
			Available:  usage.Free,
			Usage:      usage.UsedPercent,
			Filesystem: p.Fstype,
			MountPoint: p.Mountpoint,
			ReadOps:    readOps,
			WriteOps:   writeOps,
		})
	}

	return results, nil
}


func collectNetworkMetrics() (*NetworkMetrics, error) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	metrics := &NetworkMetrics{
		Interfaces: make([]NetworkInterface, 0),
	}

	for _, i := range interfaces {
		metrics.Interfaces = append(metrics.Interfaces, NetworkInterface{
			Name:   i.Name,
			Status: "Active",
		})
	}

	// Calculate bandwidth (simplified for now, would need delta over time)
	io, err := net.IOCounters(false)
	if err == nil && len(io) > 0 {
		// Just a snapshot for now
	}

	return metrics, nil
}


func collectProcessMetrics() ([]ProcessMetrics, error) {
	processes, err := process.Processes()
	if err != nil {
		return nil, err
	}

	var results []ProcessMetrics
	// Limit to top 20 processes by CPU for performance
	for i, p := range processes {
		if i > 50 { // Scan first 50 to find high usage ones
			break
		}
		name, _ := p.Name()
		cpuPercent, _ := p.CPUPercent()
		memInfo, _ := p.MemoryInfo()
		status, _ := p.Status()
		createTime, _ := p.CreateTime()

		results = append(results, ProcessMetrics{
			PID:       int(p.Pid),
			Name:      name,
			CPU:       cpuPercent,
			Memory:    memInfo.RSS,
			StartTime: time.Unix(createTime/1000, 0).Format(time.RFC3339),
			Status:    status[0],
		})
	}

	return results, nil
}


func getSystemUptime() string {
	u, err := host.Uptime()
	if err != nil {
		return "Unknown"
	}
	duration := time.Duration(u) * time.Second
	return duration.String()
}

func getLoadAverage() []float64 {
	avg, err := cpu.Counts(true)
	if err != nil {
		return []float64{0, 0, 0}
	}
	// On Windows, gopsutil might not return load average like Unix
	// Returning dummy for now if not available
	return []float64{float64(avg), 0, 0}
}


// WebSocket handler for real-time metrics streaming
func handleSystemMetricsWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("System metrics WebSocket connected")

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			metrics, err := collectSystemMetrics()
			if err != nil {
				log.Printf("Failed to collect metrics: %v", err)
				continue
			}

			if err := conn.WriteJSON(metrics); err != nil {
				log.Printf("WebSocket write failed: %v", err)
				return
			}
		case <-r.Context().Done():
			return
		}
	}
}

