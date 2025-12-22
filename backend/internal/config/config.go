package config

import (
	"log"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	JWTSecret          string
	JWTExpiry          time.Duration
	RefreshTokenExpiry time.Duration
	DatabasePath       string
	AllowedOrigins     []string
}

func Load() *Config {
	// Load .env file if exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	return &Config{
		Port:               getEnv("PORT", "8080"),
		JWTSecret:          getEnv("JWT_SECRET", "default-secret-change-in-production"),
		JWTExpiry:          parseDuration(getEnv("JWT_EXPIRY", "24h")),
		RefreshTokenExpiry: parseDuration(getEnv("REFRESH_TOKEN_EXPIRY", "168h")),
		DatabasePath:       getEnv("DATABASE_PATH", "./svara.db"),
		AllowedOrigins:     []string{getEnv("ALLOWED_ORIGINS", "http://localhost:3000")},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		log.Printf("Invalid duration %s, using default 24h", s)
		return 24 * time.Hour
	}
	return d
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}
