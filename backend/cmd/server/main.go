package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/yourusername/svara/internal/auth"
	"github.com/yourusername/svara/internal/chat"
	"github.com/yourusername/svara/internal/config"
	"github.com/yourusername/svara/internal/database"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.New(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Run migrations
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		if err := db.RunMigrations(); err != nil {
			log.Fatalf("Failed to run migrations: %v", err)
		}
		log.Println("Migrations completed successfully")
		return
	}

	// Initialize services
	authService := auth.NewService(db.DB, cfg)

	// Initialize chat hub
	hub := chat.NewHub(db.DB)
	go hub.Run()

	// Initialize handlers
	authHandler := auth.NewHandler(authService)
	chatHandler := chat.NewHandler(hub, db.DB)

	// Setup router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Routes
	r.Route("/api", func(r chi.Router) {
		// Health check
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("OK"))
		})

		// Auth routes (public)
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(auth.AuthMiddleware(cfg))

			// Chat routes
			r.Route("/chat", func(r chi.Router) {
				r.Get("/messages", chatHandler.GetMessages)
				r.Get("/conversations", chatHandler.GetConversations)
				r.Get("/search", chatHandler.SearchUsers)
				r.Delete("/conversations/{userId}", chatHandler.DeleteConversation)
			})
		})
	})

	// WebSocket routes (protected with auth middleware)
	r.Route("/ws", func(r chi.Router) {
		r.Use(auth.AuthMiddleware(cfg))
		r.Get("/chat", chatHandler.HandleWebSocket)
	})

	// Start server
	log.Printf("Server starting on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
