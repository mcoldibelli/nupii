// Package config reads the configuration of the API from environment
// variables and validates it.
package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"
)

const defaultHTTPAddr = ":8080"

// Config is the configuration of the API process.
type Config struct {
	// HTTPAddr is the address the HTTP server listens on, as host:port.
	HTTPAddr string
	// DatabaseURL is the connection URL of the Postgres database. It has
	// the password, so it must not be written to the log.
	DatabaseURL string
}

// Load reads the configuration with getenv and validates it. The caller
// must not start the process when Load returns an error.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		HTTPAddr:    defaultHTTPAddr,
		DatabaseURL: getenv("DATABASE_URL"),
	}
	if addr := getenv("HTTP_ADDR"); addr != "" {
		cfg.HTTPAddr = addr
	}
	if err := validateAddr(cfg.HTTPAddr); err != nil {
		return Config{}, fmt.Errorf("HTTP_ADDR %q: %w", cfg.HTTPAddr, err)
	}
	// The error does not have the value of the variable: it has a password.
	if err := validateDatabaseURL(cfg.DatabaseURL); err != nil {
		return Config{}, fmt.Errorf("DATABASE_URL: %w", err)
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

func validateDatabaseURL(raw string) error {
	if raw == "" {
		return errors.New("the variable is not set")
	}
	u, err := url.Parse(raw)
	if err != nil {
		// The error of url.Parse has the full URL, so it is not wrapped.
		return errors.New("the value is not a URL")
	}
	if u.Scheme != "postgres" && u.Scheme != "postgresql" {
		return errors.New(`the scheme of the URL must be "postgres" or "postgresql"`)
	}
	return nil
}
