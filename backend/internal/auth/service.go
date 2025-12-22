package auth

import (
	"database/sql"
	"errors"
	"time"

	"github.com/yourusername/svara/internal/config"
	"github.com/yourusername/svara/pkg/utils"
)

type Service struct {
	db     *sql.DB
	config *config.Config
}

func NewService(db *sql.DB, cfg *config.Config) *Service {
	return &Service{
		db:     db,
		config: cfg,
	}
}

func (s *Service) Register(req RegisterRequest) (*AuthResponse, error) {
	// Validate input
	if req.Phone == "" && req.Email == "" {
		return nil, errors.New("phone or email is required")
	}

	if req.Phone != "" {
		req.Phone = utils.NormalizePhone(req.Phone)
		if !utils.ValidatePhone(req.Phone) {
			return nil, errors.New("invalid phone number")
		}
	}

	if req.Email != "" && !utils.ValidateEmail(req.Email) {
		return nil, errors.New("invalid email address")
	}

	if !utils.ValidatePassword(req.Password) {
		return nil, errors.New("password must be at least 8 characters")
	}

	// Hash password
	passwordHash, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	// Prepare values for database
	var phone, email interface{}
	if req.Phone != "" {
		phone = req.Phone
	}
	if req.Email != "" {
		email = req.Email
	}

	// Insert user
	result, err := s.db.Exec(
		`INSERT INTO users (phone, email, password_hash, name, status, created_at) 
		 VALUES (?, ?, ?, ?, 'offline', ?)`,
		phone, email, passwordHash, req.Name, time.Now(),
	)
	if err != nil {
		return nil, errors.New("user already exists or database error")
	}

	userID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	// Get created user
	user, err := s.getUserByID(int(userID))
	if err != nil {
		return nil, err
	}

	// Generate tokens
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.generateRefreshToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		User:         *user,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *Service) Login(req LoginRequest) (*AuthResponse, error) {
	// Validate input
	if req.Phone == "" && req.Email == "" {
		return nil, errors.New("phone or email is required")
	}

	var user *User
	var err error

	if req.Phone != "" {
		req.Phone = utils.NormalizePhone(req.Phone)
		user, err = s.getUserByPhone(req.Phone)
	} else {
		user, err = s.getUserByEmail(req.Email)
	}

	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	// Check password
	if !utils.CheckPassword(req.Password, user.PasswordHash) {
		return nil, errors.New("invalid credentials")
	}

	// Generate tokens
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.generateRefreshToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		User:         *user,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *Service) getUserByID(id int) (*User, error) {
	user := &User{}
	err := s.db.QueryRow(
		`SELECT id, phone, email, password_hash, name, avatar_url, status, last_seen, created_at 
		 FROM users WHERE id = ?`,
		id,
	).Scan(&user.ID, &user.Phone, &user.Email, &user.PasswordHash, &user.Name, &user.AvatarURL, &user.Status, &user.LastSeen, &user.CreatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *Service) getUserByPhone(phone string) (*User, error) {
	user := &User{}
	err := s.db.QueryRow(
		`SELECT id, phone, email, password_hash, name, avatar_url, status, last_seen, created_at 
		 FROM users WHERE phone = ?`,
		phone,
	).Scan(&user.ID, &user.Phone, &user.Email, &user.PasswordHash, &user.Name, &user.AvatarURL, &user.Status, &user.LastSeen, &user.CreatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *Service) getUserByEmail(email string) (*User, error) {
	user := &User{}
	err := s.db.QueryRow(
		`SELECT id, phone, email, password_hash, name, avatar_url, status, last_seen, created_at 
		 FROM users WHERE email = ?`,
		email,
	).Scan(&user.ID, &user.Phone, &user.Email, &user.PasswordHash, &user.Name, &user.AvatarURL, &user.Status, &user.LastSeen, &user.CreatedAt)

	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *Service) generateAccessToken(user *User) (string, error) {
	email := ""
	if user.Email != nil {
		email = *user.Email
	}
	phone := ""
	if user.Phone != nil {
		phone = *user.Phone
	}
	return utils.GenerateToken(user.ID, email, phone, s.config.JWTSecret, s.config.JWTExpiry)
}

func (s *Service) generateRefreshToken(user *User) (string, error) {
	email := ""
	if user.Email != nil {
		email = *user.Email
	}
	phone := ""
	if user.Phone != nil {
		phone = *user.Phone
	}
	return utils.GenerateToken(user.ID, email, phone, s.config.JWTSecret, s.config.RefreshTokenExpiry)
}
