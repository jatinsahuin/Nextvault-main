-- Ticket #010H: Secure Authentication
-- Add password field to users table
ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL;

-- Ensure email is indexed for fast login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
