// Setup global de tests.
// JWT_SECRET debe existir ANTES de importar @/lib/auth (el módulo lanza si falta).
process.env.JWT_SECRET = 'test-secret-solo-para-tests-0123456789abcdef0123456789abcdef'
