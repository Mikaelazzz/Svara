package utils

import (
	"regexp"
	"strings"
)

var (
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	phoneRegex = regexp.MustCompile(`^\+?[1-9]\d{1,14}$`) // E.164 format
)

// ValidateEmail checks if email is valid
func ValidateEmail(email string) bool {
	return emailRegex.MatchString(email)
}

// ValidatePhone checks if phone number is valid
func ValidatePhone(phone string) bool {
	// Remove spaces and dashes
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	return phoneRegex.MatchString(phone)
}

// ValidatePassword checks if password meets requirements
func ValidatePassword(password string) bool {
	// Minimum 8 characters
	return len(password) >= 8
}

// NormalizePhone removes spaces and dashes from phone number
func NormalizePhone(phone string) string {
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	return phone
}
