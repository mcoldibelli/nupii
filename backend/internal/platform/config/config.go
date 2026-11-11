// Package config reads the configuration of the API from environment
// variables and validates it.
package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
)

const (
	_defaultHTTPAddr = ":8080"
	// _demoProjectPrefix is the prefix of a Firebase project that exists
	// only in the emulators.
	_demoProjectPrefix = "demo-"
)

// Config is the configuration of the API process.
type Config struct {
	// HTTPAddr is the address the HTTP server listens on, as host:port.
	HTTPAddr string
	// DatabaseURL is the connection URL of the Postgres database. It has
	// the password, so it must not be written to the log.
	DatabaseURL string
	// FirebaseProjectID is the identifier of the Firebase project whose ID
	// tokens the API accepts.
	FirebaseProjectID string
	// FirebaseAuthEmulatorHost is the host:port of the Authentication
	// emulator, or empty. The Firebase Admin SDK reads this variable from
	// the environment by itself. The API reads it only to write a warning.
	FirebaseAuthEmulatorHost string
}

// Load reads the configuration with getenv and validates it. The caller
// must not start the process when Load returns an error.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		HTTPAddr:    _defaultHTTPAddr,
		DatabaseURL: getenv("DATABASE_URL"),

		FirebaseProjectID:        getenv("FIREBASE_PROJECT_ID"),
		FirebaseAuthEmulatorHost: getenv("FIREBASE_AUTH_EMULATOR_HOST"),
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
	if cfg.FirebaseProjectID == "" {
		return Config{}, errors.New("FIREBASE_PROJECT_ID: the variable is not set")
	}
	// With the emulator, the ID tokens have no signature. The emulator is
	// accepted only with a demonstration project, so a real project never
	// runs with tokens that are not verified.
	if cfg.FirebaseAuthEmulatorHost != "" && !strings.HasPrefix(cfg.FirebaseProjectID, _demoProjectPrefix) {
		return Config{}, fmt.Errorf(
			"FIREBASE_AUTH_EMULATOR_HOST: the emulator needs a FIREBASE_PROJECT_ID that starts with %q",
			_demoProjectPrefix)
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
		// url.Parse returns a *url.Error that has the full URL. Only its
		// cause is wrapped, because the URL has the password.
		if urlErr, ok := errors.AsType[*url.Error](err); ok {
			err = urlErr.Err
		}
		return fmt.Errorf("parse URL: %w", err)
	}
	if u.Scheme != "postgres" && u.Scheme != "postgresql" {
		return errors.New(`the scheme of the URL must be "postgres" or "postgresql"`)
	}
	return nil
}
