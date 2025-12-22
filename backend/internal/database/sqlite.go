package database

import (
	"database/sql"
	"embed"
	"fmt"
	"log"
	"sort"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type Database struct {
	DB *sql.DB
}

func New(dbPath string) (*Database, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Enable foreign keys
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	// Set connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)

	return &Database{DB: db}, nil
}

func (d *Database) RunMigrations() error {
	// Read all migration files
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	// Sort migration files by name
	var migrations []string
	for _, entry := range entries {
		if !entry.IsDir() {
			migrations = append(migrations, entry.Name())
		}
	}
	sort.Strings(migrations)

	// Execute each migration
	for _, migration := range migrations {
		log.Printf("Running migration: %s", migration)

		content, err := migrationsFS.ReadFile("migrations/" + migration)
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", migration, err)
		}

		if _, err := d.DB.Exec(string(content)); err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", migration, err)
		}
	}

	log.Println("All migrations completed successfully")
	return nil
}

func (d *Database) Close() error {
	return d.DB.Close()
}

func (d *Database) Ping() error {
	return d.DB.Ping()
}
