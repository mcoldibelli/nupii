// Package config reads the configuration of the API from environment
// variables and validates it.
package config

import (
	"fmt"
	"net"
	"strconv"
)

const defaultHTTPAddr = ":8080"

// Config is the configuration of the API process.
type Config struct {
	// HTTPAddr is the address the HTTP server listens on, as host:port.
	HTTPAddr string
}

// Load reads the configuration with getenv and validates it. The caller
// must not start the process when Load returns an error.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{HTTPAddr: defaultHTTPAddr}
	if addr := getenv("HTTP_ADDR"); addr != "" {
		cfg.HTTPAddr = addr
	}
	if err := validateAddr(cfg.HTTPAddr); err != nil {
		return Config{}, fmt.Errorf("HTTP_ADDR %q: %w", cfg.HTTPAddr, err)
	}
	return cfg, nil
}

func validateAddr(addr string) error {
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("split host and port: %w", err)
	}
	if _, err := strconv.ParseUint(port, 10, 16); err != nil {
		return fmt.Errorf("parse port: %w", err)
	}
	return nil
}
